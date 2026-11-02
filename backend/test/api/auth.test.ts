/**
 * FILE: backend/test/api/auth.test.ts
 * PURPOSE: End-to-end tests of signup, login, logout, /auth/me and rate limiting.
 * LAYER: Test (Supertest + real Neon TEST database)
 * DEPENDS ON: app.ts, test/db.ts, test/helpers.ts
 */
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestPrisma, resetDb } from '../db.js';
import { makeTestApp, makeTestEnv, TEST_ORIGIN } from '../helpers.js';
import { DEFAULT_RATE_LIMITS } from '../../src/middleware/rate-limit.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';

const prisma = createTestPrisma();
const app = makeTestApp(undefined, { prisma });

beforeEach(() => resetDb(prisma));
afterAll(() => prisma.$disconnect());

const creds = { email: 'owner@acme.test', password: 'Passw0rdOK', organizationName: 'Acme' };
const post = (a: typeof app, path: string) =>
  request(a).post(`/api/v1/auth${path}`).set('Origin', TEST_ORIGIN);
const cookieOf = (res: request.Response): string =>
  (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('sf_session='))!;
const cookiePair = (res: request.Response) => cookieOf(res).split(';')[0]!;

// Protects: signup creates exactly one tenant + owner, safely, and starts a secure session.
describe('POST /auth/signup', () => {
  it('creates 1 org + 1 user, hides passwordHash, sets an HttpOnly Lax cookie', async () => {
    const res = await post(app, '/signup').send(creds);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      email: creds.email,
      organization: { name: 'Acme', defaultLowStockThreshold: 5 },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2/);
    const cookie = cookieOf(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).not.toMatch(/Secure/i);
    expect(await prisma.organization.count()).toBe(1);
    expect(await prisma.user.count()).toBe(1);
  });

  it('sets the Secure flag in production', async () => {
    const prod = makeTestApp(undefined, { prisma, env: makeTestEnv({ NODE_ENV: 'production' }) });
    const res = await post(prod, '/signup').send(creds);
    expect(cookieOf(res)).toMatch(/Secure/i);
  });

  it('stores a bcrypt hash, not the password', async () => {
    await post(app, '/signup').send(creds);
    const user = await prisma.user.findFirstOrThrow();
    expect(user.passwordHash).toMatch(/^\$2/);
    expect(user.passwordHash).not.toContain(creds.password);
  });

  // Why: proves the organization insert is rolled back when the user insert fails.
  it('rolls back the organization when user creation fails', async () => {
    const failing = new Proxy(prisma, {
      get(target, prop, receiver) {
        if (prop !== '$transaction') return Reflect.get(target, prop, receiver);
        return (fn: (tx: unknown) => Promise<unknown>) =>
          target.$transaction((tx) =>
            fn(
              new Proxy(tx, {
                get: (t, p, r) =>
                  p === 'user'
                    ? { create: () => Promise.reject(new Error('boom')) }
                    : Reflect.get(t, p, r),
              }),
            ),
          );
      },
    }) as PrismaClient;
    const res = await post(makeTestApp(undefined, { prisma: failing }), '/signup').send(creds);
    expect(res.status).toBe(500);
    expect(await prisma.organization.count()).toBe(0);
    expect(await prisma.user.count()).toBe(0);
  });

  it('returns 409 EMAIL_TAKEN for a duplicate email regardless of case', async () => {
    await post(app, '/signup').send({ ...creds, email: 'a@x.com' });
    const res = await post(app, '/signup').send({ ...creds, email: 'A@X.com' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
    expect(await prisma.organization.count()).toBe(1); // failed signup left no orphan org
  });

  it.each([
    ['email', { email: 'bad' }],
    ['password', { password: 'short1' }],
    ['password', { password: 'noNumbersHere' }],
    ['organizationName', { organizationName: 'A' }],
  ])('returns fieldErrors for invalid %s', async (field, patch) => {
    const res = await post(app, '/signup').send({ ...creds, ...patch });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fieldErrors[field]).toBeTruthy();
  });
});

