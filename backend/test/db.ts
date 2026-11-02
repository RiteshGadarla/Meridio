/**
 * FILE: backend/test/db.ts
 * PURPOSE: Test-database helpers: safe url resolution, client factory, table reset.
 * LAYER: Test support
 * USED BY: test/global-setup.ts, test/db/*.test.ts
 * NOTES: SECURITY/SAFETY: tests TRUNCATE tables. getTestDatabaseUrl refuses to return a url that
 *        points at the same database as the dev DATABASE_URL.
 */
import { databaseIdentity } from '../src/lib/database-url.js';
import { createPrismaClient } from '../src/lib/prisma.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';

/**
 * Returns TEST_DATABASE_URL after proving it is not the development database.
 * @param env environment to read (injectable for the safety test)
 * @throws if TEST_DATABASE_URL is missing or points at DATABASE_URL's database
 */
export function getTestDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const testUrl = env.TEST_DATABASE_URL;
  if (!testUrl) {
    throw new Error('TEST_DATABASE_URL is not set. Add a separate Neon database to backend/.env.');
  }
  const dev = env.DATABASE_URL;
  if (dev && (dev === testUrl || databaseIdentity(dev) === databaseIdentity(testUrl))) {
    throw new Error(
      'Refusing to run tests: TEST_DATABASE_URL points at the same database as DATABASE_URL.',
    );
  }
  return testUrl;
}

/** Creates a PrismaClient bound to the (verified) test database. Caller must $disconnect it. */
export function createTestPrisma(): PrismaClient {
  return createPrismaClient(getTestDatabaseUrl());
}

/** Empties every table so each test starts from a known state. */
export async function resetDb(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Product", "User", "Organization" CASCADE');
}
