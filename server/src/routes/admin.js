import { Router } from 'express';
import { z } from 'zod';
import { ah, notFound, conflict, badRequest } from '../lib/errors.js';
import { query, tx, oracledb } from '../db.js';
import { invalidate, writeAudit } from '../lib/repo.js';
import { MODULES } from '../modules/registry.js';

// Tailwind palette names only — colors are rendered with fixed class maps, never inline styles.
export const PALETTE = ['amber', 'lime', 'violet', 'sky', 'rose', 'orange', 'emerald', 'indigo', 'teal', 'pink', 'slate'];

const entityBody = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,20}$/, '2–20 letters/digits'),
  name: z.string().trim().min(2).max(150),
  industry: z.string().trim().max(150).nullable().optional(),
  color: z.enum(PALETTE).default('sky'),
  city: z.string().trim().max(80).nullable().optional(),
  active: z.boolean().optional(),
  sort_order: z.number().int().min(0).max(9999).optional(),
});

const emBody = z.object({
  module_code: z.string().max(40),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(60),
  label: z.string().trim().min(1).max(100),
  sort_order: z.number().int().min(0).max(9999).optional(),
  enabled: z.boolean().optional(),
  filter_config: z.record(z.union([z.string().max(100), z.number(), z.boolean()])).nullable().optional(),
});

const stageBody = z.object({
  pipeline_code: z.string().trim().max(40).default('default'),
  name: z.string().trim().min(1).max(80),
  sort_order: z.number().int().min(0).max(9999),
  color: z.enum([...PALETTE, 'blue', 'cyan', 'green']).default('slate'),
  is_won: z.boolean().default(false),
  is_lost: z.boolean().default(false),
  active: z.boolean().optional(),
});

const userBody = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  display_name: z.string().trim().min(1).max(150),
  global_role: z.enum(['group-owner', 'group-supervisor']).nullable().optional(),
  active: z.boolean().optional(),
  entities: z.array(z.object({
    entity_id: z.number().int().positive(),
    role: z.enum(['company-owner', 'dept-manager', 'sales-agent', 'marketing', 'operation', 'viewer']),
    department: z.string().max(60).nullable().optional(),
  })).max(50).default([]),
});

const idParam = (v) => z.coerce.number().int().positive().parse(v);
const b = (v) => (v === undefined ? undefined : v ? 1 : 0);

/** Filter keys must be filterable columns of the module's data table. */
function checkFilter(moduleCode, filter) {
  if (!filter) return;
  const def = MODULES[moduleCode];
  for (const k of Object.keys(filter)) {
    if (!def?.columns[k]?.filter) throw badRequest(`"${k}" cannot be used as a filter for ${moduleCode}`);
  }
}

function dupGuard(e) {
  if (e?.errorNum === 1) throw conflict('That code or slug already exists');
  throw e;
}

