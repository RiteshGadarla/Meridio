/**
 * FILE: backend/src/modules/dashboard/dashboard.service.ts
 * PURPOSE: Computes the dashboard overview with SQL-level aggregation (no full-table loads).
 * LAYER: Service (Route -> Middleware -> Validation -> Controller -> SERVICE -> Prisma)
 * USED BY: dashboard.routes.ts
 * DEPENDS ON: PrismaClient, products.service.ts (toProductDto), @meridio/contracts
 * NOTES: BUSINESS RULE: the low-stock SQL predicate must stay equivalent to getStockStatus
 *        (quantity <= COALESCE(product threshold, org default)). Each returned row still goes through
 *        toProductDto, so the status shown can never differ from the products endpoint.
 */
import type { DashboardOverviewDto } from '@meridio/contracts';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { AppError } from '../../utils/app-error.js';
import { productSelect, toProductDto } from '../products/products.service.js';

const LOW_STOCK_LIMIT = 50;

export function createDashboardService(prisma: PrismaClient) {
  return {
    /**
     * Builds the overview for one organization.
     * @throws AppError UNAUTHENTICATED if the organization no longer exists
     */
    async getOverview(organizationId: string): Promise<DashboardOverviewDto> {
      // TENANT SCOPE: every query below filters by the session's organizationId.
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { defaultLowStockThreshold: true },
      });
      if (!org) throw new AppError('UNAUTHENTICATED', 'Organization not found');
      const orgDefault = org.defaultLowStockThreshold;

      const [totals, counts, urgent] = await Promise.all([
        prisma.product.aggregate({
          where: { organizationId },
          _count: { _all: true },
          _sum: { quantityOnHand: true },
        }),
        // BUSINESS RULE: low stock = qty <= effective threshold; out of stock (qty 0) is a subset
        // because thresholds are never negative. COALESCE is the SQL form of `??` (0 stays 0).
        prisma.$queryRaw<{ low: bigint; out: bigint }[]>`
          SELECT COUNT(*) FILTER (WHERE "quantityOnHand" <= COALESCE("lowStockThreshold", ${orgDefault})) AS low,
                 COUNT(*) FILTER (WHERE "quantityOnHand" = 0) AS out
          FROM "Product"
          WHERE "organizationId" = ${organizationId}`,
        // Most urgent first: out of stock, then lowest quantity, then name for a stable order.
        prisma.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "Product"
          WHERE "organizationId" = ${organizationId}
            AND "quantityOnHand" <= COALESCE("lowStockThreshold", ${orgDefault})
          ORDER BY ("quantityOnHand" = 0) DESC, "quantityOnHand" ASC, "name" ASC
          LIMIT ${LOW_STOCK_LIMIT}`,
      ]);

      const ids = urgent.map((r) => r.id);
      // TENANT SCOPE: re-filtered by organizationId even though ids came from a scoped query.
      const rows = ids.length
        ? await prisma.product.findMany({
            where: { organizationId, id: { in: ids } },
            select: productSelect,
          })
        : [];
      const byId = new Map(rows.map((r) => [r.id, r]));
      const lowStockProducts = ids.flatMap((id) => {
        const row = byId.get(id);
        return row ? [toProductDto(row, orgDefault)] : [];
      });

      return {
        totalProducts: totals._count._all,
        // EDGE CASE: SUM over zero rows is null; report 0.
        totalUnits: totals._sum.quantityOnHand ?? 0,
        lowStockCount: Number(counts[0]?.low ?? 0n),
        outOfStockCount: Number(counts[0]?.out ?? 0n),
        lowStockProducts,
      };
    },
  };
}
