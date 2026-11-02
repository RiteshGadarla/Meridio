/**
 * FILE: backend/src/modules/products/products.service.ts
 * PURPOSE: Business logic for product CRUD, search, pagination and sorting. No HTTP code here.
 * LAYER: Service (Route -> Middleware -> Validation -> Controller -> SERVICE -> Prisma)
 * USED BY: products.controller.ts
 * DEPENDS ON: PrismaClient, @meridio/contracts, modules/inventory/stock-status.ts
 * NOTES:
 *   - Every query MUST include organizationId (tenant isolation).
 *   - Updates and deletes use { id, organizationId } and check count to avoid leaking existence.
 *   - Prices are Decimal in Postgres and serialised as strings in JSON (never floats).
 *   - Stock status and effective threshold are computed on every read via the inventory module.
 */
import type {
  CreateProductInput,
  UpdateProductInput,
  ListProductsQuery,
  ProductDto,
  PaginationMeta,
} from '@meridio/contracts';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { getEffectiveThreshold, getStockStatus } from '../inventory/index.js';
import { AppError } from '../../utils/app-error.js';

// ===== Types =====

/** A Prisma product row with the org's default threshold included (for status computation). */
interface ProductRow {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  quantityOnHand: number;
  costPrice: { toString(): string } | null;
  sellingPrice: { toString(): string } | null;
  lowStockThreshold: number | null;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ===== Mapper =====

/**
 * Converts a Prisma product row into the API's ProductDto.
 * Decimal values are serialised as strings. Stock status is computed on the server.
 *
 * @param row The product row from Prisma (with Decimal fields).
 * @param orgDefaultThreshold The organization's default low-stock threshold.
 * @returns A ProductDto ready for the API response.
 */
export function toProductDto(row: ProductRow, orgDefaultThreshold: number): ProductDto {
  const effectiveThreshold = getEffectiveThreshold(row.lowStockThreshold, orgDefaultThreshold);
  const stockStatus = getStockStatus(row.quantityOnHand, effectiveThreshold);
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    description: row.description,
    quantityOnHand: row.quantityOnHand,
    // BUSINESS RULE: money is Decimal in Postgres, serialised as strings in JSON (never floats).
    costPrice: row.costPrice?.toString() ?? null,
    sellingPrice: row.sellingPrice?.toString() ?? null,
    lowStockThreshold: row.lowStockThreshold,
    effectiveThreshold,
    stockStatus,
    updatedById: row.updatedById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ===== Select clause (reusable across all product queries) =====

export const productSelect = {
  id: true,
  name: true,
  sku: true,
  description: true,
  quantityOnHand: true,
  costPrice: true,
  sellingPrice: true,
  lowStockThreshold: true,
  updatedById: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ===== Service factory =====

/**
 * Creates the products service with the given Prisma client.
 * Every method requires an organizationId from the verified auth context.
 */
export function createProductsService(prisma: PrismaClient) {
  /**
   * Loads the organization's default threshold. Called internally by every method that returns a DTO.
   * @throws AppError if the organization is not found (should never happen with valid auth).
   */
  async function getOrgDefault(organizationId: string): Promise<number> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { defaultLowStockThreshold: true },
    });
    // EDGE CASE: if the org is missing the auth middleware would have caught it, but defensive coding.
    if (!org) throw new AppError('UNAUTHENTICATED', 'Organization not found');
    return org.defaultLowStockThreshold;
  }

  /**
   * Escapes `%` and `_` in user search input for use in Prisma `contains` (LIKE/ILIKE).
   * WHY: without this, a search for "50%" would match everything.
   */
  function escapeSearch(input: string): string {
    // SECURITY: escape special LIKE characters so user input is treated literally.
    return input.replace(/[%_\\]/g, '\\$&');
  }