// Protects: no user enumeration and a working session after login.
describe('POST /auth/login', () => {
  beforeEach(async () => {
    await post(app, '/signup').send(creds);
  });

  it('succeeds and sets the cookie', async () => {
    const res = await post(app, '/login').send({
      email: 'OWNER@acme.test',
      password: creds.password,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(creds.email);
    expect(cookieOf(res)).toMatch(/HttpOnly/i);
  });

  // Why: differing responses would let an attacker discover which emails are registered.
  it('gives the identical 401 for wrong password and unknown email', async () => {
    const wrong = await post(app, '/login').send({ email: creds.email, password: 'WrongPass1' });
    const unknown = await post(app, '/login').send({
      email: 'nobody@x.com',
      password: 'WrongPass1',
    });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
    expect(wrong.body.error.message).toBe('Invalid email or password');
  });
});

// Protects: requireAuth trusts only a valid token for a user that still exists.
describe('GET /auth/me', () => {
  const me = (cookie?: string) => {
    const r = request(app).get('/api/v1/auth/me');
    return cookie ? r.set('Cookie', cookie) : r;
  };

  it('returns user + fresh org data with a valid cookie', async () => {
    const signup = await post(app, '/signup').send(creds);
    await prisma.organization.updateMany({ data: { defaultLowStockThreshold: 9 } });
    const res = await me(cookiePair(signup));
    expect(res.status).toBe(200);
    expect(res.body.data.organization.defaultLowStockThreshold).toBe(9);
  });

  it('401 without a cookie', async () => {
    expect((await me()).status).toBe(401);
  });

  it('401 for a tampered token', async () => {
    const signup = await post(app, '/signup').send(creds);
    expect((await me(`${cookiePair(signup)}x`)).status).toBe(401);
  });

  it('401 for an expired token', async () => {
    const signup = await post(app, '/signup').send(creds);
    const user = await prisma.user.findFirstOrThrow();
    const expired = jwt.sign({ sub: user.id, org: user.organizationId }, makeTestEnv().JWT_SECRET, {
      expiresIn: -10,
    });
    expect(signup.status).toBe(201);
    expect((await me(`sf_session=${expired}`)).status).toBe(401);
  });

  // Why: revocation, a deleted user must lose access immediately.
  it('401 when the user was deleted after the token was issued', async () => {
    const signup = await post(app, '/signup').send(creds);
    await prisma.user.deleteMany();
    expect((await me(cookiePair(signup))).status).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('clears the cookie and the session is gone afterwards', async () => {
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/signup').set('Origin', TEST_ORIGIN).send(creds);
    expect((await agent.get('/api/v1/auth/me')).status).toBe(200);
    const out = await agent.post('/api/v1/auth/logout').set('Origin', TEST_ORIGIN);
    expect(out.status).toBe(200);
    expect(cookieOf(out)).toMatch(/sf_session=;/);
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
  });
});

// Protects: tenant identity can never be injected by the client.
describe('tenant context', () => {
  it('ignores a spoofed organizationId in the signup body', async () => {
    const other = await prisma.organization.create({ data: { name: 'Victim' } });
    const res = await post(app, '/signup').send({ ...creds, organizationId: other.id });
    expect(res.status).toBe(201);
    expect(res.body.data.organization.id).not.toBe(other.id);
    const user = await prisma.user.findFirstOrThrow();
    expect(user.organizationId).not.toBe(other.id);
  });

  it('derives req.auth.organizationId from the DB, not the token claim', async () => {
    const real = await post(app, '/signup').send(creds);
    const user = await prisma.user.findFirstOrThrow();
    const victim = await prisma.organization.create({ data: { name: 'Victim' } });
    const forged = jwt.sign({ sub: user.id, org: victim.id }, makeTestEnv().JWT_SECRET);
    const res = await request(app).get('/api/v1/auth/me').set('Cookie', `sf_session=${forged}`);
    expect(res.body.data.organization.id).toBe(real.body.data.organization.id);
  });
});

// Protects: brute-force protection on login.
describe('rate limiting', () => {
  it('returns 429 RATE_LIMITED on the 11th login attempt', async () => {
    const limited = makeTestApp(undefined, {
      prisma,
      rateLimits: { ...DEFAULT_RATE_LIMITS, enabled: true },
    });
    const body = { email: 'x@x.com', password: 'WrongPass1' };
    for (let i = 0; i < 10; i++)
      expect((await post(limited, '/login').send(body)).status).toBe(401);
    const res = await post(limited, '/login').send(body);
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });
});
