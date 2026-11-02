/**
 * FILE: backend/test/db.ts
 * PURPOSE: Test-database helpers: safe url resolution, client factory, table reset.
 * LAYER: Test support
 * USED BY: test/global-setup.ts, test/db/*.test.ts
 * NOTES: SECURITY/SAFETY: tests TRUNCATE tables. getTestDatabaseUrl refuses to return a url that
 *        points at the same database as the dev DATABASE_URL / DIRECT_URL.
 */
import { createPrismaClient } from '../src/lib/prisma.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';

/** Host (minus Neon's "-pooler" suffix) + database name, so pooled and direct urls compare equal. */
function dbIdentity(url: string): string {
  const u = new URL(url);
  return `${u.hostname.replace('-pooler', '')}${u.pathname}`;
}

/**
 * Returns TEST_DATABASE_URL after proving it is not the development database.
 * @param env environment to read (injectable for the safety test)
 * @throws if TEST_DATABASE_URL is missing or points at DATABASE_URL / DIRECT_URL's database
 */
export function getTestDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const testUrl = env.TEST_DATABASE_URL;
  if (!testUrl) {
    throw new Error('TEST_DATABASE_URL is not set. Add a separate Neon database to backend/.env.');
  }
  for (const key of ['DATABASE_URL', 'DIRECT_URL'] as const) {
    const other = env[key];
    if (other && (other === testUrl || dbIdentity(other) === dbIdentity(testUrl))) {
      throw new Error(
        `Refusing to run tests: TEST_DATABASE_URL points at the same database as ${key}.`,
      );
    }
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
