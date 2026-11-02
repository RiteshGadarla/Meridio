/**
 * FILE: packages/contracts/vitest.config.ts
 * PURPOSE: Vitest config for the shared contracts package, with coverage gates.
 * NOTES: Coverage only runs with `npm run test:coverage`. The business-rule file (stock-status) must
 *        stay at 90%+ because the server and the form preview both depend on it.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 85,
        'src/stock-status.ts': { lines: 90, statements: 90, functions: 90, branches: 90 },
      },
    },
  },
});
