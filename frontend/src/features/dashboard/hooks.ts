/**
 * FILE: frontend/src/features/dashboard/hooks.ts
 * PURPOSE: useDashboardOverview query and the shared cache-invalidation helper.
 * LAYER: Feature hooks
 * USED BY: pages/dashboard-page.tsx; product and settings mutations (Stages 9 and 10)
 * NOTES: CONTRACT: every mutation that changes products or the org threshold MUST call
 *        invalidateInventoryQueries, or the dashboard shows stale numbers.
 */
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { fetchDashboardOverview } from './api';

/** Delay before the sidebar feed refetches, to let the background log write land. */
export const ACTIVITY_REFRESH_MS = 1000;

export const DASHBOARD_KEY = ['dashboard', 'overview'] as const;

export function useDashboardOverview() {
  return useQuery({ queryKey: DASHBOARD_KEY, queryFn: fetchDashboardOverview });
}

/**
 * Marks all dashboard and product queries stale so they refetch.
 * WHY prefixes: ['dashboard'] and ['products'] match every key beneath them (lists, details).
 */
export function invalidateInventoryQueries(queryClient: QueryClient): Promise<unknown> {
  // WHY delayed and not awaited: the server writes the activity entry in the background after it
  // replies, so refetching instantly would usually miss it. The mutation itself never waits on this.
  setTimeout(
    () => void queryClient.invalidateQueries({ queryKey: ['activity'] }),
    ACTIVITY_REFRESH_MS,
  );
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['products'] }),
  ]);
}
