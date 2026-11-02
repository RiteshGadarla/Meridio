/**
 * FILE: backend/src/modules/products/products.routes.ts
 * PURPOSE: Wires /products routes: auth -> validation -> controller. All routes require authentication.
 * LAYER: Route (ROUTE -> Middleware -> Validation -> Controller -> Service -> Prisma)
 * USED BY: app.ts (mounted at /api/v1/products)
 * DEPENDS ON: products.controller.ts, products.service.ts, middleware/{auth,validate}.ts, @meridio/contracts
 */
import { Router } from 'express';
import {
  createProductSchema,
  updateProductSchema,
  listProductsQuerySchema,
} from '@meridio/contracts';
import type { PrismaClient } from '../../generated/prisma/client.js';
import type { JwtService } from '../../lib/jwt.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createProductsController } from './products.controller.js';
import { createProductsService } from './products.service.js';

/**
 * Creates the products router with all CRUD routes.
 * SECURITY: every route is behind requireAuth, so unauthenticated requests get 401.
 */
export function createProductsRouter(deps: { prisma: PrismaClient; jwt: JwtService }): Router {
  const service = createProductsService(deps.prisma);
  const controller = createProductsController(service);
  const auth = requireAuth({ jwt: deps.jwt, prisma: deps.prisma });
  const router = Router();

  // SECURITY: auth middleware runs before anything else on every route.
  router.use(auth);

  // GET /products — list with search, pagination, sorting, status filter
  router.get('/', validate(listProductsQuerySchema, 'query'), controller.list);

  // POST /products — create a new product
  router.post('/', validate(createProductSchema, 'body'), controller.create);

  // GET /products/:id — get a single product
  router.get('/:id', controller.getById);

  // PATCH /products/:id — partially update a product
  router.patch('/:id', validate(updateProductSchema, 'body'), controller.update);

  // DELETE /products/:id — hard delete a product
  router.delete('/:id', controller.remove);

  return router;
}
