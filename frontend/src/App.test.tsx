/**
 * FILE: frontend/src/App.test.tsx
 * PURPOSE: Routing smoke tests: redirect, shell routes, public routes, 404.
 * LAYER: Test
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Providers } from './app/providers';
import { AppRoutes } from './app/routes';

function renderAt(path: string) {
  return render(
    <Providers>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </Providers>,
  );
}

// Protects: the router skeleton works and the shared package is importable (logo uses PRODUCT_NAME).
describe('<AppRoutes />', () => {
  it('redirects / to the dashboard inside the shell', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { name: 'Inventory overview' })).toBeInTheDocument();
    expect(screen.getAllByText('StockFlow').length).toBeGreaterThan(0);
  });

  it.each([
    ['/products', 'Products'],
    ['/settings', 'Settings'],
    ['/login', 'Log in'],
    ['/signup', 'Create your account'],
    ['/nope', 'Page not found'],
  ])('renders %s', (path, heading) => {
    renderAt(path);
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
  });

  it('serves the dev-only style guide at /design in development', async () => {
    renderAt('/design');
    expect(
      await screen.findByRole('heading', { name: 'StockFlow style guide' }),
    ).toBeInTheDocument();
  });
});
