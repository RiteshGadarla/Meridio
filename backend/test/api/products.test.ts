/**
 * FILE: backend/test/api/products.test.ts
 * PURPOSE: Integration tests for the product CRUD API. Tests create, read, update, delete,
 *          search, pagination, sorting, status filtering, and validation error responses.
 * LAYER: Test (Supertest + real Neon TEST database)
 * DEPENDS ON: app.ts, test/db.ts, test/helpers.ts
 */
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestPrisma, resetDb } from '../db.js';
import { makeTestApp, TEST_ORIGIN } from '../helpers.js';

// ===== Setup =====

const prisma = createTestPrisma();
const app = makeTestApp(undefined, { prisma });

beforeEach(() => resetDb(prisma));
afterAll(() => prisma.$disconnect());

// ===== Helpers =====

const signupCreds = { email: 'owner@acme.test', password: 'Passw0rdOK', organizationName: 'Acme' };

/** Signs up and returns the session cookie. */
async function signupAndGetCookie(): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/signup')
    .set('Origin', TEST_ORIGIN)
    .send(signupCreds);
  const cookies = res.headers['set-cookie'] as unknown as string[];
  return cookies.find((c) => c.startsWith('sf_session='))!.split(';')[0]!;
}

const validProduct = {
  name: 'Widget Alpha',
  sku: 'WDG-001',
  description: 'A fine widget',
  quantityOnHand: 100,
  costPrice: 5.0,
  sellingPrice: 19.99,
  lowStockThreshold: 10,
};

const post = (cookie: string, body: Record<string, unknown> = validProduct) =>
  request(app).post('/api/v1/products').set('Origin', TEST_ORIGIN).set('Cookie', cookie).send(body);

const get = (cookie: string, path = '') =>
  request(app).get(`/api/v1/products${path}`).set('Cookie', cookie);

const patch = (cookie: string, id: string, body: Record<string, unknown>) =>
  request(app)
    .patch(`/api/v1/products/${id}`)
    .set('Origin', TEST_ORIGIN)
    .set('Cookie', cookie)
    .send(body);

const del = (cookie: string, id: string) =>
  request(app).delete(`/api/v1/products/${id}`).set('Origin', TEST_ORIGIN).set('Cookie', cookie);

// ===== CRUD =====

