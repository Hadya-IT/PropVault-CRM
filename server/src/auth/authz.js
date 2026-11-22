/**
 * Pure permission logic — no DB access, fully unit-tested.
 *
 * ctx = {
 *   userId, globalRole: 'group-owner' | 'group-supervisor' | null,
 *   entityRoles: Map<entityId, role>,
 *   perms: { [role]: { [moduleCode]: { view, create, edit, delete, export } } }
 * }
 */

export const ACTIONS = ['view', 'create', 'edit', 'delete', 'export'];

export function isAdmin(ctx) {
  return ctx?.globalRole === 'group-owner';
}

/** Entities the user may see at all. `all` = every entity. */
export function visibleEntityIds(ctx) {
  if (ctx?.globalRole) return 'all';
  return [...(ctx?.entityRoles?.keys() ?? [])];
}

export function canAccess(ctx, entityId, moduleCode, action) {
  if (!ctx || !ACTIONS.includes(action)) return false;
  if (ctx.globalRole === 'group-owner') return true;
  if (ctx.globalRole === 'group-supervisor') return action === 'view' || action === 'export';
  const role = ctx.entityRoles?.get(Number(entityId));
  if (!role) return false;
  return ctx.perms?.[role]?.[moduleCode]?.[action] === true;
}
