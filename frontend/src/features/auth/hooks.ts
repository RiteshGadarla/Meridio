/**
 * FILE: frontend/src/features/auth/hooks.ts
 * PURPOSE: TanStack Query hooks for the session: useCurrentUser, useLogin, useSignup, useLogout.
 * LAYER: Feature hooks
 * USED BY: guards, auth pages, app shell wiring
 * DEPENDS ON: features/auth/api.ts, @tanstack/react-query
 * NOTES: The current user lives in the query cache under AUTH_KEY. `null` means signed out.
 *        SECURITY: logout clears the WHOLE cache so no private data survives for the next user.
 */
import type { AuthUser, LoginInput, SignupInput } from '@meridio/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentUser, login, logout, signup } from './api';

export const AUTH_KEY = ['auth', 'me'] as const;

/** Session query. retry:false so a signed-out visitor sees the login page immediately. */
export function useCurrentUser() {
  return useQuery({
    queryKey: AUTH_KEY,
    queryFn: fetchCurrentUser,
    retry: false,
    staleTime: 5 * 60_000,
  });
}

/** Login mutation; on success the user goes straight into the cache (no extra /auth/me call). */
export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation<AuthUser, Error, LoginInput>({
    mutationFn: login,
    onSuccess: (user) => queryClient.setQueryData(AUTH_KEY, user),
  });
}

export function useSignup() {
  const queryClient = useQueryClient();
  return useMutation<AuthUser, Error, SignupInput>({
    mutationFn: signup,
    onSuccess: (user) => queryClient.setQueryData(AUTH_KEY, user),
  });
}

/**
 * Logout mutation.
 * EDGE CASE: even if the request fails (offline), the local session is wiped; the cookie then
 * simply expires on its own.
 */
export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      queryClient.clear(); // SECURITY: drop every cached private response
      queryClient.setQueryData(AUTH_KEY, null);
    },
  });
}
