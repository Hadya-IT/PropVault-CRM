// One-time (re-runnable) import of Capsule CRM opportunities into Hadya CRM, before Capsule is retired.
// Reads Capsule API v2 (read-only) with your own Capsule token, writes Oracle through the normal .env connection.
//
//   1. Capsule → avatar → My Preferences → API Authentication Tokens → Generate. Put it in server\.env:
//        CAPSULE_TOKEN="...."
//   2. Run db\03_capsule_ddl.sql and db\04_capsule_pipelines.sql first (stages must exist).
//   3. node scripts/import-capsule.js --dry      (fetches + shows counts, writes nothing)
//      node scripts/import-capsule.js            (writes)
//      add --no-activities to skip notes/emails/tasks.
//
// Idempotent: rows are matched on SOURCE='CAPSULE' + EXTERNAL_ID, so running it again updates instead of duplicating.
import 'dotenv/config';
import oracledb from 'oracledb';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';

// Capsule pipeline name → where it lands in Hadya CRM. Pipelines not listed (HOMCO Sales, AFCO) are skipped.
const PIPELINES = {
  'JS Lease Pipeline':          { entity: 'JS',  pipeline: 'lease',  category: 'Office' },
  'JS Retail Pipeline':         { entity: 'JS',  pipeline: 'retail', category: 'Retail' },
  'Residential Lease Pipeline': { entity: 'SLO', pipeline: 'lease',  category: 'Apartment' },
  'Gravita Lease Pipeline':     { entity: 'GRV', pipeline: 'lease',  category: null },
};
const API = 'https://api.capsulecrm.com/api/v2';
const ACTIVITY_TYPES = new Set(['call', 'email', 'meeting', 'note', 'task', 'whatsapp', 'visit']);

