/**
 * FILE: backend/src/utils/app-error.ts
 * PURPOSE: The one error type services and middleware throw for expected failures.
 * LAYER: Utility
 * USED BY: services, middleware, error-handler
 * DEPENDS ON: @meridio/contracts (ErrorCode, FieldErrors)
 * NOTES: The error handler turns an AppError into the standard error envelope.
 */
import type { ErrorCode, FieldErrors } from '@meridio/contracts';

/** HTTP status that belongs to each error code, so callers cannot mismatch them. */
const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN_ORIGIN: 403,
  NOT_FOUND: 404,
  DUPLICATE_SKU: 409,
  EMAIL_TAKEN: 409,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

/**
 * An expected, client-facing failure.
 * @example throw new AppError('NOT_FOUND', 'Product not found');
 * @example throw new AppError('DUPLICATE_SKU', 'SKU taken', { sku: 'This SKU already exists.' });
 */
export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly fieldErrors?: FieldErrors,
  ) {
    super(message);
    this.name = 'AppError';
    this.status = STATUS_BY_CODE[code];
  }
}
