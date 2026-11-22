import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canAccess, isAdmin, visibleEntityIds } from '../src/auth/authz.js';

const perms = {
  'sales-agent': { leads: { view: true, create: true, edit: true, delete: false, export: false }, units: { view: true } },
  'company-owner': { leads: { view: true, create: true, edit: true, delete: true, export: true } },
};
const agentJS = { userId: 9, globalRole: null, entityRoles: new Map([[1, 'sales-agent']]), perms };

test('agent can edit leads in own entity', () => {
  assert.equal(canAccess(agentJS, 1, 'leads', 'edit'), true);
});
test('agent cannot delete or export leads', () => {
  assert.equal(canAccess(agentJS, 1, 'leads', 'delete'), false);
  assert.equal(canAccess(agentJS, 1, 'leads', 'export'), false);
});
test('agent has no access to another entity', () => {
  assert.equal(canAccess(agentJS, 2, 'leads', 'view'), false);
});
test('agent has no access to unlisted module', () => {
  assert.equal(canAccess(agentJS, 1, 'deals', 'view'), false);
});
test('entity id given as string is still matched', () => {
  assert.equal(canAccess(agentJS, '1', 'leads', 'view'), true);
});
test('unknown action is denied', () => {
  assert.equal(canAccess(agentJS, 1, 'leads', 'drop'), false);
});
test('group owner can do everything and is admin', () => {
  const owner = { globalRole: 'group-owner', entityRoles: new Map(), perms };
  assert.equal(canAccess(owner, 99, 'anything', 'delete'), true);
  assert.equal(isAdmin(owner), true);
  assert.equal(visibleEntityIds(owner), 'all');
});
test('group supervisor is read + export only, not admin', () => {
  const sup = { globalRole: 'group-supervisor', entityRoles: new Map(), perms };
  assert.equal(canAccess(sup, 3, 'leads', 'view'), true);
  assert.equal(canAccess(sup, 3, 'leads', 'export'), true);
  assert.equal(canAccess(sup, 3, 'leads', 'edit'), false);
  assert.equal(isAdmin(sup), false);
});
test('null context is denied', () => {
  assert.equal(canAccess(null, 1, 'leads', 'view'), false);
  assert.deepEqual(visibleEntityIds(agentJS), [1]);
});
