/**
 * FILE: backend/test/api/dashboard-settings.test.ts
 * PURPOSE: Tests GET /dashboard/overview and GET/PATCH /settings, including tenant isolation.
 * LAYER: Test (Supertest + real Neon TEST database)
 * DEPENDS ON: app.ts, test/db.ts, test/helpers.ts
 */
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestPrisma, resetDb } from '../db.js';
import { makeTestApp, TEST_ORIGIN } from '../helpers.js';

const prisma = createTestPrisma();
const app = makeTestApp(undefined, { prisma });

beforeEach(() => resetDb(prisma));
afterAll(() => prisma.$disconnect());

// ===== Helpers =====

interface Tenant {
  cookie: string;
  orgId: string;
}

async function signup(email: string, org: string): Promise<Tenant> {
  const res = await request(app)
    .post('/api/v1/auth/signup')
    .set('Origin', TEST_ORIGIN)
    .send({ email, password: 'Passw0rdOK', organizationName: org });
  const cookies = res.headers['set-cookie'] as unknown as string[];
  return {
    cookie: cookies.find((c) => c.startsWith('sf_session='))!.split(';')[0]!,
    orgId: res.body.data.organization.id,
  };
}

/** Inserts products directly (fast); the HTTP path is covered by products.test.ts. */
const seed = (
  orgId: string,
  rows: { sku: string; qty: number; threshold?: number | null; name?: string }[],
) =>
  prisma.product.createMany({
    data: rows.map((r) => ({
      organizationId: orgId,
      sku: r.sku,
      name: r.name ?? r.sku,
      quantityOnHand: r.qty,
      lowStockThreshold: r.threshold ?? null,
    })),
  });

const overview = (t: Tenant) =>
  request(app).get('/api/v1/dashboard/overview').set('Cookie', t.cookie);
const patchSettings = (t: Tenant, body: unknown) =>
  request(app)
    .patch('/api/v1/settings')
    .set('Origin', TEST_ORIGIN)
    .set('Cookie', t.cookie)
    .send(body as object);

// ===== Dashboard =====

// Protects: the three headline metrics and the "needs attention" list are correct.
describe('GET /dashboard/overview', () => {
  let a: Tenant;
  beforeEach(async () => {
    a = await signup('a@a.test', 'Org A'); // org default threshold = 5
  });

  it('returns zeros and an empty list for an empty org (no nulls)', async () => {
    const res = await overview(a);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      totalProducts: 0,
      totalUnits: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
      lowStockProducts: [],
    });
  });

  it('matches hand-calculated totals', async () => {
    await seed(a.orgId, [
      { sku: 'H-1', qty: 100 }, // healthy
      { sku: 'L-1', qty: 3 }, // low (3 <= 5)
      { sku: 'O-1', qty: 0 }, // out
    ]);
    const { data } = (await overview(a)).body;
    expect(data).toMatchObject({
      totalProducts: 3,
      totalUnits: 103,
      lowStockCount: 2,
      outOfStockCount: 1,
    });
    expect(data.lowStockProducts).toHaveLength(2);
  });

  // Why: the boundary is <=, so equal is low and threshold+1 is healthy.
  it('includes qty == threshold and excludes qty == threshold + 1', async () => {
    await seed(a.orgId, [
      { sku: 'EQ', qty: 5 },
      { sku: 'PLUS1', qty: 6 },
    ]);
    const skus = (await overview(a)).body.data.lowStockProducts.map((p: { sku: string }) => p.sku);
    expect(skus).toEqual(['EQ']);
  });

  // Why: `null` means "follow the org default"; an explicit 0 is a real override.
  it('applies product thresholds in both directions, null uses the org default, 0 stays 0', async () => {
    await seed(a.orgId, [
      { sku: 'HIGHER', qty: 8, threshold: 10 }, // low only because override is higher than default
      { sku: 'LOWER', qty: 4, threshold: 2 }, // healthy only because override is lower than default
      { sku: 'NULL', qty: 5, threshold: null }, // org default 5 -> low
      { sku: 'ZERO', qty: 1, threshold: 0 }, // threshold 0 -> healthy
      { sku: 'ZERO-OUT', qty: 0, threshold: 0 }, // still out of stock
    ]);
    const { data } = (await overview(a)).body;
    const byStatus = Object.fromEntries(
      data.lowStockProducts.map((p: { sku: string; stockStatus: string }) => [
        p.sku,
        p.stockStatus,
      ]),
    );
    expect(byStatus).toEqual({
      HIGHER: 'LOW_STOCK',
      NULL: 'LOW_STOCK',
      'ZERO-OUT': 'OUT_OF_STOCK',
    });
    expect(data.lowStockCount).toBe(3);
  });

  it('ranks out-of-stock first, then lowest quantity', async () => {
    await seed(a.orgId, [
      { sku: 'Q4', qty: 4 },
      { sku: 'Q1', qty: 1 },
      { sku: 'Q0', qty: 0 },
      { sku: 'Q2', qty: 2 },
    ]);
    const skus = (await overview(a)).body.data.lowStockProducts.map((p: { sku: string }) => p.sku);
    expect(skus).toEqual(['Q0', 'Q1', 'Q2', 'Q4']);
  });

  it('caps the list at 50 but counts everything', async () => {
    await seed(
      a.orgId,
      Array.from({ length: 55 }, (_, i) => ({ sku: `S-${i}`, qty: 1 })),
    );
    const { data } = (await overview(a)).body;
    expect(data.lowStockProducts).toHaveLength(50);
    expect(data.lowStockCount).toBe(55);
  });

  // Why: the dashboard and products endpoint must never disagree about a product's status.
  it('reports the same stockStatus as GET /products', async () => {
    await seed(a.orgId, [
      { sku: 'A', qty: 0 },
      { sku: 'B', qty: 5 },
      { sku: 'C', qty: 9, threshold: 9 },
    ]);
    const dash = (await overview(a)).body.data.lowStockProducts;
    const list = (await request(app).get('/api/v1/products?limit=100').set('Cookie', a.cookie)).body
      .data;
    for (const p of dash) {
      expect(list.find((x: { id: string }) => x.id === p.id)).toEqual(p);
    }
  });

  it('401 without a session', async () => {
    expect((await request(app).get('/api/v1/dashboard/overview')).status).toBe(401);
  });
});

