import { existsSync } from 'node:fs';
import { z } from 'zod';

// Local development convenience: load ./.env if present (never overrides real env vars).
// In production, configuration comes from the container environment / secrets.
if (existsSync('.env') && process.env.NODE_ENV !== 'production') process.loadEnvFile('.env');

/**
 * Environment configuration. Validated once at startup: the process refuses to start with an
 * invalid or insecure configuration (fail closed). Never read process.env elsewhere.
 */
const bool = z
  .union([z.boolean(), z.string()])
  .transform((v) => v === true || v === '1' || v === 'true');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().default(3000),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:5173')
      .transform((v) =>
        v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    TRUST_PROXY: bool.default(false),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    DATABASE_URL: z.string().min(1),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(200).default(10),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
    COOKIE_SECURE: bool.default(false),
    LOGIN_MAX_FAILED_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
    LOGIN_LOCKOUT_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
    STORAGE_DIR: z.string().default('./storage'),
    SEED_ADMIN_EMAIL: z.string().default('admin@cdms.local'),
    SEED_ADMIN_PASSWORD: z.string().optional(),
    SEED_DEMO_DATA: bool.default(true),
    /** Optional fixed password for demo accounts (non-production only). Random when empty. */
    SEED_DEMO_PASSWORD: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      if (env.JWT_ACCESS_SECRET.startsWith('change-me'))
        ctx.addIssue({
          code: 'custom',
          path: ['JWT_ACCESS_SECRET'],
          message: 'Default secret in production',
        });
      if (!env.COOKIE_SECURE)
        ctx.addIssue({
          code: 'custom',
          path: ['COOKIE_SECURE'],
          message: 'Must be 1 in production (HTTPS)',
        });
    }
  });

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached && source === process.env) return cached;
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${msg}`);
  }
  if (source === process.env) cached = parsed.data;
  return parsed.data;
}

export const ENV = Symbol('ENV');
