/**
 * FILE: frontend/src/features/settings/api.ts
 * PURPOSE: Typed calls to GET/PATCH /settings.
 * LAYER: Feature API
 * USED BY: features/settings/hooks.ts
 */
import type { SettingsDto, UpdateSettingsInput } from '@meridio/contracts';
import { api } from '../../lib/api-client';

export const fetchSettings = () => api.get<SettingsDto>('/settings');
export const patchSettings = (input: UpdateSettingsInput) =>
  api.patch<SettingsDto>('/settings', input);
