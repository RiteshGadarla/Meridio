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
  },
});
