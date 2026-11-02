/**
 * FILE: backend/src/app.ts
 * PURPOSE: Builds the Express application. Does NOT call listen().
 * LAYER: Composition root (Route -> Middleware -> Validation -> Controller -> Service -> Prisma)
 * USED BY: server.ts (production/dev), tests (Supertest)
 * DEPENDS ON: express, @meridio/contracts
 * NOTES: WHY no listen(): tests can import createApp() and exercise it without opening a port.
 */
import express, { type Express } from 'express';
import type { ApiSuccess } from '@meridio/contracts';

/**
 * Creates a fresh Express app with all routes mounted under /api/v1.
 * @returns configured Express application
 */
export function createApp(): Express {
  const app = express();

  // ===== Routes =====
  // TODO(stage-2): replace this placeholder with the health module and real middleware stack.
  app.get('/api/v1/ping', (_req, res) => {
    const body: ApiSuccess<{ pong: true }> = { data: { pong: true } };
    res.json(body);
  });

  return app;
}
