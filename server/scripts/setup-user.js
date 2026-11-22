// Creates or repairs the PROPVAULT schema user, connecting as ADMIN.
// It sets PROPVAULT's password to DB_PASSWORD from .env, so .env and the DB match.
//
// 1. Put the ADMIN password in .env temporarily:   ADMIN_DB_PASSWORD="..."
// 2. Run from the server folder:                    node scripts/setup-user.js
// 3. Remove ADMIN_DB_PASSWORD from .env afterwards, and put the same
//    DB_PASSWORD into the Vault secret dev-propvault-crm-db-password.
import 'dotenv/config';
import oracledb from 'oracledb';

const appUser = (process.env.DB_USER || '').toUpperCase();
const appPassword = process.env.DB_PASSWORD || '';
const adminPassword = process.env.ADMIN_DB_PASSWORD || '';

if (!/^[A-Z][A-Z0-9_]{1,29}$/.test(appUser) || appUser === 'ADMIN') {
  console.error('DB_USER must be the app schema (e.g. PROPVAULT), not ADMIN.'); process.exit(1);
}
if (!adminPassword) { console.error('Add ADMIN_DB_PASSWORD="..." to .env first.'); process.exit(1); }
// DDL cannot use bind variables for passwords, so reject characters that would break the quoted literal.
if (appPassword.length < 12 || /["\s]/.test(appPassword)) {
  console.error('DB_PASSWORD must be at least 12 characters and contain no double quote or space.'); process.exit(1);
}

const conn = await oracledb.getConnection({
  user: 'ADMIN',
  password: adminPassword,
  connectString: process.env.DB_CONNECT_STRING,
  configDir: process.env.DB_WALLET_DIR,
  walletLocation: process.env.DB_WALLET_DIR,
  walletPassword: process.env.DB_WALLET_PASSWORD,
  connectTimeout: 20,
});

try {
  const { rows } = await conn.execute(
    'SELECT account_status FROM dba_users WHERE username = :u', { u: appUser },
  );
  if (!rows.length) {
    console.log(`${appUser} does not exist → creating it`);
    await conn.execute(`CREATE USER ${appUser} IDENTIFIED BY "${appPassword}"`);
  } else {
    console.log(`${appUser} exists (status: ${rows[0][0]}) → resetting password and unlocking`);
    await conn.execute(`ALTER USER ${appUser} IDENTIFIED BY "${appPassword}" ACCOUNT UNLOCK`);
  }
  await conn.execute(`GRANT CREATE SESSION, CREATE TABLE, CREATE SEQUENCE, CREATE VIEW, CREATE PROCEDURE TO ${appUser}`);
  await conn.execute(`ALTER USER ${appUser} QUOTA UNLIMITED ON DATA`);
  console.log(`✓ ${appUser} ready. Now: remove ADMIN_DB_PASSWORD from .env, then run node scripts/test-db.js`);
} catch (e) {
  console.error('FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await conn.close();
}