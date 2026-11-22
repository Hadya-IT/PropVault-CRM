import 'dotenv/config';
import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  SESSION_TTL_MINUTES: z.coerce.number().int().min(15).max(1440).default(480),
  ENTRA_TENANT_ID: z.string().uuid(),
  ENTRA_CLIENT_ID: z.string().uuid(),
  DB_USER: z.string().default(''),
  DB_PASSWORD: z.string().default(''),
  DB_CONNECT_STRING: z.string().default(''),
  DB_WALLET_DIR: z.string().optional(),
  DB_WALLET_PASSWORD: z.string().optional(),
  DB_POOL_MIN: z.coerce.number().int().min(0).default(2),
  DB_POOL_MAX: z.coerce.number().int().min(1).default(20),
  AUTH_DEV_LOGIN: bool,
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
});

export function loadConfig(env = process.env) {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid configuration:\n${msg}`);
  }
  const cfg = parsed.data;
  if (cfg.NODE_ENV === 'production' && cfg.AUTH_DEV_LOGIN) {
    throw new Error('AUTH_DEV_LOGIN must not be enabled in production');
  }
  return {
    ...cfg,
    isProd: cfg.NODE_ENV === 'production',
    corsOrigins: cfg.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
  };
}
