/**
 * FILE: backend/src/lib/password.ts
 * PURPOSE: bcrypt hashing and verification of passwords.
 * LAYER: Library
 * USED BY: modules/auth/auth.service.ts, prisma/seed.ts (same cost)
 * DEPENDS ON: bcrypt
 */
import bcrypt from 'bcrypt';

// SECURITY: cost 12 is ~250ms per hash on a modern CPU: slow enough to hurt offline cracking,
// fast enough for login. Raising it later is safe because the cost is stored inside each hash.
export const BCRYPT_COST = 12;

/** Hashes a plaintext password. Never log or store the input. */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

/** Constant-time comparison of a plaintext password against a stored bcrypt hash. */
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
