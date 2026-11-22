import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { HttpError } from './lib/errors.js';
import { requireAuth, requireAdmin, requireCsrfHeader } from './middleware/auth.js';
import { authRoutes } from './routes/auth.js';
import { meRoutes } from './routes/me.js';
import { recordRoutes } from './routes/records.js';
import { adminRoutes } from './routes/admin.js';
import { overviewRoutes } from './routes/overview.js';

export function buildApp({ cfg, logger, verifyIdToken, sessions }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', cfg.TRUST_PROXY);

  app.use(pinoHttp({
    logger,
    genReqId: (req) => req.get('X-Request-Id')?.slice(0, 64) || randomUUID(),
    redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
  }));

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'connect-src': ["'self'", 'https://login.microsoftonline.com'],
        'frame-src': ["'self'", 'https://login.microsoftonline.com'],
        'img-src': ["'self'", 'data:'],
        'script-src': ["'self'"],
        'style-src': ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));
  app.use(compression());
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // CORS: only our own front-end origins, with credentials.
  app.use((req, res, next) => {
    const origin = req.get('Origin');
    if (origin && cfg.corsOrigins.includes(origin)) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Access-Control-Allow-Credentials', 'true');
      res.set('Vary', 'Origin');
      res.set('Access-Control-Allow-Headers', 'Content-Type, X-PV-Request');
      res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  const authLimiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false });
  const apiLimiter = rateLimit({ windowMs: 60_000, limit: 600, standardHeaders: 'draft-7', legacyHeaders: false });

  app.use('/api', requireCsrfHeader);
  app.use('/api/auth', authLimiter, authRoutes({ verifyIdToken, sessions, cfg }));

  const authed = express.Router();
  authed.use(apiLimiter, requireAuth(sessions));
  authed.use('/', meRoutes());
  authed.use('/', overviewRoutes());
  authed.use('/admin', requireAdmin, adminRoutes());
  authed.use('/e/:entityCode/m/:slug/records', recordRoutes());
  app.use('/api', authed);

  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'not_found', message: 'Not found' } }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: { code: 'bad_request', message: 'Validation failed', details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) } });
    }
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    }
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: { code: 'too_large', message: 'Request too large' } });
    req.log?.error({ err }, 'unhandled error');
    res.status(500).json({ error: { code: 'server_error', message: 'Something went wrong', requestId: req.id } });
  });

  return app;
}