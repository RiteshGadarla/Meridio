/**
 * FILE: backend/src/modules/health/health.routes.ts
 * PURPOSE: Liveness and readiness probes for hosting platforms and uptime monitors.
 * LAYER: Route (no auth, no tenant data)
 * USED BY: app.ts (mounted at /api/v1/health)
 * DEPENDS ON: lib/prisma.ts (default database check)
 * NOTES: /live answers 200 if the process runs. /ready also proves the database is reachable, so a
 *        platform can hold traffic until Neon wakes up. Neither exposes internal error details.
 */
import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { ok } from '../../utils/api-response.js';
import { AppError } from '../../utils/app-error.js';

/** Function that resolves if the database answers and rejects otherwise. */
export type DatabaseCheck = () => Promise<void>;

/** Default check: a trivial query through the shared Prisma client. */
export const defaultDatabaseCheck: DatabaseCheck = async () => {
  await prisma.$queryRaw`SELECT 1`;
};

/**
 * Builds the health router.
 * @param checkDatabase injectable so tests can simulate a database outage
 */
export function createHealthRouter(checkDatabase: DatabaseCheck = defaultDatabaseCheck): Router {
  const router = Router();

  router.get('/live', (_req, res) => ok(res, { status: 'live' }));

  router.get('/ready', async (req, res, next) => {
    try {
      await checkDatabase();
      ok(res, { status: 'ready' });
    } catch (error) {
      req.log?.error({ err: error, requestId: req.id }, 'Readiness check failed');
      next(new AppError('SERVICE_UNAVAILABLE', 'Database is not reachable'));
    }
  });

  return router;
}
