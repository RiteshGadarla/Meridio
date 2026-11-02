/**
 * FILE: backend/src/middleware/error-handler.ts
 * PURPOSE: Single place that converts any thrown error into the standard error envelope.
 * LAYER: Middleware (last in the chain)
 * USED BY: app.ts
 * DEPENDS ON: AppError, zod, @meridio/contracts
 * NOTES: SECURITY: unknown errors return a generic 500 message. The real error (with stack) is only
 *        logged server-side with the request id; stack traces, SQL and Prisma details never reach
 *        the client.
 */
import type { ErrorRequestHandler, Response } from 'express';
import { ZodError } from 'zod';
import type { ApiErrorBody, ErrorCode, FieldErrors } from '@meridio/contracts';
import { AppError } from '../utils/app-error.js';

// ===== Mapping helpers =====

/** Flattens a ZodError into { "path.to.field": "first message" }. */
export function zodToFieldErrors(error: ZodError): FieldErrors {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    // First message per field wins: it is the most relevant one to show under the input.
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}

/**
 * Maps a Prisma unique-violation (P2002) to a domain error by looking at which column collided.
 * WHY stringify meta: with Prisma 7 driver adapters the column list lives in different places
 * depending on the adapter, so we search the whole meta object instead of trusting one key.
 * @returns the mapped AppError or undefined when the collision is not one we know
 */
function mapUniqueViolation(error: { code?: unknown; meta?: unknown }): AppError | undefined {
  if (error.code !== 'P2002') return undefined;
  const target = JSON.stringify(error.meta ?? {}).toLowerCase();
  if (target.includes('sku')) {
    return new AppError('DUPLICATE_SKU', 'This SKU already exists in your organization.', {
      sku: 'This SKU already exists in your organization.',
    });
  }
  if (target.includes('email')) {
    return new AppError('EMAIL_TAKEN', 'An account with this email already exists.', {
      email: 'An account with this email already exists.',
    });
  }
  return undefined;
}

function send(
  res: Response,
  status: number,
  code: ErrorCode,
  message: string,
  fieldErrors?: FieldErrors,
) {
  const body: ApiErrorBody = { error: { code, message, ...(fieldErrors && { fieldErrors }) } };
  res.status(status).json(body);
}

// ===== Handler =====

export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof AppError) {
    return send(res, err.status, err.code, err.message, err.fieldErrors);
  }

  if (err instanceof ZodError) {
    return send(res, 400, 'VALIDATION_ERROR', 'Some fields are invalid.', zodToFieldErrors(err));
  }

  const mapped = typeof err === 'object' && err !== null ? mapUniqueViolation(err) : undefined;
  if (mapped) {
    return send(res, mapped.status, mapped.code, mapped.message, mapped.fieldErrors);
  }

  // body-parser errors carry a `type`; they are the client's fault, not ours.
  const type = (err as { type?: string } | null)?.type;
  if (type === 'entity.parse.failed') {
    return send(res, 400, 'VALIDATION_ERROR', 'Request body is not valid JSON.');
  }
  if (type === 'entity.too.large') {
    return send(res, 413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.');
  }

  // EDGE CASE: anything else is a bug or an outage. Log everything, tell the client nothing.
  req.log?.error({ err, requestId: req.id }, 'Unhandled error');
  return send(res, 500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
};