export function adminRoutes() {
  const r = Router();

  // ----- Module library (read-only, code-defined) -----
  r.get('/modules', ah(async (_req, res) => {
    const { rows } = await query('SELECT code, name, description, phase, available FROM modules ORDER BY phase, name');
    res.json({ data: rows.map((m) => ({ ...m, filterable: Object.entries(MODULES[m.code]?.columns ?? {}).filter(([, c]) => c.filter).map(([k]) => k) })) });
  }));

  // ----- Entities -----
  r.get('/entities', ah(async (_req, res) => {
    const { rows } = await query(
      `SELECT e.id, e.code, e.name, e.industry, e.color, e.city, e.active, e.sort_order,
              (SELECT COUNT(*) FROM entity_modules em WHERE em.entity_id = e.id AND em.enabled = 1) AS module_count,
              (SELECT COUNT(*) FROM user_entities ue WHERE ue.entity_id = e.id) AS user_count
         FROM entities e ORDER BY e.sort_order, e.name`,
    );
    res.json({ data: rows.map((e) => ({ ...e, active: e.active === 1 })) });
  }));

  r.post('/entities', ah(async (req, res) => {
    const d = entityBody.parse(req.body);
    const id = await tx(async (exec) => {
      const ins = await exec(
        `INSERT INTO entities (code, name, industry, color, city, sort_order, active)
         VALUES (:code, :name, :industry, :color, :city, :so, :active) RETURNING id INTO :out_id`,
        { code: d.code, name: d.name, industry: d.industry ?? null, color: d.color, city: d.city ?? null,
          so: d.sort_order ?? 0, active: d.active === false ? 0 : 1,
          out_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } },
      ).catch(dupGuard);
      const newId = ins.outBinds.out_id[0];
      await writeAudit(exec, { userId: req.ctx.userId, entityId: newId, action: 'config', table: 'entities', recordId: newId, after: d, req });
      return newId;
    });
    invalidate('entity:');
    res.status(201).json({ id });
  }));

  r.patch('/entities/:id', ah(async (req, res) => {
    const id = idParam(req.params.id);
    const d = entityBody.partial().omit({ code: true }).parse(req.body);
    await tx(async (exec) => {
      const upd = await exec(
        `UPDATE entities SET name = NVL(:name, name), industry = CASE WHEN :setInd = 1 THEN :industry ELSE industry END,
                color = NVL(:color, color), city = CASE WHEN :setCity = 1 THEN :city ELSE city END,
                sort_order = NVL(:so, sort_order), active = NVL(:active, active), updated_at = SYSTIMESTAMP
          WHERE id = :id`,
        { name: d.name ?? null, setInd: 'industry' in d ? 1 : 0, industry: d.industry ?? null, color: d.color ?? null,
          setCity: 'city' in d ? 1 : 0, city: d.city ?? null, so: d.sort_order ?? null, active: b(d.active) ?? null, id },
      );
      if (!upd.rowsAffected) throw notFound();
      await writeAudit(exec, { userId: req.ctx.userId, entityId: id, action: 'config', table: 'entities', recordId: id, after: d, req });
    });
    invalidate('entity:');
    res.json({ ok: true });
  }));

  // ----- Module assignment per entity -----
  r.get('/entities/:id/modules', ah(async (req, res) => {
    const id = idParam(req.params.id);
    const { rows } = await query(
      `SELECT em.id, em.module_code, m.name AS module_name, em.slug, em.label, em.sort_order, em.enabled, em.filter_config
         FROM entity_modules em JOIN modules m ON m.code = em.module_code
        WHERE em.entity_id = :id ORDER BY em.sort_order`,
      { id },
    );
    res.json({ data: rows.map((x) => ({ ...x, enabled: x.enabled === 1, filter_config: x.filter_config ? JSON.parse(x.filter_config) : null })) });
  }));

  r.post('/entities/:id/modules', ah(async (req, res) => {
    const entityId = idParam(req.params.id);
    const d = emBody.parse(req.body);
    const { rows } = await query('SELECT available FROM modules WHERE code = :c', { c: d.module_code });
    if (!rows[0] || rows[0].available !== 1) throw badRequest('Unknown module');
    checkFilter(d.module_code, d.filter_config);
    const id = await tx(async (exec) => {
      const ins = await exec(
        `INSERT INTO entity_modules (entity_id, module_code, slug, label, sort_order, enabled, filter_config)
         VALUES (:e, :m, :s, :l, :so, :en, :fc) RETURNING id INTO :out_id`,
        { e: entityId, m: d.module_code, s: d.slug, l: d.label, so: d.sort_order ?? 0, en: d.enabled === false ? 0 : 1,
          fc: d.filter_config ? JSON.stringify(d.filter_config) : null, out_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } },
      ).catch(dupGuard);
      const newId = ins.outBinds.out_id[0];
      await writeAudit(exec, { userId: req.ctx.userId, entityId, action: 'config', table: 'entity_modules', recordId: newId, after: d, req });
      return newId;
    });
    invalidate('em:');
    res.status(201).json({ id });
  }));

  r.patch('/entities/:id/modules/:emId', ah(async (req, res) => {
    const entityId = idParam(req.params.id);
    const emId = idParam(req.params.emId);
    const d = emBody.partial().omit({ module_code: true, slug: true }).parse(req.body);
    const { rows } = await query('SELECT module_code FROM entity_modules WHERE id = :id AND entity_id = :e', { id: emId, e: entityId });
    if (!rows[0]) throw notFound();
    if ('filter_config' in d) checkFilter(rows[0].module_code, d.filter_config);
    await tx(async (exec) => {
      await exec(
        `UPDATE entity_modules SET label = NVL(:l, label), sort_order = NVL(:so, sort_order), enabled = NVL(:en, enabled),
                filter_config = CASE WHEN :setFc = 1 THEN :fc ELSE filter_config END
          WHERE id = :id AND entity_id = :e`,
        { l: d.label ?? null, so: d.sort_order ?? null, en: b(d.enabled) ?? null, setFc: 'filter_config' in d ? 1 : 0,
          fc: d.filter_config ? JSON.stringify(d.filter_config) : null, id: emId, e: entityId },
      );
      await writeAudit(exec, { userId: req.ctx.userId, entityId, action: 'config', table: 'entity_modules', recordId: emId, after: d, req });
    });
    invalidate('em:');
    res.json({ ok: true });
  }));

  // Removing a module only disables it, so data is never orphaned or lost.
  r.delete('/entities/:id/modules/:emId', ah(async (req, res) => {
    const entityId = idParam(req.params.id);
    const emId = idParam(req.params.emId);
    await tx(async (exec) => {
      const upd = await exec('UPDATE entity_modules SET enabled = 0 WHERE id = :id AND entity_id = :e', { id: emId, e: entityId });
      if (!upd.rowsAffected) throw notFound();
      await writeAudit(exec, { userId: req.ctx.userId, entityId, action: 'config', table: 'entity_modules', recordId: emId, after: { enabled: false }, req });
    });
    invalidate('em:');
    res.json({ ok: true });
  }));

  // ----- Pipeline stages -----
  r.get('/entities/:id/stages', ah(async (req, res) => {
    const { rows } = await query(
      'SELECT id, pipeline_code, name, sort_order, color, is_won, is_lost, active FROM entity_stages WHERE entity_id = :e ORDER BY pipeline_code, sort_order',
      { e: idParam(req.params.id) },
    );
    res.json({ data: rows.map((s) => ({ ...s, is_won: s.is_won === 1, is_lost: s.is_lost === 1, active: s.active === 1 })) });
  }));

  r.put('/entities/:id/stages', ah(async (req, res) => {
    const entityId = idParam(req.params.id);
    const list = z.array(stageBody.extend({ id: z.number().int().positive().optional() })).min(1).max(30).parse(req.body);
    const wonPer = {};
    for (const s of list) if (s.is_won) wonPer[s.pipeline_code] = (wonPer[s.pipeline_code] || 0) + 1;
    if (Object.values(wonPer).some((n) => n > 1)) throw badRequest('Each pipeline can have only one "won" stage');
    await tx(async (exec) => {
      for (const s of list) {
        const binds = { e: entityId, p: s.pipeline_code, n: s.name, so: s.sort_order, c: s.color, w: s.is_won ? 1 : 0, l: s.is_lost ? 1 : 0, a: s.active === false ? 0 : 1 };
        if (s.id) {
          await exec(
            'UPDATE entity_stages SET pipeline_code=:p, name=:n, sort_order=:so, color=:c, is_won=:w, is_lost=:l, active=:a WHERE id=:id AND entity_id=:e',
            { ...binds, id: s.id },
          );
        } else {
          await exec('INSERT INTO entity_stages (entity_id, pipeline_code, name, sort_order, color, is_won, is_lost, active) VALUES (:e,:p,:n,:so,:c,:w,:l,:a)', binds).catch(dupGuard);
        }
      }
      await writeAudit(exec, { userId: req.ctx.userId, entityId, action: 'config', table: 'entity_stages', after: list, req });
    });
    invalidate(`stages:${entityId}`);
    res.json({ ok: true });
  }));

  // ----- Users -----
  r.get('/users', ah(async (_req, res) => {
    const { rows } = await query(
      `SELECT u.id, u.email, u.display_name, u.global_role, u.active, u.last_login_at,
              ue.entity_id, ue.role, ue.department
         FROM app_users u LEFT JOIN user_entities ue ON ue.user_id = u.id ORDER BY u.display_name`,
    );
    const users = new Map();
    for (const row of rows) {
      if (!users.has(row.id)) users.set(row.id, { id: row.id, email: row.email, display_name: row.display_name, global_role: row.global_role, active: row.active === 1, last_login_at: row.last_login_at, entities: [] });
      if (row.entity_id) users.get(row.id).entities.push({ entity_id: row.entity_id, role: row.role, department: row.department });
    }
    res.json({ data: [...users.values()] });
  }));

  const saveUserEntities = async (exec, userId, entities) => {
    await exec('DELETE FROM user_entities WHERE user_id = :u', { u: userId });
    for (const e of entities) {
      await exec('INSERT INTO user_entities (user_id, entity_id, role, department) VALUES (:u, :e, :r, :d)', { u: userId, e: e.entity_id, r: e.role, d: e.department ?? null });
    }
  };

  r.post('/users', ah(async (req, res) => {
    const d = userBody.parse(req.body);
    const id = await tx(async (exec) => {
      const ins = await exec(
        'INSERT INTO app_users (email, display_name, global_role, active) VALUES (:e, :n, :g, :a) RETURNING id INTO :out_id',
        { e: d.email, n: d.display_name, g: d.global_role ?? null, a: d.active === false ? 0 : 1, out_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } },
      ).catch(dupGuard);
      const newId = ins.outBinds.out_id[0];
      await saveUserEntities(exec, newId, d.entities);
      await writeAudit(exec, { userId: req.ctx.userId, action: 'config', table: 'app_users', recordId: newId, after: d, req });
      return newId;
    });
    res.status(201).json({ id });
  }));

  r.patch('/users/:id', ah(async (req, res) => {
    const id = idParam(req.params.id);
    const d = userBody.partial().omit({ email: true }).parse(req.body);
    if (id === req.ctx.userId && (d.active === false || ('global_role' in d && d.global_role !== 'group-owner'))) {
      throw badRequest('You cannot remove your own admin access');
    }
    await tx(async (exec) => {
      const upd = await exec(
        `UPDATE app_users SET display_name = NVL(:n, display_name),
                global_role = CASE WHEN :setG = 1 THEN :g ELSE global_role END, active = NVL(:a, active)
          WHERE id = :id`,
        { n: d.display_name ?? null, setG: 'global_role' in d ? 1 : 0, g: d.global_role ?? null, a: b(d.active) ?? null, id },
      );
      if (!upd.rowsAffected) throw notFound();
      if (d.entities) await saveUserEntities(exec, id, d.entities);
      await writeAudit(exec, { userId: req.ctx.userId, action: 'config', table: 'app_users', recordId: id, after: d, req });
    });
    invalidate(`user:${id}`);
    res.json({ ok: true });
  }));

  return r;
}