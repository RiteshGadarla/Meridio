/**
 * FILE: backend/test/db/schema.test.ts
 * PURPOSE: Proves the database enforces tenant scoping, constraints, precision and cascades.
 * LAYER: Test (real PostgreSQL on the Neon TEST database)
 * DEPENDS ON: test/db.ts
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestPrisma, resetDb } from '../db.js';

const prisma = createTestPrisma();

beforeEach(() => resetDb(prisma));
afterAll(() => prisma.$disconnect());

async function makeOrg(name = 'Org') {
  return prisma.organization.create({ data: { name } });
}

async function makeProduct(organizationId: string, sku = 'SKU-1', extra = {}) {
  return prisma.product.create({ data: { organizationId, name: 'Thing', sku, ...extra } });
}

/** Inserts a product with raw SQL so application-level validation cannot interfere. */
function rawInsert(organizationId: string, columns: string, values: string) {
  return prisma.$executeRawUnsafe(
    `INSERT INTO "Product" (id, "organizationId", name, sku, "updatedAt"${columns})
     VALUES ('raw1', '${organizationId}', 'Raw', 'RAW-1', now()${values})`,
  );
}

// Protects: SKU uniqueness is per organization, not global.
describe('SKU uniqueness', () => {
  it('rejects the same SKU twice in one organization (P2002)', async () => {
    const org = await makeOrg();
    await makeProduct(org.id, 'KEY-001');
    await expect(makeProduct(org.id, 'KEY-001')).rejects.toMatchObject({ code: 'P2002' });
  });

  it('allows the same SKU in two different organizations', async () => {
    const a = await makeOrg('A');
    const b = await makeOrg('B');
    await makeProduct(a.id, 'KEY-001');
    await expect(makeProduct(b.id, 'KEY-001')).resolves.toBeDefined();
  });
});

// Protects: CHECK constraints are a safety net even if application validation has a bug.
describe('CHECK constraints', () => {
  it('rejects negative quantityOnHand', async () => {
    const org = await makeOrg();
    await expect(rawInsert(org.id, ', "quantityOnHand"', ', -1')).rejects.toThrow(
      /Product_quantityOnHand_nonneg_chk|check constraint/i,
    );
  });

  it('rejects negative prices', async () => {
    const org = await makeOrg();
    await expect(rawInsert(org.id, ', "costPrice"', ', -0.01')).rejects.toThrow(/check/i);
    await expect(rawInsert(org.id, ', "sellingPrice"', ', -5')).rejects.toThrow(/check/i);
  });

  it('rejects negative thresholds on product and organization', async () => {
    const org = await makeOrg();
    await expect(rawInsert(org.id, ', "lowStockThreshold"', ', -1')).rejects.toThrow(/check/i);
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE "Organization" SET "defaultLowStockThreshold" = -1 WHERE id = '${org.id}'`,
      ),
    ).rejects.toThrow(/check/i);
  });

  it('accepts NULL prices and a zero threshold (explicit override of 0)', async () => {
    const org = await makeOrg();
    const product = await makeProduct(org.id, 'OK-1', { lowStockThreshold: 0 });
    expect(product.costPrice).toBeNull();
    expect(product.lowStockThreshold).toBe(0);
  });
});

// Protects: money is exact (Decimal), never a float.
describe('Decimal precision', () => {
  it('round-trips 19.99 exactly', async () => {
    const org = await makeOrg();
    const created = await makeProduct(org.id, 'PRICE-1', { costPrice: '19.99' });
    const found = await prisma.product.findUniqueOrThrow({ where: { id: created.id } });
    expect(found.costPrice?.toString()).toBe('19.99');
  });
});

// Protects: referential rules (tenant cleanup, and history surviving user deletion).
describe('relations', () => {
  it('deleting an organization cascades to its products and users', async () => {
    const org = await makeOrg();
    await makeProduct(org.id, 'A');
    await prisma.user.create({
      data: { email: 'a@x.com', passwordHash: 'x', organizationId: org.id },
    });
    await prisma.organization.delete({ where: { id: org.id } });
    expect(await prisma.product.count()).toBe(0);
    expect(await prisma.user.count()).toBe(0);
  });

  it('deleting a user sets Product.updatedById to null and keeps the product', async () => {
    const org = await makeOrg();
    const user = await prisma.user.create({
      data: { email: 'u@x.com', passwordHash: 'x', organizationId: org.id },
    });
    const product = await makeProduct(org.id, 'A', { updatedById: user.id });
    await prisma.user.delete({ where: { id: user.id } });
    const after = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(after.updatedById).toBeNull();
  });
});
