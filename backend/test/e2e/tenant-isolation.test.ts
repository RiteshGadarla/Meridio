/**
 * FILE: backend/test/e2e/tenant-isolation.test.ts
 * PURPOSE: Two organizations using the API at the same time must never see or change each other's data.
 * LAYER: Scenario test (Supertest + Neon TEST database)
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestPrisma, resetDb } from '../db.js';
import { makeTestApp } from '../helpers.js';
import { ApiSession } from '../session.js';

const prisma = createTestPrisma();
const app = makeTestApp(undefined, { prisma });

beforeEach(() => resetDb(prisma));
afterAll(() => prisma.$disconnect());

// Protects: tenant isolation across the whole product lifecycle, using real separate sessions.
describe('multi-tenant isolation (two sessions)', () => {
  it("both orgs can use KEY-001; A cannot read, change or delete B's product", async () => {
    const a = new ApiSession(app);
    const b = new ApiSession(app);
    await a.signup('a@orga.test', 'Org A');
    await b.signup('b@orgb.test', 'Org B');

    const aProduct = (
      await a.post('/products', { name: 'A Keyboard', sku: 'KEY-001', quantityOnHand: 4 })
    ).body.data;
    const bRes = await b.post('/products', {
      name: 'B Keyboard',
      sku: 'KEY-001',
      quantityOnHand: 40,
    });
    expect(bRes.status).toBe(201); // same SKU in a different org is allowed
    const bProduct = bRes.body.data;

    // A, using B's product id: always 404 (never 403), for every verb.
    for (const res of [
      await a.get(`/products/${bProduct.id}`),
      await a.patch(`/products/${bProduct.id}`, { name: 'Hijacked', quantityOnHand: 0 }),
      await a.delete(`/products/${bProduct.id}`),
    ]) {
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(JSON.stringify(res.body)).not.toContain('B Keyboard'); // no data leak in the error
    }

    // B's product is untouched.
    expect((await b.get(`/products/${bProduct.id}`)).body.data).toMatchObject({
      name: 'B Keyboard',
      quantityOnHand: 40,
    });

    // Lists and dashboards are separate.
    expect((await a.get('/products')).body.data.map((p: { id: string }) => p.id)).toEqual([
      aProduct.id,
    ]);
    expect((await a.get('/dashboard/overview')).body.data).toMatchObject({
      totalProducts: 1,
      totalUnits: 4,
    });
    expect((await b.get('/dashboard/overview')).body.data).toMatchObject({
      totalProducts: 1,
      totalUnits: 40,
    });
    expect((await a.get('/products?search=B Keyboard')).body.data).toEqual([]);
  });

  it('A changing its settings never affects B', async () => {
    const a = new ApiSession(app);
    const b = new ApiSession(app);
    await a.signup('a@orga.test', 'Org A');
    await b.signup('b@orgb.test', 'Org B');
    await a.patch('/settings', { defaultLowStockThreshold: 77 });
    expect((await b.get('/settings')).body.data.defaultLowStockThreshold).toBe(5);
  });

  it('ignores a spoofed organizationId in bodies and queries', async () => {
    const a = new ApiSession(app);
    const b = new ApiSession(app);
    const aUser = await a.signup('a@orga.test', 'Org A');
    const bUser = await b.signup('b@orgb.test', 'Org B');
    const created = await a.post('/products', {
      name: 'Spoof',
      sku: 'SPF-1',
      organizationId: bUser.organization.id,
    });
    expect(created.status).toBe(201);
    const row = await prisma.product.findFirstOrThrow({ where: { sku: 'SPF-1' } });
    expect(row.organizationId).toBe(aUser.organization.id);
    expect((await b.get(`/products?organizationId=${aUser.organization.id}`)).body.data).toEqual(
      [],
    );
  });
});
