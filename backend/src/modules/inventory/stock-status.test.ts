/**
 * FILE: backend/src/modules/inventory/stock-status.test.ts
 * PURPOSE: Table-driven tests for the pure stock-status functions. Covers every boundary from
 *          the Stage 4 plan, including the critical ?? vs || edge case.
 * LAYER: Unit test
 * DEPENDS ON: ./stock-status.ts
 */
import { describe, expect, it } from 'vitest';
import { getEffectiveThreshold, getStockStatus } from './stock-status.js';

// Protects: the effective threshold falls back to the org default only when the product threshold
// is null/undefined, NOT when it is 0. This is the ?? vs || distinction.
describe('getEffectiveThreshold', () => {
  it.each([
    { productThreshold: null, orgDefault: 5, expected: 5, label: 'null falls back to org default' },
    {
      productThreshold: undefined,
      orgDefault: 5,
      expected: 5,
      label: 'undefined falls back to org default',
    },
    { productThreshold: 5, orgDefault: 10, expected: 5, label: 'product override wins' },
    {
      productThreshold: 0,
      orgDefault: 10,
      expected: 0,
      label: 'explicit 0 overrides (tests ?? not ||)',
    },
    { productThreshold: 3, orgDefault: 3, expected: 3, label: 'equal values still use product' },
  ])(
    '$label: ($productThreshold, $orgDefault) => $expected',
    ({ productThreshold, orgDefault, expected }) => {
      expect(getEffectiveThreshold(productThreshold, orgDefault)).toBe(expected);
    },
  );
});

// Protects: the status boundaries from the plan table.
// qty | product threshold | org default | effective | status
// 0   | null              | 5           | 5         | OUT_OF_STOCK
// 0   | 0                 | 5           | 0         | OUT_OF_STOCK
// 3   | 5                 | 10          | 5         | LOW_STOCK
// 5   | 5                 | 10          | 5         | LOW_STOCK (boundary, <=)
// 6   | 5                 | 10          | 5         | HEALTHY
// 8   | null              | 10          | 10        | LOW_STOCK (uses org default)
// 8   | 0                 | 10          | 0         | HEALTHY (explicit 0 overrides, tests ?? not ||)
describe('getStockStatus', () => {
  it.each([
    {
      qty: 0,
      effective: 5,
      expected: 'OUT_OF_STOCK',
      label: 'zero quantity is always out of stock',
    },
    {
      qty: 0,
      effective: 0,
      expected: 'OUT_OF_STOCK',
      label: 'zero quantity even with threshold 0',
    },
    { qty: 3, effective: 5, expected: 'LOW_STOCK', label: 'below threshold is low stock' },
    {
      qty: 5,
      effective: 5,
      expected: 'LOW_STOCK',
      label: 'boundary: exactly at threshold is low stock (<=)',
    },
    { qty: 6, effective: 5, expected: 'HEALTHY', label: 'above threshold is healthy' },
    { qty: 8, effective: 10, expected: 'LOW_STOCK', label: 'below org-default threshold' },
    { qty: 8, effective: 0, expected: 'HEALTHY', label: 'threshold 0 means never low stock' },
    {
      qty: 1,
      effective: 0,
      expected: 'HEALTHY',
      label: 'any positive qty with threshold 0 is healthy',
    },
  ])('$label: ($qty, $effective) => $expected', ({ qty, effective, expected }) => {
    expect(getStockStatus(qty, effective)).toBe(expected);
  });
});

// Protects: full integration of the two functions matches the plan table.
describe('plan table (end-to-end through both functions)', () => {
  const cases = [
    {
      qty: 0,
      productThreshold: null,
      orgDefault: 5,
      expectedEffective: 5,
      expectedStatus: 'OUT_OF_STOCK',
    },
    {
      qty: 0,
      productThreshold: 0,
      orgDefault: 5,
      expectedEffective: 0,
      expectedStatus: 'OUT_OF_STOCK',
    },
    {
      qty: 3,
      productThreshold: 5,
      orgDefault: 10,
      expectedEffective: 5,
      expectedStatus: 'LOW_STOCK',
    },
    {
      qty: 5,
      productThreshold: 5,
      orgDefault: 10,
      expectedEffective: 5,
      expectedStatus: 'LOW_STOCK',
    },
    {
      qty: 6,
      productThreshold: 5,
      orgDefault: 10,
      expectedEffective: 5,
      expectedStatus: 'HEALTHY',
    },
    {
      qty: 8,
      productThreshold: null,
      orgDefault: 10,
      expectedEffective: 10,
      expectedStatus: 'LOW_STOCK',
    },
    {
      qty: 8,
      productThreshold: 0,
      orgDefault: 10,
      expectedEffective: 0,
      expectedStatus: 'HEALTHY',
    },
  ] as const;

  it.each(cases)(
    'qty=$qty, productThreshold=$productThreshold, orgDefault=$orgDefault => $expectedStatus (effective=$expectedEffective)',
    ({ qty, productThreshold, orgDefault, expectedEffective, expectedStatus }) => {
      const effective = getEffectiveThreshold(productThreshold, orgDefault);
      expect(effective).toBe(expectedEffective);
      expect(getStockStatus(qty, effective)).toBe(expectedStatus);
    },
  );
});
