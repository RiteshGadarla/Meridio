/**
 * FILE: backend/prisma.config.ts
 * PURPOSE: Prisma CLI configuration (schema location, migrations folder, migration connection).
 * LAYER: Config
 * USED BY: every `prisma ...` CLI command (migrate, generate, studio)
 * NOTES:
 *  - WHY DIRECT_URL here: Prisma 7 moved connection settings out of schema.prisma. The CLI uses the
 *    Neon DIRECT (non-pooled) connection because migrations need session-level features that the
 *    PgBouncer pooler does not support.
 *  - Runtime queries do NOT use this file; they use the pooled DATABASE_URL via the driver adapter
 *    in src/lib/prisma.ts.
 *  - dotenv/config loads backend/.env. Variables already set in the environment win, which is how
 *    the test setup points migrations at TEST_DATABASE_URL.
 */
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DIRECT_URL') },
});
