/**
 * FILE: backend/src/modules/auth/auth.cookie.ts
 * PURPOSE: Sets and clears the session cookie with one shared set of attributes.
 * LAYER: Module helper (used by the controller)
 * USED BY: auth.controller.ts, middleware/auth.ts
 * DEPENDS ON: express
 * NOTES: Clearing a cookie only works if path/sameSite/secure match how it was set, so both
 *        operations read the same options from one function.
 */
import type { CookieOptions, Request, Response } from 'express';

export const SESSION_COOKIE = 'sf_session';

/**
 * Cookie attributes shared by set and clear.
 * SECURITY: httpOnly keeps the token away from JavaScript (XSS cannot steal it); secure is on in
 * production so it never travels over plain HTTP.
 * WHY sameSite=lax works: the browser only talks to the Vercel origin and Vercel rewrites /api to
 * Render, so the cookie is first-party. Lax also stops it being sent on cross-site POSTs (CSRF).
 */
function baseOptions(isProduction: boolean): CookieOptions {
  return { httpOnly: true, secure: isProduction, sameSite: 'lax', path: '/' };
}

/** Sets the session cookie; maxAge equals the JWT lifetime so both expire together. */
export function setSessionCookie(
  res: Response,
  token: string,
  opts: { isProduction: boolean; maxAgeSeconds: number },
): void {
  res.cookie(SESSION_COOKIE, token, {
    ...baseOptions(opts.isProduction),
    maxAge: opts.maxAgeSeconds * 1000,
  });
}

/** Clears the session cookie using the same attributes it was set with. */
export function clearSessionCookie(res: Response, opts: { isProduction: boolean }): void {
  res.clearCookie(SESSION_COOKIE, baseOptions(opts.isProduction));
}

/** Reads the raw session token from the request, if any. */
export function readSessionCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.[SESSION_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
