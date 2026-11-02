/**
 * FILE: backend/src/middleware/not-found.ts
 * PURPOSE: Turns "no route matched" into the standard 404 error envelope.
 * LAYER: Middleware (mounted after all routes)
 * USED BY: app.ts
 * NOTES: WHY: without this Express answers with an HTML page, which breaks JSON clients.
 */
import type { RequestHandler } from 'express';
import { AppError } from '../utils/app-error.js';

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new AppError('NOT_FOUND', 'Route not found'));
};
