import { unauthorized, forbidden, notFound, ah } from '../lib/errors.js';
import { loadUserContext, loadPermissions, getEntityByCode, getEntityModule } from '../lib/repo.js';
import { canAccess, isAdmin } from '../auth/authz.js';

/** Loads the signed-in user (from the session cookie) into req.ctx. */
export const requireAuth = (sessions) =>
  ah(async (req, _res, next) => {
    const userId = await sessions.read(req);
    if (!userId) throw unauthorized();
    const user = await loadUserContext(userId);
    if (!user) throw unauthorized('Account is disabled');
    req.ctx = { ...user, perms: await loadPermissions() };
    next();
  });

export const requireAdmin = (req, _res, next) => {
  if (!isAdmin(req.ctx)) return next(forbidden('Admins only'));
  next();
};

/**
 * Resolves :entityCode and :slug, then checks, on the server, that:
 *  1. the entity exists and is active
 *  2. the module is assigned + enabled for this entity
 *  3. the user's role in THIS entity allows `action` on this module
 * Hiding a menu item is not security; this is.
 */
export const requireModule = (action) =>
  ah(async (req, _res, next) => {
    const act = typeof action === 'function' ? action(req) : action;
    const entity = await getEntityByCode(req.params.entityCode);
    if (!entity || entity.active !== 1) throw notFound('Entity not found');
    const em = await getEntityModule(entity.id, req.params.slug);
    if (!em || em.enabled !== 1 || em.available !== 1) throw notFound('Module not found');
    if (!canAccess(req.ctx, entity.id, em.module_code, act)) throw forbidden();
    req.entity = entity;
    req.entityModule = em;
    next();
  });

/** For entity-level endpoints (meta, overview) — user must have some role in the entity. */
export const requireEntity = ah(async (req, _res, next) => {
  const entity = await getEntityByCode(req.params.entityCode);
  if (!entity || entity.active !== 1) throw notFound('Entity not found');
  if (!req.ctx.globalRole && !req.ctx.entityRoles.has(entity.id)) throw forbidden();
  req.entity = entity;
  next();
});

/** CSRF defence in addition to SameSite=Strict: state-changing requests must carry a custom header. */
export const requireCsrfHeader = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-PV-Request') !== '1') return res.status(403).json({ error: { code: 'csrf', message: 'Missing request header' } });
  next();
};
