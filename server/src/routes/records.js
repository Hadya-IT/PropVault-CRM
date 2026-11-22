import { Router } from 'express';
import { z } from 'zod';
import { ah, badRequest, conflict, notFound } from '../lib/errors.js';
import { query, tx, oracledb } from '../db.js';
import { requireModule } from '../middleware/auth.js';
import { MODULES, dataModuleFor } from '../modules/registry.js';
import { parseBody, buildList, buildGet, buildInsert, buildUpdate, buildSoftDelete, buildFacet, fromRow } from '../modules/sql.js';
import { writeAudit } from '../lib/repo.js';

const REF_TABLES = { contacts: 'contacts', units: 'units', leads: 'leads', deals: 'deals' };

function defFor(req) {
  const code = dataModuleFor(req.entityModule.module_code);
  const def = code && MODULES[code];
  if (!def) throw notFound('This module has no records');
  return def;
}

/** Every referenced id must belong to the same entity — stops cross-entity linking. */
async function checkRefs(exec, def, entityId, data) {
  for (const [name, col] of Object.entries(def.columns)) {
    const v = data[name];
    if (!col.ref || v === null || v === undefined) continue;
    let sql;
    if (col.ref === 'stages') sql = 'SELECT 1 FROM entity_stages WHERE id = :v AND entity_id = :e AND active = 1';
    else if (col.ref === 'users')
      sql = `SELECT 1 FROM app_users u WHERE u.id = :v AND u.active = 1 AND (u.global_role IS NOT NULL
             OR EXISTS (SELECT 1 FROM user_entities ue WHERE ue.user_id = u.id AND ue.entity_id = :e))`;
    else sql = `SELECT 1 FROM ${REF_TABLES[col.ref]} WHERE id = :v AND entity_id = :e AND deleted_at IS NULL`;
    const { rows } = await exec(sql, { v, e: entityId });
    if (!rows.length) throw badRequest('Validation failed', [{ field: name, message: 'Not found in this entity' }]);
  }
}

/** Module-specific business rules that run inside the write transaction. */
async function beforeWrite(exec, def, { entityId, id, data, existing }) {
  if (def.table === 'bookings') {
    const unitId = data.unit_id ?? existing?.unit_id;
    const starts = data.starts_at ?? existing?.starts_at;
    const ends = data.ends_at ?? existing?.ends_at;
    const status = data.status ?? existing?.status ?? 'Confirmed';
    if (starts && ends && new Date(ends) <= new Date(starts)) {
      throw badRequest('Validation failed', [{ field: 'ends_at', message: 'End must be after start' }]);
    }
    if (status !== 'Cancelled' && unitId && starts && ends) {
      // Lock the unit row so two people cannot book the same slot at the same moment.
      await exec('SELECT id FROM units WHERE id = :u AND entity_id = :e FOR UPDATE', { u: unitId, e: entityId });
      const { rows } = await exec(
        `SELECT id FROM bookings WHERE unit_id = :u AND entity_id = :e AND deleted_at IS NULL
            AND status <> 'Cancelled' AND (:id IS NULL OR id <> :id)
            AND starts_at < :ends AND ends_at > :starts`,
        { u: unitId, e: entityId, id: id ?? null, starts: new Date(starts), ends: new Date(ends) },
      );
      if (rows.length) throw conflict('This space is already booked for that time');
    }
  }
}

async function afterWrite(exec, def, { entityId, recordId, data }) {
  if (def.table === 'activities' && data.lead_id) {
    await exec('UPDATE leads SET last_activity_at = SYSTIMESTAMP WHERE id = :l AND entity_id = :e', { l: data.lead_id, e: entityId });
  }
  if (def.table === 'maintenance_requests' && (data.status === 'Resolved' || data.status === 'Closed')) {
    await exec('UPDATE maintenance_requests SET resolved_at = NVL(resolved_at, SYSTIMESTAMP) WHERE id = :id', { id: recordId });
  }
}

const listQuery = z.object({
  page: z.coerce.number().int().min(1).max(100000).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  q: z.string().max(100).optional(),
  sort: z.string().max(40).regex(/^-?[a-z_]+$/).optional(),
  filter: z.record(z.string().max(100)).optional(),
  facets: z.string().max(80).regex(/^[a-z_,]+$/).optional(),
});

