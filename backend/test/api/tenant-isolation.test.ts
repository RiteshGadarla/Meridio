/**
 * FILE: backend/test/api/tenant-isolation.test.ts
 * PURPOSE: Dedicated multi-tenancy suite. Proves that one org can never read, update, or delete
 *          another org's products, and that organizationId cannot be spoofed.
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
  userId: string;
}

/** Signs up an org and returns the cookie, org id and user id. */
async function signupTenant(email: string, orgName: string): Promise<Tenant> {
  const res = await request(app)
    .post('/api/v1/auth/signup')
    .set('Origin', TEST_ORIGIN)
    .send({ email, password: 'Passw0rdOK', organizationName: orgName });
  const cookies = res.headers['set-cookie'] as unknown as string[];
  const cookie = cookies.find((c) => c.startsWith('sf_session='))!.split(';')[0]!;
  return {
    cookie,
    orgId: res.body.data.organization.id,
    userId: res.body.data.id,
  };
}

const productA = { name: 'OrgA Product', sku: 'KEY-001', quantityOnHand: 10, sellingPrice: 9.99 };
const productB = { name: 'OrgB Product', sku: 'KEY-001', quantityOnHand: 20, sellingPrice: 14.99 };

// ===== Multi-tenancy suite =====

// Protects: complete tenant isolation between two organizations.
describe('Tenant isolation', () => {
  let orgA: Tenant;
  let orgB: Tenant;
  let productIdA: string;
  let productIdB: string;

  beforeEach(async () => {
    orgA = await signupTenant('a@orgA.test', 'Org A');
    orgB = await signupTenant('b@orgB.test', 'Org B');

    // Create a product in each org.
    const resA = await request(app)
      .post('/api/v1/products')
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', orgA.cookie)
      .send(productA);
    productIdA = resA.body.data.id;

    const resB = await request(app)
      .post('/api/v1/products')
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', orgB.cookie)
      .send(productB);
    productIdB = resB.body.data.id;
  });

  // Protects: same SKU allowed in different orgs.
  it('same SKU KEY-001 is allowed in both orgs', () => {
    expect(productIdA).toBeTruthy();
    expect(productIdB).toBeTruthy();
    expect(productIdA).not.toBe(productIdB);
  });

  // Protects: duplicate within one org returns 409.
  it('duplicate SKU within one org returns 409', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', orgA.cookie)
      .send(productA);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_SKU');
  });

  // Protects: Org A cannot GET Org B's product.
  it("Org A cannot GET Org B's product (404)", async () => {
    const res = await request(app).get(`/api/v1/products/${productIdB}`).set('Cookie', orgA.cookie);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  // Protects: Org A cannot PATCH Org B's product.
  it("Org A cannot PATCH Org B's product (404) and product is unchanged", async () => {
    const patchRes = await request(app)
      .patch(`/api/v1/products/${productIdB}`)
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', orgA.cookie)
      .send({ name: 'HACKED' });
    expect(patchRes.status).toBe(404);

    // Verify Org B's product is unchanged.
    const getRes = await request(app)
      .get(`/api/v1/products/${productIdB}`)
      .set('Cookie', orgB.cookie);
    expect(getRes.body.data.name).toBe('OrgB Product');
  });

  // Protects: Org A cannot DELETE Org B's product.
  it("Org A cannot DELETE Org B's product (404) and product still exists", async () => {
    const delRes = await request(app)
      .delete(`/api/v1/products/${productIdB}`)
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', orgA.cookie);
    expect(delRes.status).toBe(404);

    // Verify Org B's product still exists.
    const getRes = await request(app)
      .get(`/api/v1/products/${productIdB}`)
      .set('Cookie', orgB.cookie);
    expect(getRes.status).toBe(200);
  });

  // Protects: Org A's list never includes Org B's products.
  it("Org A list never includes Org B's products", async () => {
    const res = await request(app).get('/api/v1/products').set('Cookie', orgA.cookie);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(productIdA);
    expect(res.body.data.every((p: { id: string }) => p.id !== productIdB)).toBe(true);
  });

  // Protects: spoofed organizationId in create body is ignored.
  it('spoofed organizationId in create body is ignored', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', orgA.cookie)
      .send({ ...productA, sku: 'SPOOF-1', organizationId: orgB.orgId });
    expect(res.status).toBe(201);
    // Product should belong to Org A, not Org B.
    const product = await prisma.product.findUnique({
      where: { id: res.body.data.id },
      select: { organizationId: true },
    });
    expect(product?.organizationId).toBe(orgA.orgId);
  });

  // Protects: Org A cannot move a product to Org B by PATCHing organizationId.
  it('Org A cannot move a product to Org B by PATCHing organizationId', async () => {
    const patchRes = await request(app)
      .patch(`/api/v1/products/${productIdA}`)
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', orgA.cookie)
      .send({ organizationId: orgB.orgId, name: 'Moved?' });
    // The patch should succeed (updates name) but not change the org.
    expect(patchRes.status).toBe(200);
    const product = await prisma.product.findUnique({
      where: { id: productIdA },
      select: { organizationId: true },
    });
    expect(product?.organizationId).toBe(orgA.orgId);
  });

  // Protects: spoofed organizationId in query is ignored.
  it('spoofed organizationId in query is ignored', async () => {
    const res = await request(app)
      .get(`/api/v1/products?organizationId=${orgB.orgId}`)
      .set('Cookie', orgA.cookie);
    expect(res.status).toBe(200);
    // Should only return Org A's products.
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(productIdA);
  });
});
