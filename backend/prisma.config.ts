/**
 * FILE: backend/prisma.config.ts
 * PURPOSE: Prisma CLI configuration (schema location, migrations folder, migration connection).
 * LAYER: Config
 * USED BY: every `prisma ...` CLI command (migrate, generate, studio)
 * NOTES:
 *  - There is ONE database variable, DATABASE_URL. Prisma 7 moved connection settings out of
 *    schema.prisma, and this file gives the CLI the DIRECT (non-pooled) form of that URL, derived by
 *    removing "-pooler" from the Neon host, because migrations need session-level features that the
 *    pooler does not support. The running API uses DATABASE_URL as is (pooled is fine and better).
 *  - dotenv/config loads backend/.env. Variables already set in the environment win, which is how
 *    the test setup points migrations at TEST_DATABASE_URL.
 */
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';
import { toDirectUrl } from './src/lib/database-url.js';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: toDirectUrl(env('DATABASE_URL')) },
});
