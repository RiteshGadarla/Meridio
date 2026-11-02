/**
 * FILE: backend/src/modules/auth/auth.controller.ts
 * PURPOSE: HTTP layer for auth: reads the validated body, calls the service, sets/clears the cookie.
 * LAYER: Controller (Route -> Middleware -> Validation -> CONTROLLER -> Service -> Prisma)
 * USED BY: auth.routes.ts
 * DEPENDS ON: auth.service.ts, auth.cookie.ts, lib/jwt.ts, middleware/auth.ts
 */
import type { LoginInput, SignupInput } from '@meridio/contracts';
import type { JwtService } from '../../lib/jwt.js';
import { getAuth } from '../../middleware/auth.js';
import { ok } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { clearSessionCookie, setSessionCookie } from './auth.cookie.js';
import type { AuthService } from './auth.service.js';

export function createAuthController(deps: {
  service: AuthService;
  jwt: JwtService;
  isProduction: boolean;
}) {
  const { service, jwt, isProduction } = deps;
  const startSession = (
    res: Parameters<typeof setSessionCookie>[0],
    claims: { sub: string; org: string },
  ) => setSessionCookie(res, jwt.sign(claims), { isProduction, maxAgeSeconds: jwt.maxAgeSeconds });

  return {
    signup: asyncHandler(async (req, res) => {
      // req.body was replaced by the validated, normalised value (see validate middleware).
      const { user, token } = await service.signup(req.body as SignupInput);
      startSession(res, token);
      ok(res, user, undefined, 201);
    }),

    login: asyncHandler(async (req, res) => {
      const { user, token } = await service.login(req.body as LoginInput);
      startSession(res, token);
      ok(res, user);
    }),

    logout: asyncHandler(async (_req, res) => {
      clearSessionCookie(res, { isProduction });
      ok(res, { loggedOut: true });
    }),

    me: asyncHandler(async (req, res) => {
      // TENANT SCOPE: the user id comes from req.auth (verified JWT + DB), never from the request.
      ok(res, await service.getCurrentUser(getAuth(req).userId));
    }),
  };
}
