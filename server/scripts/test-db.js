// One direct connection (no pool) so the real Oracle error is shown.
// Run from the server folder:  node scripts/test-db.js
import 'dotenv/config';
import oracledb from 'oracledb';

const cfg = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECT_STRING,
  configDir: process.env.DB_WALLET_DIR,
  walletLocation: process.env.DB_WALLET_DIR,
  walletPassword: process.env.DB_WALLET_PASSWORD,
  connectTimeout: 20,
};

console.log('user:', cfg.user, '| connect:', cfg.connectString, '| wallet:', cfg.walletLocation,
  '| password set:', Boolean(cfg.password), '| wallet password set:', Boolean(cfg.walletPassword));

const t = Date.now();
try {
  const conn = await oracledb.getConnection(cfg);
  const r = await conn.execute(`SELECT USER, SYS_CONTEXT('USERENV','DB_NAME'), (SELECT COUNT(*) FROM user_tables) FROM dual`);
  console.log(`OK in ${Date.now() - t} ms →`, r.rows[0], '(user, db, table count)');
  await conn.close();
} catch (e) {
  console.error(`FAILED after ${Date.now() - t} ms →`, e.code || '', e.message);
}