const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry');
const WITH_ACTIVITIES = !args.has('--no-activities');
const REFRESH = args.has('--refresh');
// Capsule data is cached locally for 24h so a failed DB write does not cost another ~2,000 Capsule calls.
// The cache holds customer data: it lives in server/.cache (git-ignored) — delete it after the import.
const CACHE = new URL('../.cache/capsule.json', import.meta.url);
const token = process.env.CAPSULE_TOKEN;
if (!token) { console.error('CAPSULE_TOKEN is missing in server\\.env (see the top of this file).'); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let calls = 0;
async function cap(path) {
  for (let attempt = 1; ; attempt++) {
    calls++;
    if (calls > 1) await sleep(250);
    const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    if (res.status === 429 || res.status >= 500) {
      // Capsule allows a fixed number of calls per hour; when it is used up we wait for the window to reset (up to ~70 min).
      if (attempt > 40) throw new Error(`Capsule ${res.status} on ${path} (gave up after waiting)`);
      const retryAfter = Number(res.headers.get('retry-after'));
      const reset = Number(res.headers.get('x-ratelimit-reset'));
      let wait = retryAfter > 0 ? retryAfter * 1000
        : reset > 1e9 ? reset * 1000 - Date.now()
        : reset > 0 ? reset * 1000
        : Math.min(120000, 15000 * attempt);
      wait = Math.max(5000, Math.min(wait + 1000, 15 * 60000));
      console.log(`  Capsule rate limit (${res.status}) — waiting ${Math.round(wait / 1000)}s (try ${attempt}/40)…`);
      await sleep(wait); continue;
    }
    if (res.status === 401) throw new Error('Capsule rejected the token (401). Generate a new one and update CAPSULE_TOKEN.');
    if (!res.ok) throw new Error(`Capsule ${res.status} on ${path}: ${(await res.text()).slice(0, 200)}`);
    return res.json();
  }
}
async function capAll(path, key) {
  const out = [];
  for (let page = 1; ; page++) {
    const sep = path.includes('?') ? '&' : '?';
    const j = await cap(`${path}${sep}perPage=100&page=${page}`);
    const rows = j[key] || [];
    out.push(...rows);
    if (rows.length < 100) return out;
  }
}

// Oracle VARCHAR2 limits are in BYTES; Arabic text is 2-3 bytes per character, so cut by UTF-8 bytes.
const clip = (s, n) => {
  if (s == null) return null;
  let t = String(s);
  if (Buffer.byteLength(t, 'utf8') <= n) return t;
  t = Buffer.from(t, 'utf8').subarray(0, n).toString('utf8');
  while (Buffer.byteLength(t, 'utf8') > n || t.endsWith('\uFFFD')) t = t.slice(0, -1);
  return t;
};
const partyName = (p) => (p ? (p.type === 'organisation' ? p.name : [p.firstName, p.lastName].filter(Boolean).join(' ') || p.name) : null);
const toDate = (s) => (s ? new Date(s) : null);
const lostReasonOf = (o) => (typeof o.lostReason === 'string' ? o.lostReason : o.lostReason?.name) || null;

async function fetchCapsule() {
  console.log('Reading Capsule…');
  const { pipelines } = await cap('/pipelines');
  const milestonePipe = new Map(); // milestone id → pipeline name
  const pipeMilestones = {};
  for (const p of pipelines) {
    const { milestones } = await cap(`/pipelines/${p.id}/milestones`);
    pipeMilestones[p.name] = milestones.map((m) => m.name);
    for (const m of milestones) milestonePipe.set(m.id, p.name);
  }

  const opps = await capAll('/opportunities?embed=tags,fields', 'opportunities');
  const users = await capAll('/users?embed=party', 'users').catch(() => []);
  const userEmail = new Map(users.map((u) => [u.id, (u.party?.emailAddresses?.[0]?.address || '').toLowerCase()]));

  const inScope = [];
  const skipped = {};
  for (const o of opps) {
    const pName = o.pipeline?.name || milestonePipe.get(o.milestone?.id) || milestonePipe.get(o.lastOpenMilestone?.id);
    const target = PIPELINES[pName];
    if (!target) { skipped[pName || '(no pipeline)'] = (skipped[pName || '(no pipeline)'] || 0) + 1; continue; }
    inScope.push({ o, pName, target });
  }

  // Parties linked to the in-scope opportunities only (not all 9k contacts)
  const partyIds = [...new Set(inScope.map((x) => x.o.party?.id).filter(Boolean))];
  const parties = new Map();
  for (let i = 0; i < partyIds.length; i += 10) {
    const chunk = partyIds.slice(i, i + 10);
    const j = await cap(`/parties/${chunk.join(',')}?embed=tags`);
    for (const p of j.parties || (j.party ? [j.party] : [])) parties.set(p.id, p);
  }

  const entries = new Map(); // opp id → entries[]
  let tasks = [];
  if (WITH_ACTIVITIES) {
    let n = 0;
    for (const { o } of inScope) {
      entries.set(o.id, await capAll(`/opportunities/${o.id}/entries?embed=activityType`, 'entries'));
      if (++n % 25 === 0) console.log(`  notes/emails: ${n}/${inScope.length} opportunities`);
    }
    const ids = new Set(inScope.map((x) => x.o.id));
    for (const status of ['open', 'completed']) {
      const t = await capAll(`/tasks?status=${status}`, 'tasks');
      tasks.push(...t.filter((x) => x.opportunity && ids.has(x.opportunity.id)));
    }
  }
  return { pipelines, pipeMilestones, inScope, skipped, parties, entries, tasks, userEmail, total: opps.length };
}

async function loadData() {
  if (!REFRESH && existsSync(CACHE) && Date.now() - statSync(CACHE).mtimeMs < 24 * 3600e3) {
    const c = JSON.parse(readFileSync(CACHE, 'utf8'));
    if (!WITH_ACTIVITIES || c.withActivities) {
      console.log('Using cached Capsule data (server/.cache/capsule.json). Add --refresh to read Capsule again.');
      return { ...c, parties: new Map(c.parties), entries: new Map(c.entries), userEmail: new Map(c.userEmail) };
    }
  }
  const d = await fetchCapsule();
  mkdirSync(new URL('../.cache/', import.meta.url), { recursive: true });
  writeFileSync(CACHE, JSON.stringify({ ...d, withActivities: WITH_ACTIVITIES, parties: [...d.parties], entries: [...d.entries], userEmail: [...d.userEmail] }));
  return d;
}

async function main() {
  const data = await loadData();
  const { inScope, parties, entries, tasks } = data;

  console.log(`\nCapsule opportunities: ${data.total} total, ${inScope.length} in scope.`);
  if (Object.keys(data.skipped).length) console.log('Skipped (pipeline not mapped):', data.skipped);
  const summary = {};
  for (const { o, pName } of inScope) {
    const k = pName; summary[k] ??= { open: 0, won: 0, lost: 0, value: 0 };
    const m = (o.milestone?.name || '').toLowerCase();
    if (m === 'won') summary[k].won++; else if (m === 'lost') summary[k].lost++; else summary[k].open++;
    summary[k].value += Number(o.value?.amount || 0);
  }
  console.table(summary);
  console.log(`Contacts linked: ${parties.size} · notes/emails: ${[...entries.values()].reduce((a, e) => a + e.length, 0)} · tasks: ${tasks.length} · Capsule API calls: ${calls}`);
  for (const [p, ms] of Object.entries(data.pipeMilestones)) console.log(`  ${p}: ${ms.join(' › ')}`);
  if (DRY) { console.log('\nDry run: nothing written.'); return; }

  const conn = await oracledb.getConnection({
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, connectString: process.env.DB_CONNECT_STRING,
    configDir: process.env.DB_WALLET_DIR, walletLocation: process.env.DB_WALLET_DIR, walletPassword: process.env.DB_WALLET_PASSWORD,
    connectTimeout: 20,
  });
  try {
    const { rows: ents } = await conn.execute(`SELECT code, id FROM entities WHERE code IN ('JS','SLO','GRV')`);
    const entityId = Object.fromEntries(ents);
    const { rows: stRows } = await conn.execute(
      `SELECT entity_id, pipeline_code, LOWER(name), id FROM entity_stages WHERE active = 1 AND pipeline_code <> 'default'`);
    const stageId = new Map(stRows.map(([e, p, n, id]) => [`${e}|${p}|${n}`, id]));
    if (!stRows.length) throw new Error('Capsule stages not found — run db/04_capsule_pipelines.sql first.');
    const { rows: uRows } = await conn.execute(`SELECT LOWER(email), LOWER(display_name), id FROM app_users WHERE active = 1`);
    const userByEmail = new Map(uRows.map(([em, , id]) => [em, id]));
    const userByName = new Map(uRows.map(([, nm, id]) => [nm, id]));
    const userOf = (u) => (u ? userByEmail.get(data.userEmail.get(u.id)) ?? userByName.get(String(u.name || '').toLowerCase()) ?? null : null);

    // 1. Contacts — reuse an existing contact (e.g. a D365 tenant) with the same name in the same entity.
    const { rows: existing } = await conn.execute(
      `SELECT entity_id, LOWER(name), id FROM contacts WHERE deleted_at IS NULL AND source <> 'CAPSULE'`);
    const byName = new Map(existing.map(([e, n, id]) => [`${e}|${n}`, id]));
    const contactRows = [];
    const contactLink = new Map(); // `${entity}|${partyId}` → existing contact id
    for (const { o, target } of inScope) {
      const p = parties.get(o.party?.id); if (!p) continue;
      const e = entityId[target.entity];
      const key = `${e}|${p.id}`;
      if (contactLink.has(key) || contactRows.some((r) => r.e === e && r.x === String(p.id))) continue;
      const hit = byName.get(`${e}|${String(partyName(p) || '').toLowerCase()}`);
      if (hit) { contactLink.set(key, hit); continue; }
      contactRows.push({
        e, x: String(p.id), t: p.type === 'organisation' ? 'company' : 'person', n: clip(partyName(p) || 'Unnamed', 200),
        co: clip(p.organisation?.name || null, 200),
        em: clip(p.emailAddresses?.[0]?.address || null, 200), ph: clip(p.phoneNumbers?.[0]?.number || null, 40),
        tags: JSON.stringify((p.tags || []).map((t) => t.name)),
        attrs: JSON.stringify({ capsule: { id: p.id, about: clip(p.about, 1000), website: p.websites?.[0]?.address || null, jobTitle: p.jobTitle || null } }),
      });
    }
    if (contactRows.length) await conn.executeMany(
      `MERGE INTO contacts t USING (SELECT :e entity_id, :x external_id FROM dual) s
         ON (t.entity_id = s.entity_id AND t.source = 'CAPSULE' AND t.external_id = s.external_id)
       WHEN MATCHED THEN UPDATE SET t.contact_type = :t, t.name = :n, t.company = :co, t.email = :em, t.phone = :ph, t.tags = :tags,
            t.attrs = :attrs, t.updated_at = SYSTIMESTAMP, t.row_version = t.row_version + 1
       WHEN NOT MATCHED THEN INSERT (entity_id, contact_type, name, company, email, phone, status, tags, attrs, source, external_id)
            VALUES (:e, :t, :n, :co, :em, :ph, 'Prospect', :tags, :attrs, 'CAPSULE', :x)`, contactRows);
    const { rows: cRows } = await conn.execute(`SELECT entity_id, external_id, id FROM contacts WHERE source = 'CAPSULE'`);
    for (const [e, x, id] of cRows) contactLink.set(`${e}|${x}`, id);

    // 2. Leads (one per opportunity)
    const missingStage = new Set();
    const leadRows = inScope.map(({ o, target }) => {
      const e = entityId[target.entity];
      const mName = String(o.milestone?.name || '').toLowerCase();
      const sid = stageId.get(`${e}|${target.pipeline}|${mName}`) ?? null;
      if (!sid) missingStage.add(`${target.entity}/${target.pipeline}: ${o.milestone?.name}`);
      const p = parties.get(o.party?.id);
      const tags = (o.tags || []).map((t) => t.name);
      const fields = Object.fromEntries((o.fields || []).map((f) => [f.definition?.name || f.id, f.value]));
      return {
        e, x: String(o.id), cid: o.party ? contactLink.get(`${e}|${o.party.id}`) ?? null : null, cat: target.category,
        n: clip(o.name || partyName(p) || 'Opportunity', 200),
        em: clip(p?.emailAddresses?.[0]?.address || null, 200), ph: clip(p?.phoneNumbers?.[0]?.number || null, 40),
        sid, src: clip(tags[0] || null, 40), val: Number(o.value?.amount || 0),
        sc: Math.max(0, Math.min(100, Math.round(Number(o.probability ?? 0)))), aid: userOf(o.owner),
        la: toDate(o.lastContactedAt || o.updatedAt), notes: clip(o.description, 4000), ca: toDate(o.createdAt) || new Date(),
        attrs: JSON.stringify({ capsule: {
          id: o.id, pipeline: target.pipeline, party: partyName(p), owner: o.owner?.name || null, team: o.team?.name || null,
          expectedCloseOn: o.expectedCloseOn || null, closedOn: o.closedOn || null, lostReason: lostReasonOf(o),
          currency: o.value?.currency || null, duration: o.duration ?? null, durationBasis: o.durationBasis || null,
          tags, fields,
        } }),
      };
    });
    await conn.executeMany(
      `MERGE INTO leads t USING (SELECT :e entity_id, :x external_id FROM dual) s
         ON (t.entity_id = s.entity_id AND t.source = 'CAPSULE' AND t.external_id = s.external_id)
       WHEN MATCHED THEN UPDATE SET t.contact_id = :cid, t.category = :cat, t.name = :n, t.email = :em, t.phone = :ph, t.stage_id = :sid,
            t.lead_source = :src, t.value_amount = :val, t.score = :sc, t.assignee_id = :aid, t.last_activity_at = :la, t.notes = :notes,
            t.attrs = :attrs, t.updated_at = SYSTIMESTAMP, t.row_version = t.row_version + 1
       WHEN NOT MATCHED THEN INSERT (entity_id, contact_id, category, name, email, phone, stage_id, lead_source, value_amount, score,
            assignee_id, last_activity_at, notes, attrs, source, external_id, created_at)
            VALUES (:e, :cid, :cat, :n, :em, :ph, :sid, :src, :val, :sc, :aid, :la, :notes, :attrs, 'CAPSULE', :x, :ca)`,
      leadRows, { bindDefs: {
        e: { type: oracledb.NUMBER }, x: { type: oracledb.STRING, maxSize: 100 }, cid: { type: oracledb.NUMBER }, cat: { type: oracledb.STRING, maxSize: 40 },
        n: { type: oracledb.STRING, maxSize: 200 }, em: { type: oracledb.STRING, maxSize: 200 }, ph: { type: oracledb.STRING, maxSize: 40 },
        sid: { type: oracledb.NUMBER }, src: { type: oracledb.STRING, maxSize: 40 }, val: { type: oracledb.NUMBER }, sc: { type: oracledb.NUMBER },
        aid: { type: oracledb.NUMBER }, la: { type: oracledb.DATE }, notes: { type: oracledb.STRING, maxSize: 4000 },
        ca: { type: oracledb.DATE }, attrs: { type: oracledb.STRING, maxSize: 32767 },
      } });

    // 3. Activities: notes/emails on each opportunity + tasks linked to it
    let actCount = 0;
    if (WITH_ACTIVITIES) {
      const { rows: lRows } = await conn.execute(`SELECT entity_id, external_id, id, contact_id FROM leads WHERE source = 'CAPSULE'`);
      const leadOf = new Map(lRows.map(([e, x, id, c]) => [x, { e, id, c }]));
      const acts = [];
      for (const [oppId, list] of entries) {
        const l = leadOf.get(String(oppId)); if (!l) continue;
        for (const en of list) {
          const at = String(en.activityType?.name || '').toLowerCase();
          const type = en.type === 'email' ? 'email' : ACTIVITY_TYPES.has(at) ? at : 'note';
          acts.push({ e: l.e, x: `entry:${en.id}`, lid: l.id, cid: l.c, ty: type,
            sub: clip(en.subject || en.activityType?.name || (type === 'email' ? 'Email' : 'Note'), 200),
            note: clip(String(en.content || '').replace(/\r/g, ''), 4000), due: null, done: 1, usr: userOf(en.creator), ca: toDate(en.entryAt || en.createdAt) || new Date() });
        }
      }
      for (const t of tasks) {
        const l = leadOf.get(String(t.opportunity.id)); if (!l) continue;
        acts.push({ e: l.e, x: `task:${t.id}`, lid: l.id, cid: l.c, ty: 'task', sub: clip(t.description || 'Task', 200), note: clip(t.detail, 4000),
          due: toDate(t.dueOn), done: t.status === 'COMPLETED' || t.status === 'completed' ? 1 : 0, usr: userOf(t.owner), ca: toDate(t.createdAt) || new Date() });
      }
      if (acts.length) await conn.executeMany(
        `MERGE INTO activities t USING (SELECT :e entity_id, :x external_id FROM dual) s
           ON (t.entity_id = s.entity_id AND t.source = 'CAPSULE' AND t.external_id = s.external_id)
         WHEN MATCHED THEN UPDATE SET t.lead_id = :lid, t.contact_id = :cid, t.activity_type = :ty, t.subject = :sub, t.note = :note,
              t.due_at = :due, t.done = :done, t.user_id = :usr, t.updated_at = SYSTIMESTAMP, t.row_version = t.row_version + 1
         WHEN NOT MATCHED THEN INSERT (entity_id, lead_id, contact_id, activity_type, subject, note, due_at, done, user_id, source, external_id, created_at)
              VALUES (:e, :lid, :cid, :ty, :sub, :note, :due, :done, :usr, 'CAPSULE', :x, :ca)`,
        acts, { bindDefs: {
          e: { type: oracledb.NUMBER }, x: { type: oracledb.STRING, maxSize: 100 }, lid: { type: oracledb.NUMBER }, cid: { type: oracledb.NUMBER },
          ty: { type: oracledb.STRING, maxSize: 20 }, sub: { type: oracledb.STRING, maxSize: 200 }, note: { type: oracledb.STRING, maxSize: 4000 },
          due: { type: oracledb.DATE }, done: { type: oracledb.NUMBER }, usr: { type: oracledb.NUMBER }, ca: { type: oracledb.DATE },
        } });
      actCount = acts.length;
    }

    await conn.execute(`INSERT INTO audit_log (action, table_name, after_data) VALUES ('import', 'capsule', :d)`,
      { d: JSON.stringify({ leads: leadRows.length, contacts: contactRows.length, activities: actCount }) });
    await conn.commit();
    console.log(`\n✓ Imported/updated ${leadRows.length} leads, ${contactRows.length} new contacts (${contactLink.size - cRows.length > 0 ? contactLink.size - cRows.length : 0} matched to existing), ${actCount} activities.`);
    if (missingStage.size) console.log('⚠ No matching stage for (left without a stage):', [...missingStage]);
  } catch (e) {
    await conn.rollback();
    console.error('FAILED (nothing saved):', e.message);
    process.exitCode = 1;
  } finally {
    await conn.close();
  }
}

main().catch((e) => { console.error('FAILED:', e.message); process.exitCode = 1; });