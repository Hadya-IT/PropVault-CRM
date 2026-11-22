import { Router } from 'express';
import { ah } from '../lib/errors.js';
import { listNavigation, getStages } from '../lib/repo.js';
import { canAccess, isAdmin, visibleEntityIds } from '../auth/authz.js';
import { requireEntity } from '../middleware/auth.js';
import { query } from '../db.js';

export function meRoutes() {
  const r = Router();

  /** Current user + the navigation they are allowed to see. */
  r.get('/me', ah(async (req, res) => {
    const ctx = req.ctx;
    const rows = await listNavigation(visibleEntityIds(ctx));
    const entities = new Map();
    for (const row of rows) {
      if (!entities.has(row.entity_id)) {
        entities.set(row.entity_id, {
          id: row.entity_id, code: row.code, name: row.name, industry: row.industry, color: row.color,
          role: ctx.globalRole || ctx.entityRoles.get(row.entity_id) || null,
          modules: [],
        });
      }
      if (row.module_code && canAccess(ctx, row.entity_id, row.module_code, 'view')) {
        const e = entities.get(row.entity_id);
        e.modules.push({
          module: row.module_code, slug: row.slug, label: row.label,
          fixed: row.filter_config ? JSON.parse(row.filter_config) : {},
          can: {
            create: canAccess(ctx, row.entity_id, row.module_code, 'create'),
            edit: canAccess(ctx, row.entity_id, row.module_code, 'edit'),
            delete: canAccess(ctx, row.entity_id, row.module_code, 'delete'),
            export: canAccess(ctx, row.entity_id, row.module_code, 'export'),
          },
        });
      }
    }
    res.json({
      user: { id: ctx.userId, email: ctx.email, name: ctx.name, globalRole: ctx.globalRole, isAdmin: isAdmin(ctx) },
      entities: [...entities.values()],
    });
  }));

  /** Per-entity metadata the module screens need: stages, field definitions, assignable users. */
  r.get('/entities/:entityCode/meta', requireEntity, ah(async (req, res) => {
    const entityId = req.entity.id;
    const [stages, fields, users] = await Promise.all([
      getStages(entityId),
      query(
        `SELECT em.slug, fd.field_key, fd.label, fd.field_type, fd.options, fd.required, fd.show_in_list, fd.sort_order
           FROM field_definitions fd JOIN entity_modules em ON em.id = fd.entity_module_id
          WHERE em.entity_id = :entityId ORDER BY em.slug, fd.sort_order`,
        { entityId },
      ),
      query(
        `SELECT u.id, u.display_name AS name, ue.role FROM app_users u
           JOIN user_entities ue ON ue.user_id = u.id
          WHERE ue.entity_id = :entityId AND u.active = 1 ORDER BY u.display_name`,
        { entityId },
      ),
    ]);
    const fieldsBySlug = {};
    for (const f of fields.rows) {
      (fieldsBySlug[f.slug] ??= []).push({
        key: f.field_key, label: f.label, type: f.field_type,
        options: f.options ? JSON.parse(f.options) : null,
        required: f.required === 1, showInList: f.show_in_list === 1,
      });
    }
    res.json({ entity: req.entity, stages, fields: fieldsBySlug, users: users.rows });
  }));

  return r;
}
