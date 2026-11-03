/**
 * FILE: frontend/src/features/products/products.test.tsx
 * PURPOSE: Tests the /products page: list, search, paging, drawer form, validation, errors, delete.
 * LAYER: Test (RTL + MSW with a stateful fake API)
 */
import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeProductsApi, makeProduct } from '../../test/fake-products-api';
import { mockSession, renderApp, USER } from '../../test/render';
import { server } from '../../test/server';

beforeEach(() => mockSession(USER));

const many = (n: number) => Array.from({ length: n }, (_, i) => makeProduct(i + 1));
const field = (name: string) => screen.getByLabelText(new RegExp(`^${name}`));
const search = () => screen.getByTestId('search').textContent;

describe('list', () => {
  it('renders rows with the right columns; a null price shows "Not set"', async () => {
    fakeProductsApi([
      makeProduct(1, {
        name: 'Keyboard',
        sku: 'KEY-001',
        quantityOnHand: 1200,
        sellingPrice: '89.5',
        stockStatus: 'HEALTHY',
      }),
      makeProduct(2, {
        name: 'Lamp',
        sku: 'LMP-1',
        sellingPrice: null,
        quantityOnHand: 0,
        stockStatus: 'OUT_OF_STOCK',
      }),
    ]);
    renderApp('/products');
    const table = await screen.findByRole('table', { name: 'Products' });
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((h) => h.textContent?.trim());
    expect(headers).toEqual([
      'Product',
      'SKU',
      'Quantity',
      'Threshold',
      'Stock status',
      'Selling price',
      'Actions',
    ]);
    const [, kb, lamp] = within(table).getAllByRole('row');
    expect(within(kb!).getByText('1,200')).toBeInTheDocument();
    expect(within(kb!).getByText('₹89.50')).toBeInTheDocument();
    // Inherited threshold shows the building symbol's text alternative plus the number.
    expect(within(kb!).getByText('Org default')).toBeInTheDocument();
    expect(within(kb!).getByText('5')).toBeInTheDocument();
    expect(within(lamp!).getByText('Not set')).toBeInTheDocument();
    expect(within(lamp!).getByText('Out of stock')).toBeInTheDocument();
    expect(screen.getByText('2 products')).toBeInTheDocument();
  });

  it('shows the empty state with an add action when there are no products', async () => {
    fakeProductsApi([]);
    renderApp('/products');
    expect(await screen.findByRole('heading', { name: 'No products yet' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add your first product' }));
    expect(search()).toContain('new=1');
  });

  it('shows an error state and retry refetches', async () => {
    let n = 0;
    server.use(
      http.get('*/api/v1/products', () =>
        ++n === 1
          ? HttpResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'x' } }, { status: 500 })
          : HttpResponse.json({
              data: [makeProduct(1)],
              meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
            }),
      ),
    );
    renderApp('/products');
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Product 1')).toBeInTheDocument();
  });
});

