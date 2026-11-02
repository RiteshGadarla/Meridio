/**
 * FILE: backend/test/global-setup.ts
 * PURPOSE: Vitest globalSetup: applies all migrations to the TEST database once before the suite.
 * LAYER: Test support
 * NOTES: If TEST_DATABASE_URL is unset this is a no-op so non-DB tests still run; DB tests then fail
 *        with a clear message from getTestDatabaseUrl().
 */
import { execFileSync } from 'node:child_process';
import { getTestDatabaseUrl } from './db.js';

export default function setup(): void {
  if (!process.env.TEST_DATABASE_URL) {
    console.warn('TEST_DATABASE_URL not set: skipping test database migration.');
    return;
  }
  const url = getTestDatabaseUrl();
  // WHY DIRECT_URL override: prisma.config.ts migrates whatever DIRECT_URL points at.
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DIRECT_URL: url },
    stdio: 'ignore',
  });
}
