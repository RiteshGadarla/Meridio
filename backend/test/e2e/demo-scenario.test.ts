/**
 * FILE: backend/test/e2e/demo-scenario.test.ts
 * PURPOSE: The PRD demo scenario, end to end through the real HTTP API and the real test database.
 * LAYER: Scenario test (Supertest + Neon TEST database)
 * DEPENDS ON: test/session.ts, test/db.ts, app.ts
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestPrisma, resetDb } from '../db.js';
import { makeTestApp } from '../helpers.js';
import { ApiSession } from '../session.js';

const prisma = createTestPrisma();
const app = makeTestApp(undefined, { prisma });

beforeEach(() => resetDb(prisma));
afterAll(() => prisma.$disconnect());

// Protects: the headline user journey keeps working across auth, products, dashboard and settings.
describe('PRD demo scenario', () => {
  it('signup -> products -> dashboard -> thresholds -> search -> delete -> logout', async () => {
    const me = new ApiSession(app);

    // 1. Sign up "Demo Store"; the dashboard starts empty.
    const user = await me.signup('demo@demostore.test', 'Demo Store');
    expect(user.email).toBe('demo@demostore.test');
    let dash = (await me.get('/dashboard/overview')).body.data;
    expect(dash).toEqual({
      totalProducts: 0,
      totalUnits: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
      lowStockProducts: [],
    });

    // 2. Create Wireless Keyboard (KEY-001, qty 12, threshold 5): Healthy.
    const created = await me.post('/products', {
      name: 'Wireless Keyboard',
      sku: 'key-001',
      quantityOnHand: 12,
      lowStockThreshold: 5,
    });
    expect(created.status).toBe(201);
    const keyboard = created.body.data;
    expect(keyboard).toMatchObject({
      sku: 'KEY-001',
      stockStatus: 'HEALTHY',
      effectiveThreshold: 5,
    });

    // 3. It appears in the list; the dashboard shows 1 product, 12 units, 0 low stock.
    const list = (await me.get('/products')).body;
    expect(list.data.map((p: { id: string }) => p.id)).toContain(keyboard.id);
    expect(list.meta.total).toBe(1);
    dash = (await me.get('/dashboard/overview')).body.data;
    expect(dash).toMatchObject({ totalProducts: 1, totalUnits: 12, lowStockCount: 0 });

    // 4. Edit quantity to 3: the dashboard shows 1 low stock and lists the product.
    const edited = await me.patch(`/products/${keyboard.id}`, { quantityOnHand: 3 });
    expect(edited.body.data.stockStatus).toBe('LOW_STOCK');
    dash = (await me.get('/dashboard/overview')).body.data;
    expect(dash.lowStockCount).toBe(1);
    expect(dash.lowStockProducts.map((p: { sku: string }) => p.sku)).toEqual(['KEY-001']);

    // 5. Settings: a product WITHOUT its own threshold follows the new default.
    const mouse = (await me.post('/products', { name: 'Mouse', sku: 'MSE-001', quantityOnHand: 8 }))
      .body.data;
    expect(mouse).toMatchObject({
      lowStockThreshold: null,
      effectiveThreshold: 5,
      stockStatus: 'HEALTHY',
    });
    const settings = await me.patch('/settings', { defaultLowStockThreshold: 10 });
    expect(settings.body.data).toEqual({
      defaultLowStockThreshold: 10,
      organizationName: 'Demo Store',
    });
    expect((await me.get(`/products/${mouse.id}`)).body.data).toMatchObject({
      effectiveThreshold: 10,
      stockStatus: 'LOW_STOCK',
    });
    // The keyboard has its own threshold (5), so the default change must not affect it.
    expect((await me.get(`/products/${keyboard.id}`)).body.data.effectiveThreshold).toBe(5);
    expect((await me.get('/dashboard/overview')).body.data.lowStockCount).toBe(2);

    // 6. Search by SKU (case-insensitive) finds it.
    const found = (await me.get('/products?search=key-0')).body;
    expect(found.data.map((p: { sku: string }) => p.sku)).toEqual(['KEY-001']);

    // 7. Edit the description.
    const withDesc = await me.patch(`/products/${keyboard.id}`, {
      description: 'Bluetooth, UK layout',
    });
    expect(withDesc.body.data.description).toBe('Bluetooth, UK layout');

    // 8. Create a second product and delete it; it is gone afterwards.
    const temp = (await me.post('/products', { name: 'Temporary', sku: 'TMP-001' })).body.data;
    expect((await me.delete(`/products/${temp.id}`)).status).toBe(200);
    expect((await me.get(`/products/${temp.id}`)).status).toBe(404);
    expect((await me.get('/products')).body.meta.total).toBe(2);

    // 9. Log out: the same client can no longer reach private data.
    expect((await me.post('/auth/logout')).status).toBe(200);
    expect((await me.get('/dashboard/overview')).status).toBe(401);
    expect((await me.get('/auth/me')).status).toBe(401);
  });
});
