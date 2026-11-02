/**
 * FILE: backend/src/modules/inventory/stock-status.ts
 * PURPOSE: The single authoritative implementation of stock-status logic. Pure functions, no Prisma,
 *          no I/O. Every other module (products, dashboard, settings) imports from here.
 * LAYER: Domain logic (no framework dependency)
 * USED BY: products.service.ts, dashboard.service.ts (Stage 5)
 * DEPENDS ON: nothing (pure)
 * NOTES:
 *   BUSINESS RULE: stock status is computed once on the server and returned on every product payload.
 *   The frontend never recomputes it. This prevents drift between the API and the UI.
 *
 *   The effective threshold uses nullish coalescing (??), NOT logical-or (||), because an explicit
 *   product threshold of 0 is a real override that means "never consider this product low-stock".
 */

// ===== Types =====

/** The three possible stock statuses. Matches the contract enum. */
export type StockStatus = 'HEALTHY' | 'LOW_STOCK' | 'OUT_OF_STOCK';

// ===== Pure functions =====

/**
 * Resolves the threshold that should be used for a given product.
 *
 * BUSINESS RULE: a product's own `lowStockThreshold` takes priority. When it is `null` (not set),
 * the organization's `defaultLowStockThreshold` is used as the fallback.
 *
 * EDGE CASE: a product threshold of `0` is a valid override (means "this product is never
 * considered low-stock"). The `??` operator handles this correctly: `0 ?? 10` returns `0`,
 * while `0 || 10` would incorrectly return `10`.
 *
 * @param productThreshold The product's own low-stock threshold, or null/undefined if not set.
 * @param orgDefault The organization's default low-stock threshold (always an integer >= 0).
 * @returns The threshold to compare quantity against.
 *
 * @example
 * getEffectiveThreshold(null, 10) // => 10 (uses org default)
 * getEffectiveThreshold(5, 10)    // => 5  (product override wins)
 * getEffectiveThreshold(0, 10)    // => 0  (explicit zero is honoured, NOT treated as "unset")
 */
export function getEffectiveThreshold(
  productThreshold: number | null | undefined,
  orgDefault: number,
): number {
  // WHY ??: see EDGE CASE above. `||` would treat 0 as falsy and fall through to orgDefault.
  return productThreshold ?? orgDefault;
}

/**
 * Computes the stock status for a product given its current quantity and effective threshold.
 *
 * BUSINESS RULE (from CLAUDE.md):
 *   - quantity === 0                       → OUT_OF_STOCK
 *   - quantity > 0 AND quantity <= threshold → LOW_STOCK
 *   - quantity > threshold                  → HEALTHY
 *
 * Note: the boundary case `quantity === threshold` is LOW_STOCK (uses <=, not <).
 *
 * @param quantityOnHand Current stock count (integer >= 0).
 * @param effectiveThreshold The resolved threshold (from getEffectiveThreshold).
 * @returns The stock status string.
 *
 * @example
 * getStockStatus(0, 5)   // => 'OUT_OF_STOCK'
 * getStockStatus(3, 5)   // => 'LOW_STOCK'
 * getStockStatus(5, 5)   // => 'LOW_STOCK'  (boundary: <= means equal is low)
 * getStockStatus(6, 5)   // => 'HEALTHY'
 * getStockStatus(8, 0)   // => 'HEALTHY'    (threshold 0 means never low)
 */
export function getStockStatus(quantityOnHand: number, effectiveThreshold: number): StockStatus {
  // BUSINESS RULE: zero quantity is always out of stock, regardless of threshold.
  if (quantityOnHand === 0) return 'OUT_OF_STOCK';

  // BUSINESS RULE: at or below threshold means the product needs attention.
  if (quantityOnHand <= effectiveThreshold) return 'LOW_STOCK';

  return 'HEALTHY';
}
