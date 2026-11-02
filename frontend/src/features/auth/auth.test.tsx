/**
 * FILE: frontend/src/features/auth/auth.test.tsx
 * PURPOSE: Tests the auth UI and session handling against a mocked API (MSW).
 * LAYER: Test
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { AUTH_KEY } from './hooks';
import { api } from '../../lib/api-client';
import { server } from '../../test/server';
import { mockSession, renderApp, USER } from '../../test/render';

const path = () => screen.getByTestId('path').textContent;
const errorBody = (code: string, message: string, fieldErrors?: Record<string, string>) => ({
  error: { code, message, fieldErrors },
});

async function fillSignup(
  overrides: Partial<Record<'email' | 'password' | 'confirm' | 'org', string>> = {},
) {
  const v = {
    email: 'me@acme.test',
    password: 'Passw0rdOK',
    confirm: 'Passw0rdOK',
    org: 'Acme',
    ...overrides,
  };
  await userEvent.type(screen.getByLabelText('Email'), v.email);
  await userEvent.type(screen.getByLabelText('Password'), v.password);
  await userEvent.type(screen.getByLabelText('Confirm password'), v.confirm);
  await userEvent.type(screen.getByLabelText('Organization name'), v.org);
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
}

// Protects: invalid signups never reach the API, and valid ones send exactly what the API expects.
describe('SignupPage', () => {
  it('shows validation errors and does not call the API when invalid', async () => {
    mockSession(null);
    const spy = vi.fn();
    server.use(http.post('*/api/v1/auth/signup', () => (spy(), HttpResponse.json({}))));
    renderApp('/signup');
    await screen.findByRole('heading', { name: 'Create your account' });
    await fillSignup({ email: 'nope', password: 'short', confirm: 'different', org: 'A' });
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    expect(screen.getByText('Organization name must be at least 2 characters')).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it('sends the payload WITHOUT confirmPassword and navigates to /dashboard', async () => {
    mockSession(null);
    let body: unknown;
    server.use(
      http.post('*/api/v1/auth/signup', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: USER }, { status: 201 });
      }),
    );
    renderApp('/signup');
    await screen.findByRole('heading', { name: 'Create your account' });
    await fillSignup();
    await waitFor(() => expect(path()).toBe('/dashboard'));
    expect(body).toEqual({
      email: 'me@acme.test',
      password: 'Passw0rdOK',
      organizationName: 'Acme',
    });
    expect(await screen.findByRole('heading', { name: 'Inventory overview' })).toBeInTheDocument();
  });

  it('shows an EMAIL_TAKEN server error under the email field', async () => {
    mockSession(null);
    server.use(
      http.post('*/api/v1/auth/signup', () =>
        HttpResponse.json(
          errorBody('EMAIL_TAKEN', 'taken', {
            email: 'An account with this email already exists.',
          }),
          { status: 409 },
        ),
      ),
    );
    renderApp('/signup');
    await screen.findByRole('heading', { name: 'Create your account' });
    await fillSignup();
    expect(await screen.findByLabelText('Email')).toHaveAccessibleDescription(
      'An account with this email already exists.',
    );
    expect(path()).toBe('/signup');
  });
});

// Protects: visitors can always get back to the intro page from the auth screens.
describe('Back to home link', () => {
  it.each(['/login', '/signup'])(
    '%s has a top-left link to the intro page that works',
    async (route) => {
      mockSession(null);
      renderApp(route);
      const back = await screen.findByRole('link', { name: 'Back to home' });
      expect(back).toHaveAttribute('href', '/');
      await userEvent.click(back);
      expect(
        await screen.findByRole('heading', { level: 1, name: /Know what is on your shelves/ }),
      ).toBeInTheDocument();
      expect(path()).toBe('/');
    },
  );
});

