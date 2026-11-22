import pino from 'pino';
import { loadConfig } from './config.js';
import { initPool, closePool } from './db.js';
import { createEntraVerifier } from './auth/entra.js';
import { createSessionManager } from './auth/session.js';
import { buildApp } from './app.js';

const cfg = loadConfig();
const logger = pino({ level: cfg.isProd ? 'info' : 'debug' });

await initPool(cfg);
logger.info('Oracle pool ready');

const app = buildApp({
  cfg,
  logger,
  verifyIdToken: createEntraVerifier({ tenantId: cfg.ENTRA_TENANT_ID, clientId: cfg.ENTRA_CLIENT_ID }),
  sessions: createSessionManager({ secret: cfg.SESSION_SECRET, ttlMinutes: cfg.SESSION_TTL_MINUTES, secure: cfg.isProd }),
});

const server = app.listen(cfg.PORT, () => logger.info(`Hadya CRM API on :${cfg.PORT}`));
server.headersTimeout = 30_000;
server.requestTimeout = 30_000;

async function shutdown(sig) {
  logger.info(`${sig}: shutting down`);
  server.close(async () => {
    await closePool().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 15_000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);