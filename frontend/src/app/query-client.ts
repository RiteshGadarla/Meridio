/**
 * FILE: frontend/src/app/query-client.ts
 * PURPOSE: TanStack Query client with the project's defaults.
 * LAYER: App wiring
 * USED BY: app/providers.tsx, tests
 */
import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../lib/api-client';

/** Retry once for transient failures, never for 401/404 (retrying cannot change the answer). */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && (error.status === 401 || error.status === 404)) return false;
  return failureCount < 1;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      // 30s: lists feel instant when navigating back, yet data is never long-stale.
      queries: { staleTime: 30_000, retry: shouldRetry, refetchOnWindowFocus: false },
    },
  });
}
