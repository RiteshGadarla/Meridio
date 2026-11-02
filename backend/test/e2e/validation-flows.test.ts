/**
 * FILE: backend/test/e2e/validation-flows.test.ts
 * PURPOSE: Duplicate SKU and validation failures give the field-level errors the UI relies on.
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

// Protects: the error shapes the forms map onto inputs.
describe('product validation flows', () => {
  it('a duplicate SKU in the same org is 409 DUPLICATE_SKU with fieldErrors.sku (case-insensitive)', async () => {
    const me = new ApiSession(app);
    await me.signup('me@acme.test', 'Acme');
    await me.post('/products', { name: 'First', sku: 'KEY-001' });
    const res = await me.post('/products', { name: 'Second', sku: 'key-001' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: 'DUPLICATE_SKU',
      fieldErrors: { sku: 'This SKU already exists in your organization.' },
    });
    expect((await me.get('/products')).body.meta.total).toBe(1);
  });

  it("renaming a product onto another product's SKU is also a 409", async () => {
    const me = new ApiSession(app);
    await me.signup('me@acme.test', 'Acme');
    await me.post('/products', { name: 'First', sku: 'AAA-1' });
    const second = (await me.post('/products', { name: 'Second', sku: 'BBB-2' })).body.data;
    const res = await me.patch(`/products/${second.id}`, { sku: 'AAA-1' });
    expect(res.status).toBe(409);
    expect(res.body.error.fieldErrors.sku).toBeTruthy();
  });

  it.each([
    ['quantityOnHand', { quantityOnHand: -1 }],
    ['quantityOnHand', { quantityOnHand: 1.5 }],
    ['sellingPrice', { sellingPrice: '1.999' }],
    ['costPrice', { costPrice: -5 }],
    ['sku', { sku: 'bad sku!' }],
    ['name', { name: '   ' }],
    ['lowStockThreshold', { lowStockThreshold: -2 }],
  ])('rejects invalid %s with a field error', async (field, patch) => {
    const me = new ApiSession(app);
    await me.signup('me@acme.test', 'Acme');
    const res = await me.post('/products', { name: 'Widget', sku: 'WDG-1', ...patch });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fieldErrors[field]).toBeTruthy();
  });

  it('rejects an empty PATCH body and an out-of-range page size', async () => {
    const me = new ApiSession(app);
    await me.signup('me@acme.test', 'Acme');
    const p = (await me.post('/products', { name: 'Widget', sku: 'WDG-1' })).body.data;
    expect((await me.patch(`/products/${p.id}`, {})).status).toBe(400);
    expect((await me.get('/products?limit=101')).status).toBe(400);
    expect((await me.get('/products?sort=passwordHash')).status).toBe(400);
  });
});
