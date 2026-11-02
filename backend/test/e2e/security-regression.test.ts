/**
 * FILE: backend/test/e2e/security-regression.test.ts
 * PURPOSE: Locks in security properties so a refactor cannot silently remove them.
 * LAYER: Scenario test (Supertest + Neon TEST database)
 * NOTES: Covers cookie flags, secret leakage, rate limits, origin check, error hygiene, caching.
 */
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestPrisma, resetDb } from '../db.js';
import { makeTestApp, makeTestEnv, TEST_ORIGIN } from '../helpers.js';
import { ApiSession } from '../session.js';
import { DEFAULT_RATE_LIMITS } from '../../src/middleware/rate-limit.js';

const prisma = createTestPrisma();
const app = makeTestApp(undefined, { prisma });

beforeEach(() => resetDb(prisma));
afterAll(() => prisma.$disconnect());

const BCRYPT = /\$2[aby]\$\d{2}\$/;

/** Recursively checks a JSON value for a passwordHash key or anything shaped like a bcrypt hash. */
function leaksSecret(value: unknown): boolean {
  if (typeof value === 'string') return BCRYPT.test(value);
  if (Array.isArray(value)) return value.some(leaksSecret);
  if (value && typeof value === 'object') {
    return Object.entries(value).some(([k, v]) => /password/i.test(k) || leaksSecret(v));
  }
  return false;
}

// Protects: the session cookie cannot be read by scripts or sent over plain HTTP in production.
describe('cookie flags', () => {
  it.each([
    ['development/test', 'test', false],
    ['production', 'production', true],
  ] as const)('%s: HttpOnly, SameSite=Lax, Path=/, Secure=%s', async (_label, nodeEnv, secure) => {
    const a = makeTestApp(undefined, { prisma, env: makeTestEnv({ NODE_ENV: nodeEnv }) });
    const res = await new ApiSession(a).post('/auth/signup', {
      email: 'me@acme.test',
      password: 'Passw0rdOK',
      organizationName: 'Acme',
    });
    const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) =>
      c.startsWith('sf_session='),
    )!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//);
    expect(/Secure/i.test(cookie)).toBe(secure);
    expect(cookie).toMatch(/Max-Age=\d+/);
  });
});

// Protects: password hashes never leave the server, in any response.
describe('no secrets in responses', () => {
  it('scans every auth, product, dashboard and settings response', async () => {
    const me = new ApiSession(app);
    const bodies: unknown[] = [];
    const keep = <T extends { body: unknown }>(res: T) => (bodies.push(res.body), res);

    keep(
      await me.post('/auth/signup', {
        email: 'me@acme.test',
        password: 'Passw0rdOK',
        organizationName: 'Acme',
      }),
    );
    keep(await me.post('/auth/login', { email: 'me@acme.test', password: 'Passw0rdOK' }));
    keep(await me.get('/auth/me'));
    const created = keep(
      await me.post('/products', { name: 'Widget', sku: 'WDG-1', quantityOnHand: 1 }),
    );
    const id = (created.body as { data: { id: string } }).data.id;
    keep(await me.get('/products'));
    keep(await me.get(`/products/${id}`));
    keep(await me.patch(`/products/${id}`, { quantityOnHand: 2 }));
    keep(await me.get('/dashboard/overview'));
    keep(await me.get('/settings'));
    keep(await me.patch('/settings', { defaultLowStockThreshold: 3 }));
    keep(await me.delete(`/products/${id}`));
    // error responses too
    keep(
      await new ApiSession(app).post('/auth/login', { email: 'me@acme.test', password: 'wrong' }),
    );
    keep(
      await new ApiSession(app).post('/auth/signup', {
        email: 'me@acme.test',
        password: 'Passw0rdOK',
        organizationName: 'X',
      }),
    );

    expect(bodies.length).toBeGreaterThan(10);
    for (const body of bodies) expect(leaksSecret(body)).toBe(false);
  });

  it('the scanner itself detects a leak (guards against a broken test)', () => {
    expect(leaksSecret({ data: { user: { passwordHash: 'x' } } })).toBe(true);
    expect(leaksSecret({ data: ['$2b$12$abcdefghijklmnopqrstuv'] })).toBe(true);
    expect(leaksSecret({ data: { email: 'a@b.c' } })).toBe(false);
  });
});

