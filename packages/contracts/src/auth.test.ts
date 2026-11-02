/**
 * FILE: packages/contracts/src/auth.test.ts
 * PURPOSE: Locks the signup/login validation rules shared by API and UI.
 */
import { describe, expect, it } from 'vitest';
import { loginSchema, signupFormSchema, signupSchema } from './auth.js';

const valid = { email: ' A@X.com ', password: 'passw0rdOK', organizationName: '  Acme  ' };

// Protects: normalisation (trim/lowercase) happens in one place, before anything touches the DB.
describe('signupSchema', () => {
  it('normalises email and organization name', () => {
    const out = signupSchema.parse(valid);
    expect(out.email).toBe('a@x.com');
    expect(out.organizationName).toBe('Acme');
  });

  it.each([
    ['email', { ...valid, email: 'nope' }],
    ['password', { ...valid, password: 'short1' }],
    ['password', { ...valid, password: 'noNumbersHere' }],
    ['password', { ...valid, password: '12345678' }],
    ['password', { ...valid, password: `a1${'x'.repeat(71)}` }],
    ['organizationName', { ...valid, organizationName: 'A' }],
  ])('rejects bad %s', (field, input) => {
    const r = signupSchema.safeParse(input);
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.path[0] === field)).toBe(true);
  });

  // Why: 30 emoji = 120 bytes; bcrypt would silently truncate at 72 bytes.
  it('rejects passwords over 72 BYTES even if under 72 characters', () => {
    expect(signupSchema.safeParse({ ...valid, password: `1${'😀'.repeat(30)}` }).success).toBe(
      false,
    );
  });
});

// Protects: the confirm-password check exists for the form only.
describe('signupFormSchema', () => {
  it('requires confirmPassword to match', () => {
    const r = signupFormSchema.safeParse({ ...valid, confirmPassword: 'different1' });
    expect(r.error?.issues[0]?.path).toEqual(['confirmPassword']);
  });
});

describe('loginSchema', () => {
  it('requires a non-empty password but no complexity', () => {
    expect(loginSchema.safeParse({ email: 'a@x.com', password: '' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@x.com', password: 'x' }).success).toBe(true);
  });
});
