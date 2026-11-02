/**
 * FILE: backend/test/db/seed.test.ts
 * PURPOSE: Verifies the dev seed is idempotent and demonstrates per-tenant SKU reuse.
 * LAYER: Test (real PostgreSQL on the Neon TEST database)
 * DEPENDS ON: prisma/seed.ts, test/db.ts
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { seedDatabase } from '../../prisma/seed.js';
import { createTestPrisma, resetDb } from '../db.js';

const prisma = createTestPrisma();

beforeEach(() => resetDb(prisma));
afterAll(() => prisma.$disconnect());

const counts = async () => ({
  organizations: await prisma.organization.count(),
  users: await prisma.user.count(),
  products: await prisma.product.count(),
});

// Protects: re-running `npm run db:seed` never duplicates data or errors.
describe('seedDatabase', () => {
  it('is idempotent (second run leaves counts unchanged)', async () => {
    await seedDatabase(prisma);
    const first = await counts();
    await seedDatabase(prisma);
    expect(await counts()).toEqual(first);
    expect(first).toEqual({ organizations: 2, users: 2, products: 14 });
  });

  it('stores bcrypt hashes, never plaintext passwords', async () => {
    await seedDatabase(prisma);
    const users = await prisma.user.findMany();
    expect(users.every((u) => u.passwordHash?.startsWith('$2'))).toBe(true);
  });

  it('puts KEY-001 in both organizations', async () => {
    await seedDatabase(prisma);
    const keys = await prisma.product.findMany({ where: { sku: 'KEY-001' } });
    expect(new Set(keys.map((k) => k.organizationId)).size).toBe(2);
  });
});
