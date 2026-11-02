/**
 * FILE: backend/src/modules/dashboard/dashboard.routes.ts
 * PURPOSE: GET /dashboard/overview (controller inlined: one thin handler).
 * LAYER: Route + Controller (ROUTE -> Middleware -> Controller -> Service -> Prisma)
 * USED BY: app.ts (mounted at /api/v1/dashboard)
 * DEPENDS ON: dashboard.service.ts, middleware/auth.ts
 */
import { Router } from 'express';
import type { PrismaClient } from '../../generated/prisma/client.js';
import type { JwtService } from '../../lib/jwt.js';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { ok } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { createDashboardService } from './dashboard.service.js';

export function createDashboardRouter(deps: { prisma: PrismaClient; jwt: JwtService }): Router {
  const service = createDashboardService(deps.prisma);
  const router = Router();
  router.use(requireAuth(deps)); // SECURITY: session required

  router.get(
    '/overview',
    asyncHandler(async (req, res) =>
      ok(res, await service.getOverview(getAuth(req).organizationId)),
    ),
  );

  return router;
}
