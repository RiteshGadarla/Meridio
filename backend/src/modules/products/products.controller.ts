/**
 * FILE: backend/src/modules/products/products.controller.ts
 * PURPOSE: HTTP layer for product CRUD: reads the validated input, calls the service, shapes the response.
 * LAYER: Controller (Route -> Middleware -> Validation -> CONTROLLER -> Service -> Prisma)
 * USED BY: products.routes.ts
 * DEPENDS ON: products.service.ts, middleware/auth.ts, utils/api-response.ts, utils/async-handler.ts
 * NOTES: No Prisma imports here. No business logic. Controllers only translate HTTP <-> service.
 */
import type {
  AdjustStockInput,
  CreateProductInput,
  UpdateProductInput,
  ListProductsQuery,
} from '@meridio/contracts';
import { getAuth } from '../../middleware/auth.js';
import { ok } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';
import type { ProductsService } from './products.service.js';

/**
 * Creates the products controller, wired to a ProductsService instance.
 * Each handler uses getAuth(req) to obtain the caller's identity from the verified JWT.
 */
export function createProductsController(service: ProductsService) {
  return {
    /**
     * POST /products
     * Creates a new product in the caller's organization.
     */
    create: asyncHandler(async (req, res) => {
      // TENANT SCOPE: organizationId and userId come from req.auth (verified JWT + DB).
      const { organizationId, userId } = getAuth(req);
      const product = await service.create(req.body as CreateProductInput, organizationId, userId);
      ok(res, product, undefined, 201);
    }),

    /**
     * GET /products
     * Lists products with search, pagination, sorting and optional status filtering.
     */
    list: asyncHandler(async (req, res) => {
      // TENANT SCOPE: organizationId from the verified session.
      const { organizationId } = getAuth(req);
      // req.query was replaced by the validate middleware with the parsed value from listProductsQuerySchema.
      const { products, meta } = await service.list(
        req.query as unknown as ListProductsQuery,
        organizationId,
      );
      ok(res, products, meta as unknown as Record<string, unknown>);
    }),

    /**
     * GET /products/:id
     * Returns a single product by id, scoped to the caller's organization.
     */
    getById: asyncHandler(async (req, res) => {
      const { organizationId } = getAuth(req);
      const product = await service.getById(req.params.id as string, organizationId);
      ok(res, product);
    }),

    /**
     * PATCH /products/:id
     * Partially updates a product. At least one field is required.
     */
    update: asyncHandler(async (req, res) => {
      const { organizationId, userId } = getAuth(req);
      const product = await service.update(
        req.params.id as string,
        req.body as UpdateProductInput,
        organizationId,
        userId,
      );
      ok(res, product);
    }),

    /**
     * PATCH /products/:id/stock
     * Applies a relative stock change ("+N" / "-N") with an optional note.
     */
    adjustStock: asyncHandler(async (req, res) => {
      const { organizationId, userId } = getAuth(req);
      const product = await service.adjustStock(
        req.params.id as string,
        req.body as AdjustStockInput,
        organizationId,
        userId,
      );
      ok(res, product);
    }),

    /**
     * DELETE /products/:id
     * Hard-deletes a product. Returns 200 with { data: { id } }.
     */
    remove: asyncHandler(async (req, res) => {
      const { organizationId, userId } = getAuth(req);
      const result = await service.delete(req.params.id as string, organizationId, userId);
      ok(res, result);
    }),
  };
}
