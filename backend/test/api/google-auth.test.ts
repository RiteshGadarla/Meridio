/**
 * FILE: backend/test/api/google-auth.test.ts
 * PURPOSE: Tests the Google sign-in flow with a fake Google client (no network): redirect, state
 *          check, new-user pending step, organization completion, and returning-user login.
 * LAYER: Test (Supertest + real Neon TEST database)
 */
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { GoogleOAuthClient, GoogleProfile } from '../../src/lib/google-oauth.js';
import { createTestPrisma, resetDb } from '../db.js';
import { makeTestApp, TEST_ORIGIN } from '../helpers.js';

const prisma = createTestPrisma();
let profile: GoogleProfile = {
  sub: 'g-123',
  email: 'ada@acme.test',
  emailVerified: true,
  name: 'Ada Lovelace',
  pictureUrl: 'https://lh3.googleusercontent.com/a/ada',
};
let exchangeFails = false;
const fake: GoogleOAuthClient = {
  buildAuthUrl: (state) => `https://accounts.google.test/auth?state=${state}`,
  exchangeCode: async () => {
    if (exchangeFails) throw new Error('bad code');
    return profile;
  },
};
const app = makeTestApp(undefined, { prisma, googleClient: fake });

beforeEach(async () => {
  await resetDb(prisma);
  exchangeFails = false;
  profile = { ...profile, emailVerified: true, name: 'Ada Lovelace' };
});
afterAll(() => prisma.$disconnect());

