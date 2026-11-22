import { z } from 'zod';
import { badRequest } from '../lib/errors.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_JSON_BYTES = 20_000;

function zodFor(col) {
  let s;
  switch (col.type) {
    case 'string':
    case 'text': {
      s = z.string().trim().max(col.max ?? 4000);
      if (col.enum) s = z.enum(col.enum);
      else if (col.format === 'email') s = z.string().trim().max(col.max ?? 200).email();
      break;
    }
    case 'int': {
      s = z.number().int();
      if (col.min !== undefined) s = s.min(col.min);
      if (col.max !== undefined) s = s.max(col.max);
      break;
    }
    case 'number': {
      s = z.number().finite();
      if (col.min !== undefined) s = s.min(col.min);
      if (col.max !== undefined) s = s.max(col.max);
      break;
    }
    case 'date':
      s = z.string().regex(DATE_RE, 'Use YYYY-MM-DD');
      break;
    case 'timestamp':
      s = z.string().datetime({ offset: true });
      break;
    case 'bool':
      s = z.boolean();
      break;
    case 'json':
      s = z.union([z.record(z.any()), z.array(z.any())]).refine(
        (v) => JSON.stringify(v).length <= MAX_JSON_BYTES,
        'Too much data',
      );
      break;
    default:
      throw new Error(`Unknown column type ${col.type}`);
  }
  return s;
}

/** Build a zod schema for create (required enforced) or update (all optional). */
export function writeSchema(def, mode) {
  const shape = {};
  for (const [name, col] of Object.entries(def.columns)) {
    if (!col.write) continue;
    let s = zodFor(col);
    if (mode === 'create' && col.required) shape[name] = s;
    else shape[name] = s.nullable().optional();
  }
  const base = z.object(shape).strict();
  return mode === 'update' ? base.extend({ row_version: z.number().int().positive() }) : base;
}

