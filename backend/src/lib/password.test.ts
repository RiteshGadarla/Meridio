/**
 * FILE: backend/src/lib/password.test.ts
 * PURPOSE: Unit tests for bcrypt hashing helpers.
 */
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

// Protects: passwords are never stored in plaintext and verification is correct.
describe('password', () => {
  it('hashes with bcrypt (cost 12) and verifies the right password only', async () => {
    const hash = await hashPassword('Secret123');
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
    expect(hash).not.toContain('Secret123');
    expect(await verifyPassword('Secret123', hash)).toBe(true);
    expect(await verifyPassword('secret123', hash)).toBe(false);
  });

  // Why: salts must differ or identical passwords would be visible in the DB.
  it('produces a different hash each time', async () => {
    expect(await hashPassword('Secret123')).not.toBe(await hashPassword('Secret123'));
  });
});
