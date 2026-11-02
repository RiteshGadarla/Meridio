/**
 * FILE: frontend/src/features/settings/hooks.ts
 * PURPOSE: useSettings query and useUpdateSettings mutation.
 * LAYER: Feature hooks
 * USED BY: pages/settings-page.tsx
 * DEPENDS ON: features/dashboard/hooks.ts (invalidateInventoryQueries), features/auth/hooks.ts
 * NOTES: Changing the default threshold changes the stock status of every product that has no
 *        threshold of its own, so dashboard and product queries are invalidated. The cached current
 *        user is also patched in place so the product form helper text updates immediately.
 */
import type { AuthUser, SettingsDto, UpdateSettingsInput } from '@meridio/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AUTH_KEY } from '../auth/hooks';
import { invalidateInventoryQueries } from '../dashboard/hooks';
import { fetchSettings, patchSettings } from './api';

export const SETTINGS_KEY = ['settings'] as const;

export function useSettings() {
  return useQuery({ queryKey: SETTINGS_KEY, queryFn: fetchSettings });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation<SettingsDto, Error, UpdateSettingsInput>({
    mutationFn: patchSettings,
    onSuccess: (settings) => {
      queryClient.setQueryData(SETTINGS_KEY, settings);
      // Keep the session user's organization in step (product form reads it for its helper text).
      queryClient.setQueryData<AuthUser | null>(AUTH_KEY, (user) =>
        user
          ? {
              ...user,
              organization: {
                ...user.organization,
                defaultLowStockThreshold: settings.defaultLowStockThreshold,
              },
            }
          : user,
      );
      return invalidateInventoryQueries(queryClient);
    },
  });
}
