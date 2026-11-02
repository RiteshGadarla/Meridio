/**
 * FILE: backend/src/middleware/validate.ts
 * PURPOSE: Reusable Zod validation for body, query or params; stores the parsed result on the request.
 * LAYER: Middleware (Validation step: Route -> Middleware -> Validation -> Controller)
 * USED BY: route files in later stages
 * DEPENDS ON: zod
 * NOTES: A ZodError is thrown to next() and rendered as VALIDATION_ERROR by the error handler.
 */
import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

export type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Validates one part of the request and REPLACES it with the parsed value, so controllers receive
 * normalised data (trimmed, uppercased, defaults applied) and never the raw input.
 * @example router.post('/', validate(createProductSchema, 'body'), controller.create)
 */
export function validate(schema: ZodType, target: ValidationTarget): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) return next(result.error);
    // WHY defineProperty: Express 5 makes req.query a read-only getter, so plain assignment fails.
    Object.defineProperty(req, target, {
      value: result.data,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    next();
  };
}