// Protects: full lifecycle create → get → list → update → delete.
describe('Product CRUD lifecycle', () => {
  it('create → get → list contains it; response includes stockStatus and effectiveThreshold; prices are strings', async () => {
    const cookie = await signupAndGetCookie();

    // Create
    const createRes = await post(cookie);
    expect(createRes.status).toBe(201);
    const created = createRes.body.data;
    expect(created.name).toBe('Widget Alpha');
    expect(created.sku).toBe('WDG-001');
    expect(created.stockStatus).toBe('HEALTHY');
    expect(created.effectiveThreshold).toBe(10);
    // BUSINESS RULE: prices serialised as strings, never floats.
    expect(typeof created.costPrice).toBe('string');
    expect(typeof created.sellingPrice).toBe('string');
    expect(created.costPrice).toBe('5');
    expect(created.sellingPrice).toBe('19.99');
    expect(created.updatedById).toBeTruthy();

    // Get by id
    const getRes = await get(cookie, `/${created.id}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.id).toBe(created.id);
    expect(getRes.body.data.stockStatus).toBe('HEALTHY');

    // List
    const listRes = await get(cookie);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].id).toBe(created.id);
    expect(listRes.body.meta.total).toBe(1);
  });

  it('PATCH quantity changes status (12 → 3 with threshold 5 flips to LOW_STOCK)', async () => {
    const cookie = await signupAndGetCookie();
    const createRes = await post(cookie, {
      ...validProduct,
      quantityOnHand: 12,
      lowStockThreshold: 5,
    });
    const id = createRes.body.data.id;
    expect(createRes.body.data.stockStatus).toBe('HEALTHY');

    const patchRes = await patch(cookie, id, { quantityOnHand: 3 });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.stockStatus).toBe('LOW_STOCK');
    expect(patchRes.body.data.quantityOnHand).toBe(3);
  });

  it('PATCH lowStockThreshold: null falls back to org default', async () => {
    const cookie = await signupAndGetCookie();
    const createRes = await post(cookie, { ...validProduct, lowStockThreshold: 50 });
    const id = createRes.body.data.id;
    expect(createRes.body.data.effectiveThreshold).toBe(50);

    const patchRes = await patch(cookie, id, { lowStockThreshold: null });
    expect(patchRes.status).toBe(200);
    // Org default is 5 (from signup).
    expect(patchRes.body.data.effectiveThreshold).toBe(5);
    expect(patchRes.body.data.lowStockThreshold).toBeNull();
  });

  it('DELETE then GET returns 404', async () => {
    const cookie = await signupAndGetCookie();
    const createRes = await post(cookie);
    const id = createRes.body.data.id;

    const delRes = await del(cookie, id);
    expect(delRes.status).toBe(200);
    expect(delRes.body.data.id).toBe(id);

    const getRes = await get(cookie, `/${id}`);
    expect(getRes.status).toBe(404);
    expect(getRes.body.error.code).toBe('NOT_FOUND');
  });

  it('updatedById is set to the acting user', async () => {
    const cookie = await signupAndGetCookie();
    const user = await prisma.user.findFirstOrThrow();
    const createRes = await post(cookie);
    expect(createRes.body.data.updatedById).toBe(user.id);
  });
});

// ===== Search =====

// Protects: case-insensitive search on name and SKU, and % escaping.
describe('Search', () => {
  it('search by name fragment, case-insensitive', async () => {
    const cookie = await signupAndGetCookie();
    await post(cookie, { ...validProduct, name: 'Alpha Widget', sku: 'A-1' });
    await post(cookie, { ...validProduct, name: 'Beta Gadget', sku: 'B-1' });

    const res = await get(cookie, '?search=alpha');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Alpha Widget');
  });

  it('search by SKU fragment, case-insensitive', async () => {
    const cookie = await signupAndGetCookie();
    await post(cookie, { ...validProduct, name: 'Product 1', sku: 'UNIQUE-SKU-123' });
    await post(cookie, { ...validProduct, name: 'Product 2', sku: 'OTHER-456' });

    const res = await get(cookie, '?search=unique-sku');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].sku).toBe('UNIQUE-SKU-123');
  });

  it('% in search does not match everything', async () => {
    const cookie = await signupAndGetCookie();
    await post(cookie, { ...validProduct, name: 'Product One', sku: 'P-1' });
    await post(cookie, { ...validProduct, name: 'Product Two', sku: 'P-2' });

    // A raw "%" in LIKE would match everything. After escaping it should match nothing.
    const res = await get(cookie, '?search=%25');
    expect(res.body.data).toHaveLength(0);
  });
});

// ===== Pagination =====

// Protects: pagination math and meta values.
describe('Pagination', () => {
  it('25 products, page 2 limit 10 returns 10 and correct meta', async () => {
    const cookie = await signupAndGetCookie();
    for (let i = 0; i < 25; i++) {
      await post(cookie, {
        ...validProduct,
        name: `Product ${i}`,
        sku: `SKU-${String(i).padStart(3, '0')}`,
      });
    }

    const res = await get(cookie, '?page=2&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(10);
    expect(res.body.meta).toEqual({ page: 2, limit: 10, total: 25, totalPages: 3 });
  });

  it('limit above 100 is rejected', async () => {
    const cookie = await signupAndGetCookie();
    const res = await get(cookie, '?limit=101');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ===== Sorting =====

// Protects: whitelisted sort and invalid field returns 400.
describe('Sorting', () => {
  it('sorts by name ascending', async () => {
    const cookie = await signupAndGetCookie();
    await post(cookie, { ...validProduct, name: 'Bravo', sku: 'B-1' });
    await post(cookie, { ...validProduct, name: 'Alpha', sku: 'A-1' });
    await post(cookie, { ...validProduct, name: 'Charlie', sku: 'C-1' });

    const res = await get(cookie, '?sort=name&order=asc');
    expect(res.status).toBe(200);
    expect(res.body.data.map((p: { name: string }) => p.name)).toEqual([
      'Alpha',
      'Bravo',
      'Charlie',
    ]);
  });

  it('invalid sort field returns 400', async () => {
    const cookie = await signupAndGetCookie();
    const res = await get(cookie, '?sort=malicious');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ===== Status filter =====

// Protects: status filter only returns matching products, including null-threshold fallback case.
describe('Status filter', () => {
  it('returns only matching products', async () => {
    const cookie = await signupAndGetCookie();
    // Healthy product: qty 100, threshold 10
    await post(cookie, {
      ...validProduct,
      name: 'Healthy',
      sku: 'H-1',
      quantityOnHand: 100,
      lowStockThreshold: 10,
    });
    // Low stock product: qty 3, threshold 5
    await post(cookie, {
      ...validProduct,
      name: 'LowStock',
      sku: 'L-1',
      quantityOnHand: 3,
      lowStockThreshold: 5,
    });
    // Out of stock product: qty 0
    await post(cookie, { ...validProduct, name: 'OutOfStock', sku: 'O-1', quantityOnHand: 0 });

    const lowRes = await get(cookie, '?status=LOW_STOCK');
    expect(lowRes.body.data).toHaveLength(1);
    expect(lowRes.body.data[0].name).toBe('LowStock');

    const outRes = await get(cookie, '?status=OUT_OF_STOCK');
    expect(outRes.body.data).toHaveLength(1);
    expect(outRes.body.data[0].name).toBe('OutOfStock');

    const healthyRes = await get(cookie, '?status=HEALTHY');
    expect(healthyRes.body.data).toHaveLength(1);
    expect(healthyRes.body.data[0].name).toBe('Healthy');
  });

  it('null-threshold fallback case: uses org default for status filter', async () => {
    const cookie = await signupAndGetCookie();
    // Org default threshold is 5. Product with no custom threshold, qty 3 → LOW_STOCK.
    await post(cookie, {
      ...validProduct,
      name: 'FallbackLow',
      sku: 'FL-1',
      quantityOnHand: 3,
      lowStockThreshold: null,
    });
    // Product with qty 10 and no custom threshold → HEALTHY (10 > 5).
    await post(cookie, {
      ...validProduct,
      name: 'FallbackHealthy',
      sku: 'FH-1',
      quantityOnHand: 10,
      lowStockThreshold: null,
    });

    const lowRes = await get(cookie, '?status=LOW_STOCK');
    expect(lowRes.body.data).toHaveLength(1);
    expect(lowRes.body.data[0].name).toBe('FallbackLow');
  });
});

// ===== Duplicate SKU =====

describe('Duplicate SKU', () => {
  it('returns 409 DUPLICATE_SKU with fieldErrors.sku', async () => {
    const cookie = await signupAndGetCookie();
    await post(cookie);
    const res = await post(cookie);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_SKU');
    expect(res.body.error.fieldErrors.sku).toBeTruthy();
  });
});

// ===== Unauthenticated requests =====

// Protects: every endpoint returns 401 without a cookie.
describe('Unauthenticated requests', () => {
  it.each([
    ['GET', '/api/v1/products'],
    ['GET', '/api/v1/products/some-id'],
    ['POST', '/api/v1/products'],
    ['PATCH', '/api/v1/products/some-id'],
    ['DELETE', '/api/v1/products/some-id'],
  ])('%s %s returns 401', async (method, path) => {
    const m = method.toLowerCase() as 'get' | 'post' | 'patch' | 'delete';
    let req = request(app)[m](path);
    if (m !== 'get') req = req.set('Origin', TEST_ORIGIN);
    if (m === 'post' || m === 'patch') req = req.send(validProduct);
    const res = await req;
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

// ===== Validation errors =====

describe('Validation errors', () => {
  it('rejects create with negative quantity', async () => {
    const cookie = await signupAndGetCookie();
    const res = await post(cookie, { ...validProduct, quantityOnHand: -1 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects create with bad SKU', async () => {
    const cookie = await signupAndGetCookie();
    const res = await post(cookie, { ...validProduct, sku: '$BAD' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects PATCH with empty body', async () => {
    const cookie = await signupAndGetCookie();
    const createRes = await post(cookie);
    const res = await patch(cookie, createRes.body.data.id, {});
    expect(res.status).toBe(400);
  });
});
