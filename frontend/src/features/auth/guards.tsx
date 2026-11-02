/**
 * FILE: frontend/src/features/auth/guards.tsx
 * PURPOSE: Route guards (RequireAuth, RedirectIfAuthed), the authenticated shell wrapper, and the
 *          global session-expiry watcher.
 * LAYER: Feature UI
 * USED BY: app/routes.tsx
 * DEPENDS ON: features/auth/hooks.ts, layouts/app-shell.tsx, lib/api-client.ts
 * NOTES: While /auth/me is pending a full-page loading state is shown, so a refresh never flashes
 *        the login screen for a signed-in user. These guards are UX only; the API enforces auth.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ErrorState } from '../../components/ui/states';
import { AppShell } from '../../layouts/app-shell';
import { setUnauthorizedHandler } from '../../lib/api-client';
import { AUTH_KEY, useCurrentUser, useLogout } from './hooks';

/** Router state carried to /login so the user returns to where they were going. */
export interface LoginRedirectState {
  from?: string;
  expired?: boolean;
}

function FullPageLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="grid min-h-dvh place-items-center text-sm text-graphite-soft"
    >
      Loading StockFlow…
    </div>
  );
}

/** Renders child routes only for a signed-in user; otherwise redirects to /login. */
export function RequireAuth() {
  const { data: user, isPending, isError, refetch } = useCurrentUser();
  const location = useLocation();

  if (isPending) return <FullPageLoading />;
  if (isError) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <ErrorState
          message="We could not check your session. Check your connection and try again."
          onRetry={() => void refetch()}
        />
      </div>
    );
  }
  if (!user) {
    const state: LoginRedirectState = { from: `${location.pathname}${location.search}` };
    return <Navigate to="/login" replace state={state} />;
  }
  return <Outlet />;
}

/** Keeps signed-in users away from /login and /signup. */
export function RedirectIfAuthed() {
  const { data: user, isPending } = useCurrentUser();
  const state = (useLocation().state ?? {}) as LoginRedirectState;
  if (isPending) return <FullPageLoading />;
  // WHY honour state.from: logging in updates the cache first, which re-renders this guard before
  // the login page's own redirect runs. Without this, the requested deep link would be lost.
  if (user) return <Navigate to={state.from ?? '/dashboard'} replace />;
  return <Outlet />;
}

/** AppShell wired to the real session: organization name, email and logout. */
export function AuthedShell() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();
  return (
    <AppShell
      user={user ? { email: user.email, organizationName: user.organization.name } : undefined}
      onLogout={() =>
        logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) })
      }
    />
  );
}

/**
 * Global 401 handling. If any API call answers 401 while a user is signed in, the session has
 * expired: wipe the cache and go to /login with a notice.
 * EDGE CASE: ignored when nobody is signed in, so the logged-out state cannot cause redirect loops.
 */
export function SessionWatcher() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (!queryClient.getQueryData(AUTH_KEY)) return;
      queryClient.clear();
      queryClient.setQueryData(AUTH_KEY, null);
      const state: LoginRedirectState = { expired: true };
      navigate('/login', { replace: true, state });
    });
    return () => setUnauthorizedHandler(undefined);
  }, [queryClient, navigate]);
  return null;
}
