/**
 * FILE: frontend/src/features/products/product-form-values.test.ts
 * PURPOSE: Unit tests for form <-> payload conversion and the PATCH diff.
 */
import { createProductSchema } from '@meridio/contracts';
import { describe, expect, it } from 'vitest';
import { makeProduct } from '../../test/fake-products-api';
import { EMPTY_FORM, diffForUpdate, formToPayload } from './product-form-values';

const validate = (over: Partial<typeof EMPTY_FORM>) =>
  createProductSchema.parse(formToPayload({ ...EMPTY_FORM, name: 'Widget', sku: 'w-1', ...over }));

// Protects: empty optional inputs become null (not 0 or ""), and rules come from the shared schema.
describe('formToPayload', () => {
  it('maps empty optional fields to null and normalises through the shared schema', () => {
    expect(validate({})).toMatchObject({
      sku: 'W-1',
      quantityOnHand: 0,
      description: null,
      costPrice: null,
      sellingPrice: null,
      lowStockThreshold: null,
    });
  });
  it('keeps explicit zeros distinct from empty', () => {
    expect(validate({ lowStockThreshold: '0', sellingPrice: '0' })).toMatchObject({
      lowStockThreshold: 0,
      sellingPrice: 0,
    });
  });
});

// Protects: PATCH carries only what changed, and clearing a threshold sends null.
describe('diffForUpdate', () => {
  const original = makeProduct(1, {
    costPrice: '45.00',
    sellingPrice: '89.99',
    lowStockThreshold: 3,
  });
  const base = {
    name: original.name,
    sku: original.sku,
    quantityOnHand: 10,
    costPrice: 45,
    sellingPrice: 89.99,
    lowStockThreshold: 3,
    description: null,
  };

  it('is empty when nothing changed (45.00 equals 45)', () => {
    expect(diffForUpdate(original, base)).toEqual({});
  });
  it('includes only changed fields', () => {
    expect(diffForUpdate(original, { ...base, name: 'New', quantityOnHand: 4 })).toEqual({
      name: 'New',
      quantityOnHand: 4,
    });
  });
  it('sends null when the threshold or a price is cleared', () => {
    expect(diffForUpdate(original, { ...base, lowStockThreshold: null, costPrice: null })).toEqual({
      lowStockThreshold: null,
      costPrice: null,
    });
  });
});
