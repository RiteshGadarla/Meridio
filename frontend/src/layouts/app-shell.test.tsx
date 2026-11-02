/**
 * FILE: frontend/src/layouts/app-shell.test.tsx
 * PURPOSE: Tests navigation, active-link marking, identity display and the mobile menu.
 * LAYER: Test
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from './app-shell';

function renderShell(path = '/products', props: Parameters<typeof AppShell>[0] = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShell {...props} />}>
          <Route path="/dashboard" element={<p>dash</p>} />
          <Route path="/products" element={<p>prods</p>} />
          <Route path="/settings" element={<p>sets</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppShell', () => {
  // Protects: users (and screen readers) can tell where they are.
  it('renders the three nav links and marks only the active one with aria-current="page"', () => {
    renderShell('/products');
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(nav.querySelectorAll('a')).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'Products' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
    expect(screen.getByText('prods')).toBeInTheDocument();
  });

  it('shows organization and email when a user is provided, and logs out', async () => {
    const onLogout = vi.fn();
    renderShell('/dashboard', {
      user: { email: 'me@acme.test', organizationName: 'Acme' },
      onLogout,
    });
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('me@acme.test')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('toggles the mobile menu and closes it after choosing a link', async () => {
    renderShell('/dashboard');
    const toggle = screen.getByRole('button', { name: 'Open menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await userEvent.click(screen.getByRole('link', { name: 'Settings' }));
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByText('sets')).toBeInTheDocument();
  });
});
