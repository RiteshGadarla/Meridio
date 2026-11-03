/**
 * FILE: frontend/src/features/activity/api.ts
 * PURPOSE: Typed call to GET /activity (paged, filterable).
 * LAYER: Feature API
 * USED BY: features/activity/hooks.ts
 */
import type { ActivityAction, ActivityDto, PaginationMeta } from '@meridio/contracts';
import { request } from '../../lib/api-client';

export interface ActivityParams {
  page: number;
  limit: number;
  action?: ActivityAction;
  search?: string;
}

export interface ActivityPage {
  entries: ActivityDto[];
  meta: PaginationMeta;
}

export async function fetchActivity(params: ActivityParams): Promise<ActivityPage> {
  const { data, meta } = await request<ActivityDto[]>('/activity', { query: { ...params } });
  return { entries: data, meta: meta as unknown as PaginationMeta };
}
