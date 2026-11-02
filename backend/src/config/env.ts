/**
 * FILE: backend/src/config/env.ts
 * PURPOSE: Validates process.env once at startup and returns a typed, immutable config.
 * LAYER: Config
 * USED BY: server.ts, app.ts, lib/logger.ts, tests
 * DEPENDS ON: zod
 * NOTES: SECURITY: error messages list variable NAMES and rules, never values, so a misconfigured
 *        secret can never leak into logs or CI output.
 */
import { z } from 'zod';

// ===== Schema =====

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  // ONE database URL. Pooled or direct both work; migrations derive the direct form themselves.
  DATABASE_URL: z.string().min(1, 'is required (Neon connection string)'),
  // SECURITY: 32 characters minimum so the HMAC signing key cannot be brute-forced cheaply.
  JWT_SECRET: z.string().min(32, 'must be at least 32 characters'),
  // WHY regex: the same value drives the JWT lifetime AND the cookie maxAge (see lib/jwt.ts).
  JWT_EXPIRES_IN: z
    .string()
    .regex(/^\d+[smhd]?$/, 'must look like 7d, 12h, 30m or a number of seconds')
    .default('7d'),
  // WHY configurable: req.ip (used by rate limiting) must be the real visitor, not a proxy. Locally
  // there is 1 hop (the Vite proxy). In production there are 2 (Vercel rewrite -> Render's load
  // balancer), so render.yaml sets 2. Too LOW groups all visitors under one proxy IP (shared rate
  // limit); too HIGH lets a visitor spoof their IP with an X-Forwarded-For header.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
  // WHY normalise to origin: browsers send "Origin: https://host" with no trailing slash or path,
  // so comparing against a value like "https://host/" would wrongly reject every request.
  APP_ORIGIN: z
    .url('must be a valid URL such as http://localhost:5173')
    .transform((v) => new URL(v).origin),
});

export type Env = z.infer<typeof envSchema>;

// ===== Loader =====

/**
 * Parses and validates environment variables.
 * @param source variables to read (defaults to process.env; injectable for tests)
 * @returns the validated config
 * @throws Error listing every invalid variable name and rule (never the values)
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (result.success) return result.data;

  const lines = result.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`);
  throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
}
