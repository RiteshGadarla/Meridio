/**
 * FILE: frontend/src/features/dashboard/api.ts
 * PURPOSE: Typed call to GET /dashboard/overview.
 * LAYER: Feature API
 * USED BY: features/dashboard/hooks.ts
 */
import type { DashboardOverviewDto } from '@meridio/contracts';
import { api } from '../../lib/api-client';

export const fetchDashboardOverview = () => api.get<DashboardOverviewDto>('/dashboard/overview');
