/**
 * FILE: backend/test/db/services-edge.test.ts
 * PURPOSE: Service-level edge cases the HTTP layer cannot reach: a missing organization/user, and
 *          every optional field of a product update (set, change and clear).
 * LAYER: Test (real Neon TEST database)
 * DEPENDS ON: the auth, settings, dashboard and products services, test/db.ts
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createAuthService } from '../../src/modules/auth/auth.service.js';
import { createDashboardService } from '../../src/modules/dashboard/dashboard.service.js';
import { createProductsService } from '../../src/modules/products/products.service.js';
import { createSettingsService } from '../../src/modules/settings/settings.service.js';
import { createTestPrisma, resetDb } from '../db.js';

const prisma = createTestPrisma();

beforeEach(() => resetDb(prisma));
afterAll(() => prisma.$disconnect());

// Protects: a deleted organization/user is reported as UNAUTHENTICATED, never as a crash or empty data.
// (requireAuth normally stops these first; the services stay safe if they are called directly.)
describe('missing organization or user', () => {
  const ghost = 'does-not-exist';
  const expectUnauthenticated = (promise: Promise<unknown>) =>
    expect(promise).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });

  it('settings.get and settings.update', async () => {
    const settings = createSettingsService(prisma);
    await expectUnauthenticated(settings.get(ghost));
    await expectUnauthenticated(settings.update(ghost, { defaultLowStockThreshold: 3 }));
  });

  it('dashboard.getOverview', async () => {
    await expectUnauthenticated(createDashboardService(prisma).getOverview(ghost));
  });

  it('auth.getCurrentUser', async () => {
    await expectUnauthenticated(createAuthService(prisma).getCurrentUser(ghost));
  });

  it('products.list', async () => {
    const products = createProductsService(prisma);
    await expectUnauthenticated(
      products.list({ page: 1, limit: 20, sort: 'createdAt', order: 'desc' }, ghost),
    );
  });
});

// Protects: every optional field can be set, changed and cleared independently through update.
describe('products.update field handling', () => {
  it('sets, changes and clears each optional field', async () => {
    const org = await prisma.organization.create({ data: { name: 'Acme' } });
    const user = await prisma.user.create({
      data: { email: 'a@acme.test', passwordHash: 'x', organizationId: org.id },
    });
    const products = createProductsService(prisma);
    const created = await products.create(
      {
        name: 'Widget',
        sku: 'WDG-1',
        quantityOnHand: 5,
        description: 'first',
        costPrice: 1.5,
        sellingPrice: 2.5,
        lowStockThreshold: 2,
      },
      org.id,
      user.id,
    );
    expect(created).toMatchObject({
      description: 'first',
      costPrice: '1.5',
      sellingPrice: '2.5',
      lowStockThreshold: 2,
    });

    // change every field at once
    const changed = await products.update(
      created.id,
      {
        name: 'Widget 2',
        sku: 'WDG-2',
        description: 'second',
        quantityOnHand: 9,
        costPrice: 3,
        sellingPrice: 4,
        lowStockThreshold: 7,
      },
      org.id,
      user.id,
    );
    expect(changed).toMatchObject({
      name: 'Widget 2',
      sku: 'WDG-2',
      description: 'second',
      quantityOnHand: 9,
      costPrice: '3',
      sellingPrice: '4',
      lowStockThreshold: 7,
      updatedById: user.id,
    });

    // clear every clearable field with null
    const cleared = await products.update(
      created.id,
      { description: null, costPrice: null, sellingPrice: null, lowStockThreshold: null },
      org.id,
      user.id,
    );
    expect(cleared).toMatchObject({
      description: null,
      costPrice: null,
      sellingPrice: null,
      lowStockThreshold: null,
    });
    expect(cleared.effectiveThreshold).toBe(5); // back to the organization default

    // an update with only updatedById changing still succeeds and leaves everything else alone
    const untouched = await products.update(created.id, { name: 'Widget 2' }, org.id, user.id);
    expect(untouched).toMatchObject({ name: 'Widget 2', sku: 'WDG-2', quantityOnHand: 9 });
  });

  it('update and delete of an unknown or foreign id are NOT_FOUND', async () => {
    const org = await prisma.organization.create({ data: { name: 'Acme' } });
    const user = await prisma.user.create({
      data: { email: 'a@acme.test', passwordHash: 'x', organizationId: org.id },
    });
    const products = createProductsService(prisma);
    await expect(products.update('nope', { name: 'x' }, org.id, user.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(products.delete('nope', org.id, user.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
