/**
 * FILE: frontend/src/features/dashboard/dashboard.test.tsx
 * PURPOSE: Tests the dashboard page states, metrics, table and cache-invalidation helper (MSW).
 * LAYER: Test
 */
import type { DashboardOverviewDto, ProductDto } from '@meridio/contracts';
import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { fakeProductsApi, makeProduct } from '../../test/fake-products-api';
import { mockSession, renderApp, USER } from '../../test/render';
import { server } from '../../test/server';
import { invalidateInventoryQueries } from './hooks';

const product = (over: Partial<ProductDto> = {}): ProductDto => ({
  id: 'p1',
  name: 'USB-C Hub',
  sku: 'HUB-014',
  description: null,
  quantityOnHand: 4,
  costPrice: null,
  sellingPrice: null,
  lowStockThreshold: 10,
  effectiveThreshold: 10,
  stockStatus: 'LOW_STOCK',
  updatedById: null,
  createdAt: '2026-11-02T10:00:00.000Z',
  updatedAt: '2026-11-02T10:00:00.000Z',
  ...over,
});

const overview = (over: Partial<DashboardOverviewDto> = {}): DashboardOverviewDto => ({
  totalProducts: 1234,
  totalUnits: 56789,
  lowStockCount: 2,
  outOfStockCount: 1,
  lowStockProducts: [
    product(),
    product({
      id: 'p2',
      name: 'Desk Lamp',
      sku: 'LMP-220',
      quantityOnHand: 0,
      lowStockThreshold: null,
      effectiveThreshold: 5,
      stockStatus: 'OUT_OF_STOCK',
    }),
  ],
  ...over,
});

function serve(data: DashboardOverviewDto) {
  mockSession(USER);
  server.use(http.get('*/api/v1/dashboard/overview', () => HttpResponse.json({ data })));
}

