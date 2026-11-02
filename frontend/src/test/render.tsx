/**
 * FILE: frontend/src/test/render.tsx
 * PURPOSE: Test helpers: render the real routes with a fresh QueryClient, and mock the session API.
 * LAYER: Test support
 */
import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { AuthUser } from '@meridio/contracts';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { Providers } from '../app/providers';
import { AppRoutes } from '../app/routes';
import { server } from './server';

export const USER: AuthUser = {
  id: 'u1',
  email: 'me@acme.test',
  organization: { id: 'o1', name: 'Acme', defaultLowStockThreshold: 5 },
};

/** Makes GET /auth/me answer with the user (signed in) or 401 (signed out). */
export function mockSession(user: AuthUser | null) {
  server.use(
    http.get('*/api/v1/auth/me', () =>
      user
        ? HttpResponse.json({ data: user })
        : HttpResponse.json(
            { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
            { status: 401 },
          ),
    ),
  );
}

/** Shows the current path so tests can assert where navigation ended up. */
function LocationProbe() {
  const { pathname, search } = useLocation();
  return (
    <>
      <output data-testid="path">{pathname}</output>
      <output data-testid="search">{search}</output>
    </>
  );
}

/** Renders the real app routes at `path`. Returns the QueryClient for cache assertions. */
export function renderApp(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <Providers client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
        <LocationProbe />
      </MemoryRouter>
    </Providers>,
  );
  return { client, ...utils };
}
