/**
 * FILE: packages/contracts/src/index.test.ts
 * PURPOSE: Smoke test that the contracts entry point exports what the apps rely on.
 * LAYER: Test
 */
import { describe, expect, it } from 'vitest';
import { PRODUCT_NAME } from './index.js';

// Protects: the shared package keeps exporting its placeholder constant.
describe('contracts entry point', () => {
  it('exports the product name', () => {
    expect(PRODUCT_NAME).toBe('StockFlow');
  });
});
