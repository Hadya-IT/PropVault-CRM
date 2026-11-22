// Pulls HOMCO maintenance work orders from D365 F&O (OData) into the Hadya CRM
// "Maintenance CRM" tab. Authenticates with the leasing-dashboard Azure app
// (client-credentials), so it needs NO browser session and can run on a schedule.
//
// Idempotent: re-running MERGEs the same rows, matched by SOURCE='D365' + EXTERNAL_ID.
// Run db/08_maintenance_d365.sql once first (adds source/external_id/attrs).
//
//   node scripts/import-d365-workorders.js --dry            preview counts, nothing written
//   node scripts/import-d365-workorders.js                  import (default scope = since D365_WO_SINCE)
//   node scripts/import-d365-workorders.js --since 2026-09-01   override the ExpectedStart cutoff
//   node scripts/import-d365-workorders.js --all            no date cutoff (all ~50k, slow)
//
// Nightly: cron/pm2 → `node scripts/import-d365-workorders.js` (incremental, re-runs are safe).
import 'dotenv/config';
import oracledb from 'oracledb';

const D365_URL   = (process.env.D365_URL || '').replace(/\/$/, '');
const TENANT     = process.env.D365_TENANT_ID;
const CLIENT_ID  = process.env.D365_CLIENT_ID;
const SECRET     = process.env.D365_CLIENT_SECRET;
const COMPANY    = process.env.D365_WO_COMPANY || 'homc';   // D365 legal entity
const ENTITY     = process.env.D365_WO_ENTITY  || 'HMC';    // Hadya CRM entity code
const SINCE_DFLT = process.env.D365_WO_SINCE   || '2026-01-01';
const PAGE       = 2000;

const args = process.argv.slice(2);
const dry  = args.includes('--dry');
const all  = args.includes('--all');
const sinceArg = (() => { const i = args.indexOf('--since'); return i >= 0 ? args[i + 1] : null; })();
const since = all ? null : (sinceArg || SINCE_DFLT);

// Byte-safe truncate for Oracle VARCHAR2 (Arabic = 2-3 bytes/char).
function clip(s, maxBytes) {
  if (s == null) return null;
  s = String(s);
  let buf = Buffer.from(s, 'utf8');
  if (buf.length <= maxBytes) return s;
  buf = buf.subarray(0, maxBytes);
  return new TextDecoder('utf-8', { fatal: false }).decode(buf).replace(/�+$/, '');
}
const realDate = (d) => (d && !String(d).startsWith('1900') && !String(d).startsWith('1901')) ? String(d).slice(0, 10) : null;

