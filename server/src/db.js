import oracledb from 'oracledb';

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.fetchAsString = [oracledb.CLOB];
oracledb.autoCommit = false;

let pool;

export async function initPool(cfg) {
  pool = await oracledb.createPool({
    user: cfg.DB_USER,
    password: cfg.DB_PASSWORD,
    connectString: cfg.DB_CONNECT_STRING,
    configDir: cfg.DB_WALLET_DIR,
    walletLocation: cfg.DB_WALLET_DIR,
    walletPassword: cfg.DB_WALLET_PASSWORD,
    poolMin: cfg.DB_POOL_MIN,
    poolMax: cfg.DB_POOL_MAX,
    poolIncrement: 2,
    poolTimeout: 60,
    queueTimeout: 10000,
    stmtCacheSize: 60,
  });
  return pool;
}

export async function closePool() {
  if (pool) await pool.close(10);
}

// Lower-case column names so the API returns camel-ish keys consistently.
function lowerKeys(rows = []) {
  return rows.map((r) => {
    const o = {};
    for (const k of Object.keys(r)) o[k.toLowerCase()] = r[k];
    return o;
  });
}

/** Run one statement. ALWAYS pass values as binds — never interpolate. */
export async function query(sql, binds = {}, opts = {}) {
  const conn = await pool.getConnection();
  try {
    const res = await conn.execute(sql, binds, { autoCommit: true, ...opts });
    return { rows: lowerKeys(res.rows), rowsAffected: res.rowsAffected, outBinds: res.outBinds };
  } finally {
    await conn.close();
  }
}

/** Run several statements in one transaction. */
export async function tx(fn) {
  const conn = await pool.getConnection();
  const exec = async (sql, binds = {}, opts = {}) => {
    const res = await conn.execute(sql, binds, opts);
    return { rows: lowerKeys(res.rows), rowsAffected: res.rowsAffected, outBinds: res.outBinds };
  };
  try {
    const out = await fn(exec);
    await conn.commit();
    return out;
  } catch (e) {
    await conn.rollback().catch(() => {});
    throw e;
  } finally {
    await conn.close();
  }
}

export { oracledb };
