import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULES } from '../src/modules/registry.js';
import { buildList, buildInsert, buildUpdate, parseBody } from '../src/modules/sql.js';

const units = MODULES.units;

test('list is always scoped by entity and excludes deleted rows', () => {
  const { sql, binds } = buildList(units, { entityId: 7 });
  assert.match(sql, /t\.entity_id = :entityId/);
  assert.match(sql, /t\.deleted_at IS NULL/);
  assert.equal(binds.entityId, 7);
});

test('fixed filter from entity module cannot be overridden by client filter', () => {
  const { binds } = buildList(units, { entityId: 1, fixed: { category: 'Office' }, filters: { category: 'Retail' } });
  const values = Object.values(binds);
  assert.ok(values.includes('Office'));
  assert.ok(!values.includes('Retail'));
});

test('search text is bound, never concatenated into SQL', () => {
  const evil = "x' OR 1=1 --";
  const { sql, binds } = buildList(units, { entityId: 1, q: evil });
  assert.ok(!sql.includes(evil));
  assert.ok(binds.q.includes("x' or 1=1 --"));
});

test('unknown sort or filter columns are rejected', () => {
  assert.throws(() => buildList(units, { entityId: 1, sort: 'password' }), /Cannot sort/);
  assert.throws(() => buildList(units, { entityId: 1, filters: { 'id; DROP TABLE units': '1' } }), /Cannot filter/);
  assert.throws(() => buildList(units, { entityId: 1, filters: { attrs: '1' } }), /Cannot filter/);
});

test('page size is capped at 100', () => {
  const { binds } = buildList(units, { entityId: 1, pageSize: 100000 });
  assert.equal(binds.limit, 100);
});

test('create validation: required fields, unknown fields rejected', () => {
  assert.throws(() => parseBody(units, 'create', { name: 'A' }), /Validation failed/);
  assert.throws(() => parseBody(units, 'create', { category: 'Office', code: 'X1', entity_id: 5 }), /Validation failed/);
  const ok = parseBody(units, 'create', { category: 'Office', code: 'JS-O-001', size_sqm: 150, lease_end: '2026-12-31' });
  assert.equal(ok.code, 'JS-O-001');
});

test('update requires row_version for optimistic locking', () => {
  assert.throws(() => parseBody(units, 'update', { status: 'Leased' }), /Validation failed/);
  const d = parseBody(units, 'update', { status: 'Leased', row_version: 3 });
  const { sql, binds } = buildUpdate(units, { entityId: 1, id: 10, userId: 2, data: d });
  assert.match(sql, /row_version = :rv/);
  assert.match(sql, /entity_id = :entityId/);
  assert.equal(binds.rv, 3);
});

test('insert sets entity and creator from server, not from body', () => {
  const { sql, binds } = buildInsert(units, { entityId: 4, userId: 8, data: { category: 'Office', code: 'A' } });
  assert.equal(binds.entity_id, 4);
  assert.equal(binds.created_by, 8);
  assert.match(sql, /RETURNING id INTO :out_id/);
});

test('activities record creator in user_id', () => {
  const { sql } = buildInsert(MODULES.activities, { entityId: 1, userId: 2, data: { activity_type: 'call' } });
  const cols = sql.slice(sql.indexOf('(') + 1, sql.indexOf(')'));
  assert.match(cols, /user_id/);
  assert.ok(!cols.includes('created_by'));
});

import { buildFacet } from '../src/modules/sql.js';
test('facet counts are entity-scoped and only on filterable columns', () => {
  const { sql, binds } = buildFacet(MODULES.units, { entityId: 3, fixed: { category: 'Office' }, column: 'status' });
  assert.match(sql, /GROUP BY t\.status/);
  assert.match(sql, /t\.entity_id = :entityId/);
  assert.equal(binds.entityId, 3);
  assert.throws(() => buildFacet(MODULES.units, { entityId: 3, column: 'attrs' }), /Cannot count/);
});

test('buildList: id list filter becomes IN with binds', () => {
  const def = MODULES.leads;
  const r = buildList(def, { entityId: 1, filters: { stage_id: '4,5,6' } });
  assert.match(r.sql, /t\.stage_id IN \(:f\d+,:f\d+,:f\d+\)/);
  assert.throws(() => buildList(def, { entityId: 1, filters: { stage_id: '4,x' } }));
});

test('buildStats: money sum + avg score, values are bound', async () => {
  const { buildStats } = await import('../src/modules/sql.js');
  const leads = MODULES.leads;
  const r = buildStats(leads, { entityId: 5, fixed: { category: 'Office' } });
  assert.match(r.sql, /COUNT\(\*\) AS cnt/);
  assert.match(r.sql, /SUM\(t\.value_amount\) AS sum_value_amount/);
  assert.match(r.sql, /ROUND\(AVG\(t\.score\),1\) AS avg_score/);
  assert.ok(r.sums.includes('value_amount'));
  assert.equal(r.binds.entityId, 5);
  assert.equal(r.binds.x0, 'Office');
  // no raw value interpolation
  assert.ok(!r.sql.includes('Office'));
});