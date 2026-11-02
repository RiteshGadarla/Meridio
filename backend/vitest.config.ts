/**
 * FILE: backend/vitest.config.ts
 * PURPOSE: Vitest configuration for the backend test suite.
 * LAYER: Config
 * NOTES:
 *  - dotenv/config loads backend/.env so TEST_DATABASE_URL etc. reach the test workers.
 *  - fileParallelism false: DB tests share one test database and TRUNCATE tables, so files must
 *    not run at the same time.
 *  - testTimeout 30s: every query is a network round trip to Neon.
 *  - globalSetup migrates the test database once per run.
 *  - coverage (npm run test:coverage): overall >= 80%, services and stock-status >= 90%.
 */
import 'dotenv/config';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // generated Prisma client, tests, and the process entry point (server.ts only calls listen)
      exclude: ['src/generated/**', 'src/**/*.test.ts', 'src/server.ts'],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 75,
        // Business logic must be tested thoroughly: services and the stock-status entry point.
        'src/modules/**/*.service.ts': { lines: 90, statements: 90, functions: 90, branches: 80 },
        'src/modules/inventory/**': { lines: 90, statements: 90, functions: 90, branches: 90 },
      },
    },
  },
});