async function getToken() {
  if (!TENANT || !CLIENT_ID || !SECRET || !D365_URL) {
    throw new Error('Missing D365_TENANT_ID / D365_CLIENT_ID / D365_CLIENT_SECRET / D365_URL in .env');
  }
  const body = new URLSearchParams({
    grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: SECRET,
    scope: `${D365_URL}/.default`,
  });
  const r = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  });
  if (!r.ok) throw new Error(`Token request failed ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return (await r.json()).access_token;
}

async function fetchWorkOrders(token) {
  const select = ['WorkOrderId', 'WorkOrderTypeId', 'Description', 'ExpectedStart', 'ExpectedEnd',
    'ServiceLevel', 'ResponsibleWorkerPersonnelNumber', 'PropertyId', 'UnitId', 'FloorId', 'BlockID',
    'CustAccount', 'AgreementId', 'RESInspectionStatus', 'ParentWorkOrderId'].join(',');
  let filter = `dataAreaId eq '${COMPANY}'`;
  if (since) filter += ` and ExpectedStart ge ${since}T00:00:00Z`;
  // No $top: D365 treats $top as a hard cap and drops @odata.nextLink. Letting the
  // service page (server-driven, ~10k/page + nextLink) is what pulls the full set.
  let url = `${D365_URL}/data/AssetMaintenanceWorkOrderTables?cross-company=true`
    + `&$filter=${encodeURIComponent(filter)}&$select=${select}`;
  const rows = [];
  let page = 0;
  while (url) {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    if (!r.ok) throw new Error(`OData ${r.status} on page ${page}: ${(await r.text()).slice(0, 300)}`);
    const j = await r.json();
    rows.push(...(j.value || []));
    url = j['@odata.nextLink'] || null;
    page++;
    process.stdout.write(`\r  fetched ${rows.length} work orders...`);
  }
  process.stdout.write('\n');
  return rows;
}

function toRecord(entityId, wo) {
  const attrs = {
    d365: {
      company: COMPANY, work_order: wo.WorkOrderId, service_level: wo.ServiceLevel ?? null,
      property: wo.PropertyId || null, unit: wo.UnitId || null, floor: wo.FloorId || null, block: wo.BlockID || null,
      customer_account: wo.CustAccount || null, agreement: wo.AgreementId || null,
      responsible_worker: wo.ResponsibleWorkerPersonnelNumber || null,
      expected_end: realDate(wo.ExpectedEnd), inspection_status: wo.RESInspectionStatus || null,
      parent_work_order: wo.ParentWorkOrderId || null,
    },
  };
  return {
    e: entityId,
    x: `${COMPANY}|${wo.WorkOrderId}`,
    rt: clip(wo.WorkOrderTypeId || 'Work Order', 60),
    nt: clip([wo.WorkOrderId, wo.Description].filter(Boolean).join(' — '), 4000),
    due: (() => { const d = realDate(wo.ExpectedStart); return d ? `${d} 00:00 +00:00` : null; })(),
    attrs: JSON.stringify(attrs),
  };
}

async function main() {
  console.log(`D365 work orders → Hadya CRM  (company=${COMPANY}, entity=${ENTITY}, scope=${since ? '>= ' + since : 'ALL'})`);
  const token = await getToken();
  const wos = await fetchWorkOrders(token);
  console.log(`  ${wos.length} work orders in scope.`);
  if (!wos.length) { console.log('Nothing to import.'); return; }
  if (dry) {
    const byType = {};
    for (const w of wos) byType[w.WorkOrderTypeId || '?'] = (byType[w.WorkOrderTypeId || '?'] || 0) + 1;
    console.table(byType);
    console.log('Dry run: nothing written.');
    return;
  }

  const conn = await oracledb.getConnection({
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, connectString: process.env.DB_CONNECT_STRING,
    configDir: process.env.DB_WALLET_DIR, walletLocation: process.env.DB_WALLET_DIR, walletPassword: process.env.DB_WALLET_PASSWORD,
    connectTimeout: 20,
  });
  try {
    const { rows: ents } = await conn.execute(`SELECT id FROM entities WHERE code = :c`, { c: ENTITY });
    if (!ents.length) throw new Error(`Entity ${ENTITY} not found — run db/05_entities.sql first.`);
    const entityId = ents[0][0];

    const binds = wos.map((w) => toRecord(entityId, w));
    // status stays 'Open' (D365 does not expose current lifecycle state on this OData entity);
    // priority defaults to 'Medium'. Both are refined later if a state entity is wired in.
    await conn.executeMany(
      `MERGE INTO maintenance_requests t
         USING (SELECT :e entity_id, :x external_id FROM dual) s
         ON (t.entity_id = s.entity_id AND t.source = 'D365' AND t.external_id = s.external_id)
       WHEN MATCHED THEN UPDATE SET
         t.request_type = :rt, t.notes = :nt,
         t.due_at = CASE WHEN :due IS NULL THEN NULL ELSE TO_TIMESTAMP_TZ(:due,'YYYY-MM-DD HH24:MI TZH:TZM') END,
         t.attrs = :attrs, t.updated_at = SYSTIMESTAMP, t.row_version = t.row_version + 1
       WHEN NOT MATCHED THEN INSERT
         (entity_id, request_type, priority, status, notes, due_at, attrs, source, external_id)
         VALUES (:e, :rt, 'Medium', 'Open', :nt,
                 CASE WHEN :due IS NULL THEN NULL ELSE TO_TIMESTAMP_TZ(:due,'YYYY-MM-DD HH24:MI TZH:TZM') END,
                 :attrs, 'D365', :x)`,
      binds,
      { autoCommit: false,
        bindDefs: {
          e: { type: oracledb.NUMBER },
          x: { type: oracledb.STRING, maxSize: 100 },
          rt: { type: oracledb.STRING, maxSize: 60 },
          nt: { type: oracledb.STRING, maxSize: 4000 },
          due: { type: oracledb.STRING, maxSize: 24 },
          attrs: { type: oracledb.STRING, maxSize: 4000 },
        } },
    );
    await conn.execute(
      `INSERT INTO audit_log (action, table_name, after_data) VALUES ('import','d365_workorders',:d)`,
      { d: JSON.stringify({ company: COMPANY, entity: ENTITY, scope: since || 'all', count: wos.length }) },
    );
    await conn.commit();
    console.log(`✓ Imported/updated ${wos.length} maintenance work orders into ${ENTITY}.`);
  } catch (e) {
    await conn.rollback();
    console.error('FAILED (nothing saved):', e.message);
    process.exitCode = 1;
  } finally {
    await conn.close();
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });