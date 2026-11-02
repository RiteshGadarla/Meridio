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

export const DASHBOARD_KEY = ['dashboard', 'overview'] as const;

export function useDashboardOverview() {
  return useQuery({ queryKey: DASHBOARD_KEY, queryFn: fetchDashboardOverview });
}

/**
 * Marks all dashboard and product queries stale so they refetch.
 * WHY prefixes: ['dashboard'] and ['products'] match every key beneath them (lists, details).
 */
export function invalidateInventoryQueries(queryClient: QueryClient): Promise<unknown> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['products'] }),
  ]);
}
