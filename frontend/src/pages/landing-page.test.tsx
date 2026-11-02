/**
 * FILE: frontend/src/pages/landing-page.test.tsx
 * PURPOSE: Tests the public intro page at "/" for signed-out and signed-in visitors.
 * LAYER: Test (RTL + MSW)
 */
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { mockSession, renderApp, USER } from '../test/render';

// Protects: first-time visitors see the product intro (not a login wall or an empty app shell).
describe('LandingPage at /', () => {
  // Protects: the decorative rings never become part of the accessible content.
  it('keeps the decorative rings out of the accessibility tree', async () => {
    mockSession(null);
    const { container } = renderApp('/');
    await screen.findByRole('heading', { level: 1 });
    const decorative = container.querySelector('.magic-rings')!.closest('[aria-hidden="true"]');
    expect(decorative).not.toBeNull();
  });

  it('introduces StockFlow to a signed-out visitor, with sign-up and log-in actions', async () => {
    mockSession(null);
    renderApp('/');
    expect(
      await screen.findByRole('heading', { level: 1, name: /Know what is on your shelves/ }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('path')).toHaveTextContent('/'); // no redirect to /login
    expect(screen.getAllByRole('link', { name: 'Create your organization' })[0]).toHaveAttribute(
      'href',
      '/signup',
    );
    expect(screen.getAllByRole('link', { name: 'Log in' })[0]).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument(); // no navbar, and not the app shell
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });

  it('explains the stock status rule with all three statuses', async () => {
    mockSession(null);
    renderApp('/');
    const rule = await screen.findByRole('heading', { name: /One definition of stock status/ });
    expect(rule).toBeInTheDocument();
    expect(screen.getAllByText('Out of stock').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Low stock').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Healthy').length).toBeGreaterThan(0);
  });

  // Protects: the illustration is never mistaken for real data.
  it('labels the specimen table as an example', async () => {
    mockSession(null);
    renderApp('/');
    expect(await screen.findByText('Example: what needs attention')).toBeInTheDocument();
    expect(
      screen.getByRole('table', { name: 'Example inventory attention list' }),
    ).toBeInTheDocument();
  });

  it('offers "Open dashboard" instead of sign-up to a signed-in user, without redirecting', async () => {
    mockSession(USER);
    renderApp('/');
    const links = await screen.findAllByRole('link', { name: 'Open dashboard' });
    expect(links[0]).toHaveAttribute('href', '/dashboard');
    expect(
      screen.queryByRole('link', { name: 'Create your organization' }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('path')).toHaveTextContent('/');
  });
});
