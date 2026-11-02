/**
 * FILE: backend/vitest.config.ts
 * PURPOSE: Vitest configuration for the API test suite.
 * LAYER: Config
 * NOTES: Node environment (no DOM). Tests live in src/ and test/ as *.test.ts.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
  },
});
