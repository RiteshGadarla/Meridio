/**
 * FILE: frontend/src/features/activity/hooks.ts
 * PURPOSE: TanStack Query hook for activity entries (sidebar feed and the Logs page).
 * LAYER: Feature hooks
 * USED BY: features/activity/activity-feed.tsx, pages/logs-page.tsx
 * NOTES: Key prefix ['activity'] is invalidated by invalidateInventoryQueries, so every product
 *        mutation refreshes the feed without extra wiring. keepPreviousData stops the Logs table
 *        flashing empty while the next page or filter loads.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchActivity, type ActivityParams } from './api';

export function useActivity(params: ActivityParams) {
  return useQuery({
    queryKey: ['activity', params],
    queryFn: () => fetchActivity(params),
    placeholderData: keepPreviousData,
  });
}