// Protects: the dashboard shows real API numbers in the right places.
describe('DashboardPage', () => {
  it('shows a skeleton first, then exactly three formatted KPI cards', async () => {
    serve(overview());
    renderApp('/dashboard');
    expect((await screen.findAllByRole('status', { name: 'Loading' })).length).toBeGreaterThan(0);

    const strip = await screen.findByText('Total Products');
    const metrics = strip.closest('dl')!;
    expect(within(metrics).getAllByRole('term')).toHaveLength(3);
    expect(within(metrics).getByText('1,234')).toBeInTheDocument();
    expect(within(metrics).getByText('56,789')).toBeInTheDocument();
    expect(within(metrics).getByText('Total Units')).toBeInTheDocument();
    expect(within(metrics).getByText('Low Stock Products')).toBeInTheDocument();
    expect(screen.getByText(/What needs attention in Acme right now/)).toBeInTheDocument();
  });

  it('applies amber emphasis to Low Stock only when the count is above 0', async () => {
    serve(overview({ lowStockCount: 2 }));
    const first = renderApp('/dashboard');
    const low = (await screen.findByText('Low Stock Products'))
      .closest('dl')!
      .querySelectorAll('dd')[2]!;
    expect(low).toHaveAttribute('data-emphasis', 'true');
    first.unmount();

    serve(overview({ lowStockCount: 0, lowStockProducts: [] }));
    renderApp('/dashboard');
    const zero = (await screen.findByText('Low Stock Products'))
      .closest('dl')!
      .querySelectorAll('dd')[2]!;
    expect(zero).not.toHaveAttribute('data-emphasis');
  });

  it('renders attention rows with status badges and a "default" tag only for inherited thresholds', async () => {
    serve(overview());
    renderApp('/dashboard');
    const table = await screen.findByRole('table', { name: 'Products that need attention' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText('Low stock')).toBeInTheDocument();
    expect(within(rows[0]!).queryByText('Org default')).not.toBeInTheDocument(); // own threshold 10
    expect(within(rows[1]!).getByText('Out of stock')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Org default')).toBeInTheDocument(); // inherited from org
  });

  // Protects: the attention list can be narrowed by status and by name/SKU without a refetch.
  it('filters the attention table by status and search, with a clear action', async () => {
    serve(overview());
    renderApp('/dashboard');
    const table = await screen.findByRole('table', { name: 'Products that need attention' });
    expect(within(table).getAllByRole('row')).toHaveLength(3);

    await userEvent.click(screen.getByRole('button', { name: /^Out of stock/ }));
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2);

    await userEvent.type(screen.getByRole('searchbox'), 'zzz-nothing');
    expect(screen.getByText('No matching products')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(3);
  });

  // Protects: the list never shows more rows than the chosen page size, and Next/Previous work.
  it('paginates the attention table with a rows-per-page setting', async () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      product({ id: `p${i}`, name: `Item ${i}`, sku: `SKU-${i}` }),
    );
    serve(overview({ lowStockCount: 12, lowStockProducts: many }));
    renderApp('/dashboard');
    await screen.findByRole('table', { name: 'Products that need attention' });
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(11); // 10 + header

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(3); // 2 + header

    await userEvent.selectOptions(screen.getByLabelText('Rows per page'), '25');
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(13);
  });

  // Protects: healthy products are reachable from the dashboard (they are not in the overview list).
  it('"All products" loads the full catalogue from the products API', async () => {
    serve(overview({ totalProducts: 3 }));
    fakeProductsApi([
      makeProduct(1, { name: 'Healthy Cable' }),
      makeProduct(2, { name: 'Healthy Dock' }),
    ]);
    renderApp('/dashboard');
    await userEvent.click(await screen.findByRole('button', { name: /^All products/ }));
    expect(await screen.findByText('Healthy Cable')).toBeInTheDocument();
    expect(screen.getByText('Healthy Dock')).toBeInTheDocument();
  });

  // Protects: column headers sort the table, toggling direction and reporting it via aria-sort.
  it('sorts by clicking a column header and toggles the direction', async () => {
    serve(overview());
    renderApp('/dashboard');
    await screen.findByRole('table', { name: 'Products that need attention' });
    const names = () =>
      within(screen.getByRole('table'))
        .getAllByRole('row')
        .slice(1)
        .map((r) => within(r).getAllByRole('cell')[0]!.textContent);

    await userEvent.click(screen.getByRole('button', { name: /^Product/ }));
    const asc = names();
    expect(asc).toEqual([...asc].sort((a, b) => a!.localeCompare(b!)));
    expect(screen.getByRole('columnheader', { name: /^Product/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );

    await userEvent.click(screen.getByRole('button', { name: /^Product/ }));
    expect(names()).toEqual([...asc].reverse());
  });

  // Protects: a row click opens a read-only details pop-up; only the Edit control navigates.
  it('opens a product info pop-up on row click without navigating, and Edit goes to the drawer', async () => {
    serve(overview());
    renderApp('/dashboard');
    await userEvent.click(await screen.findByText('USB-C Hub'));
    const dialog = await screen.findByRole('dialog', { name: 'USB-C Hub' });
    expect(within(dialog).getByText('Quantity on hand')).toBeInTheDocument();
    expect(within(dialog).getByText('Cost price')).toBeInTheDocument();
    expect(screen.getByTestId('path').textContent).toBe('/dashboard');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    fakeProductsApi([makeProduct(1, { id: 'p1', name: 'USB-C Hub' })]);
    await userEvent.click(screen.getByRole('link', { name: 'Edit USB-C Hub' }));
    await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/products'));
    expect(screen.getByTestId('search').textContent).toBe('?edit=p1');
  });

  it('Edit link points at /products?edit=ID', async () => {
    serve(overview());
    renderApp('/dashboard');
    expect(await screen.findByRole('link', { name: 'Edit USB-C Hub' })).toHaveAttribute(
      'href',
      '/products?edit=p1',
    );
  });

  it('empty catalogue: "No products yet" with a working add-first-product link', async () => {
    serve(
      overview({
        totalProducts: 0,
        totalUnits: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
        lowStockProducts: [],
      }),
    );
    renderApp('/dashboard');
    expect(await screen.findByRole('heading', { name: 'No products yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add your first product' })).toHaveAttribute(
      'href',
      '/products?new=1',
    );
  });

  it('products exist but none need attention: "All stocked up"', async () => {
    serve(overview({ lowStockCount: 0, outOfStockCount: 0, lowStockProducts: [] }));
    renderApp('/dashboard');
    expect(await screen.findByRole('heading', { name: 'All stocked up' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('header has an Add Product link to /products?new=1', async () => {
    serve(overview());
    renderApp('/dashboard');
    expect(await screen.findByRole('link', { name: 'Add Product' })).toHaveAttribute(
      'href',
      '/products?new=1',
    );
  });

  it('shows an error state and Retry refetches', async () => {
    mockSession(USER);
    let calls = 0;
    server.use(
      http.get('*/api/v1/dashboard/overview', () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(
              { error: { code: 'INTERNAL_ERROR', message: 'boom' } },
              { status: 500 },
            )
          : HttpResponse.json({ data: overview() });
      }),
    );
    renderApp('/dashboard');
    expect(
      await screen.findByText('We could not load your inventory overview.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Total Products')).toBeInTheDocument();
    expect(calls).toBe(2);
  });
});

// Protects: later mutations refresh the dashboard by calling this one helper.
describe('invalidateInventoryQueries', () => {
  it('invalidates both the dashboard and products key prefixes', async () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, 'invalidateQueries');
    await invalidateInventoryQueries(client);
    expect(spy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['products'] });
  });
});
