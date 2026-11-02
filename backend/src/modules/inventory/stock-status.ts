/**
 * FILE: backend/src/modules/inventory/stock-status.ts
 * PURPOSE: The backend entry point for stock-status logic. The implementation lives in
 *          @meridio/contracts so the frontend form preview uses the exact same functions.
 * LAYER: Domain logic (re-export)
 * USED BY: modules/inventory/index.ts, products.service.ts, dashboard.service.ts
 * DEPENDS ON: @meridio/contracts (stock-status.ts)
 * NOTES: BUSINESS RULE (single implementation): effective = product ?? org default;
 *        status = qty 0 -> OUT_OF_STOCK, qty <= effective -> LOW_STOCK, else HEALTHY.
 */
export { getEffectiveThreshold, getStockStatus } from '@meridio/contracts';
export type { StockStatus } from '@meridio/contracts';
