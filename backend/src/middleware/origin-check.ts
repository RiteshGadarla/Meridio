/**
 * FILE: backend/src/middleware/origin-check.ts
 * PURPOSE: Blocks state-changing requests that come from a foreign website (CSRF defence in depth).
 * LAYER: Middleware
 * USED BY: app.ts
 * DEPENDS ON: AppError
 * NOTES: SECURITY: the session cookie is SameSite=Lax; this check additionally rejects POST, PATCH,
 *        PUT and DELETE whose Origin header is present but is not our frontend. A missing Origin
 *        (curl, server-to-server, same-origin requests from some clients) is allowed: browsers always
 *        send Origin on cross-site unsafe requests, which is the case we need to stop.
 */
import type { RequestHandler } from 'express';
import { AppError } from '../utils/app-error.js';

const UNSAFE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * Creates the origin-check middleware.
 * @param allowedOrigin exact allowed origin, e.g. https://stockflow.vercel.app
 */
export function originCheck(allowedOrigin: string): RequestHandler {
  return (req, _res, next) => {
    const origin = req.headers.origin;
    if (UNSAFE_METHODS.has(req.method) && origin !== undefined && origin !== allowedOrigin) {
      return next(new AppError('FORBIDDEN_ORIGIN', 'Request origin is not allowed'));
    }
    next();
  };
}
