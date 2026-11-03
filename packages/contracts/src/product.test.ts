/**
 * FILE: packages/contracts/src/product.test.ts
 * PURPOSE: Validation unit tests for product schemas. Covers negative/float/overflow quantities,
 *          bad prices, SKU normalisation, and empty PATCH body rejection.
 * LAYER: Unit test
 * DEPENDS ON: ./product.ts
 */
import { describe, expect, it } from 'vitest';
import {
  adjustStockSchema,
  createProductSchema,
  updateProductSchema,
  listProductsQuerySchema,
} from './product.js';

// Protects: a valid product passes all constraints.
describe('createProductSchema', () => {
  const valid = {
    name: 'Widget',
    sku: 'WDG-001',
    quantityOnHand: 100,
    sellingPrice: 19.99,
  };

  it('accepts a valid product', () => {
    const result = createProductSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('defaults quantityOnHand to 0 when omitted', () => {
    const result = createProductSchema.safeParse({ name: 'Test', sku: 'T-1' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.quantityOnHand).toBe(0);
  });

  // Protects: SKU is trimmed and uppercased.
  it('normalises SKU to uppercase', () => {
    const result = createProductSchema.safeParse({ ...valid, sku: ' key-001 ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.sku).toBe('KEY-001');
  });

  // Protects: name is trimmed.
  it('trims name', () => {
    const result = createProductSchema.safeParse({ ...valid, name: '  Widget  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe('Widget');
  });

  // ===== Quantity validation =====

  it('rejects negative quantity', () => {
    const result = createProductSchema.safeParse({ ...valid, quantityOnHand: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects float quantity (1.5)', () => {
    const result = createProductSchema.safeParse({ ...valid, quantityOnHand: 1.5 });
    expect(result.success).toBe(false);
  });

  it('rejects quantity over max (1,000,001)', () => {
    const result = createProductSchema.safeParse({ ...valid, quantityOnHand: 1_000_001 });
    expect(result.success).toBe(false);
  });

  // ===== Price validation =====

  it('rejects negative price', () => {
    const result = createProductSchema.safeParse({ ...valid, sellingPrice: -0.01 });
    expect(result.success).toBe(false);
  });

  it('rejects 3-decimal price', () => {
    const result = createProductSchema.safeParse({ ...valid, sellingPrice: 1.999 });
    expect(result.success).toBe(false);
  });

  it('accepts price as a string ("19.99")', () => {
    const result = createProductSchema.safeParse({ ...valid, sellingPrice: '19.99' });
    expect(result.success).toBe(true);
  });

  it('accepts null price', () => {
    const result = createProductSchema.safeParse({ ...valid, sellingPrice: null });
    expect(result.success).toBe(true);
  });

  it('accepts price at max boundary (9999999.99)', () => {
    const result = createProductSchema.safeParse({ ...valid, sellingPrice: 9_999_999.99 });
    expect(result.success).toBe(true);
  });

  it('rejects price above max (10000000)', () => {
    const result = createProductSchema.safeParse({ ...valid, sellingPrice: 10_000_000 });
    expect(result.success).toBe(false);
  });

  // ===== SKU validation =====

  it('rejects SKU with special characters ($)', () => {
    const result = createProductSchema.safeParse({ ...valid, sku: 'BAD$SKU' });
    expect(result.success).toBe(false);
  });

  it('rejects SKU starting with a dash', () => {
    const result = createProductSchema.safeParse({ ...valid, sku: '-START' });
    expect(result.success).toBe(false);
  });

  it('rejects empty SKU', () => {
    const result = createProductSchema.safeParse({ ...valid, sku: '' });
    expect(result.success).toBe(false);
  });

  it('rejects whitespace-only SKU', () => {
    const result = createProductSchema.safeParse({ ...valid, sku: '   ' });
    expect(result.success).toBe(false);
  });

  it('accepts SKU with dots, dashes, slashes, underscores', () => {
    const result = createProductSchema.safeParse({ ...valid, sku: 'A.B-C/D_E' });
    expect(result.success).toBe(true);
  });

  // ===== Threshold validation =====

  it('accepts null lowStockThreshold', () => {
    const result = createProductSchema.safeParse({ ...valid, lowStockThreshold: null });
    expect(result.success).toBe(true);
  });

  it('rejects negative lowStockThreshold', () => {
    const result = createProductSchema.safeParse({ ...valid, lowStockThreshold: -1 });
    expect(result.success).toBe(false);
  });

  it('accepts lowStockThreshold of 0', () => {
    const result = createProductSchema.safeParse({ ...valid, lowStockThreshold: 0 });
    expect(result.success).toBe(true);
  });
});

// Protects: empty PATCH body is rejected. Partial fields pass through.
describe('updateProductSchema', () => {
  it('accepts a partial update with one field', () => {
    const result = updateProductSchema.safeParse({ name: 'Updated' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty body', () => {
    const result = updateProductSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('accepts lowStockThreshold: null (clears override)', () => {
    const result = updateProductSchema.safeParse({ lowStockThreshold: null });
    expect(result.success).toBe(true);
  });
});

// Protects: list query defaults and constraints.
describe('listProductsQuerySchema', () => {
  it('applies defaults for an empty query', () => {
    const result = listProductsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
      expect(result.data.sort).toBe('createdAt');
      expect(result.data.order).toBe('desc');
    }
  });

  it('rejects invalid sort field', () => {
    const result = listProductsQuerySchema.safeParse({ sort: 'malicious' });
    expect(result.success).toBe(false);
  });

  it('coerces string page and limit', () => {
    const result = listProductsQuerySchema.safeParse({ page: '2', limit: '50' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.limit).toBe(50);
    }
  });

  it('rejects limit over 100', () => {
    const result = listProductsQuerySchema.safeParse({ limit: 101 });
    expect(result.success).toBe(false);
  });

  it('accepts valid status filter', () => {
    const result = listProductsQuerySchema.safeParse({ status: 'LOW_STOCK' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid status filter', () => {
    const result = listProductsQuerySchema.safeParse({ status: 'UNKNOWN' });
    expect(result.success).toBe(false);
  });
});

// Protects: the stock-adjust body only accepts a non-zero whole-number change within bounds.
describe('adjustStockSchema', () => {
  it('accepts positive and negative whole numbers and trims the note', () => {
    expect(adjustStockSchema.parse({ delta: 5 })).toEqual({ delta: 5 });
    expect(adjustStockSchema.parse({ delta: -2, note: '  Damaged  ' })).toEqual({
      delta: -2,
      note: 'Damaged',
    });
  });

  it.each([[0], [1.5], ['3'], [null], [1_000_001], [-1_000_001]])('rejects delta %s', (delta) => {
    expect(adjustStockSchema.safeParse({ delta }).success).toBe(false);
  });

  it('rejects a missing delta and a note over 200 characters', () => {
    expect(adjustStockSchema.safeParse({}).success).toBe(false);
    expect(adjustStockSchema.safeParse({ delta: 1, note: 'x'.repeat(201) }).success).toBe(false);
  });
});
