/**
 * FILE: backend/src/modules/auth/auth.routes.ts
 * PURPOSE: Wires /auth routes: rate limit -> validation -> controller.
 * LAYER: Route (ROUTE -> Middleware -> Validation -> Controller -> Service -> Prisma)
 * USED BY: app.ts (mounted at /api/v1/auth)
 * DEPENDS ON: auth.controller.ts, auth.service.ts, middleware/{auth,validate,rate-limit}.ts
 */
import { Router, type RequestHandler } from 'express';
import { googleCompleteSchema, loginSchema, signupSchema } from '@meridio/contracts';
import type { PrismaClient } from '../../generated/prisma/client.js';
import type { GoogleOAuthClient } from '../../lib/google-oauth.js';
import type { JwtService } from '../../lib/jwt.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createAuthController } from './auth.controller.js';
import { createAuthService } from './auth.service.js';
import { createGoogleController } from './google.controller.js';

export function createAuthRouter(deps: {
  prisma: PrismaClient;
  jwt: JwtService;
  isProduction: boolean;
  /** null when Google credentials are not configured. */
  google: GoogleOAuthClient | null;
  jwtSecret: string;
  appOrigin: string;
  limiters: { login: RequestHandler; signup: RequestHandler };
}): Router {
  const controller = createAuthController({
    service: createAuthService(deps.prisma),
    jwt: deps.jwt,
    isProduction: deps.isProduction,
  });
  const google = createGoogleController({
    service: createAuthService(deps.prisma),
    jwt: deps.jwt,
    google: deps.google,
    jwtSecret: deps.jwtSecret,
    appOrigin: deps.appOrigin,
    isProduction: deps.isProduction,
  });
  const router = Router();

  // SECURITY: limiters run before validation so junk requests are counted too.
  router.post('/signup', deps.limiters.signup, validate(signupSchema, 'body'), controller.signup);
  router.post('/login', deps.limiters.login, validate(loginSchema, 'body'), controller.login);
  // Google sign-in (see google.controller.ts for the flow). The callback is a GET navigation from
  // Google, so it is covered by the state cookie rather than the Origin check.
  router.get('/google', deps.limiters.login, google.start);
  router.get('/google/callback', deps.limiters.login, google.callback);
  router.get('/google/pending', google.pending);
  router.post(
    '/google/complete',
    deps.limiters.signup,
    validate(googleCompleteSchema, 'body'),
    google.complete,
  );
  router.post('/logout', controller.logout);
  router.get('/me', requireAuth({ jwt: deps.jwt, prisma: deps.prisma }), controller.me);

  return router;
}
