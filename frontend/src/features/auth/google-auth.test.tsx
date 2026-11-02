/**
 * FILE: frontend/src/features/auth/google-auth.test.tsx
 * PURPOSE: Tests the Google sign-in UI: the buttons, callback error messages, and the
 *          "name your organization" step for new Google users.
 * LAYER: Test
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { mockSession, renderApp, USER } from '../../test/render';
import { server } from '../../test/server';

const path = () => screen.getByTestId('path').textContent;

// Protects: both entry pages offer Google, as a real link to the API (full-page navigation).
describe('Google buttons', () => {
  it('login and signup link to /api/v1/auth/google', async () => {
    mockSession(null);
    renderApp('/login');
    expect(await screen.findByRole('link', { name: 'Continue with Google' })).toHaveAttribute(
      'href',
      '/api/v1/auth/google',
    );
  });

  it('signup offers "Sign up with Google"', async () => {
    mockSession(null);
    renderApp('/signup');
    expect(await screen.findByRole('link', { name: 'Sign up with Google' })).toBeInTheDocument();
  });

  // Why: the callback can only redirect, so the login page must explain the failure.
  it('shows a message for a failed Google callback', async () => {
    mockSession(null);
    renderApp('/login?error=google_denied');
    expect(await screen.findByText('Google sign-in was cancelled.')).toBeInTheDocument();
  });
});

// Protects: a new Google user must name an organization before an account exists.
describe('GoogleOrganizationPage', () => {
  const pending = {
    email: 'ada@acme.test',
    name: 'Ada Lovelace',
    pictureUrl: null,
  };

  it('greets the user, validates the name, and completes signup', async () => {
    mockSession(null);
    server.use(
      http.get('*/api/v1/auth/google/pending', () => HttpResponse.json({ data: pending })),
      http.post('*/api/v1/auth/google/complete', async ({ request }) => {
        const body = (await request.json()) as { organizationName: string };
        return HttpResponse.json(
          {
            data: {
              ...USER,
              email: pending.email,
              organization: { ...USER.organization, name: body.organizationName },
            },
          },
          { status: 201 },
        );
      }),
    );
    renderApp('/signup/organization');
    expect(await screen.findByText('Welcome, Ada')).toBeInTheDocument();
    expect(screen.getByText('ada@acme.test')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Create workspace' }));
    expect(await screen.findByText(/at least 2 characters/i)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Organization name'), 'Acme Co');
    await userEvent.click(screen.getByRole('button', { name: 'Create workspace' }));
    await waitFor(() => expect(path()).toBe('/dashboard'));
  });

  // Why: the pending cookie lasts 10 minutes; an expired one must not leave a dead form.
  it('sends the user back to /signup when the pending session is gone', async () => {
    mockSession(null);
    server.use(
      http.get('*/api/v1/auth/google/pending', () =>
        HttpResponse.json(
          { error: { code: 'UNAUTHENTICATED', message: 'expired' } },
          { status: 401 },
        ),
      ),
    );
    renderApp('/signup/organization');
    await waitFor(() => expect(path()).toBe('/signup'));
  });
});
