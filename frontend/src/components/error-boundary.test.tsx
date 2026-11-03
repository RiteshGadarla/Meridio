/**
 * FILE: frontend/src/components/error-boundary.test.tsx
 * PURPOSE: Tests the crash recovery screen and the 404 page.
 * LAYER: Test (RTL)
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockSession, renderApp, USER } from '../test/render';
import { ErrorBoundary } from './error-boundary';

let shouldCrash = true;
function Bomb() {
  if (shouldCrash) throw new Error('boom');
  return <p>Recovered content</p>;
}

beforeEach(() => {
  shouldCrash = true;
  // React logs caught render errors; keep test output clean.
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

// Protects: a render crash shows a recovery screen instead of a blank page.
describe('ErrorBoundary', () => {
  it('shows the recovery screen with Try again, Reload and Go to overview', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to overview' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });

  it('Try again re-renders the children (why: transient failures should not need a reload)', async () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    shouldCrash = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Recovered content')).toBeInTheDocument();
  });

  it('clears the error when resetKey changes (why: navigating away must not leave it stuck)', () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="/a">
        <Bomb />
      </ErrorBoundary>,
    );
    shouldCrash = false;
    rerender(
      <ErrorBoundary resetKey="/b">
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Recovered content')).toBeInTheDocument();
  });
});

// Protects: unknown URLs get recovery actions that fit the visitor's session state.
describe('404 page', () => {
  it('signed in: offers overview and products links and names the missing path', async () => {
    mockSession(USER);
    renderApp('/nope/at/all');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(within(screen.getByRole('main')).getByText('/nope/at/all')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Go to overview' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
    expect(screen.getByRole('link', { name: 'View products' })).toBeInTheDocument();
  });

  it('signed out: offers Back to home instead of a dashboard link that would bounce to login', async () => {
    mockSession(null);
    renderApp('/nope');
    expect(await screen.findByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('link', { name: 'Go to overview' })).not.toBeInTheDocument();
  });
});