describe('search and URL state', () => {
  it('debounces typing into ?search= and requests it; clearing resets to page 1', async () => {
    const rec = fakeProductsApi(many(3).concat([makeProduct(9, { name: 'Widget', sku: 'WDG-9' })]));
    renderApp('/products?page=1');
    await screen.findByText('Widget');
    const before = rec.listUrls.length;

    await userEvent.type(screen.getByLabelText('Search products by name or SKU'), 'wid');
    expect(search()).not.toContain('search='); // not yet: still within the debounce window
    await waitFor(() => expect(search()).toContain('search=wid'));
    await waitFor(() => expect(rec.listUrls.at(-1)?.searchParams.get('search')).toBe('wid'));
    expect(rec.listUrls.length).toBeLessThanOrEqual(before + 2); // debounced: not one request per key
    expect(await screen.findByText('Widget')).toBeInTheDocument();
    expect(screen.queryByText('Product 1')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    await waitFor(() => expect(search()).not.toContain('search='));
    expect(await screen.findByText('Product 1')).toBeInTheDocument();
  });

  it('shows "No results" with a clear-search action', async () => {
    fakeProductsApi(many(2));
    renderApp('/products?search=zzz');
    expect(
      await screen.findByRole('heading', { name: 'No results for “zzz”' }),
    ).toBeInTheDocument();
    // Two "Clear search" buttons exist (the input's X and this empty-state action); use the action.
    const buttons = screen.getAllByRole('button', { name: 'Clear search' });
    await userEvent.click(buttons[buttons.length - 1]!);
    await waitFor(() => expect(search()).not.toContain('search='));
  });

  it('restores state from the URL on load (search, page, sort)', async () => {
    const rec = fakeProductsApi(many(30));
    renderApp('/products?page=2&sort=name&order=desc');
    await screen.findByText('Product 11');
    const url = rec.listUrls.at(-1)!;
    expect([
      url.searchParams.get('page'),
      url.searchParams.get('sort'),
      url.searchParams.get('order'),
    ]).toEqual(['2', 'name', 'desc']);
    expect(screen.getByRole('columnheader', { name: /Product/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
  });

  it('clicking a sortable header sorts ascending then toggles', async () => {
    fakeProductsApi(many(2));
    renderApp('/products');
    await screen.findByText('Product 1');
    await userEvent.click(screen.getByRole('button', { name: /Quantity/ }));
    await waitFor(() => expect(search()).toContain('sort=quantityOnHand'));
    expect(search()).toContain('order=asc');
    await userEvent.click(screen.getByRole('button', { name: /Quantity/ }));
    await waitFor(() => expect(search()).toContain('order=desc'));
  });
});

describe('pagination', () => {
  it('next and previous request the right pages and disable at the bounds', async () => {
    const rec = fakeProductsApi(many(25)); // 3 pages of 10 (the default page size)
    renderApp('/products');
    await screen.findByText('Product 1');
    const prev = screen.getByRole('button', { name: 'Previous' });
    const next = screen.getByRole('button', { name: 'Next' });
    expect(prev).toBeDisabled();
    expect(screen.getByText(/Page 1 of 3 · 25 products/)).toBeInTheDocument();

    await userEvent.click(next);
    await screen.findByText('Product 11');
    expect(rec.listUrls.at(-1)?.searchParams.get('page')).toBe('2');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Product 21');
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Previous' }));
    await screen.findByText('Product 11');
  });
});

// Protects: status filter and rows-per-page live in the URL and reach the API.
describe('filter and page size', () => {
  it('the status chips and rows-per-page select send status and limit to the API', async () => {
    const rec = fakeProductsApi(many(30));
    renderApp('/products');
    await screen.findByText('Product 1');
    await userEvent.click(screen.getByRole('button', { name: 'Low stock' }));
    await waitFor(() => expect(rec.listUrls.at(-1)?.searchParams.get('status')).toBe('LOW_STOCK'));
    expect(screen.getByRole('button', { name: 'Low stock' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await userEvent.click(screen.getByRole('button', { name: 'All' }));
    await userEvent.selectOptions(screen.getByLabelText('Rows per page'), '25');
    await waitFor(() => expect(rec.listUrls.at(-1)?.searchParams.get('limit')).toBe('25'));
  });
});

describe('create', () => {
  it('?new=1 opens the drawer; an empty submit shows required errors and never calls the API', async () => {
    const rec = fakeProductsApi(many(1));
    renderApp('/products?new=1');
    const dialog = await screen.findByRole('dialog', { name: 'Add product' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add product' }));
    expect(await within(dialog).findByText('Product name is required')).toBeInTheDocument();
    expect(within(dialog).getByText('SKU is required')).toBeInTheDocument();
    expect(rec.posts).toHaveLength(0);
  });

  it.each([
    ['Quantity on hand', '-3', 'Quantity must be zero or positive'],
    ['Quantity on hand', '1.5', 'Quantity must be a whole number'],
    ['Selling price', '1.234', 'Must have at most 2 decimal places'],
    ['Selling price', '-5', 'Must be zero or positive'],
    ['Low-stock threshold', '-1', 'Threshold must be zero or positive'],
  ])('%s = %s shows "%s"', async (label, value, message) => {
    fakeProductsApi([]);
    renderApp('/products?new=1');
    const dialog = await screen.findByRole('dialog', { name: 'Add product' });
    await userEvent.type(field('Product name'), 'Widget');
    await userEvent.type(field('SKU'), 'WDG-1');
    const input = within(dialog).getByLabelText(new RegExp(`^${label}`));
    await userEvent.clear(input);
    await userEvent.click(input);
    await userEvent.paste(value); // paste bypasses the key filter, so the schema message is reachable
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add product' }));
    expect(await within(dialog).findByText(message)).toBeInTheDocument();
  });

  it('rejects SKU characters outside the allowed set', async () => {
    fakeProductsApi([]);
    renderApp('/products?new=1');
    await screen.findByRole('dialog');
    await userEvent.type(field('Product name'), 'Widget');
    await userEvent.type(field('SKU'), 'bad sku!');
    await userEvent.click(screen.getByRole('button', { name: 'Add product' }));
    expect(await screen.findByText(/SKU must start with a letter or digit/)).toBeInTheDocument();
  });

  it('uppercases the SKU on blur', async () => {
    fakeProductsApi([]);
    renderApp('/products?new=1');
    await screen.findByRole('dialog');
    await userEvent.type(field('SKU'), ' key-9 ');
    await userEvent.tab();
    expect(field('SKU')).toHaveValue('KEY-9');
  });

  it('posts a normalised payload, closes the drawer, shows a toast and invalidates queries', async () => {
    const rec = fakeProductsApi(many(1));
    const { client } = renderApp('/products?new=1');
    const spy = vi.spyOn(client as QueryClient, 'invalidateQueries');
    await screen.findByRole('dialog');
    await userEvent.type(field('Product name'), '  Widget ');
    await userEvent.type(field('SKU'), 'wdg-1');
    await userEvent.clear(field('Quantity on hand'));
    await userEvent.type(field('Quantity on hand'), '7');
    await userEvent.type(field('Selling price'), '9.99');
    await userEvent.click(screen.getByRole('button', { name: 'Add product' }));

    await waitFor(() => expect(rec.posts).toHaveLength(1));
    expect(rec.posts[0]).toMatchObject({
      name: 'Widget',
      sku: 'WDG-1',
      quantityOnHand: 7,
      sellingPrice: 9.99,
      costPrice: null,
      lowStockThreshold: null,
      description: null,
    });
    expect(await screen.findByText('Product added')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(search()).not.toContain('new=1');
    expect(spy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['products'] });
  });

  it('maps a 409 DUPLICATE_SKU onto the SKU field and keeps the drawer and data', async () => {
    fakeProductsApi([makeProduct(1, { sku: 'KEY-001' })]);
    renderApp('/products?new=1');
    await screen.findByRole('dialog');
    await userEvent.type(field('Product name'), 'Another');
    await userEvent.type(field('SKU'), 'key-001');
    await userEvent.click(screen.getByRole('button', { name: 'Add product' }));
    expect(await screen.findByLabelText(/^SKU/)).toHaveAccessibleDescription(
      'This SKU already exists in your organization.',
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(field('Product name')).toHaveValue('Another');
  });

  it('shows a form-level banner for unknown server errors', async () => {
    fakeProductsApi([]);
    server.use(
      http.post('*/api/v1/products', () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } },
          { status: 500 },
        ),
      ),
    );
    renderApp('/products?new=1');
    await screen.findByRole('dialog');
    await userEvent.type(field('Product name'), 'Widget');
    await userEvent.type(field('SKU'), 'W-1');
    await userEvent.click(screen.getByRole('button', { name: 'Add product' }));
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
  });
});

describe('form preview', () => {
  it('flips the status as quantity crosses the threshold, using the org default when empty', async () => {
    fakeProductsApi([]);
    renderApp('/products?new=1'); // org default threshold is 5
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText('Leave empty to use your organization default of 5.'),
    ).toBeInTheDocument();
    await userEvent.clear(field('Quantity on hand'));
    await userEvent.type(field('Quantity on hand'), '0');
    expect(within(dialog).getByText('Out of stock')).toBeInTheDocument();
    await userEvent.clear(field('Quantity on hand'));
    await userEvent.type(field('Quantity on hand'), '5');
    expect(within(dialog).getByText('Low stock')).toBeInTheDocument(); // 5 <= 5
    await userEvent.clear(field('Quantity on hand'));
    await userEvent.type(field('Quantity on hand'), '6');
    expect(within(dialog).getByText('Healthy')).toBeInTheDocument();
    await userEvent.type(field('Low-stock threshold'), '10');
    expect(within(dialog).getByText('Low stock')).toBeInTheDocument(); // own threshold 10 overrides
  });
});

describe('edit', () => {
  const original = makeProduct(1, {
    name: 'Keyboard',
    sku: 'KEY-001',
    quantityOnHand: 12,
    lowStockThreshold: 3,
    costPrice: '45.00',
    sellingPrice: '89.99',
  });

  it('prefills the form and sends a PATCH with only the changed fields', async () => {
    const rec = fakeProductsApi([original]);
    renderApp('/products?edit=p1');
    await screen.findByRole('dialog', { name: 'Edit product' });
    await waitFor(() => expect(field('Product name')).toHaveValue('Keyboard'));
    expect(field('Quantity on hand')).toHaveValue('12');
    expect(field('Cost price')).toHaveValue('45.00');
    await userEvent.clear(field('Quantity on hand'));
    await userEvent.type(field('Quantity on hand'), '4');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(rec.patches).toHaveLength(1));
    expect(rec.patches[0]).toEqual({ id: 'p1', body: { quantityOnHand: 4 } });
    expect(await screen.findByText('Product updated')).toBeInTheDocument();
  });

  it('clearing the threshold sends null (fall back to the organization default)', async () => {
    const rec = fakeProductsApi([original]);
    renderApp('/products?edit=p1');
    await waitFor(() => expect(field('Low-stock threshold')).toHaveValue('3'));
    await userEvent.clear(field('Low-stock threshold'));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(rec.patches[0]?.body).toEqual({ lowStockThreshold: null }));
  });

  it('shows a friendly message when the product does not exist (404)', async () => {
    fakeProductsApi([]);
    renderApp('/products?edit=ghost');
    expect(await screen.findByText('This product no longer exists.')).toBeInTheDocument();
  });

  it('opens the drawer from a row Edit link', async () => {
    fakeProductsApi([original]);
    renderApp('/products');
    await userEvent.click(await screen.findByRole('link', { name: 'Edit Keyboard' }));
    expect(await screen.findByRole('dialog', { name: 'Edit product' })).toBeInTheDocument();
  });
});

describe('dirty-form guard', () => {
  it('asks before discarding unsaved changes; "Keep editing" stays, "Discard" closes', async () => {
    fakeProductsApi([]);
    renderApp('/products?new=1');
    await screen.findByRole('dialog', { name: 'Add product' });
    await userEvent.type(field('Product name'), 'Half done');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      await screen.findByRole('alertdialog', { name: 'Discard changes?' }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(field('Product name')).toHaveValue('Half done');

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(search()).not.toContain('new=1');
  });

  it('closes immediately when nothing changed', async () => {
    fakeProductsApi([]);
    renderApp('/products?new=1');
    await screen.findByRole('dialog');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

describe('delete', () => {
  it('names the product and SKU; cancel does nothing; confirm deletes with a toast', async () => {
    const rec = fakeProductsApi([
      makeProduct(1, { name: 'Keyboard', sku: 'KEY-001' }),
      makeProduct(2),
    ]);
    renderApp('/products');
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Keyboard' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete Keyboard?' });
    expect(dialog).toHaveTextContent('KEY-001');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(rec.deletes).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: 'Delete Keyboard' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Delete product' }));
    await waitFor(() => expect(rec.deletes).toEqual(['p1']));
    expect(await screen.findByText('Deleted Keyboard')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('KEY-001')).not.toBeInTheDocument());
  });

  it('deleting the last item on the last page moves back a page', async () => {
    const rec = fakeProductsApi(many(11)); // page 2 holds only Product 11
    renderApp('/products?page=2');
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Product 11' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Delete product' }));
    await waitFor(() => expect(rec.deletes).toEqual(['p11']));
    await waitFor(() => expect(search()).not.toContain('page=2'));
    expect(await screen.findByText('Product 1')).toBeInTheDocument();
  });
});

// Protects: the PRD's inline "Adjust stock" control (+/- N units and a note).
describe('adjust stock', () => {
  const keyboard = makeProduct(1, { name: 'Keyboard', quantityOnHand: 12 });

  async function openDialog() {
    renderApp('/products');
    await userEvent.click(await screen.findByRole('button', { name: 'Adjust stock for Keyboard' }));
    return screen.findByRole('dialog', { name: 'Adjust stock' });
  }

  it('sends a relative change with the note, previews the result and refreshes the row', async () => {
    const rec = fakeProductsApi([keyboard]);
    const dialog = await openDialog();
    await userEvent.type(within(dialog).getByLabelText(/^Change/), '-5');
    expect(within(dialog).getByText('12 → 7')).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(/^Note/), 'Damaged');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Apply change' }));
    await waitFor(() => expect(rec.adjusts).toHaveLength(1));
    expect(rec.adjusts[0]).toEqual({ id: 'p1', body: { delta: -5, note: 'Damaged' } });
    expect(await screen.findByText(/now 7 in stock/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('accepts a leading + and omits an empty note', async () => {
    const rec = fakeProductsApi([keyboard]);
    const dialog = await openDialog();
    await userEvent.type(within(dialog).getByLabelText(/^Change/), '+3');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Apply change' }));
    await waitFor(() => expect(rec.adjusts[0]?.body).toEqual({ delta: 3 }));
  });

  it('rejects empty, zero and non-numeric input without calling the API', async () => {
    const rec = fakeProductsApi([keyboard]);
    const dialog = await openDialog();
    const apply = within(dialog).getByRole('button', { name: 'Apply change' });
    await userEvent.click(apply);
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/Enter a number of units/);
    await userEvent.type(within(dialog).getByLabelText(/^Change/), '0');
    await userEvent.click(apply);
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/other than zero/);
    expect(rec.adjusts).toHaveLength(0);
  });

  it("shows the server's refusal on the field when stock would go negative", async () => {
    fakeProductsApi([keyboard]);
    const dialog = await openDialog();
    await userEvent.type(within(dialog).getByLabelText(/^Change/), '-50');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Apply change' }));
    expect(await within(dialog).findByText(/Only 12 in stock/)).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Adjust stock' })).toBeInTheDocument();
  });
});

// Protects: last-change attribution (PRD FR-5 "last_updated_by").
describe('last updated attribution', () => {
  it('shows who changed the product and when in the edit drawer', async () => {
    fakeProductsApi([makeProduct(1, { updatedByName: 'Asha Rao' })]);
    renderApp('/products?edit=p1');
    expect(await screen.findByText(/Last updated .* by Asha Rao/)).toBeInTheDocument();
  });

  it('omits the "by" part when the updater is unknown', async () => {
    fakeProductsApi([makeProduct(1, { updatedByName: null })]);
    renderApp('/products?edit=p1');
    const line = await screen.findByText(/^Last updated/);
    expect(line.textContent).not.toContain(' by ');
  });
});

// Protects: refresh / tab close with an unsaved form triggers the browser's native warning.
describe('beforeunload guard', () => {
  it('blocks unload only while the form is dirty', async () => {
    fakeProductsApi([]);
    renderApp('/products?new=1');
    await screen.findByRole('dialog', { name: 'Add product' });

    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);

    await userEvent.type(field('Product name'), 'Half done');
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });
});
