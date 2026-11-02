/**
 * FILE: backend/src/lib/jwt.ts
 * PURPOSE: Signs and verifies the session JWT. Payload is { sub: userId, org: organizationId }.
 * LAYER: Library
 * USED BY: modules/auth (sign, cookie lifetime), middleware/auth.ts (verify)
 * DEPENDS ON: jsonwebtoken
 * NOTES: SECURITY: the algorithm is pinned to HS256 on both sign and verify, so a token cannot
 *        pick a weaker one ("alg: none" attack).
 */
import jwt from 'jsonwebtoken';

/** Claims stored in the session token. */
export interface SessionClaims {
  /** User id. */
  sub: string;
  /** Organization id at signup. Informational: the DB value is what requireAuth trusts. */
  org: string;
}

export interface JwtService {
  /** Lifetime in seconds; reused for the cookie maxAge so the two always match. */
  readonly maxAgeSeconds: number;
  sign(claims: SessionClaims): string;
  /** @throws if the token is malformed, tampered with, expired or has the wrong shape */
  verify(token: string): SessionClaims;
}

const UNIT_SECONDS = { s: 1, m: 60, h: 3600, d: 86_400 } as const;

/**
 * Converts "7d", "12h", "30m", "45s" (or a plain number of seconds) to seconds.
 * @throws Error when the format is not recognised
 */
export function parseDuration(value: string): number {
  const match = /^(\d+)([smhd]?)$/.exec(value.trim());
  if (!match) throw new Error(`Invalid duration "${value}". Use for example 7d, 12h, 30m.`);
  const unit = (match[2] || 's') as keyof typeof UNIT_SECONDS;
  return Number(match[1]) * UNIT_SECONDS[unit];
}

/**
 * Builds a JWT service bound to one secret and lifetime.
 * @example const jwtService = createJwtService({ secret, expiresIn: '7d' });
 */
export function createJwtService(config: { secret: string; expiresIn: string }): JwtService {
  const maxAgeSeconds = parseDuration(config.expiresIn);
  return {
    maxAgeSeconds,
    sign: (claims) =>
      jwt.sign(claims, config.secret, { algorithm: 'HS256', expiresIn: maxAgeSeconds }),
    verify: (token) => {
      const decoded = jwt.verify(token, config.secret, { algorithms: ['HS256'] });
      if (
        typeof decoded !== 'object' ||
        typeof decoded.sub !== 'string' ||
        typeof decoded.org !== 'string'
      ) {
        throw new Error('Unexpected token payload');
      }
      return { sub: decoded.sub, org: decoded.org };
    },
  };
}
