/**
 * FILE: backend/src/server.ts
 * PURPOSE: Process entry point. Validates config, starts listening, shuts down gracefully.
 * LAYER: Entry
 * USED BY: `npm run dev` (tsx) and `npm start` (node dist/server.js)
 * DEPENDS ON: app.ts, config/env.ts, lib/prisma.ts
 * NOTES: Binds 0.0.0.0 because hosts like Render inject PORT and route traffic from outside the
 *        container; binding localhost would make the service unreachable.
 */
import { loadEnv } from './config/env.js';

// Fail fast: a bad config should stop the process before it accepts any traffic.
let env;
try {
  env = loadEnv();
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

// WHY dynamic imports: lib/prisma.ts reads DATABASE_URL when it is first imported. Importing it only
// after loadEnv() succeeds means a bad config always shows the readable message above, never a
// lower-level crash.
const { createApp } = await import('./app.js');
const { prisma } = await import('./lib/prisma.js');

const app = createApp({ env });
const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`StockFlow API listening on port ${env.PORT} (${env.NODE_ENV})`);
});

// ===== Graceful shutdown =====

let shuttingDown = false;

/** Stops accepting connections, lets in-flight requests finish, then closes the database pool. */
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    prisma
      .$disconnect()
      .catch((error: unknown) => console.error('Error closing database connection', error))
      .finally(() => process.exit(0));
  });
  // EDGE CASE: keep-alive connections can hold close() open forever; force exit after 10s.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
