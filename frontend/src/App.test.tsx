/**
 * FILE: frontend/src/App.test.tsx
 * PURPOSE: Routing smoke tests: redirect, shell routes (signed in), public routes, 404, /design.
 * LAYER: Test
 */
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { mockSession, renderApp, USER } from './test/render';

// Protects: the router skeleton works for a signed-in user and the shared package is importable.
describe('<AppRoutes /> (signed in)', () => {
  beforeEach(() => mockSession(USER));

  it('redirects / to the dashboard inside the shell, showing the real organization and email', async () => {
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Inventory overview' })).toBeInTheDocument();
    expect(screen.getAllByText('StockFlow').length).toBeGreaterThan(0);
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('me@acme.test')).toBeInTheDocument();
  });

  it.each([
    ['/products', 'Products'],
    ['/settings', 'Settings'],
    ['/nope', 'Page not found'],
  ])('renders %s', async (path, heading) => {
    renderApp(path);
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
  });

  it('serves the dev-only style guide at /design in development', async () => {
    renderApp('/design');
    expect(
      await screen.findByRole('heading', { name: 'StockFlow style guide' }),
    ).toBeInTheDocument();
  });
});
