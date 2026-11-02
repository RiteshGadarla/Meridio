/**
 * FILE: backend/prisma/seed.ts
 * PURPOSE: Idempotent DEVELOPMENT seed: two demo organizations, their owners, and sample products.
 * LAYER: Script
 * USED BY: `npm run db:seed`, test/db/seed.test.ts
 * DEPENDS ON: src/lib/prisma.ts, bcrypt
 * NOTES:
 *  - DEV ONLY. The passwords below are public (documented in the README). Never run in production.
 *  - Idempotent: fixed ids + skipDuplicates inserts mean running it twice changes nothing.
 *  - KEY-001 intentionally exists in BOTH organizations to demonstrate per-tenant SKU uniqueness.
 */
import { pathToFileURL } from 'node:url';
import bcrypt from 'bcrypt';
import type { PrismaClient } from '../src/generated/prisma/client.js';

// ===== Fixture data =====

export const DEV_USERS = [
  {
    id: 'seed_user_demo',
    email: 'demo@demostore.test',
    password: 'DemoPass123',
    orgId: 'seed_org_demo',
  },
  {
    id: 'seed_user_northwind',
    email: 'owner@northwind.test',
    password: 'NorthPass123',
    orgId: 'seed_org_northwind',
  },
] as const;

const ORGS = [
  { id: 'seed_org_demo', name: 'Demo Store', defaultLowStockThreshold: 5 },
  { id: 'seed_org_northwind', name: 'Northwind Supply', defaultLowStockThreshold: 10 },
];

interface SeedProduct {
  orgId: string;
  sku: string;
  name: string;
  quantityOnHand: number;
  costPrice: string | null;
  sellingPrice: string | null;
  lowStockThreshold: number | null;
}

const p = (
  sku: string,
  name: string,
  quantityOnHand: number,
  costPrice: string | null,
  sellingPrice: string | null,
  lowStockThreshold: number | null,
  orgId = 'seed_org_demo',
): SeedProduct => ({
  orgId,
  sku,
  name,
  quantityOnHand,
  costPrice,
  sellingPrice,
  lowStockThreshold,
});

// Demo Store default threshold is 5. The comments say which status each row produces.
const PRODUCTS: SeedProduct[] = [
  p('KEY-001', 'Wireless Keyboard', 12, '18.50', '39.99', 5), // healthy
  p('MSE-002', 'Wireless Mouse', 3, '9.00', '24.99', 5), // low
  p('HUB-003', 'USB-C Hub', 0, '14.25', '34.99', 5), // out of stock
  p('CAB-004', 'HDMI Cable 2m', 40, '2.10', '8.99', null), // healthy, org default
  p('CAB-005', 'USB-C Cable 1m', 5, '1.80', '7.49', null), // low: boundary qty == default
  p('MON-006', '27in Monitor', 8, '120.00', '199.00', 10), // low: own threshold above qty
  p('LMP-007', 'Desk Lamp', 25, null, null, null), // healthy, no prices set
  p('STD-008', 'Laptop Stand', 0, '11.00', '29.50', null), // out of stock, org default
  p('WBC-009', 'HD Webcam', 6, '22.00', '49.00', 0), // healthy: explicit 0 overrides default
  p('HDP-010', 'Headphones', 14, '30.00', '79.00', 15), // low: own threshold above qty
  p('CHG-011', '65W Charger', 60, '12.00', '34.00', 20), // healthy
  p('MPD-012', 'Mouse Pad XL', 2, '3.00', '12.99', null), // low, org default
  // Northwind Supply: same SKU as Demo Store's KEY-001, allowed because uniqueness is per org.
  p('KEY-001', 'Mechanical Keyboard', 7, '45.00', '89.00', null, 'seed_org_northwind'),
  p('PLT-100', 'Pallet Wrap Roll', 120, '4.00', '9.50', null, 'seed_org_northwind'),
];

// ===== Seeding =====

/**
 * Inserts the dev fixture into the database behind `prisma`. Safe to run repeatedly.
 * @param prisma client connected to the target database
 */
export async function seedDatabase(prisma: PrismaClient): Promise<void> {
  // WHY createMany + skipDuplicates (INSERT ... ON CONFLICT DO NOTHING): one round trip per table
  // instead of one per row. Neon is a network hop away, so row-by-row upserts are very slow.
  // Fixed ids / the (organizationId, sku) unique key make re-runs a no-op.
  await prisma.organization.createMany({ data: ORGS, skipDuplicates: true });

  // WHY look up first: bcrypt cost 12 is slow on purpose; do not hash users that already exist.
  const existing = await prisma.user.findMany({
    where: { id: { in: DEV_USERS.map((u) => u.id) } },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((u) => u.id));
  const newUsers = await Promise.all(
    DEV_USERS.filter((u) => !existingIds.has(u.id)).map(async (u) => ({
      id: u.id,
      email: u.email,
      passwordHash: await bcrypt.hash(u.password, 12),
      organizationId: u.orgId,
    })),
  );
  await prisma.user.createMany({ data: newUsers, skipDuplicates: true });

  await prisma.product.createMany({
    data: PRODUCTS.map(({ orgId, ...product }) => ({ ...product, organizationId: orgId })),
    skipDuplicates: true,
  });
}

// ===== CLI entry =====

// Run only when executed directly (`tsx prisma/seed.ts`), not when imported by tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { prisma } = await import('../src/lib/prisma.js');
  try {
    await seedDatabase(prisma);
    console.log('Seed complete: 2 organizations, 2 users, 14 products.');
  } finally {
    await prisma.$disconnect();
  }
}
