/**
 * FILE: packages/contracts/src/product.ts
 * PURPOSE: Zod schemas and DTO types for product CRUD, listing, search, and pagination.
 * LAYER: Shared contract
 * USED BY: backend products module (validation), frontend product forms (Stage 9)
 * DEPENDS ON: zod
 * NOTES:
 *   - Prices accept both number and string inputs (frontend may send strings for decimal precision).
 *     They are coerced to strings in the DTO so JSON never carries floats for money.
 *   - SKU is trimmed and uppercased so "key-001" and "KEY-001" are the same.
 *   - Stock status and effective threshold are server-computed and included in every ProductDto.
 */
import { z } from 'zod';

// ===== Stock status enum (shared between backend and frontend) =====

/** The three stock statuses the server computes for every product. */
export const STOCK_STATUSES = ['HEALTHY', 'LOW_STOCK', 'OUT_OF_STOCK'] as const;
export type StockStatus = (typeof STOCK_STATUSES)[number];

// ===== Reusable field helpers =====

/**
 * Price field: accepts number OR string, coerces to number for validation, then stored as Decimal.
 * WHY accept string: HTML inputs naturally produce strings, and Prisma Decimal is serialised as a
 * string in JSON. Accepting both prevents surprises.
 * Max 9,999,999.99 with at most 2 decimal places.
 */
const priceField = z
  .union([z.number(), z.string().transform((v) => (v.trim() === '' ? NaN : Number(v)))])
  .pipe(
    z
      .number({ message: 'Must be a valid number' })
      .nonnegative('Must be zero or positive')
      .max(9_999_999.99, 'Must be at most 9,999,999.99')
      .refine(
        // WHY tolerance: 19.99 * 100 is 1998.9999999999998 in floating point, so an exact
        // equality check would wrongly reject valid two-decimal prices.
        (v) => Number.isFinite(v) && Math.abs(v * 100 - Math.round(v * 100)) < 1e-6,
        'Must have at most 2 decimal places',
      ),
  )
  .nullable()
  .optional();

/**
 * SKU pattern: starts with a letter or digit, then letters, digits, dots, dashes, slashes, or underscores.
 * WHY: prevents control characters and whitespace-only SKUs while allowing common industrial formats.
 */
const SKU_PATTERN = /^[A-Z0-9][A-Z0-9._\-/]*$/;

// ===== Create =====

/** Fields shared by create and update (no defaults). */
const productFields = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Product name is required')
    .max(120, 'Product name must be at most 120 characters'),

  sku: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'SKU is required')
    .max(64, 'SKU must be at most 64 characters')
    .regex(
      SKU_PATTERN,
      'SKU must start with a letter or digit and contain only letters, digits, dots, dashes, slashes, or underscores',
    ),

  description: z
    .string()
    .max(2000, 'Description must be at most 2000 characters')
    .nullable()
    .optional(),

  quantityOnHand: z
    .number({ message: 'Quantity must be a number' })
    .int('Quantity must be a whole number')
    .nonnegative('Quantity must be zero or positive')
    .max(1_000_000, 'Quantity must be at most 1,000,000'),

  costPrice: priceField,

  sellingPrice: priceField,

  lowStockThreshold: z
    .number({ message: 'Threshold must be a number' })
    .int('Threshold must be a whole number')
    .nonnegative('Threshold must be zero or positive')
    .nullable()
    .optional(),
});

/** Request body for POST /products (quantity defaults to 0). */
export const createProductSchema = productFields.extend({
  quantityOnHand: productFields.shape.quantityOnHand.default(0),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

// ===== Update (PATCH) =====

/**
 * Request body for PATCH /products/:id.
 * Partial of create, but at least one field is required (empty patches are rejected).
 * EDGE CASE: sending `lowStockThreshold: null` clears the override (falls back to org default).
 */
// WHY built from productFields (not createProductSchema): the create default of quantity 0 would
// otherwise make an empty PATCH body look non-empty and silently reset stock to 0.
export const updateProductSchema = productFields
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field must be provided' });

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// ===== Stock adjustment =====

/** Upper bound for quantity on hand; mirrors the product schema so an adjust can never exceed it. */
export const MAX_QUANTITY = 1_000_000;

/**
 * Request body for PATCH /products/:id/stock: a relative change ("+5", "-2") with an optional note.
 * WHY relative (not absolute): two people adjusting at once never overwrite each other's change.
 * The note is stored only on the activity-feed entry (there is no movement ledger).
 */
export const adjustStockSchema = z.object({
  delta: z
    .number({ message: 'Enter a number of units' })
    .int('Must be a whole number')
    .refine((v) => v !== 0, 'Enter a change other than zero')
    .refine(
      (v) => Math.abs(v) <= MAX_QUANTITY,
      `Must be at most ${MAX_QUANTITY.toLocaleString('en-US')} units`,
    ),
  note: z.string().trim().max(200, 'Note must be at most 200 characters').optional(),
});

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

// ===== List / Search / Pagination =====

/** Columns the list can be sorted by. Whitelisted to prevent SQL injection via dynamic ORDER BY. */
export const PRODUCT_SORT_FIELDS = [
  'createdAt',
  'name',
  'sku',
  'quantityOnHand',
  'sellingPrice',
] as const;

export type ProductSortField = (typeof PRODUCT_SORT_FIELDS)[number];

/** Query params for GET /products. */
export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  sort: z.enum(PRODUCT_SORT_FIELDS).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  status: z.enum(STOCK_STATUSES).optional(),
});

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;

// ===== DTO =====

/**
 * The shape of a product as returned by the API.
 * Server-computed fields: `stockStatus`, `effectiveThreshold`.
 * Prices are strings (Decimal serialisation), never floats.
 */
export interface ProductDto {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  quantityOnHand: number;
  costPrice: string | null;
  sellingPrice: string | null;
  lowStockThreshold: number | null;
  /** Resolved threshold (product override ?? org default). */
  effectiveThreshold: number;
  /** Server-computed stock status. */
  stockStatus: StockStatus;
  updatedById: string | null;
  /** Display name (or email) of whoever last changed the product; null if that user was removed. */
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Pagination metadata returned in the `meta` field of a list response. */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
