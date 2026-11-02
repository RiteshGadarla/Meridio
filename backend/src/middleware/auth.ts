/**
 * FILE: backend/src/middleware/auth.ts
 * PURPOSE: requireAuth: verifies the session cookie and attaches req.auth = { userId, organizationId }.
 * LAYER: Middleware
 * USED BY: auth.routes.ts (/auth/me) and every protected router in later stages
 * DEPENDS ON: lib/jwt.ts, auth.cookie.ts, PrismaClient, AppError
 * NOTES: TENANT SCOPE: this is the ONLY place organizationId enters a request. It is read from
 *        the database row of the verified user, never from body, query, params or even the token.
 */
import type { Request, RequestHandler } from 'express';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { JwtService } from '../lib/jwt.js';
import { readSessionCookie } from '../modules/auth/auth.cookie.js';
import { AppError } from '../utils/app-error.js';

/** Identity of the caller, derived server-side. */
export interface AuthContext {
  userId: string;
  organizationId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- the only way to augment Express's Request
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

const unauthenticated = () => new AppError('UNAUTHENTICATED', 'Authentication required');

/**
 * Creates the auth middleware.
 * SECURITY: the user is loaded from the DB on EVERY request, so deleting a user (or their org)
 * revokes access immediately even though their JWT has not expired.
 * @throws (via next) AppError UNAUTHENTICATED for a missing, tampered, expired or orphaned token
 */
export function requireAuth(deps: { jwt: JwtService; prisma: PrismaClient }): RequestHandler {
  return async (req, _res, next) => {
    try {
      const token = readSessionCookie(req);
      if (!token) return next(unauthenticated());

      let claims;
      try {
        claims = deps.jwt.verify(token);
      } catch {
        // EDGE CASE: expired, tampered or malformed tokens all look the same to the client.
        return next(unauthenticated());
      }

      const user = await deps.prisma.user.findUnique({
        where: { id: claims.sub },
        select: { id: true, organizationId: true },
      });
      if (!user) return next(unauthenticated());

      // TENANT SCOPE: organizationId comes from the DB row, not from claims.org.
      req.auth = { userId: user.id, organizationId: user.organizationId };
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Returns req.auth or throws UNAUTHENTICATED; lets controllers avoid non-null assertions. */
export function getAuth(req: Request): AuthContext {
  if (!req.auth) throw unauthenticated();
  return req.auth;
}
