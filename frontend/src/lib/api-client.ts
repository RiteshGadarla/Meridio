/**
 * FILE: frontend/src/lib/api-client.ts
 * PURPOSE: The only place the SPA talks HTTP. Unwraps the { data } envelope, converts error
 *          envelopes into ApiError, and exposes a hook for global 401 handling.
 * LAYER: Library
 * USED BY: TanStack Query hooks in later stages
 * DEPENDS ON: @meridio/contracts (ErrorCode, FieldErrors)
 * NOTES:
 *  - Only relative /api/v1 URLs. No deployment URL is ever hardcoded: in dev Vite proxies /api, in
 *    production the host rewrites /api to the API, so the session cookie stays first-party.
 *  - SECURITY: credentials 'same-origin' sends the HttpOnly cookie; this code never sees the token.
 */
import type { ErrorCode, FieldErrors } from '@meridio/contracts';
import { trackRequest } from './slow-requests';

const BASE_PATH = '/api/v1';

// ===== Errors =====

/** Thrown for every non-2xx response. `code` is an API ErrorCode, or a client-side fallback. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK_ERROR' | 'UNKNOWN_ERROR',
    message: string,
    readonly fieldErrors?: FieldErrors,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ===== 401 hook =====

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | undefined;

/** Registers the function called on any 401 (for example: clear the session and go to /login). */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | undefined): void {
  onUnauthorized = handler;
}

// ===== Requests =====

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  /** Skip the global 401 hook. Use for login, where 401 means "wrong password", not "expired". */
  skipUnauthorizedHandler?: boolean;
}

export interface ApiResult<T> {
  data: T;
  meta?: Record<string, unknown>;
}

function buildUrl(path: string, query: RequestOptions['query']): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return `${BASE_PATH}${path}${qs ? `?${qs}` : ''}`;
}

/** Parses a body as JSON, returning undefined when it is empty or not JSON. */
async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    // EDGE CASE: proxies and crashes can return HTML or an empty body; never throw a parse error.
    return undefined;
  }
}

/** The actual fetch + envelope handling. Wrapped by request() for slow-request tracking. */
async function perform<T>(path: string, options: RequestOptions): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      credentials: 'same-origin',
      headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection.');
  }
  const json = (await readJson(response)) as
    | {
        data?: T;
        meta?: Record<string, unknown>;
        error?: { code?: ErrorCode; message?: string; fieldErrors?: FieldErrors };
      }
    | undefined;

  if (!response.ok) {
    if (response.status === 401 && !options.skipUnauthorizedHandler) onUnauthorized?.();
    throw new ApiError(
      response.status,
      json?.error?.code ?? 'UNKNOWN_ERROR',
      json?.error?.message ?? 'Something went wrong. Please try again.',
      json?.error?.fieldErrors,
    );
  }
  return { data: json?.data as T, meta: json?.meta };
}

/**
 * Performs a request and returns the unwrapped envelope.
 * @throws ApiError on network failure or any non-2xx response
 * @example const { data, meta } = await request<ProductDto[]>('/products', { query: { page: 2 } });
 */
export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  // After 5s the UI shows a "waking up the server" notice (free-tier cold start); cleared on settle.
  const settled = trackRequest();
  try {
    return await perform<T>(path, options);
  } finally {
    settled();
  }
}

/** Convenience wrappers that return only `data`. */
export const api = {
  get: async <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    (await request<T>(path, { ...options, method: 'GET' })).data,
  post: async <T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>,
  ) => (await request<T>(path, { ...options, method: 'POST', body })).data,
  patch: async <T>(
    path: string,
    body: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>,
  ) => (await request<T>(path, { ...options, method: 'PATCH', body })).data,
  delete: async <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    (await request<T>(path, { ...options, method: 'DELETE' })).data,
};
