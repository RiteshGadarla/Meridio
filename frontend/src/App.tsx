/**
 * FILE: frontend/src/App.tsx
 * PURPOSE: Root component: providers + browser router + error boundary + route table.
 * LAYER: UI
 * USED BY: main.tsx
 * DEPENDS ON: app/providers.tsx, app/routes.tsx
 */
import { BrowserRouter, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './components/error-boundary';
import { Providers } from './app/providers';
import { AppRoutes } from './app/routes';

/** Boundary keyed by URL so leaving a crashed page clears the error. */
function RoutedErrorBoundary({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>;
}

export function App() {
  return (
    <Providers>
      <BrowserRouter>
        <RoutedErrorBoundary>
          <AppRoutes />
        </RoutedErrorBoundary>
      </BrowserRouter>
    </Providers>
  );
}
