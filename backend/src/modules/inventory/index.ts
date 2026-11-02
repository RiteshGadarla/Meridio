/**
 * FILE: backend/src/modules/inventory/index.ts
 * PURPOSE: Public exports of the inventory module. The single source of truth for stock status.
 * LAYER: Module
 * USED BY: products.service.ts, dashboard.service.ts (Stage 5)
 * DEPENDS ON: ./stock-status.ts
 */
export { getEffectiveThreshold, getStockStatus } from './stock-status.js';
export type { StockStatus } from './stock-status.js';
