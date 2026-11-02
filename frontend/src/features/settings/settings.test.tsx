/**
 * FILE: frontend/src/features/settings/settings.test.tsx
 * PURPOSE: Tests the /settings page (RTL + MSW).
 * LAYER: Test
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_KEY } from '../auth/hooks';
import { mockSession, renderApp, USER } from '../../test/render';
import { server } from '../../test/server';

beforeEach(() => mockSession(USER));

function serveSettings(value = 5) {
  const patches: unknown[] = [];
  server.use(
    http.get('*/api/v1/settings', () =>
      HttpResponse.json({
        data: { defaultLowStockThreshold: value, currency: 'INR', organizationName: 'Acme' },
      }),
    ),
    http.patch('*/api/v1/settings', async ({ request }) => {
      const body = (await request.json()) as { defaultLowStockThreshold: number };
      patches.push(body);
      return HttpResponse.json({
        data: {
          defaultLowStockThreshold: body.defaultLowStockThreshold,
          currency: 'INR',
          organizationName: 'Acme',
        },
      });
    }),
  );
  return patches;
}

const input = () => screen.getByLabelText('Default low-stock threshold');
const save = () => screen.getByRole('button', { name: 'Save changes' });

describe('SettingsPage', () => {
  it('shows a skeleton, then loads the current value into the field', async () => {
    serveSettings(7);
    renderApp('/settings');
    expect(await screen.findByRole('status', { name: 'Loading settings' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Default low-stock threshold')).toHaveValue('7');
    expect(screen.getByRole('heading', { name: 'Inventory Defaults' })).toBeInTheDocument();
    expect(screen.getByText(/at or below its threshold/)).toBeInTheDocument();
  });

  // Protects: no pointless saves.
  it('keeps Save disabled while pristine and enables it after a change', async () => {
    serveSettings();
    renderApp('/settings');
    await screen.findByLabelText('Default low-stock threshold');
    expect(save()).toBeDisabled();
    await userEvent.clear(input());
    await userEvent.type(input(), '8');
    await waitFor(() => expect(save()).toBeEnabled());
  });

  it.each([
    ['empty', '', 'Threshold must be a number'],
    ['decimal', '1.5', 'Threshold must be a whole number'],
    ['negative', '-2', 'Threshold must be zero or positive'],
    ['non-numeric', 'abc', 'Threshold must be a number'],
  ])('rejects %s input with a message and never calls the API', async (_label, value, message) => {
    const patches = serveSettings();
    renderApp('/settings');
    await screen.findByLabelText('Default low-stock threshold');
    await userEvent.clear(input());
    if (value) {
      await userEvent.click(input());
      await userEvent.paste(value); // paste bypasses the key filter so the schema message is reachable
    }
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(save()).toBeDisabled();
    expect(patches).toHaveLength(0);
  });

  it('saves an integer, shows feedback, patches the cached user and invalidates inventory queries', async () => {
    const patches = serveSettings(5);
    const { client } = renderApp('/settings');
    const spy = vi.spyOn(client, 'invalidateQueries');
    await screen.findByLabelText('Default low-stock threshold');
    await userEvent.clear(input());
    await userEvent.type(input(), '12');
    await userEvent.click(
      await waitFor(() => {
        const b = save();
        expect(b).toBeEnabled();
        return b;
      }),
    );

    await waitFor(() =>
      expect(patches).toEqual([{ defaultLowStockThreshold: 12, currency: 'INR' }]),
    );
    expect(await screen.findByText('Settings saved')).toBeInTheDocument();
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect(client.getQueryData<typeof USER>(AUTH_KEY)?.organization.defaultLowStockThreshold).toBe(
      12,
    );
    expect(spy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['products'] });
    expect(save()).toBeDisabled(); // pristine again after saving
  });

  it('marks the dashboard query stale after a change (integration)', async () => {
    serveSettings();
    server.use(
      http.get('*/api/v1/dashboard/overview', () =>
        HttpResponse.json({
          data: {
            totalProducts: 0,
            totalUnits: 0,
            lowStockCount: 0,
            outOfStockCount: 0,
            lowStockProducts: [],
          },
        }),
      ),
    );
    const { client } = renderApp('/settings');
    await screen.findByLabelText('Default low-stock threshold');
    await client.prefetchQuery({ queryKey: ['dashboard', 'overview'], queryFn: async () => ({}) });
    expect(client.getQueryState(['dashboard', 'overview'])?.isInvalidated).toBe(false);

    await userEvent.clear(input());
    await userEvent.type(input(), '9');
    await userEvent.click(
      await waitFor(() => {
        const b = save();
        expect(b).toBeEnabled();
        return b;
      }),
    );
    await waitFor(() =>
      expect(client.getQueryState(['dashboard', 'overview'])?.isInvalidated).toBe(true),
    );
  });

  it('shows an API 400 under the field', async () => {
    serveSettings();
    server.use(
      http.patch('*/api/v1/settings', () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Some fields are invalid.',
              fieldErrors: { defaultLowStockThreshold: 'Threshold must be at most 100,000' },
            },
          },
          { status: 400 },
        ),
      ),
    );
    renderApp('/settings');
    await screen.findByLabelText('Default low-stock threshold');
    await userEvent.clear(input());
    await userEvent.type(input(), '50');
    await userEvent.click(
      await waitFor(() => {
        const b = save();
        expect(b).toBeEnabled();
        return b;
      }),
    );
    expect(await screen.findByText('Threshold must be at most 100,000')).toBeInTheDocument();
  });

  it('shows a banner for an API 500', async () => {
    serveSettings();
    server.use(
      http.patch('*/api/v1/settings', () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } },
          { status: 500 },
        ),
      ),
    );
    renderApp('/settings');
    await screen.findByLabelText('Default low-stock threshold');
    await userEvent.clear(input());
    await userEvent.type(input(), '3');
    await userEvent.click(
      await waitFor(() => {
        const b = save();
        expect(b).toBeEnabled();
        return b;
      }),
    );
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
  });

  it('shows an error state with retry when loading fails', async () => {
    let n = 0;
    server.use(
      http.get('*/api/v1/settings', () =>
        ++n === 1
          ? HttpResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'x' } }, { status: 500 })
          : HttpResponse.json({
              data: { defaultLowStockThreshold: 5, currency: 'INR', organizationName: 'Acme' },
            }),
      ),
    );
    renderApp('/settings');
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByLabelText('Default low-stock threshold')).toHaveValue('5');
  });
});
