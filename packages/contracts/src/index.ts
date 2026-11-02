/**
 * FILE: packages/contracts/src/index.ts
 * PURPOSE: Public entry point of the shared contracts package (Zod schemas and DTO types).
 * LAYER: Shared package (consumed by both backend and frontend)
 * USED BY: backend, frontend
 * DEPENDS ON: ./common.ts, ./auth.ts, ./product.ts, ./settings.ts, ./dashboard.ts
 * NOTES: One source of truth for validation rules. Never duplicate a schema in an app.
 */

/** Name of the product, shared so both apps can prove the workspace link resolves. */
export const PRODUCT_NAME = 'StockFlow';

export * from './common.js';
export * from './auth.js';
export * from './product.js';
export * from './settings.js';
export * from './dashboard.js';
