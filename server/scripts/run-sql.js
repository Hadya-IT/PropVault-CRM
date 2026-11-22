// Runs a .sql file (statements ending with ";") using the connection in .env.
// Usage (from the server folder):
//   node scripts/run-sql.js ../db/01_schema.sql
//   node scripts/run-sql.js ../db/02_seed.sql you@hadya.com
// The optional email replaces &BOOTSTRAP_ADMIN_EMAIL in the seed.
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import oracledb from 'oracledb';

export function splitStatements(sql) {
  const noComments = sql
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n');
  return noComments
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s && !/^commit$/i.test(s));
}

async function main() {
  const [file, email] = process.argv.slice(2);
  if (!file) {
    console.error('Usage: node scripts/run-sql.js <file.sql> [bootstrap-admin-email]');
    process.exit(1);
  }
  let sql = readFileSync(file, 'utf8');
  if (sql.includes('&BOOTSTRAP_ADMIN_EMAIL')) {
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      console.error('This file needs your admin email: node scripts/run-sql.js ../db/02_seed.sql you@hadya.com');
      process.exit(1);
    }
    sql = sql.replaceAll('&BOOTSTRAP_ADMIN_EMAIL', email.toLowerCase().replace(/'/g, "''"));
  }
  const statements = splitStatements(sql);
  console.log(`${statements.length} statements in ${file}`);

  const conn = await oracledb.getConnection({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECT_STRING,
    configDir: process.env.DB_WALLET_DIR,
    walletLocation: process.env.DB_WALLET_DIR,
    walletPassword: process.env.DB_WALLET_PASSWORD,
    connectTimeout: 20,
  });

  let ok = 0;
  try {
    for (const [i, stmt] of statements.entries()) {
      try {
        await conn.execute(stmt);
        ok++;
      } catch (e) {
        const head = stmt.split('\n')[0].slice(0, 80);
        console.error(`\n✗ Statement ${i + 1} failed: ${head}\n  ${e.message}`);
        await conn.rollback();
        console.error(`Stopped. ${ok} statements ran before this one; data changes in this run were rolled back (tables already created stay).`);
        process.exitCode = 1;
        return;
      }
    }
    await conn.commit();
    console.log(`✓ Done: ${ok} statements, committed.`);
  } finally {
    await conn.close();
  }
}

if (process.argv[1] && process.argv[1].endsWith('run-sql.js')) {
  main().catch((e) => { console.error('FAILED:', e.code || '', e.message); process.exit(1); });
}