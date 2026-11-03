/**
 * FILE: frontend/src/features/activity/activity-feed.test.tsx
 * PURPOSE: Tests the sidebar "Recent activity" feed and that product changes refresh it.
 * LAYER: Test (RTL + MSW)
 */
import type { ActivityDto } from '@meridio/contracts';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { formatRelativeTime } from '../../lib/format';
import { fakeProductsApi, makeProduct } from '../../test/fake-products-api';
import { mockSession, renderApp, USER } from '../../test/render';
import { server } from '../../test/server';

beforeEach(() => mockSession(USER));

const entry = (over: Partial<ActivityDto>): ActivityDto => ({
  id: 'a1',
  action: 'STOCK_ADJUSTED',
  productName: 'Keyboard',
  productSku: 'KEY-001',
  summary: 'Stock -5 (12 → 7)',
  note: null,
  actorName: 'me@acme.test',
  createdAt: new Date().toISOString(),
  ...over,
});

const feed = () => screen.getByRole('region', { name: 'Recent activity' });

// Protects: users can see what changed in the sidebar, including the stock-adjust note.
describe('ActivityFeed', () => {
  it('lists entries with product, summary, note and who did it', async () => {
    server.use(
      http.get('*/api/v1/activity', () =>
        HttpResponse.json({
          data: [entry({ note: 'Damaged in transit' })],
          meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
        }),
      ),
    );
    fakeProductsApi([]);
    renderApp('/products');
    const region = await screen.findByRole('region', { name: 'Recent activity' });
    expect(await within(region).findByText('Keyboard')).toBeInTheDocument();
    expect(within(region).getByText('Stock -5 (12 → 7)')).toBeInTheDocument();
    expect(within(region).getByText('“Damaged in transit”')).toBeInTheDocument();
    expect(within(region).getByText('just now')).toBeInTheDocument();
    expect(within(region).getByText(/· me@acme.test/)).toBeInTheDocument();
  });

  it('shows a helpful empty message', async () => {
    fakeProductsApi([]);
    renderApp('/products');
    expect(
      await screen.findByText(/Changes to your products will appear here/),
    ).toBeInTheDocument();
  });

  it('stays out of the way when the feed fails to load', async () => {
    server.use(
      http.get('*/api/v1/activity', () =>
        HttpResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'x' } }, { status: 500 }),
      ),
    );
    fakeProductsApi([]);
    renderApp('/products');
    await screen.findByRole('heading', { name: 'Products' });
    await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument());
    expect(screen.queryByRole('region', { name: 'Recent activity' })).not.toBeInTheDocument();
  });

  it('refetches after a product change (why: the feed must not lag behind what the user just did)', async () => {
    let calls = 0;
    server.use(
      http.get('*/api/v1/activity', () => {
        calls++;
        return HttpResponse.json({ data: [] });
      }),
    );
    fakeProductsApi([makeProduct(1, { name: 'Keyboard', quantityOnHand: 12 })]);
    renderApp('/products');
    await userEvent.click(await screen.findByRole('button', { name: 'Adjust stock for Keyboard' }));
    const dialog = await screen.findByRole('dialog', { name: 'Adjust stock' });
    await userEvent.type(within(dialog).getByLabelText(/^Change/), '+1');
    const before = calls;
    await userEvent.click(within(dialog).getByRole('button', { name: 'Apply change' }));
    // The feed refreshes ~1s later because the server logs in the background after replying.
    await waitFor(() => expect(calls).toBeGreaterThan(before), { timeout: 4000 });
    expect(feed()).toBeInTheDocument();
  });
});

// Protects: relative timestamps read naturally and fall back to a date for old entries.
describe('formatRelativeTime', () => {
  const now = new Date('2026-11-03T12:00:00Z');
  it.each([
    ['2026-11-03T11:59:50Z', 'just now'],
    ['2026-11-03T11:30:00Z', '30 minutes ago'],
    ['2026-11-03T09:00:00Z', '3 hours ago'],
    ['2026-11-02T12:00:00Z', 'yesterday'],
    ['2026-10-01T12:00:00Z', 'Oct 1, 2026'],
  ])('%s -> %s', (iso, expected) => {
    expect(formatRelativeTime(iso, now)).toBe(expected);
  });
});

// Protects: the full log has its own page, reachable from the sidebar.
describe('Logs page', () => {
  it('is linked from the sidebar and lists entries in a table', async () => {
    server.use(
      http.get('*/api/v1/activity', () =>
        HttpResponse.json({
          data: [entry({ note: 'Damaged in transit' })],
          meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
        }),
      ),
    );
    fakeProductsApi([]);
    renderApp('/dashboard');
    await userEvent.click(await screen.findByRole('link', { name: 'Logs' }));
    const table = await screen.findByRole('table', { name: 'Activity log' });
    expect(within(table).getByText('Keyboard')).toBeInTheDocument();
    expect(within(table).getByText('Stock -5 (12 → 7)')).toBeInTheDocument();
    expect(within(table).getByText('“Damaged in transit”')).toBeInTheDocument();
  });

  it('shows an empty state when nothing has happened yet', async () => {
    renderApp('/logs');
    expect(await screen.findByRole('heading', { name: 'No activity yet' })).toBeInTheDocument();
  });
});

// Protects: the Logs page pages and filters on the server, with state kept in the URL.
describe('Logs page filters and paging', () => {
  it('sends the action filter and search to the API and resets to page 1', async () => {
    const urls: URL[] = [];
    server.use(
      http.get('*/api/v1/activity', ({ request }) => {
        urls.push(new URL(request.url));
        return HttpResponse.json({
          data: [entry({})],
          meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
        });
      }),
    );
    renderApp('/logs?page=2');
    await screen.findByRole('table', { name: 'Activity log' });
    expect(urls.at(-1)?.searchParams.get('page')).toBe('2');

    await userEvent.click(screen.getByRole('button', { name: 'Stock changes' }));
    await waitFor(() => expect(urls.at(-1)?.searchParams.get('action')).toBe('STOCK_ADJUSTED'));
    expect(urls.at(-1)?.searchParams.get('page')).toBe('1');
    expect(screen.getByRole('button', { name: 'Stock changes' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await userEvent.type(screen.getByRole('searchbox'), 'key');
    await waitFor(() => expect(urls.at(-1)?.searchParams.get('search')).toBe('key'));
  });

  it('shows page info, moves between pages, and offers Clear filters on an empty result', async () => {
    const urls: URL[] = [];
    server.use(
      http.get('*/api/v1/activity', ({ request }) => {
        const url = new URL(request.url);
        urls.push(url);
        if (url.searchParams.get('action') === 'PRODUCT_DELETED') {
          return HttpResponse.json({
            data: [],
            meta: { page: 1, limit: 10, total: 0, totalPages: 1 },
          });
        }
        return HttpResponse.json({
          data: [entry({})],
          meta: { page: 1, limit: 10, total: 25, totalPages: 3 },
        });
      }),
    );
    renderApp('/logs');
    expect(await screen.findByText(/Page 1 of 3 · 25 entries/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(urls.at(-1)?.searchParams.get('page')).toBe('2'));

    await userEvent.click(screen.getByRole('button', { name: 'Deleted' }));
    expect(
      await screen.findByRole('heading', { name: 'No log entries match' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByRole('table', { name: 'Activity log' })).toBeInTheDocument();
  });
});
