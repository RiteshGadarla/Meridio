/**
 * FILE: backend/src/modules/products/index.ts
 * PURPOSE: Public exports of the products module. Exposes the router factory for app.ts.
 * LAYER: Module
 * USED BY: app.ts
 * DEPENDS ON: ./products.routes.ts
 */
export { createProductsRouter } from './products.routes.js';
