/**
 * FILE: backend/src/utils/async-handler.ts
 * PURPOSE: Wraps async route handlers so rejected promises reach the error handler.
 * LAYER: Utility
 * USED BY: controllers / routes
 * NOTES: WHY: Express 5 already forwards rejected promises, but this keeps handler typing in one
 *        place and works the same if the framework version ever changes.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Wraps an async handler; any thrown error or rejection is passed to next(). */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