const cookies = (res: request.Response): string[] =>
  (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
const pair = (res: request.Response, name: string) =>
  cookies(res)
    .find((c) => c.startsWith(`${name}=`))
    ?.split(';')[0];

/** Runs start + callback and returns the callback response. */
async function runFlow(a = app) {
  const start = await request(a).get('/api/v1/auth/google');
  const stateCookie = pair(start, 'sf_oauth_state')!;
  const state = stateCookie.split('=')[1]!;
  return request(a)
    .get(`/api/v1/auth/google/callback?code=abc&state=${state}`)
    .set('Cookie', stateCookie);
}

// Protects: the flow cannot be started without credentials and starts safely with them.
describe('GET /auth/google', () => {
  it('redirects to Google with a state and an HttpOnly state cookie', async () => {
    const res = await request(app).get('/api/v1/auth/google');
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/^https:\/\/accounts\.google\.test\/auth\?state=/);
    expect(cookies(res).find((c) => c.startsWith('sf_oauth_state='))).toMatch(/HttpOnly/i);
  });

  it('sends the user back to /login when Google is not configured', async () => {
    const off = makeTestApp(undefined, { prisma, googleClient: null });
    const res = await request(off).get('/api/v1/auth/google');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${TEST_ORIGIN}/login?error=google_unavailable`);
  });
});

// Protects: login CSRF and unverified emails are rejected before anything is created.
describe('GET /auth/google/callback (rejections)', () => {
  it('rejects a missing or mismatched state', async () => {
    const res = await request(app)
      .get('/api/v1/auth/google/callback?code=abc&state=forged')
      .set('Cookie', 'sf_oauth_state=other');
    expect(res.headers.location).toBe(`${TEST_ORIGIN}/login?error=google_failed`);
    expect(await prisma.user.count()).toBe(0);
  });

  it('handles a failed code exchange', async () => {
    exchangeFails = true;
    const res = await runFlow();
    expect(res.headers.location).toBe(`${TEST_ORIGIN}/login?error=google_failed`);
  });

  it('rejects an unverified Google email', async () => {
    profile = { ...profile, emailVerified: false };
    const res = await runFlow();
    expect(res.headers.location).toBe(`${TEST_ORIGIN}/login?error=google_unverified`);
  });

  it('reports a denied consent screen', async () => {
    const res = await request(app).get('/api/v1/auth/google/callback?error=access_denied');
    expect(res.headers.location).toBe(`${TEST_ORIGIN}/login?error=google_denied`);
  });
});

// Protects: a new Google user creates NOTHING until they name an organization.
describe('new Google user', () => {
  it('goes to the organization page with a pending cookie and no database rows', async () => {
    const res = await runFlow();
    expect(res.headers.location).toBe(`${TEST_ORIGIN}/signup/organization`);
    expect(pair(res, 'sf_session')).toBeUndefined();
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.organization.count()).toBe(0);
  });

  it('exposes the pending profile, then completes signup with a session', async () => {
    const pending = pair(await runFlow(), 'sf_google_pending')!;

    const info = await request(app).get('/api/v1/auth/google/pending').set('Cookie', pending);
    expect(info.body.data).toEqual({
      email: 'ada@acme.test',
      name: 'Ada Lovelace',
      pictureUrl: profile.pictureUrl,
    });

    const done = await request(app)
      .post('/api/v1/auth/google/complete')
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', pending)
      .send({ organizationName: '  Acme Co  ' });
    expect(done.status).toBe(201);
    expect(done.body.data).toMatchObject({
      email: 'ada@acme.test',
      name: 'Ada Lovelace',
      pictureUrl: profile.pictureUrl,
      organization: { name: 'Acme Co' },
    });
    expect(pair(done, 'sf_session')).toBeDefined();
    const user = await prisma.user.findFirstOrThrow();
    expect(user.passwordHash).toBeNull();
    expect(user.googleId).toBe('g-123');
  });

  it('refuses to complete without a pending cookie, and validates the name', async () => {
    const none = await request(app)
      .post('/api/v1/auth/google/complete')
      .set('Origin', TEST_ORIGIN)
      .send({ organizationName: 'Acme' });
    expect(none.status).toBe(401);

    const pending = pair(await runFlow(), 'sf_google_pending')!;
    const bad = await request(app)
      .post('/api/v1/auth/google/complete')
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', pending)
      .send({ organizationName: 'A' });
    expect(bad.status).toBe(400);
  });

  // Why: the pending token is signed; a forged one must not create an account.
  it('rejects a forged pending cookie', async () => {
    const res = await request(app)
      .post('/api/v1/auth/google/complete')
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', 'sf_google_pending=not.a.jwt')
      .send({ organizationName: 'Acme' });
    expect(res.status).toBe(401);
  });
});

// Protects: returning users and password accounts sign in without a second signup step.
describe('existing users', () => {
  it('logs a returning Google user straight in and refreshes their profile', async () => {
    const pending = pair(await runFlow(), 'sf_google_pending')!;
    await request(app)
      .post('/api/v1/auth/google/complete')
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', pending)
      .send({ organizationName: 'Acme' });

    profile = { ...profile, name: 'Ada L.' };
    const res = await runFlow();
    expect(res.headers.location).toBe(`${TEST_ORIGIN}/dashboard`);
    expect(pair(res, 'sf_session')).toBeDefined();
    expect((await prisma.user.findFirstOrThrow()).name).toBe('Ada L.');
    expect(await prisma.organization.count()).toBe(1);
  });

  it('links a Google login to an existing password account with the same email', async () => {
    await request(app)
      .post('/api/v1/auth/signup')
      .set('Origin', TEST_ORIGIN)
      .send({ email: 'ada@acme.test', password: 'Passw0rdOK', organizationName: 'Acme' });
    const res = await runFlow();
    expect(res.headers.location).toBe(`${TEST_ORIGIN}/dashboard`);
    const user = await prisma.user.findFirstOrThrow();
    expect(user.googleId).toBe('g-123');
    expect(user.passwordHash).toMatch(/^\$2/);
    expect(await prisma.user.count()).toBe(1);
  });

  // Why: password-less accounts must not be loggable with any password.
  it('does not allow password login for a Google-only account', async () => {
    const pending = pair(await runFlow(), 'sf_google_pending')!;
    await request(app)
      .post('/api/v1/auth/google/complete')
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', pending)
      .send({ organizationName: 'Acme' });
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', TEST_ORIGIN)
      .send({ email: 'ada@acme.test', password: 'anything1' });
    expect(res.status).toBe(401);
  });
});
