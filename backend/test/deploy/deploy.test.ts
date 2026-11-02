/**
 * FILE: backend/test/deploy/deploy.test.ts
 * PURPOSE: Verifies the deployment artefacts and production-mode behaviour: vercel.json, render.yaml,
 *          the web bundle scan, secure cookies, error hygiene, proxy-aware rate limiting, and the
 *          smoke-test script run against a real production-mode server.
 * LAYER: Test (Supertest / real HTTP + Neon TEST database)
 * DEPENDS ON: ../../../frontend/vercel.json, ../../../render.yaml, ../../../scripts/*.mjs, app.ts
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { scanDirectory } from '../../../scripts/check-bundle.mjs';
import { runSmoke } from '../../../scripts/smoke-prod.mjs';
import { DEFAULT_RATE_LIMITS } from '../../src/middleware/rate-limit.js';
import { createTestPrisma, resetDb } from '../db.js';
import { TEST_ORIGIN, makeTestApp, makeTestEnv } from '../helpers.js';

// Vitest runs with cwd = backend/, so the repo root is one level up.
const root = resolve(process.cwd(), '..');
const prisma = createTestPrisma();

beforeEach(() => resetDb(prisma));
afterAll(() => prisma.$disconnect());

// Protects: the one place the backend URL lives, and the order that makes the SPA fallback safe.
describe('vercel.json', () => {
  const config = JSON.parse(readFileSync(join(root, 'frontend/vercel.json'), 'utf8')) as {
    outputDirectory: string;
    buildCommand: string;
    installCommand: string;
    rewrites: { source: string; destination: string }[];
    headers: { source: string; headers: { key: string; value: string }[] }[];
  };

  it('rewrites /api to the backend BEFORE the SPA fallback', () => {
    const sources = config.rewrites.map((r) => r.source);
    const api = sources.indexOf('/api/:path*');
    const spa = sources.indexOf('/(.*)');
    expect(api).toBeGreaterThanOrEqual(0);
    expect(spa).toBeGreaterThan(api); // otherwise API calls would return index.html
    expect(config.rewrites[api]!.destination).toBe('https://meridio-g01d.onrender.com/api/:path*');
    expect(JSON.stringify(config)).not.toContain('YOUR-RENDER-SERVICE'); // placeholder must be replaced
    expect(config.rewrites[spa]!.destination).toBe('/index.html');
  });

  it('disables rewrite caching for /api and builds contracts before the frontend', () => {
    const rule = config.headers.find((h) => h.source === '/api/:path*');
    expect(rule?.headers).toContainEqual({ key: 'x-vercel-enable-rewrite-caching', value: '0' });
    expect(config.buildCommand.indexOf('packages/contracts')).toBeLessThan(
      config.buildCommand.indexOf('-w frontend'),
    );
    // Vercel's Root Directory is frontend/, so paths are relative to it: install and build step up
    // to the repo root (npm workspaces + the contracts package live there), output is frontend/dist.
    expect(config.outputDirectory).toBe('dist');
    expect(config.installCommand).toBe('cd .. && npm ci');
    expect(config.buildCommand.startsWith('cd .. && ')).toBe(true);
    expect(config.buildCommand).toContain('scripts/check-bundle.mjs frontend/dist');
  });
});

// Protects: the Render blueprint keeps the settings that make the deploy work.
describe('render.yaml', () => {
  const yaml = readFileSync(join(root, 'render.yaml'), 'utf8');
  // Strip comment lines so rules are checked against configuration, not prose.
  const config = yaml
    .split('\n')
    .filter((l) => !l.trim().startsWith('#'))
    .join('\n');

  it.each([
    ['dev dependencies installed for the build', /npm ci --include=dev/],
    [
      'contracts built before the backend',
      /build -w packages\/contracts && npm run build -w backend/,
    ],
    ['start command migrates then launches the API', /startCommand: npm run start -w backend/],
    ['health check is the readiness endpoint', /healthCheckPath: \/api\/v1\/health\/ready/],
    ['production mode', /key: NODE_ENV\s+value: production/],
    ['two trusted proxy hops', /key: TRUST_PROXY_HOPS\s+value: ["']?2["']?/],
  ])('%s', (_label, pattern) => {
    expect(config).toMatch(pattern);
  });

  it('keeps secrets out of the file: the DB url and APP_ORIGIN are dashboard-only', () => {
    for (const key of ['DATABASE_URL', 'APP_ORIGIN']) {
      expect(config).toMatch(new RegExp(`key: ${key}\\s+sync: false`));
    }
    expect(config).toMatch(/key: JWT_SECRET\s+generateValue: true/);
    expect(config).not.toMatch(/postgres(ql)?:\/\//i);
  });
});

// Protects: nothing secret or environment-specific ships to browsers.
describe('web bundle scan', () => {
  function fixture(files: Record<string, string>) {
    const dir = mkdtempSync(join(tmpdir(), 'bundle-'));
    for (const [name, content] of Object.entries(files)) {
      mkdirSync(join(dir, name, '..'), { recursive: true });
      writeFileSync(join(dir, name), content);
    }
    return dir;
  }

  it.each([
    ['localhost API URL', 'fetch("http://localhost:4000/api")'],
    ['Postgres connection string', 'const u="postgresql://user:pw@host/db"'],
    ['Neon credential', 'const k="npg_AbCdEfGh1234"'],
    ['JWT_SECRET reference', 'process.env.JWT_SECRET'],
    ['hardcoded Render host', 'fetch("https://x.onrender.com/api")'],
  ])('detects: %s (the scanner is not blind)', (rule, content) => {
    const findings = scanDirectory(fixture({ 'assets/app.js': content }));
    expect(findings.map((f) => f.rule)).toContain(rule);
  });

  it('passes a clean bundle', () => {
    expect(
      scanDirectory(
        fixture({ 'index.html': '<div id="root"></div>', 'assets/app.js': 'fetch("/api/v1/x")' }),
      ),
    ).toEqual([]);
  });

  it.skipIf(!existsSync(join(root, 'frontend/dist')))(
    'the real built frontend/dist is clean',
    () => {
      expect(scanDirectory(join(root, 'frontend/dist'))).toEqual([]);
    },
  );
});

// Protects: production-mode behaviour that dev/test mode cannot show.
describe('production mode', () => {
  const prod = () =>
    makeTestApp(
      (router) => {
        router.get('/boom', () => {
          throw new Error('secret internals at /srv/app/db.ts:42');
        });
      },
      { prisma, env: makeTestEnv({ NODE_ENV: 'production' }) },
    );

  it('serves a generic 500 with no stack or message', async () => {
    const res = await request(prod()).get('/api/v1/boom');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toMatch(/secret internals|\.ts:|node_modules/);
  });

  it('sets a Secure, HttpOnly, SameSite=Lax session cookie', async () => {
    const res = await request(prod())
      .post('/api/v1/auth/signup')
      .set('Origin', TEST_ORIGIN)
      .send({ email: 'p@acme.test', password: 'Passw0rdOK', organizationName: 'Acme' });
    const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) =>
      c.startsWith('sf_session='),
    )!;
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });
});

// Protects: rate limits count real visitors, not the Vercel/Render proxies in front of the API.
describe('TRUST_PROXY_HOPS and rate limiting', () => {
  const limited = (hops: number) =>
    makeTestApp(undefined, {
      prisma,
      env: makeTestEnv({ TRUST_PROXY_HOPS: hops }),
      rateLimits: { ...DEFAULT_RATE_LIMITS, enabled: true },
    });
  // X-Forwarded-For as the API sees it behind Vercel -> Render: "<visitor>, <vercel edge>".
  const signupFrom = (app: ReturnType<typeof limited>, visitor: string) =>
    request(app)
      .post('/api/v1/auth/signup')
      .set('X-Forwarded-For', `${visitor}, 76.76.21.21`)
      .send({});

  it('with 2 hops, visitors are limited separately by their real IP', async () => {
    const app = limited(2);
    for (let i = 0; i < 5; i++) expect((await signupFrom(app, '203.0.113.1')).status).toBe(400);
    expect((await signupFrom(app, '203.0.113.1')).status).toBe(429); // visitor 1 is over the limit
    expect((await signupFrom(app, '203.0.113.2')).status).toBe(400); // visitor 2 is unaffected
  });

  // Why this setting exists: with too few hops everyone shares the proxy's IP and one visitor locks out all.
  it('with only 1 hop, all visitors collapse onto the proxy IP (the bug TRUST_PROXY_HOPS=2 avoids)', async () => {
    const app = limited(1);
    for (let i = 0; i < 5; i++) await signupFrom(app, '203.0.113.1');
    expect((await signupFrom(app, '203.0.113.2')).status).toBe(429);
  });
});

// Protects: the shipped smoke script really works against a production-mode server over real HTTP.
describe('scripts/smoke-prod.mjs', () => {
  it('passes a full signup -> cookie -> product -> dashboard -> logout cycle', async () => {
    const app = makeTestApp(undefined, { prisma, env: makeTestEnv({ NODE_ENV: 'production' }) });
    const server = app.listen(0, '127.0.0.1');
    await new Promise((r) => server.once('listening', r));
    const { port } = server.address() as AddressInfo;
    try {
      // origin = the allowed APP_ORIGIN, as a browser on the deployed site would send
      const { steps } = await runSmoke(`http://127.0.0.1:${port}`, { origin: TEST_ORIGIN });
      expect(steps).toEqual(
        expect.arrayContaining([
          'GET /health/ready is 200',
          'POST /auth/signup is 201',
          'cookie is Secure',
          'cookie is HttpOnly',
          'cookie is SameSite=Lax',
          'GET /auth/me is 401 after logout',
        ]),
      );
    } finally {
      server.close();
    }
  });

  it('fails loudly when the server is not healthy (non-zero path)', async () => {
    const app = makeTestApp(undefined, {
      prisma,
      env: makeTestEnv({ NODE_ENV: 'production' }),
      checkDatabase: async () => {
        throw new Error('db down');
      },
    });
    const server = app.listen(0, '127.0.0.1');
    await new Promise((r) => server.once('listening', r));
    const { port } = server.address() as AddressInfo;
    try {
      await expect(runSmoke(`http://127.0.0.1:${port}`, { origin: TEST_ORIGIN })).rejects.toThrow(
        /health\/ready/,
      );
    } finally {
      server.close();
    }
  });
});

// Protects: tables are created automatically at startup from the migration files.
describe('startup migrations', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'backend/package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  };

  it('production start applies pending migrations before launching the server', () => {
    expect(pkg.scripts.start).toBe('prisma migrate deploy && node dist/server.js');
  });

  it('local dev applies pending migrations before watching', () => {
    const dev = pkg.scripts.dev ?? '';
    expect(dev).toContain('prisma migrate deploy');
    expect(dev.indexOf('prisma migrate deploy')).toBeLessThan(dev.indexOf('tsx watch'));
  });

  it('the app needs only one database variable', () => {
    const example = readFileSync(join(root, 'backend/.env.example'), 'utf8');
    expect(example).toMatch(/^DATABASE_URL=/m);
    expect(example).not.toMatch(/^DIRECT_URL=/m);
  });
});