describe('LoginPage', () => {
  it('redirects to /dashboard on success', async () => {
    mockSession(null);
    server.use(http.post('*/api/v1/auth/login', () => HttpResponse.json({ data: USER })));
    renderApp('/login');
    await userEvent.type(await screen.findByLabelText('Email'), 'me@acme.test');
    await userEvent.type(screen.getByLabelText('Password'), 'Passw0rdOK');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() => expect(path()).toBe('/dashboard'));
  });

  it('shows the generic error banner on failure and stays on /login (no session-expired redirect)', async () => {
    mockSession(null);
    server.use(
      http.post('*/api/v1/auth/login', () =>
        HttpResponse.json(errorBody('UNAUTHENTICATED', 'Invalid email or password'), {
          status: 401,
        }),
      ),
    );
    renderApp('/login');
    await userEvent.type(await screen.findByLabelText('Email'), 'me@acme.test');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
    expect(path()).toBe('/login');
  });

  // Why: prevents double submits and tells the user something is happening.
  it('disables the button and shows busy state while the request is pending', async () => {
    mockSession(null);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    server.use(
      http.post('*/api/v1/auth/login', async () => {
        await gate;
        return HttpResponse.json({ data: USER });
      }),
    );
    renderApp('/login');
    await userEvent.type(await screen.findByLabelText('Email'), 'me@acme.test');
    await userEvent.type(screen.getByLabelText('Password'), 'Passw0rdOK');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    const button = await screen.findByRole('button', { name: 'Log in' });
    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveAttribute('aria-busy', 'true');
    release();
    await waitFor(() => expect(path()).toBe('/dashboard'));
  });
});

describe('guards', () => {
  // Protects: deep links survive the login round trip.
  it('RequireAuth sends a visitor to /login, and login returns them to the requested page', async () => {
    mockSession(null);
    server.use(http.post('*/api/v1/auth/login', () => HttpResponse.json({ data: USER })));
    renderApp('/products');
    await screen.findByRole('heading', { name: 'Log in' });
    expect(path()).toBe('/login');
    await userEvent.type(screen.getByLabelText('Email'), 'me@acme.test');
    await userEvent.type(screen.getByLabelText('Password'), 'Passw0rdOK');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() => expect(path()).toBe('/products'));
    expect(await screen.findByRole('heading', { name: 'Products' })).toBeInTheDocument();
  });

  it('RedirectIfAuthed sends a signed-in user from /login to /dashboard', async () => {
    mockSession(USER);
    renderApp('/login');
    await waitFor(() => expect(path()).toBe('/dashboard'));
    expect(await screen.findByRole('heading', { name: 'Inventory overview' })).toBeInTheDocument();
  });

  // Protects: a refresh while signed in never flashes the login screen.
  it('shows a loading screen while /auth/me is pending, then the page', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    server.use(
      http.get('*/api/v1/auth/me', async () => {
        await gate;
        return HttpResponse.json({ data: USER });
      }),
    );
    renderApp('/dashboard');
    expect(screen.getByText(/Loading StockFlow/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Log in' })).not.toBeInTheDocument();
    release();
    expect(await screen.findByRole('heading', { name: 'Inventory overview' })).toBeInTheDocument();
  });

  it('shows a retryable error (not the login page) when the session check itself fails', async () => {
    server.use(http.get('*/api/v1/auth/me', () => HttpResponse.json({}, { status: 500 })));
    renderApp('/dashboard');
    expect(await screen.findByText(/could not check your session/)).toBeInTheDocument();
  });
});

describe('logout and expiry', () => {
  // Protects: no private data survives for the next person on this browser.
  it('logout clears the whole query cache and returns to /login', async () => {
    mockSession(USER);
    server.use(
      http.post('*/api/v1/auth/logout', () => HttpResponse.json({ data: { loggedOut: true } })),
    );
    const { client } = renderApp('/dashboard');
    await screen.findByRole('heading', { name: 'Inventory overview' });
    client.setQueryData(['products', 'list'], [{ id: 'secret' }]);

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    await waitFor(() => expect(path()).toBe('/login'));
    expect(client.getQueryData(['products', 'list'])).toBeUndefined();
    expect(client.getQueryData(AUTH_KEY)).toBeNull();
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });

  it('a 401 while signed in clears the cache and redirects to /login with a notice', async () => {
    mockSession(USER);
    server.use(
      http.get('*/api/v1/products', () =>
        HttpResponse.json(errorBody('UNAUTHENTICATED', 'Authentication required'), { status: 401 }),
      ),
    );
    const { client } = renderApp('/dashboard');
    await screen.findByRole('heading', { name: 'Inventory overview' });
    client.setQueryData(['products', 'list'], [{ id: 'secret' }]);

    await api.get('/products').catch(() => undefined); // any API call that returns 401
    await waitFor(() => expect(path()).toBe('/login'));
    expect(client.getQueryData(['products', 'list'])).toBeUndefined();
    expect(await screen.findByText(/Session expired/)).toBeInTheDocument();
  });
});