// ===== Settings =====

describe('settings', () => {
  let a: Tenant;
  beforeEach(async () => {
    a = await signup('a@a.test', 'Org A');
  });

  it('GET returns the default threshold and organization name', async () => {
    const res = await request(app).get('/api/v1/settings').set('Cookie', a.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      defaultLowStockThreshold: 5,
      currency: 'INR', // rupees by default
      organizationName: 'Org A',
    });
  });

  // Why: status is computed on read, so a settings change must show on the very next call.
  it('PATCH changes dashboard output immediately', async () => {
    await seed(a.orgId, [{ sku: 'P', qty: 8 }]);
    expect((await overview(a)).body.data.lowStockCount).toBe(0);
    const res = await patchSettings(a, { defaultLowStockThreshold: 10 });
    expect(res.status).toBe(200);
    expect(res.body.data.defaultLowStockThreshold).toBe(10);
    expect((await overview(a)).body.data.lowStockCount).toBe(1);
  });

  // Protects: the display currency is an allow-listed, per-organization setting.
  it('PATCH changes the currency and rejects unsupported codes', async () => {
    const ok = await patchSettings(a, { defaultLowStockThreshold: 5, currency: 'USD' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.currency).toBe('USD');
    const me = await request(app).get('/api/v1/auth/me').set('Cookie', a.cookie);
    expect(me.body.data.organization.currency).toBe('USD');

    const bad = await patchSettings(a, { defaultLowStockThreshold: 5, currency: 'XYZ' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.fieldErrors.currency).toBeTruthy();
  });

  it.each([
    ['negative', -1],
    ['float', 1.5],
    ['string', '5'],
    ['huge', 100_001],
    ['null', null],
  ])('rejects %s threshold', async (_label, value) => {
    const res = await patchSettings(a, { defaultLowStockThreshold: value });
    expect(res.status).toBe(400);
    expect(res.body.error.fieldErrors.defaultLowStockThreshold).toBeTruthy();
  });

  it('401 without a session on GET and PATCH', async () => {
    expect((await request(app).get('/api/v1/settings')).status).toBe(401);
    const res = await request(app)
      .patch('/api/v1/settings')
      .set('Origin', TEST_ORIGIN)
      .send({ defaultLowStockThreshold: 3 });
    expect(res.status).toBe(401);
  });
});

// ===== Tenant isolation =====

// Protects: one organization never sees or changes another's dashboard or settings.
describe('tenant isolation (dashboard + settings)', () => {
  it("keeps B's data out of A's dashboard and A's PATCH off B's settings", async () => {
    const a = await signup('a@a.test', 'Org A');
    const b = await signup('b@b.test', 'Org B');
    await seed(a.orgId, [{ sku: 'A-1', qty: 1 }]);
    await seed(b.orgId, [
      { sku: 'B-1', qty: 0 },
      { sku: 'B-2', qty: 50 },
    ]);

    const dashA = (await overview(a)).body.data;
    expect(dashA).toMatchObject({
      totalProducts: 1,
      totalUnits: 1,
      lowStockCount: 1,
      outOfStockCount: 0,
    });
    expect(dashA.lowStockProducts.map((p: { sku: string }) => p.sku)).toEqual(['A-1']);

    await patchSettings(a, { defaultLowStockThreshold: 99 });
    const settingsB = await request(app).get('/api/v1/settings').set('Cookie', b.cookie);
    expect(settingsB.body.data.defaultLowStockThreshold).toBe(5);
    expect((await overview(b)).body.data.lowStockCount).toBe(1); // B-1 only; unaffected by A's change
  });
});
