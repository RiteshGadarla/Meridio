/**
 * FILE: backend/src/lib/jwt.test.ts
 * PURPOSE: Unit tests for the session JWT service.
 */
import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { createJwtService, parseDuration } from './jwt.js';

const SECRET = 'unit-test-secret-unit-test-secret-1234';
const svc = createJwtService({ secret: SECRET, expiresIn: '7d' });

// Protects: tokens round-trip and every kind of bad token is rejected.
describe('jwt service', () => {
  it('round-trips claims', () => {
    expect(svc.verify(svc.sign({ sub: 'u1', org: 'o1' }))).toEqual({ sub: 'u1', org: 'o1' });
    expect(svc.maxAgeSeconds).toBe(7 * 86_400);
  });

  it('rejects a token signed with another secret', () => {
    const other = createJwtService({ secret: 'x'.repeat(40), expiresIn: '7d' });
    expect(() => svc.verify(other.sign({ sub: 'u1', org: 'o1' }))).toThrow();
  });

  it('rejects an expired token', () => {
    const expired = jwt.sign({ sub: 'u1', org: 'o1' }, SECRET, { expiresIn: -10 });
    expect(() => svc.verify(expired)).toThrow();
  });

  // Why: the classic "alg: none" bypass.
  it('rejects an unsigned (alg none) token', () => {
    const none = jwt.sign({ sub: 'u1', org: 'o1' }, '', { algorithm: 'none' });
    expect(() => svc.verify(none)).toThrow();
  });

  it('rejects a validly signed token with the wrong payload shape', () => {
    expect(() => svc.verify(jwt.sign({ foo: 1 }, SECRET))).toThrow();
  });
});

describe('parseDuration', () => {
  it('parses units and rejects garbage', () => {
    expect(parseDuration('30m')).toBe(1800);
    expect(parseDuration('12h')).toBe(43_200);
    expect(parseDuration('90')).toBe(90);
    expect(() => parseDuration('soon')).toThrow();
  });
});