// Protects: brute force and signup abuse are throttled.
describe('rate limiting', () => {
  const limited = () =>
    makeTestApp(undefined, { prisma, rateLimits: { ...DEFAULT_RATE_LIMITS, enabled: true } });

  it('login: the 11th attempt in the window is 429 RATE_LIMITED', async () => {
    const a = limited();
    const s = new ApiSession(a);
    for (let i = 0; i < 10; i++)
      await s.post('/auth/login', { email: 'x@x.com', password: 'WrongPass1' });
    const res = await s.post('/auth/login', { email: 'x@x.com', password: 'WrongPass1' });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });

  it('login limit is per email: another email from the same IP is unaffected', async () => {
    const a = limited();
    const s = new ApiSession(a);
    for (let i = 0; i < 11; i++)
      await s.post('/auth/login', { email: 'x@x.com', password: 'WrongPass1' });
    const other = await s.post('/auth/login', { email: 'other@x.com', password: 'WrongPass1' });
    expect(other.status).toBe(401);
  });

  it('signup: the 6th attempt in the window is 429', async () => {
    const a = limited();
    const s = new ApiSession(a);
    for (let i = 0; i < 5; i++) {
      await s.post('/auth/signup', {
        email: `u${i}@x.com`,
        password: 'Passw0rdOK',
        organizationName: `Org ${i}`,
      });
    }
    const res = await s.post('/auth/signup', {
      email: 'u9@x.com',
      password: 'Passw0rdOK',
      organizationName: 'Org 9',
    });
    expect(res.status).toBe(429);
  });
});

// Protects: cross-site forms/scripts cannot make state-changing calls with the user's cookie.
describe('origin check', () => {
  const evil = 'https://evil.example';

  it.each([
    ['post', '/auth/login'],
    ['post', '/auth/signup'],
    ['post', '/auth/logout'],
    ['post', '/products'],
    ['patch', '/settings'],
    ['delete', '/products/x'],
  ] as const)('%s %s from a foreign Origin is 403 FORBIDDEN_ORIGIN', async (method, path) => {
    const res = await request(app)[method](`/api/v1${path}`).set('Origin', evil).send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_ORIGIN');
  });

  it('allows the real frontend origin and requests without an Origin header (curl, server-side)', async () => {
    const s = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', TEST_ORIGIN)
      .send({ email: 'a@b.co', password: 'x' });
    expect(s.status).toBe(401); // reached the handler (not 403)
    const n = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'a@b.co', password: 'x' });
    expect(n.status).toBe(401);
  });
});

// Protects: unexpected errors never reveal internals.
describe('error hygiene', () => {
  it('a thrown 500 returns a generic body with no stack, paths or message', async () => {
    const boom = makeTestApp((router) => {
      router.get('/boom', () => {
        throw new Error('SELECT secret FROM /srv/app/src/db.ts:42 password=hunter2');
      });
    });
    const res = await request(boom).get('/api/v1/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
    });
    const text = JSON.stringify(res.body);
    for (const needle of ['hunter2', 'SELECT', '.ts', 'node_modules', 'at '])
      expect(text).not.toContain(needle);
  });

  it('unknown routes return the standard 404 envelope', async () => {
    const res = await request(app).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

// Protects: private data is not stored by browsers or shared caches.
describe('caching headers', () => {
  it('private API responses are Cache-Control: private, no-store', async () => {
    const me = new ApiSession(app);
    await me.signup('me@acme.test', 'Acme');
    for (const path of ['/auth/me', '/products', '/dashboard/overview', '/settings']) {
      expect((await me.get(path)).headers['cache-control']).toBe('private, no-store');
    }
  });

  it('every response carries security headers and a request id', async () => {
    const res = await request(app).get('/api/v1/health/live');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-request-id']).toBeTruthy();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
