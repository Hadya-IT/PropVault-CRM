import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import pino from 'pino';
import { loadConfig } from '../src/config.js';
import { buildApp } from '../src/app.js';
import { createSessionManager } from '../src/auth/session.js';
import { unauthorized } from '../src/lib/errors.js';

const cfg = loadConfig({
  NODE_ENV: 'test',
  SESSION_SECRET: 'x'.repeat(40),
  ENTRA_TENANT_ID: 'd99305b7-6b48-4009-b8e6-efbef47e3b95',
  ENTRA_CLIENT_ID: 'ae0f5bfa-6a00-4f2c-8f8b-656d051e6764',
  CORS_ORIGINS: 'http://localhost:5173',
});
const app = buildApp({
  cfg,
  logger: pino({ level: 'silent' }),
  verifyIdToken: async () => { throw unauthorized('Microsoft sign-in could not be verified'); },
  sessions: createSessionManager({ secret: cfg.SESSION_SECRET, ttlMinutes: 60, secure: false }),
});

test('health is public', async () => {
  await request(app).get('/api/health').expect(200, { ok: true });
});

test('API requires a session', async () => {
  const r = await request(app).get('/api/me').expect(401);
  assert.equal(r.body.error.code, 'unauthorized');
});

test('forged session cookie is rejected', async () => {
  await request(app).get('/api/me').set('Cookie', 'pv_session=eyJhbGciOiJub25lIn0.e30.').expect(401);
});

test('state-changing request without CSRF header is blocked', async () => {
  await request(app).post('/api/auth/login').send({ idToken: 'a'.repeat(50) }).expect(403);
});

test('invalid Microsoft token is rejected', async () => {
  await request(app).post('/api/auth/login').set('X-PV-Request', '1').send({ idToken: 'a'.repeat(50) }).expect(401);
});

test('dev login is not mounted unless enabled', async () => {
  const r = await request(app).post('/api/auth/dev-login').set('X-PV-Request', '1').send({ email: 'a@b.com' });
  assert.notEqual(r.status, 200);
});

test('security headers are set', async () => {
  const r = await request(app).get('/api/health');
  assert.ok(r.headers['content-security-policy']);
  assert.equal(r.headers['x-powered-by'], undefined);
});

test('CORS allows only configured origin', async () => {
  const ok = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
  assert.equal(ok.headers['access-control-allow-origin'], 'http://localhost:5173');
  const bad = await request(app).get('/api/health').set('Origin', 'https://evil.example');
  assert.equal(bad.headers['access-control-allow-origin'], undefined);
});

test('production refuses dev login', () => {
  assert.throws(() => loadConfig({ ...cfg, NODE_ENV: 'production', AUTH_DEV_LOGIN: 'true', SESSION_SECRET: 'x'.repeat(40), ENTRA_TENANT_ID: cfg.ENTRA_TENANT_ID, ENTRA_CLIENT_ID: cfg.ENTRA_CLIENT_ID }), /AUTH_DEV_LOGIN/);
});
