/**
 * FILE: backend/src/middleware/rate-limit.ts
 * PURPOSE: Rate limiters for the unauthenticated auth endpoints.
 * LAYER: Middleware
 * USED BY: auth.routes.ts
 * DEPENDS ON: express-rate-limit, AppError
 * NOTES: SECURITY: counters live in process memory. That is correct for the single Render
 *        instance this project deploys; a multi-instance deploy would need a shared store (Redis).
 */
import type { Request, RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { AppError } from '../utils/app-error.js';

/** Limits are injectable so tests can use tiny windows or switch limiting off. */
export interface RateLimitConfig {
  enabled: boolean;
  login: { max: number; windowMs: number };
  signup: { max: number; windowMs: number };
}

export const DEFAULT_RATE_LIMITS: RateLimitConfig = {
  enabled: true,
  login: { max: 10, windowMs: 15 * 60_000 },
  signup: { max: 5, windowMs: 60 * 60_000 },
};

const passThrough: RequestHandler = (_req, _res, next) => next();

function build(max: number, windowMs: number, key: (req: Request) => string): RequestHandler {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: key,
    handler: (_req, _res, next) =>
      next(new AppError('RATE_LIMITED', 'Too many attempts. Please try again later.')),
  });
}

const ipOf = (req: Request) => ipKeyGenerator(req.ip ?? '');

/**
 * Builds both limiters.
 * SECURITY: login is keyed by IP + email, so one attacker cannot lock a victim out from another IP,
 * yet guessing one account's password from one IP is capped. Signup is keyed by IP only.
 */
export function createRateLimiters(config: RateLimitConfig): {
  login: RequestHandler;
  signup: RequestHandler;
} {
  if (!config.enabled) return { login: passThrough, signup: passThrough };
  return {
    login: build(config.login.max, config.login.windowMs, (req) => {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      return `${ipOf(req)}|${email}`;
    }),
    signup: build(config.signup.max, config.signup.windowMs, ipOf),
  };
}
