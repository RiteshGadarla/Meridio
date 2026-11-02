/**
 * FILE: packages/contracts/src/dashboard.ts
 * PURPOSE: DTO for GET /dashboard/overview.
 * LAYER: Shared contract
 * USED BY: backend dashboard module, frontend dashboard (Stage 8)
 * DEPENDS ON: ./product.ts
 */
import type { ProductDto } from './product.js';

/**
 * Dashboard payload.
 * BUSINESS RULE: "low stock" means quantity <= effective threshold, so it INCLUDES out-of-stock
 * items. The UI labels the list "Needs attention".
 */
export interface DashboardOverviewDto {
  totalProducts: number;
  /** Sum of quantityOnHand across all products (0 for an empty catalogue). */
  totalUnits: number;
  /** Count of products with quantity <= effective threshold (low + out of stock). */
  lowStockCount: number;
  /** Extra field; the UI only shows the three required metrics. */
  outOfStockCount: number;
  /** Up to 50 products needing attention, out-of-stock first, then lowest quantity. */
  lowStockProducts: ProductDto[];
}
