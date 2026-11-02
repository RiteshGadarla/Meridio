/**
 * FILE: backend/test/e2e/auth-guards.test.ts
 * PURPOSE: Every protected endpoint rejects anonymous callers; sessions behave like a browser's.
 * LAYER: Scenario test (Supertest + Neon TEST database)
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestPrisma, resetDb } from '../db.js';
import { makeTestApp } from '../helpers.js';
import { anonymous, ApiSession } from '../session.js';

const prisma = createTestPrisma();
const app = makeTestApp(undefined, { prisma });

beforeEach(() => resetDb(prisma));
afterAll(() => prisma.$disconnect());

const PROTECTED: [method: 'get' | 'post' | 'patch' | 'delete', path: string][] = [
  ['get', '/auth/me'],
  ['get', '/products'],
  ['post', '/products'],
  ['get', '/products/some-id'],
  ['patch', '/products/some-id'],
  ['delete', '/products/some-id'],
  ['get', '/dashboard/overview'],
  ['get', '/settings'],
  ['patch', '/settings'],
];

// Protects: no endpoint holding private data can be reached without a session.
describe('unauthenticated access', () => {
  it.each(PROTECTED)('%s %s returns 401 UNAUTHENTICATED', async (method, path) => {
    const res = await anonymous(app)[method](
      path,
      method === 'get' || method === 'delete' ? undefined : {},
    );
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('sessions', () => {
  it('survive many requests (a page reload reuses the same cookie)', async () => {
    const me = new ApiSession(app);
    await me.signup('me@acme.test', 'Acme');
    for (let i = 0; i < 3; i++) expect((await me.get('/auth/me')).status).toBe(200);
  });

  it('log in again after logout with a working new session', async () => {
    const me = new ApiSession(app);
    await me.signup('me@acme.test', 'Acme');
    await me.post('/auth/logout');
    expect((await me.get('/auth/me')).status).toBe(401);
    const login = await me.post('/auth/login', { email: 'ME@acme.test', password: 'Passw0rdOK' });
    expect(login.status).toBe(200);
    expect((await me.get('/auth/me')).status).toBe(200);
  });

  it('a duplicate email at signup returns 409 EMAIL_TAKEN with a field error', async () => {
    await new ApiSession(app).signup('me@acme.test', 'Acme');
    const res = await new ApiSession(app).post('/auth/signup', {
      email: 'Me@Acme.test',
      password: 'Passw0rdOK',
      organizationName: 'Other',
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: 'EMAIL_TAKEN',
      fieldErrors: { email: expect.any(String) },
    });
  });

  it('a wrong password returns the generic 401', async () => {
    await new ApiSession(app).signup('me@acme.test', 'Acme');
    const res = await new ApiSession(app).post('/auth/login', {
      email: 'me@acme.test',
      password: 'nope',
    });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password');
  });
});