export function parseBody(def, mode, body) {
  const r = writeSchema(def, mode).safeParse(body ?? {});
  if (!r.success) {
    throw badRequest('Validation failed', r.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
  }
  return r.data;
}

function selectExpr(name, col) {
  if (col.type === 'date') return `TO_CHAR(t.${name},'YYYY-MM-DD') AS ${name}`;
  return `t.${name}`;
}

function valueExpr(name, col) {
  if (col.type === 'date') return `TO_DATE(:${name},'YYYY-MM-DD')`;
  if (col.type === 'timestamp') return `TO_TIMESTAMP_TZ(:${name},'YYYY-MM-DD"T"HH24:MI:SS.FFTZH:TZM')`;
  return `:${name}`;
}

function toBind(col, v) {
  if (v === null || v === undefined) return null;
  if (col.type === 'json') return JSON.stringify(v);
  if (col.type === 'bool') return v ? 1 : 0;
  if (col.type === 'timestamp') return new Date(v).toISOString().replace('Z', '+00:00');
  return v;
}

export function fromRow(def, row) {
  const out = { id: row.id, row_version: row.row_version };
  for (const [name, col] of Object.entries(def.columns)) {
    if (!(name in row)) continue;
    let v = row[name];
    if (col.type === 'json' && typeof v === 'string') {
      try { v = JSON.parse(v); } catch { v = null; }
    }
    if (col.type === 'bool') v = v === 1;
    out[name] = v;
  }
  return out;
}

/**
 * Build a paginated list query. Every identifier comes from `def`; every value is a bind.
 * fixed: filters forced by ENTITY_MODULES.filter_config (cannot be overridden by the client).
 */
export function buildList(def, { entityId, fixed = {}, filters = {}, q, sort, page = 1, pageSize = 25 }) {
  const binds = { entityId };
  const where = ['t.entity_id = :entityId', 't.deleted_at IS NULL'];
  let i = 0;

  const addEq = (name, value) => {
    const col = def.columns[name];
    if (!col || !col.filter) throw badRequest(`Cannot filter by ${name}`);
    if (col.type === 'int' && typeof value === 'string' && value.includes(',')) {
      // id lists such as stage_id=12,13,14 (pipeline board); capped and validated
      const ids = [...new Set(value.split(',').map((x) => Number(x.trim())))];
      if (!ids.length || ids.length > 40 || ids.some((x) => !Number.isSafeInteger(x) || x <= 0)) throw badRequest(`Invalid ${name} list`);
      const keys = ids.map((x) => { const k = `f${i++}`; binds[k] = x; return `:${k}`; });
      where.push(`t.${name} IN (${keys.join(',')})`);
      return;
    }
    const key = `f${i++}`;
    binds[key] = toBind(col, col.type === 'int' || col.type === 'number' ? Number(value) : col.type === 'bool' ? value === true || value === 'true' : value);
    where.push(`t.${name} = :${key}`);
  };

  for (const [k, v] of Object.entries(fixed)) addEq(k, v);
  for (const [k, v] of Object.entries(filters)) {
    if (k in fixed) continue; // fixed filter always wins
    if (v === '' || v === undefined || v === null) continue;
    addEq(k, v);
  }

  if (q && String(q).trim()) {
    const searchCols = Object.entries(def.columns).filter(([, c]) => c.search).map(([n]) => n);
    if (searchCols.length) {
      binds.q = `%${String(q).trim().toLowerCase().slice(0, 100).replace(/[\\%_]/g, (m) => '\\' + m)}%`;
      where.push('(' + searchCols.map((n) => `LOWER(t.${n}) LIKE :q ESCAPE '\\'`).join(' OR ') + ')');
    }
  }

  let sortKey = sort || def.defaultSort || '-created_at';
  let dir = 'ASC';
  if (sortKey.startsWith('-')) { dir = 'DESC'; sortKey = sortKey.slice(1); }
  const sortCol = def.columns[sortKey];
  if (!sortCol || !sortCol.sort) throw badRequest(`Cannot sort by ${sortKey}`);

  const size = Math.min(Math.max(Number(pageSize) || 25, 1), 100);
  const pg = Math.max(Number(page) || 1, 1);
  binds.offset = (pg - 1) * size;
  binds.limit = size;

  const cols = Object.entries(def.columns).filter(([, c]) => c.list).map(([n, c]) => selectExpr(n, c));
  const sql =
    `SELECT t.id, t.row_version, ${cols.join(', ')}, COUNT(*) OVER () AS total_count ` +
    `FROM ${def.table} t WHERE ${where.join(' AND ')} ` +
    `ORDER BY t.${sortKey} ${dir} NULLS LAST, t.id ${dir} ` +
    `OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;
  return { sql, binds, page: pg, pageSize: size };
}

export function buildGet(def, { entityId, id, fixed = {} }) {
  const binds = { entityId, id };
  const where = ['t.id = :id', 't.entity_id = :entityId', 't.deleted_at IS NULL'];
  let i = 0;
  for (const [k, v] of Object.entries(fixed)) {
    if (!def.columns[k]) throw badRequest(`Bad fixed filter ${k}`);
    binds[`x${i}`] = v; where.push(`t.${k} = :x${i}`); i++;
  }
  const cols = Object.entries(def.columns).map(([n, c]) => selectExpr(n, c));
  return { sql: `SELECT t.id, t.row_version, ${cols.join(', ')} FROM ${def.table} t WHERE ${where.join(' AND ')}`, binds };
}

export function buildInsert(def, { entityId, userId, data }) {
  const names = ['entity_id'];
  const values = [':entity_id'];
  const binds = { entity_id: entityId };
  for (const [name, v] of Object.entries(data)) {
    const col = def.columns[name];
    if (!col?.write) continue;
    names.push(name); values.push(valueExpr(name, col)); binds[name] = toBind(col, v);
  }
  const cb = def.createdByCol || 'created_by';
  names.push(cb); values.push(':created_by'); binds.created_by = userId;
  const sql = `INSERT INTO ${def.table} (${names.join(', ')}) VALUES (${values.join(', ')}) RETURNING id INTO :out_id`;
  return { sql, binds };
}

export function buildUpdate(def, { entityId, id, userId, data }) {
  const sets = [];
  const binds = { id, entityId, rv: data.row_version };
  for (const [name, v] of Object.entries(data)) {
    if (name === 'row_version') continue;
    const col = def.columns[name];
    if (!col?.write) continue;
    sets.push(`${name} = ${valueExpr(name, col)}`); binds[name] = toBind(col, v);
  }
  if (!sets.length) throw badRequest('Nothing to update');
  if (def.hasUpdatedBy) { sets.push('updated_by = :updated_by'); binds.updated_by = userId; }
  sets.push('updated_at = SYSTIMESTAMP', 'row_version = row_version + 1');
  const sql = `UPDATE ${def.table} SET ${sets.join(', ')} WHERE id = :id AND entity_id = :entityId AND row_version = :rv AND deleted_at IS NULL`;
  return { sql, binds };
}

export function buildSoftDelete(def, { entityId, id }) {
  return {
    sql: `UPDATE ${def.table} SET deleted_at = SYSTIMESTAMP, row_version = row_version + 1 WHERE id = :id AND entity_id = :entityId AND deleted_at IS NULL`,
    binds: { id, entityId },
  };
}

/** Counts per value of one filterable column, within the module's fixed filter. Used for tab counts. */
export function buildFacet(def, { entityId, fixed = {}, column }) {
  const col = def.columns[column];
  if (!col || !col.filter) throw badRequest(`Cannot count by ${column}`);
  const binds = { entityId };
  const where = ['t.entity_id = :entityId', 't.deleted_at IS NULL'];
  let i = 0;
  for (const [k, v] of Object.entries(fixed)) {
    if (!def.columns[k]) throw badRequest(`Bad fixed filter ${k}`);
    binds[`x${i}`] = v; where.push(`t.${k} = :x${i}`); i++;
  }
  return { sql: `SELECT t.${column} AS val, COUNT(*) AS cnt FROM ${def.table} t WHERE ${where.join(' AND ')} GROUP BY t.${column}`, binds };
}