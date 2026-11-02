/**
 * FILE: backend/src/lib/prisma.ts
 * PURPOSE: The single shared PrismaClient for the API, plus a factory for scripts and tests.
 * LAYER: Library (used by Services only; never by controllers)
 * USED BY: services (later stages), prisma/seed.ts
 * DEPENDS ON: generated Prisma client, @prisma/adapter-pg
 * NOTES:
 *  - Prisma 7 needs a driver adapter. Runtime uses the Neon POOLED url (DATABASE_URL).
 *  - WHY a globalThis cache: `tsx watch` re-evaluates modules on every change; without the cache
 *    each reload would open a new connection pool and eventually exhaust Neon's connections.
 *  - TODO(stage-2): read the url from the validated config/env.ts instead of process.env.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * Creates a PrismaClient connected to the given Postgres url through the pg driver adapter.
 * @param connectionString Postgres connection string (pooled for runtime)
 * @returns a new PrismaClient (caller owns the lifecycle and must $disconnect it)
 */
export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

const globalForPrisma = globalThis as unknown as { __stockflowPrisma?: PrismaClient };

function createFromEnv(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set. Copy backend/.env.example to backend/.env.');
  return createPrismaClient(url);
}

/** Shared client instance for the running process. */
export const prisma: PrismaClient = (globalForPrisma.__stockflowPrisma ??= createFromEnv());
