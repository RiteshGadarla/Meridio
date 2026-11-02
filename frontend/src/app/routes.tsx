/**
 * FILE: frontend/src/app/routes.tsx
 * PURPOSE: Route table. Public: / (intro page), /login, /signup. Shell: /dashboard, /products, /settings.
 * LAYER: App wiring
 * USED BY: App.tsx, tests (inside a MemoryRouter)
 * NOTES:
 *  - Shell routes sit behind RequireAuth; /login and /signup behind RedirectIfAuthed (Stage 7).
 *  - /design is the living style guide. It is only referenced when import.meta.env.DEV is true;
 *    Vite replaces that with `false` in production builds, so the page is dropped from the bundle.
 */
import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import {
  AuthedShell,
  RedirectIfAuthed,
  RequireAuth,
  SessionWatcher,
} from '../features/auth/guards';
import { DashboardPage } from '../pages/dashboard-page';
import { GoogleOrganizationPage } from '../pages/google-organization-page';
import { LandingPage } from '../pages/landing-page';
import { LoginPage } from '../pages/login-page';
import { NotFoundPage } from '../pages/not-found-page';
import { ProductsPage } from '../pages/products-page';
import { SettingsPage } from '../pages/settings-page';
import { SignupPage } from '../pages/signup-page';

const DesignPage = import.meta.env.DEV ? lazy(() => import('../pages/design-page')) : null;

export function AppRoutes() {
  return (
    <>
      <SessionWatcher />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route element={<RedirectIfAuthed />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/signup/organization" element={<GoogleOrganizationPage />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route element={<AuthedShell />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
        {DesignPage && (
          <Route
            path="/design"
            element={
              <Suspense fallback={null}>
                <DesignPage />
              </Suspense>
            }
          />
        )}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
