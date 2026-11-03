/**
 * FILE: backend/src/modules/activity/activity.routes.ts
 * PURPOSE: GET /activity: a page of feed entries (newest first, filterable) for the caller's organization.
 * LAYER: Route (ROUTE -> Middleware -> Validation -> Controller -> Service -> Prisma)
 * USED BY: app.ts (mounted at /api/v1/activity)
 * DEPENDS ON: activity.service.ts, middleware/{auth,validate}.ts, @meridio/contracts
 */
import { Router } from 'express';
import { listActivityQuerySchema, type ListActivityQuery } from '@meridio/contracts';
import type { PrismaClient } from '../../generated/prisma/client.js';
import type { JwtService } from '../../lib/jwt.js';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { ok } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { createActivityService } from './activity.service.js';

/** SECURITY: behind requireAuth; the organization comes from the verified session only. */
export function createActivityRouter(deps: { prisma: PrismaClient; jwt: JwtService }): Router {
  const service = createActivityService(deps.prisma);
  const router = Router();
  router.use(requireAuth({ jwt: deps.jwt, prisma: deps.prisma }));

  router.get(
    '/',
    validate(listActivityQuerySchema, 'query'),
    asyncHandler(async (req, res) => {
      const { organizationId } = getAuth(req); // TENANT SCOPE
      const { entries, meta } = await service.list(
        organizationId,
        req.query as unknown as ListActivityQuery,
      );
      ok(res, entries, meta as unknown as Record<string, unknown>);
    }),
  );

  return router;
}
