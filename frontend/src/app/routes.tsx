/**
 * FILE: frontend/src/app/routes.tsx
 * PURPOSE: Route table. Public: /login, /signup. Shell: /dashboard, /products, /settings.
 * LAYER: App wiring
 * USED BY: App.tsx, tests (inside a MemoryRouter)
 * NOTES:
 *  - TODO(stage-7): wrap the shell routes in an auth guard and pass the session user to AppShell.
 *  - /design is the living style guide. It is only referenced when import.meta.env.DEV is true;
 *    Vite replaces that with `false` in production builds, so the page is dropped from the bundle.
 */
import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../layouts/app-shell';
import { DashboardPage } from '../pages/dashboard-page';
import { LoginPage } from '../pages/login-page';
import { NotFoundPage } from '../pages/not-found-page';
import { ProductsPage } from '../pages/products-page';
import { SettingsPage } from '../pages/settings-page';
import { SignupPage } from '../pages/signup-page';

const DesignPage = import.meta.env.DEV ? lazy(() => import('../pages/design-page')) : null;

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route element={<AppShell />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
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
  );
}
