/**
 * FILE: backend/src/modules/settings/settings.routes.ts
 * PURPOSE: GET/PATCH /settings (controller inlined: two thin handlers).
 * LAYER: Route + Controller (ROUTE -> Middleware -> Validation -> Controller -> Service -> Prisma)
 * USED BY: app.ts (mounted at /api/v1/settings)
 * DEPENDS ON: settings.service.ts, middleware/{auth,validate}.ts, @meridio/contracts
 */
import { Router } from 'express';
import { updateSettingsSchema, type UpdateSettingsInput } from '@meridio/contracts';
import type { PrismaClient } from '../../generated/prisma/client.js';
import type { JwtService } from '../../lib/jwt.js';
import { getAuth, requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { ok } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { createSettingsService } from './settings.service.js';

export function createSettingsRouter(deps: { prisma: PrismaClient; jwt: JwtService }): Router {
  const service = createSettingsService(deps.prisma);
  const router = Router();
  router.use(requireAuth(deps)); // SECURITY: every settings route needs a session

  router.get(
    '/',
    asyncHandler(async (req, res) => ok(res, await service.get(getAuth(req).organizationId))),
  );

  router.patch(
    '/',
    validate(updateSettingsSchema, 'body'),
    asyncHandler(async (req, res) =>
      ok(res, await service.update(getAuth(req).organizationId, req.body as UpdateSettingsInput)),
    ),
  );

  return router;
}