  return {
    /**
     * Creates a new product in the caller's organization.
     * @param input Validated product fields (from createProductSchema).
     * @param organizationId From req.auth (verified JWT + DB).
     * @param userId From req.auth (set as updatedById).
     * @returns The created product as a ProductDto.
     * @throws P2002 (caught by error handler as DUPLICATE_SKU) on duplicate org+sku.
     */
    async create(
      input: CreateProductInput,
      organizationId: string,
      userId: string,
    ): Promise<ProductDto> {
      // TENANT SCOPE: organizationId comes from the verified session, never from the request body.
      const row = await prisma.product.create({
        data: {
          organizationId,
          name: input.name,
          sku: input.sku,
          description: input.description ?? null,
          quantityOnHand: input.quantityOnHand,
          costPrice: input.costPrice ?? null,
          sellingPrice: input.sellingPrice ?? null,
          lowStockThreshold: input.lowStockThreshold ?? null,
          updatedById: userId,
        },
        select: productSelect,
      });
      const orgDefault = await getOrgDefault(organizationId);
      return toProductDto(row, orgDefault);
    },

    /**
     * Returns a single product by id, or throws 404 if not found in this organization.
     * @throws AppError NOT_FOUND if the product does not exist or belongs to another tenant.
     */
    async getById(id: string, organizationId: string): Promise<ProductDto> {
      // TENANT SCOPE: always filter by organizationId so another tenant's product returns 404.
      const row = await prisma.product.findUnique({
        where: { id },
        select: { ...productSelect, organizationId: true },
      });
      // SECURITY: return 404 (not 403) for other tenants' rows, so existence is not leaked.
      if (!row || row.organizationId !== organizationId) {
        throw new AppError('NOT_FOUND', 'Product not found');
      }
      const orgDefault = await getOrgDefault(organizationId);
      return toProductDto(row, orgDefault);
    },

    /**
     * Lists products with search, pagination, sorting and optional status filtering.
     * @param query Validated query parameters (from listProductsQuerySchema).
     * @param organizationId From req.auth.
     * @returns Products page with pagination meta.
     */
    async list(
      query: ListProductsQuery,
      organizationId: string,
    ): Promise<{ products: ProductDto[]; meta: PaginationMeta }> {
      const orgDefault = await getOrgDefault(organizationId);
      const { page, limit, search, sort, order, status } = query;

      // ===== Where clause =====

      // TENANT SCOPE: every list query is scoped to the caller's organization.
      const where: Record<string, unknown> = { organizationId };

      // Search: case-insensitive substring match on name OR sku.
      if (search) {
        const escaped = escapeSearch(search);
        where.OR = [
          { name: { contains: escaped, mode: 'insensitive' } },
          { sku: { contains: escaped, mode: 'insensitive' } },
        ];
      }

      // ===== Status filter =====
      // BUSINESS RULE: status filtering must account for the null-threshold fallback.
      // We cannot use a simple Prisma where because the effective threshold depends on whether
      // the product has its own threshold or falls back to the org default.
      // Strategy: fetch all matching rows (with search applied), compute status, then filter.
      // For large datasets this is less efficient than a raw SQL query, but correctness is the
      // priority. The pg_trgm indexes still help with the search filter.

      if (status) {
        // When status filtering is active, we need to fetch all products (not paginated),
        // compute their status, filter, then paginate in memory.
        const allRows = await prisma.product.findMany({
          where: where as Parameters<typeof prisma.product.findMany>[0] extends { where?: infer W }
            ? W
            : never,
          select: productSelect,
          orderBy: { [sort]: order },
        });

        const allDtos = allRows.map((r) => toProductDto(r as unknown as ProductRow, orgDefault));
        const filtered = allDtos.filter((dto) => dto.stockStatus === status);
        const total = filtered.length;
        const totalPages = Math.ceil(total / limit) || 1;
        const start = (page - 1) * limit;
        const products = filtered.slice(start, start + limit);

        return { products, meta: { page, limit, total, totalPages } };
      }

      // ===== No status filter: use Prisma pagination directly =====

      const [rows, total] = await Promise.all([
        prisma.product.findMany({
          where: where as Parameters<typeof prisma.product.findMany>[0] extends { where?: infer W }
            ? W
            : never,
          select: productSelect,
          // WHY whitelisted sort: the sort field comes from a validated enum in the schema,
          // so it can never be arbitrary user input. Never interpolate sort from input directly.
          orderBy: { [sort]: order },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.product.count({
          where: where as Parameters<typeof prisma.product.count>[0] extends { where?: infer W }
            ? W
            : never,
        }),
      ]);

      const products = rows.map((r) => toProductDto(r as unknown as ProductRow, orgDefault));
      const totalPages = Math.ceil(total / limit) || 1;

      return { products, meta: { page, limit, total, totalPages } };
    },

    /**
     * Partially updates a product. At least one field is required (enforced by the schema).
     * @param id Product id.
     * @param input Validated partial fields.
     * @param organizationId From req.auth.
     * @param userId From req.auth (set as updatedById).
     * @returns The updated ProductDto.
     * @throws AppError NOT_FOUND if the product does not exist in this org.
     * @throws P2002 (-> DUPLICATE_SKU) if the new SKU collides with an existing one.
     */
    async update(
      id: string,
      input: UpdateProductInput,
      organizationId: string,
      userId: string,
    ): Promise<ProductDto> {
      // TENANT SCOPE: updateMany with { id, organizationId } so another tenant's product is not touched.
      // WHY updateMany: Prisma's update() does not support compound where on non-unique fields.
      // We check the count to distinguish "not found" from "nothing changed".
      const data: Record<string, unknown> = { updatedById: userId };

      if (input.name !== undefined) data.name = input.name;
      if (input.sku !== undefined) data.sku = input.sku;
      if (input.description !== undefined) data.description = input.description ?? null;
      if (input.quantityOnHand !== undefined) data.quantityOnHand = input.quantityOnHand;
      if (input.costPrice !== undefined) data.costPrice = input.costPrice ?? null;
      if (input.sellingPrice !== undefined) data.sellingPrice = input.sellingPrice ?? null;
      // EDGE CASE: sending lowStockThreshold: null clears the override (falls back to org default).
      // The `undefined` check ensures we only set it when the key was actually sent in the body.
      if ('lowStockThreshold' in input) data.lowStockThreshold = input.lowStockThreshold ?? null;

      const result = await prisma.product.updateMany({
        where: { id, organizationId }, // TENANT SCOPE
        data,
      });

      if (result.count === 0) {
        throw new AppError('NOT_FOUND', 'Product not found');
      }

      // Re-fetch the updated product to return the full DTO with computed fields.
      return this.getById(id, organizationId);
    },

    /**
     * Hard-deletes a product.
     * @returns The deleted product's id.
     * @throws AppError NOT_FOUND if the product does not exist in this org.
     */
    async delete(id: string, organizationId: string): Promise<{ id: string }> {
      // TENANT SCOPE: deleteMany with { id, organizationId }.
      const result = await prisma.product.deleteMany({
        where: { id, organizationId },
      });

      if (result.count === 0) {
        throw new AppError('NOT_FOUND', 'Product not found');
      }

      return { id };
    },
  };
}

export type ProductsService = ReturnType<typeof createProductsService>;
