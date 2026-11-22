// Imports a D365 Real Estate Pro export (JSON made in the browser) into PropVault.
// Idempotent: re-running updates the same rows (matched by SOURCE='D365' + EXTERNAL_ID).
//
//   node scripts/import-d365.js "C:\Users\you\Downloads\d365-propvault-export.json" --dry   (preview only)
//   node scripts/import-d365.js "C:\Users\you\Downloads\d365-propvault-export.json"
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import oracledb from 'oracledb';

// D365 company|property  →  PropVault entity code (agreed with the business, 22 Nov 2026)
const SCOPE = { 'reic|JS': 'JS', 'reic|HR': 'SLO', 'hjtc|GR': 'GRV' };

const U = ['co', 'prop', 'unit', 'name', 'type', 'floor', 'area', 'rate', 'rentStatus', 'agrStatus', 'curAgr', 'curCust', 'furnishing', 'beds', 'deactive'];
const A = ['co', 'prop', 'id', 'unit', 'multiUnit', 'cust', 'custName', 'start', 'end', 'actualEnd', 'total', 'current', 'freq', 'payPeriod', 'wf', 'type'];
const obj = (keys, arr) => Object.fromEntries(keys.map((k, i) => [k, arr[i]]));

function category(entity, type) {
  const t = (type || '').toLowerCase();
  if (entity === 'SLO') return 'Apartment';
  if (t === 'parking') return 'Parking';
  if (entity === 'GRV') return 'Space';
  if (t === 'office') return 'Office';
  if (t === 'shop' || t === 'shops') return 'Retail';
  if (t === 'storage') return 'Storage';
  if (t === 'hot desk') return 'Coworking';
  if (t === 'tower') return 'Tower';
  return 'Other';
}

function unitStatus(rentStatus, deactive) {
  if (deactive === 'Yes') return 'Offline';
  return { Occupied: 'Occupied', Vacant: 'Available', UnderRenewal: 'Under Renewal', UnderaTermination: 'Under Termination' }[rentStatus] || rentStatus || 'Available';
}

const today = new Date().toISOString().slice(0, 10);
function effectiveEnd(a) {
  if (a.actualEnd && a.end && a.actualEnd < a.end) return a.actualEnd;
  return a.end || a.actualEnd;
}
function dealStatus(a) {
  if (a.wf && a.wf !== 'Completed') return 'Pending';
  const end = effectiveEnd(a);
  return end && end < today ? 'Expired' : 'Active';
}
/** Contract total spread over its term → approximate annual rent. */
function annualRent(a) {
  const end = effectiveEnd(a);
  if (!a.start || !end || !a.total) return null;
  const years = (new Date(end) - new Date(a.start)) / (365.25 * 864e5);
  return years > 0.08 ? Math.round(a.total / years) : null;
}

function load(file) {
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  const units = raw.units.map((r) => obj(U, r)).filter((u) => SCOPE[`${u.co}|${u.prop}`]);
  const agrs = raw.agrs.map((r) => obj(A, r)).filter((a) => SCOPE[`${a.co}|${a.prop}`]);
  return { units, agrs };
}

