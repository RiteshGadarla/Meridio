/**
 * FILE: backend/src/modules/auth/google.controller.ts
 * PURPOSE: HTTP layer for "Continue with Google": start the flow, handle Google's callback, and
 *          finish signup for new users once they have named their organization.
 * LAYER: Controller (Route -> Middleware -> Validation -> CONTROLLER -> Service -> Prisma)
 * USED BY: auth.routes.ts
 * DEPENDS ON: auth.service.ts, lib/google-oauth.ts, auth.cookie.ts, jsonwebtoken
 * NOTES: Flow, in order:
 *   1. GET  /auth/google            sets a one-time `state` cookie, redirects to Google.
 *   2. GET  /auth/google/callback   checks state, exchanges the code. Existing user: session cookie
 *                                   and redirect to /dashboard. New user: a short-lived "pending"
 *                                   cookie (no database row yet) and redirect to /signup/organization.
 *   3. GET  /auth/google/pending    tells that page who the pending user is.
 *   4. POST /auth/google/complete   creates organization + user, starts the session.
 *   WHY a pending cookie instead of a half-created user: a user row cannot exist without an
 *   organization (tenant isolation), and abandoning the page must leave nothing behind.
 */
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { GoogleCompleteInput, GooglePendingProfile } from '@meridio/contracts';
import type { GoogleOAuthClient } from '../../lib/google-oauth.js';
import type { JwtService } from '../../lib/jwt.js';
import { ok } from '../../utils/api-response.js';
import { AppError } from '../../utils/app-error.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { setSessionCookie } from './auth.cookie.js';
import type { AuthService, GoogleIdentity } from './auth.service.js';

const STATE_COOKIE = 'sf_oauth_state';
const PENDING_COOKIE = 'sf_google_pending';
const FLOW_TTL_SECONDS = 10 * 60;
const PENDING_PURPOSE = 'google-signup';

export function createGoogleController(deps: {
  service: AuthService;
  jwt: JwtService;
  /** null when Google credentials are not configured. */
  google: GoogleOAuthClient | null;
  jwtSecret: string;
  appOrigin: string;
  isProduction: boolean;
}) {
  const { service, jwt: sessionJwt, google, jwtSecret, appOrigin, isProduction } = deps;

  // SECURITY: httpOnly + Lax. Lax is required: the callback is a cross-site top-level GET from
  // Google, and Lax is the strictest setting that still sends the cookie on it.
  const flowCookie: CookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
  };
  const redirectTo = (res: Response, path: string) => res.redirect(`${appOrigin}${path}`);

  const readPending = (req: Request): GoogleIdentity => {
    const raw: unknown = req.cookies?.[PENDING_COOKIE];
    try {
      if (typeof raw !== 'string') throw new Error('missing');
      const d = jwt.verify(raw, jwtSecret, { algorithms: ['HS256'] });
      if (typeof d !== 'object' || d.purpose !== PENDING_PURPOSE) throw new Error('wrong token');
      return {
        sub: String(d.gid),
        email: String(d.email),
        name: typeof d.name === 'string' ? d.name : null,
        pictureUrl: typeof d.picture === 'string' ? d.picture : null,
      };
    } catch {
      throw new AppError('UNAUTHENTICATED', 'Your Google sign-up expired. Please start again.');
    }
  };

  return {
    start: asyncHandler(async (_req, res) => {
      if (!google) return redirectTo(res, '/login?error=google_unavailable');
      const state = randomBytes(24).toString('base64url');
      res.cookie(STATE_COOKIE, state, { ...flowCookie, maxAge: FLOW_TTL_SECONDS * 1000 });
      res.redirect(google.buildAuthUrl(state));
    }),

    callback: asyncHandler(async (req, res) => {
      if (!google) return redirectTo(res, '/login?error=google_unavailable');
      const expected = req.cookies?.[STATE_COOKIE] as unknown;
      res.clearCookie(STATE_COOKIE, flowCookie); // one use only

      const { code, state, error } = req.query;
      if (error === 'access_denied') return redirectTo(res, '/login?error=google_denied');

      // SECURITY: state must match the cookie set in start(), or this callback was not initiated
      // by this browser (login CSRF). Constant-time compare.
      const a = Buffer.from(typeof state === 'string' ? state : '');
      const b = Buffer.from(typeof expected === 'string' ? expected : '');
      if (
        typeof code !== 'string' ||
        a.length === 0 ||
        a.length !== b.length ||
        !timingSafeEqual(a, b)
      ) {
        return redirectTo(res, '/login?error=google_failed');
      }

      let profile;
      try {
        profile = await google.exchangeCode(code);
      } catch (error_) {
        req.log?.warn({ err: error_ }, 'google code exchange failed');
        return redirectTo(res, '/login?error=google_failed');
      }
      // SECURITY: an unverified email could belong to someone else; never trust it for linking.
      if (!profile.emailVerified) return redirectTo(res, '/login?error=google_unverified');

      const identity: GoogleIdentity = {
        sub: profile.sub,
        email: profile.email,
        name: profile.name,
        pictureUrl: profile.pictureUrl,
      };
      const session = await service.loginWithGoogle(identity);
      if (session) {
        setSessionCookie(res, sessionJwt.sign(session.token), {
          isProduction,
          maxAgeSeconds: sessionJwt.maxAgeSeconds,
        });
        return redirectTo(res, '/dashboard');
      }

      const pending = jwt.sign(
        {
          purpose: PENDING_PURPOSE,
          gid: identity.sub,
          email: identity.email,
          name: identity.name,
          picture: identity.pictureUrl,
        },
        jwtSecret,
        { algorithm: 'HS256', expiresIn: FLOW_TTL_SECONDS },
      );
      res.cookie(PENDING_COOKIE, pending, { ...flowCookie, maxAge: FLOW_TTL_SECONDS * 1000 });
      redirectTo(res, '/signup/organization');
    }),

    pending: asyncHandler(async (req, res) => {
      const p = readPending(req);
      const profile: GooglePendingProfile = {
        email: p.email,
        name: p.name,
        pictureUrl: p.pictureUrl,
      };
      ok(res, profile);
    }),

    complete: asyncHandler(async (req, res) => {
      const identity = readPending(req);
      const { organizationName } = req.body as GoogleCompleteInput;
      const { user, token } = await service.completeGoogleSignup(identity, organizationName);
      res.clearCookie(PENDING_COOKIE, flowCookie);
      setSessionCookie(res, sessionJwt.sign(token), {
        isProduction,
        maxAgeSeconds: sessionJwt.maxAgeSeconds,
      });
      ok(res, user, undefined, 201);
    }),
  };
}
