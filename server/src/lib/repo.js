import { query } from '../db.js';

// Small in-process caches. With 2 VMs a change can take up to TTL to show on the other VM.
const TTL_MS = 30_000;
const cache = new Map();
async function cached(key, loader) {
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.val;
  const val = await loader();
  cache.set(key, { val, exp: Date.now() + TTL_MS });
  return val;
}
export function invalidate(prefix = '') {
  for (const k of cache.keys()) if (k.startsWith(prefix)) cache.delete(k);
}

export async function loadPermissions() {
  return cached('perms', async () => {
    const { rows } = await query('SELECT role, module_code, can_view, can_create, can_edit, can_delete, can_export FROM role_permissions');
    const perms = {};
    for (const r of rows) {
      perms[r.role] ??= {};
      perms[r.role][r.module_code] = {
        view: r.can_view === 1, create: r.can_create === 1, edit: r.can_edit === 1,
        delete: r.can_delete === 1, export: r.can_export === 1,
      };
    }
    return perms;
  });
}

export async function loadUserContext(userId) {
  return cached(`user:${userId}`, async () => {
    const { rows } = await query(
      'SELECT id, email, display_name, global_role, active FROM app_users WHERE id = :id',
      { id: userId },
    );
    const u = rows[0];
    if (!u || u.active !== 1) return null;
    const { rows: er } = await query(
      'SELECT ue.entity_id, ue.role, ue.department FROM user_entities ue JOIN entities e ON e.id = ue.entity_id WHERE ue.user_id = :id AND e.active = 1',
      { id: userId },
    );
    return {
      userId: u.id,
      email: u.email,
      name: u.display_name,
      globalRole: u.global_role || null,
      entityRoles: new Map(er.map((r) => [r.entity_id, r.role])),
      departments: Object.fromEntries(er.map((r) => [r.entity_id, r.department])),
    };
  });
}

export async function findUserForLogin({ oid, email }) {
  const { rows } = await query(
    'SELECT id, email, entra_oid, active FROM app_users WHERE entra_oid = :oid OR LOWER(email) = :email',
    { oid, email },
  );
  // Prefer the row bound to this Entra object id.
  return rows.find((r) => r.entra_oid === oid) || rows.find((r) => r.email.toLowerCase() === email) || null;
}

export async function getEntityByCode(code) {
  return cached(`entity:${code}`, async () => {
    const { rows } = await query(
      'SELECT id, code, name, industry, color, city, active FROM entities WHERE code = :code',
      { code: String(code).toUpperCase() },
    );
    return rows[0] || null;
  });
}

export async function getEntityModule(entityId, slug) {
  return cached(`em:${entityId}:${slug}`, async () => {
    const { rows } = await query(
      `SELECT em.id, em.module_code, em.slug, em.label, em.filter_config, em.enabled, m.available
         FROM entity_modules em JOIN modules m ON m.code = em.module_code
        WHERE em.entity_id = :entityId AND em.slug = :slug`,
      { entityId, slug },
    );
    const r = rows[0];
    if (!r) return null;
    let filter = {};
    if (r.filter_config) { try { filter = JSON.parse(r.filter_config); } catch { filter = {}; } }
    return { ...r, filter };
  });
}

export async function listNavigation(entityIds) {
  const all = entityIds === 'all';
  if (!all && entityIds.length === 0) return [];
  const { rows } = await query(
    `SELECT e.id AS entity_id, e.code, e.name, e.industry, e.color, e.sort_order AS e_sort,
            em.module_code, em.slug, em.label, em.sort_order, em.filter_config
       FROM entities e
       LEFT JOIN entity_modules em ON em.entity_id = e.id AND em.enabled = 1
       LEFT JOIN modules m ON m.code = em.module_code AND m.available = 1
      WHERE e.active = 1 ${all ? '' : 'AND e.id IN (' + entityIds.map((_, i) => ':e' + i).join(',') + ')'}
      ORDER BY e.sort_order, e.name, em.sort_order`,
    all ? {} : Object.fromEntries(entityIds.map((id, i) => ['e' + i, id])),
  );
  return rows;
}

export async function getStages(entityId) {
  return cached(`stages:${entityId}`, async () => {
    const { rows } = await query(
      `SELECT id, pipeline_code, name, sort_order, color, is_won, is_lost, probability, stale_days, description
         FROM entity_stages WHERE entity_id = :entityId AND active = 1 ORDER BY pipeline_code, sort_order`,
      { entityId },
    );
    return rows.map((r) => ({ ...r, is_won: r.is_won === 1, is_lost: r.is_lost === 1 }));
  });
}

export async function writeAudit(exec, { userId, entityId, action, table, recordId, before, after, req }) {
  await exec(
    `INSERT INTO audit_log (user_id, entity_id, action, table_name, record_id, before_data, after_data, ip_address, request_id)
     VALUES (:u, :e, :a, :t, :r, :b, :af, :ip, :rid)`,
    {
      u: userId ?? null, e: entityId ?? null, a: action, t: table ?? null, r: recordId ?? null,
      b: before ? JSON.stringify(before) : null, af: after ? JSON.stringify(after) : null,
      ip: req?.ip?.slice(0, 64) ?? null, rid: req?.id ? String(req.id).slice(0, 64) : null,
    },
  );
}