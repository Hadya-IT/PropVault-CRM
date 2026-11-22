import { Router } from 'express';
import { z } from 'zod';
import { ah, unauthorized, forbidden, badRequest } from '../lib/errors.js';
import { query, tx } from '../db.js';
import { findUserForLogin, invalidate, writeAudit } from '../lib/repo.js';

export function authRoutes({ verifyIdToken, sessions, cfg }) {
  const r = Router();

  r.post('/login', ah(async (req, res) => {
    const { idToken } = z.object({ idToken: z.string().min(20).max(8000) }).parse(req.body ?? {});
    const id = await verifyIdToken(idToken);
    const user = await findUserForLogin(id);
    // Only pre-provisioned users can sign in. Same message for "unknown" and "disabled".
    if (!user || user.active !== 1) throw forbidden('Your account has not been given access to Hadya CRM. Contact IT.');
    if (user.entra_oid && user.entra_oid !== id.oid) throw unauthorized('Account mismatch. Contact IT.');

    await tx(async (exec) => {
      await exec(
        'UPDATE app_users SET entra_oid = NVL(entra_oid, :oid), display_name = :name, last_login_at = SYSTIMESTAMP WHERE id = :id',
        { oid: id.oid, name: id.name.slice(0, 150), id: user.id },
      );
      await writeAudit(exec, { userId: user.id, action: 'login', req });
    });
    invalidate(`user:${user.id}`);
    await sessions.issue(res, user.id);
    res.json({ ok: true });
  }));

  // Local development only (blocked in production by config validation).
  if (cfg.AUTH_DEV_LOGIN && !cfg.isProd) {
    r.post('/dev-login', ah(async (req, res) => {
      const parsed = z.object({ email: z.string().email() }).safeParse(req.body ?? {});
      if (!parsed.success) throw badRequest('Email required');
      const { rows } = await query('SELECT id, active FROM app_users WHERE LOWER(email) = :e', { e: parsed.data.email.toLowerCase() });
      if (!rows[0] || rows[0].active !== 1) throw forbidden('Unknown user');
      await sessions.issue(res, rows[0].id);
      res.json({ ok: true, dev: true });
    }));
  }

  r.post('/logout', (req, res) => {
    sessions.clear(res);
    res.json({ ok: true });
  });

  r.get('/config', (_req, res) => {
    res.json({ devLogin: Boolean(cfg.AUTH_DEV_LOGIN && !cfg.isProd) });
  });

  return r;
}