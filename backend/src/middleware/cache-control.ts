/**
 * FILE: backend/src/middleware/cache-control.ts
 * PURPOSE: Marks API responses as private and uncacheable.
 * LAYER: Middleware
 * USED BY: app.ts
 * NOTES: SECURITY: responses are tenant-specific. A shared cache (CDN, proxy) must never store one
 *        tenant's data and serve it to another. Health checks are exempt so monitors can cache-bust
 *        nothing and platforms can treat them as plain probes.
 */
import type { RequestHandler } from 'express';

export const cacheControl: RequestHandler = (req, res, next) => {
  if (!req.path.startsWith('/health')) {
    res.setHeader('Cache-Control', 'private, no-store');
  }
  next();
};
