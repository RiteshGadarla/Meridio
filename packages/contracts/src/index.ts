/**
 * FILE: packages/contracts/src/index.ts
 * PURPOSE: Public entry point of the shared contracts package (Zod schemas and DTO types).
 * LAYER: Shared package (consumed by both backend and frontend)
 * USED BY: backend, frontend
 * DEPENDS ON: nothing yet (Zod schemas arrive in Stage 3+)
 * NOTES: One source of truth for validation rules. Never duplicate a schema in an app.
 */

/** Name of the product, shared so both apps can prove the workspace link resolves. */
export const PRODUCT_NAME = 'StockFlow';

/**
 * Shape of the success envelope returned by every API endpoint.
 * @example { data: { pong: true } }
 */
export interface ApiSuccess<T> {
  data: T;
  meta?: Record<string, unknown>;
}
