/**
 * FILE: backend/src/lib/logger.ts
 * PURPOSE: Creates the pino logger with secret redaction, pretty output in dev and JSON in prod.
 * LAYER: Library
 * USED BY: app.ts (pino-http), error-handler, server.ts
 * DEPENDS ON: pino, pino-pretty (dev only)
 * NOTES: SECURITY: never log passwords, tokens, cookies or full request bodies.
 */
import { pino, type DestinationStream, type Logger } from 'pino';
import type { Env } from '../config/env.js';

/**
 * Paths whose values are replaced with "[Redacted]" before anything is written.
 * Covers request/response headers (cookies, auth) and any password-like field at any depth one level
 * down, plus the request body we deliberately never log.
 */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'req.body',
  'password',
  'passwordHash',
  'confirmPassword',
  '*.password',
  '*.passwordHash',
  '*.confirmPassword',
];

/**
 * Builds the application logger.
 * @param env validated config (decides level and pretty printing)
 * @param destination optional stream, used by tests to capture output
 */
export function createLogger(env: Pick<Env, 'NODE_ENV'>, destination?: DestinationStream): Logger {
  const options = {
    level: env.NODE_ENV === 'test' ? 'silent' : 'info',
    redact: { paths: REDACT_PATHS, censor: '[Redacted]' },
  };
  // WHY: pino-pretty is human friendly but slow; production keeps fast structured JSON for log tools.
  if (!destination && env.NODE_ENV === 'development') {
    return pino({ ...options, transport: { target: 'pino-pretty', options: { colorize: true } } });
  }
  return destination ? pino(options, destination) : pino(options);
}
