/**
 * FILE: packages/contracts/src/common.ts
 * PURPOSE: API envelope and error-code types shared by backend and frontend.
 * LAYER: Shared contract
 * USED BY: backend error handling, frontend api-client
 * NOTES: One list of error codes, so the two apps can never disagree about them.
 */

/** Every error code the API can return. Mirrors the table in docs/API.md. */
export const ERROR_CODES = [
  'VALIDATION_ERROR', // 400
  'UNAUTHENTICATED', // 401
  'FORBIDDEN_ORIGIN', // 403
  'NOT_FOUND', // 404
  'DUPLICATE_SKU', // 409
  'EMAIL_TAKEN', // 409
  'PAYLOAD_TOO_LARGE', // 413
  'RATE_LIMITED', // 429
  'INTERNAL_ERROR', // 500
  'SERVICE_UNAVAILABLE', // 503 (readiness check only)
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** Per-field validation messages, keyed by dotted field path (for example "sku"). */
export type FieldErrors = Record<string, string>;

/**
 * Success envelope returned by every endpoint.
 * @example { data: { pong: true } }
 */
export interface ApiSuccess<T> {
  data: T;
  meta?: Record<string, unknown>;
}

/**
 * Error envelope returned by every failing endpoint.
 * @example { error: { code: 'VALIDATION_ERROR', message: 'Invalid input', fieldErrors: { sku: 'Required' } } }
 */
export interface ApiErrorBody {
  error: { code: ErrorCode; message: string; fieldErrors?: FieldErrors };
}
