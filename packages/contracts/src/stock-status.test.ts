/**
 * FILE: packages/contracts/src/stock-status.test.ts
 * PURPOSE: Tests the shared stock-status rule where it now lives (the backend re-exports it and keeps
 *          its own table, so the rule is verified from both sides).
 */
import { describe, expect, it } from 'vitest';
import { getEffectiveThreshold, getStockStatus } from './stock-status.js';

// Protects: ?? (not ||) semantics and the <= boundary, which the form preview and server share.
describe('shared stock status', () => {
  it.each([
    [0, null, 5, 'OUT_OF_STOCK'],
    [0, 0, 5, 'OUT_OF_STOCK'],
    [3, 5, 10, 'LOW_STOCK'],
    [5, 5, 10, 'LOW_STOCK'],
    [6, 5, 10, 'HEALTHY'],
    [8, null, 10, 'LOW_STOCK'],
    [8, 0, 10, 'HEALTHY'],
    [8, undefined, 10, 'LOW_STOCK'],
  ] as const)('qty %i, own %s, default %i -> %s', (qty, own, orgDefault, expected) => {
    expect(getStockStatus(qty, getEffectiveThreshold(own, orgDefault))).toBe(expected);
  });

  it('an explicit 0 threshold is honoured, not treated as unset', () => {
    expect(getEffectiveThreshold(0, 10)).toBe(0);
    expect(getEffectiveThreshold(null, 10)).toBe(10);
  });
});