async function main() {
  const [file, flag] = process.argv.slice(2);
  if (!file) { console.error('Usage: node scripts/import-d365.js <export.json> [--dry]'); process.exit(1); }
  const dry = flag === '--dry';
  const { units, agrs } = load(file);
  const agrById = new Map(agrs.map((a) => [`${a.co}|${a.id}`, a]));

  // Customers = everyone who has an agreement in scope
  const custs = new Map();
  for (const a of agrs) {
    if (!a.cust) continue;
    const key = `${a.co}|${a.cust}`;
    const c = custs.get(key) || { co: a.co, prop: a.prop, account: a.cust, name: a.custName || a.cust, active: false };
    if (dealStatus(a) === 'Active') c.active = true;
    custs.set(key, c);
  }

  const summary = {};
  const bump = (e, k) => { summary[e] ??= { units: 0, occupied: 0, customers: 0, deals: 0, activeDeals: 0 }; summary[e][k]++; };
  for (const u of units) { const e = SCOPE[`${u.co}|${u.prop}`]; bump(e, 'units'); if (u.rentStatus === 'Occupied') bump(e, 'occupied'); }
  for (const c of custs.values()) bump(SCOPE[`${c.co}|${c.prop}`], 'customers');
  for (const a of agrs) { const e = SCOPE[`${a.co}|${a.prop}`]; bump(e, 'deals'); if (dealStatus(a) === 'Active') bump(e, 'activeDeals'); }
  console.table(summary);
  if (dry) { console.log('Dry run: nothing written.'); return; }

  const conn = await oracledb.getConnection({
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, connectString: process.env.DB_CONNECT_STRING,
    configDir: process.env.DB_WALLET_DIR, walletLocation: process.env.DB_WALLET_DIR, walletPassword: process.env.DB_WALLET_PASSWORD,
    connectTimeout: 20,
  });

  try {
    const { rows: ents } = await conn.execute(`SELECT code, id FROM entities WHERE code IN ('JS','SLO','GRV')`);
    const entityId = Object.fromEntries(ents);
    for (const code of Object.values(SCOPE)) if (!entityId[code]) throw new Error(`Entity ${code} not found in PropVault`);

    // 1. Customers
    await conn.executeMany(
      `MERGE INTO contacts t USING (SELECT :e entity_id, :x external_id FROM dual) s
         ON (t.entity_id = s.entity_id AND t.source = 'D365' AND t.external_id = s.external_id)
       WHEN MATCHED THEN UPDATE SET t.name = :n, t.contact_type = 'company', t.status = :st, t.attrs = :attrs, t.updated_at = SYSTIMESTAMP, t.row_version = t.row_version + 1
       WHEN NOT MATCHED THEN INSERT (entity_id, contact_type, name, status, attrs, source, external_id)
            VALUES (:e, 'company', :n, :st, :attrs, 'D365', :x)`,
      [...custs.values()].map((c) => ({
        e: entityId[SCOPE[`${c.co}|${c.prop}`]], x: `${c.co}|${c.account}`, n: c.name.slice(0, 200),
        st: c.active ? 'Active' : 'Past', attrs: JSON.stringify({ d365: { company: c.co, account: c.account } }),
      })),
    );
    const { rows: cRows } = await conn.execute(`SELECT external_id, id FROM contacts WHERE source = 'D365'`);
    const contactId = Object.fromEntries(cRows);

    // 2. Units
    await conn.executeMany(
      `MERGE INTO units t USING (SELECT :e entity_id, :x external_id FROM dual) s
         ON (t.entity_id = s.entity_id AND t.source = 'D365' AND t.external_id = s.external_id)
       WHEN MATCHED THEN UPDATE SET t.category = :cat, t.code = :code, t.name = :n, t.unit_type = :ut, t.floor = :fl, t.size_sqm = :sz,
            t.status = :st, t.rent_amount = :rent, t.rent_period = 'year', t.tenant_contact_id = :ten,
            t.lease_start = TO_DATE(:ls,'YYYY-MM-DD'), t.lease_end = TO_DATE(:le,'YYYY-MM-DD'), t.attrs = :attrs,
            t.updated_at = SYSTIMESTAMP, t.row_version = t.row_version + 1
       WHEN NOT MATCHED THEN INSERT (entity_id, category, code, name, unit_type, floor, size_sqm, status, rent_amount, rent_period,
            tenant_contact_id, lease_start, lease_end, attrs, source, external_id)
            VALUES (:e, :cat, :code, :n, :ut, :fl, :sz, :st, :rent, 'year', :ten, TO_DATE(:ls,'YYYY-MM-DD'), TO_DATE(:le,'YYYY-MM-DD'), :attrs, 'D365', :x)`,
      units.map((u) => {
        const ent = SCOPE[`${u.co}|${u.prop}`];
        const cur = u.curAgr ? agrById.get(`${u.co}|${u.curAgr}`) : null;
        return {
          e: entityId[ent], x: `${u.co}|${u.prop}|${u.unit}`, cat: category(ent, u.type), code: String(u.unit).slice(0, 40),
          n: (u.name || u.unit).slice(0, 150), ut: (u.type || null), fl: u.floor ? String(u.floor).slice(0, 40) : null,
          sz: u.area || null, st: unitStatus(u.rentStatus, u.deactive), rent: cur ? annualRent(cur) : null,
          ten: u.curCust ? contactId[`${u.co}|${u.curCust}`] ?? null : null,
          ls: cur?.start ?? null, le: cur ? effectiveEnd(cur) : null,
          attrs: JSON.stringify({ d365: { company: u.co, property: u.prop, agreement_status: u.agrStatus, current_agreement: u.curAgr || null, furnishing: u.furnishing || null, bedrooms: u.beds || null, unit_rate: u.rate || null } }),
        };
      }),
    );
    const { rows: uRows } = await conn.execute(`SELECT external_id, id FROM units WHERE source = 'D365'`);
    const unitId = Object.fromEntries(uRows);

    // 3. Deals (lease agreements)
    await conn.executeMany(
      `MERGE INTO deals t USING (SELECT :e entity_id, :x external_id FROM dual) s
         ON (t.entity_id = s.entity_id AND t.source = 'D365' AND t.external_id = s.external_id)
       WHEN MATCHED THEN UPDATE SET t.name = :n, t.contact_id = :c, t.unit_id = :u, t.status = :st, t.amount = :amt,
            t.start_date = TO_DATE(:sd,'YYYY-MM-DD'), t.end_date = TO_DATE(:ed,'YYYY-MM-DD'), t.close_date = TO_DATE(:sd,'YYYY-MM-DD'),
            t.attrs = :attrs, t.updated_at = SYSTIMESTAMP, t.row_version = t.row_version + 1
       WHEN NOT MATCHED THEN INSERT (entity_id, name, contact_id, unit_id, deal_type, status, amount, start_date, end_date, close_date, attrs, source, external_id)
            VALUES (:e, :n, :c, :u, 'Lease', :st, :amt, TO_DATE(:sd,'YYYY-MM-DD'), TO_DATE(:ed,'YYYY-MM-DD'), TO_DATE(:sd,'YYYY-MM-DD'), :attrs, 'D365', :x)`,
      agrs.map((a) => ({
        e: entityId[SCOPE[`${a.co}|${a.prop}`]], x: `${a.co}|${a.id}`,
        n: `${a.custName || a.cust || 'Tenant'} – ${a.unit || a.multiUnit || a.prop}`.slice(0, 200),
        c: a.cust ? contactId[`${a.co}|${a.cust}`] ?? null : null,
        u: a.unit ? unitId[`${a.co}|${a.prop}|${a.unit}`] ?? null : null,
        st: dealStatus(a), amt: a.total || 0, sd: a.start, ed: effectiveEnd(a),
        attrs: JSON.stringify({ d365: { company: a.co, agreement: a.id, workflow: a.wf, payment_period: a.payPeriod, period: a.freq, agreement_type: a.type, multiple_units: a.multiUnit || null, current_amount: a.current, annual_rent_estimate: annualRent(a) } }),
      })),
    );

    await conn.execute(
      `INSERT INTO audit_log (action, table_name, after_data) VALUES ('import', 'd365', :d)`,
      { d: JSON.stringify({ file, units: units.length, customers: custs.size, deals: agrs.length }) },
    );
    await conn.commit();
    console.log(`✓ Imported/updated ${units.length} units, ${custs.size} customers, ${agrs.length} deals.`);
  } catch (e) {
    await conn.rollback();
    console.error('FAILED (nothing saved):', e.message);
    process.exitCode = 1;
  } finally {
    await conn.close();
  }
}

main();