export function recordRoutes() {
  const r = Router({ mergeParams: true });

  r.get('/', requireModule('view'), ah(async (req, res) => {
    const def = defFor(req);
    const p = listQuery.parse(req.query);
    const { sql, binds, page, pageSize } = buildList(def, {
      entityId: req.entity.id, fixed: req.entityModule.filter, filters: p.filter ?? {},
      q: p.q, sort: p.sort, page: p.page, pageSize: p.pageSize,
    });
    const { rows } = await query(sql, binds);
    const total = rows[0]?.total_count ?? 0;
    const facets = {};
    for (const column of (p.facets ? p.facets.split(',').slice(0, 3) : [])) {
      if (!def.columns[column]?.filter) continue;
      const f = buildFacet(def, { entityId: req.entity.id, fixed: req.entityModule.filter, column });
      const r2 = await query(f.sql, f.binds);
      facets[column] = Object.fromEntries(r2.rows.map((x) => [x.val ?? '—', Number(x.cnt)]));
    }
    res.json({ data: rows.map((row) => fromRow(def, row)), page, pageSize, total, facets });
  }));

  r.get('/:id', requireModule('view'), ah(async (req, res) => {
    const def = defFor(req);
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const { sql, binds } = buildGet(def, { entityId: req.entity.id, id, fixed: req.entityModule.filter });
    const { rows } = await query(sql, binds);
    if (!rows[0]) throw notFound();
    res.json({ data: fromRow(def, rows[0]) });
  }));

  r.post('/', requireModule('create'), ah(async (req, res) => {
    const def = defFor(req);
    // Fixed filters (e.g. category=Office) are forced on create; the client cannot override them.
    const forced = Object.fromEntries(Object.entries(req.entityModule.filter).filter(([k]) => def.columns[k]?.write));
    const data = parseBody(def, 'create', { ...(req.body ?? {}), ...forced });
    const entityId = req.entity.id;

    const created = await tx(async (exec) => {
      await checkRefs(exec, def, entityId, data);
      await beforeWrite(exec, def, { entityId, data });
      const { sql, binds } = buildInsert(def, { entityId, userId: req.ctx.userId, data });
      binds.out_id = { dir: oracledb.BIND_OUT, type: oracledb.NUMBER };
      const ins = await exec(sql, binds);
      const recordId = ins.outBinds.out_id[0];
      await afterWrite(exec, def, { entityId, recordId, data });
      await writeAudit(exec, { userId: req.ctx.userId, entityId, action: 'create', table: def.table, recordId, after: data, req });
      return recordId;
    });
    res.status(201).json({ id: created });
  }));

  r.patch('/:id', requireModule('edit'), ah(async (req, res) => {
    const def = defFor(req);
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const data = parseBody(def, 'update', req.body);
    for (const k of Object.keys(req.entityModule.filter)) delete data[k]; // cannot move a record out of its module
    const entityId = req.entity.id;

    await tx(async (exec) => {
      const get = buildGet(def, { entityId, id, fixed: req.entityModule.filter });
      const { rows } = await exec(get.sql + ' FOR UPDATE', get.binds);
      if (!rows[0]) throw notFound();
      const before = fromRow(def, rows[0]);
      await checkRefs(exec, def, entityId, data);
      await beforeWrite(exec, def, { entityId, id, data, existing: before });
      const { sql, binds } = buildUpdate(def, { entityId, id, userId: req.ctx.userId, data });
      const upd = await exec(sql, binds);
      if (upd.rowsAffected !== 1) throw conflict('Someone else changed this record. Reload and try again.');
      await afterWrite(exec, def, { entityId, recordId: id, data });
      await writeAudit(exec, { userId: req.ctx.userId, entityId, action: 'update', table: def.table, recordId: id, before, after: data, req });
    });
    res.json({ ok: true });
  }));

  r.delete('/:id', requireModule('delete'), ah(async (req, res) => {
    const def = defFor(req);
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const entityId = req.entity.id;
    await tx(async (exec) => {
      const get = buildGet(def, { entityId, id, fixed: req.entityModule.filter });
      const { rows } = await exec(get.sql, get.binds);
      if (!rows[0]) throw notFound();
      const { sql, binds } = buildSoftDelete(def, { entityId, id });
      await exec(sql, binds);
      await writeAudit(exec, { userId: req.ctx.userId, entityId, action: 'delete', table: def.table, recordId: id, before: fromRow(def, rows[0]), req });
    });
    res.json({ ok: true });
  }));

  return r;
}