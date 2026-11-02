/**
 * FILE: frontend/src/pages/products-page.tsx
 * PURPOSE: /products: searchable, sortable, paginated list with add/edit drawer and delete.
 * LAYER: Page
 * USED BY: app/routes.tsx
 * DEPENDS ON: features/products
 * NOTES: All list state lives in the URL (?search=&page=&sort=&order=) so refresh, back and shared
 *        links work. Paging, sorting and search are server-side.
 */
import {
  listProductsQuerySchema,
  type ProductDto,
  type ProductSortField,
  type StockStatus,
} from '@meridio/contracts';
import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ThresholdLegend } from '../components/threshold-cell';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { TableSkeleton } from '../components/ui/skeleton';
import { EmptyState, ErrorState } from '../components/ui/states';
import { useToast } from '../components/ui/toast';
import { useDeleteProduct, useProducts } from '../features/products/hooks';
import { PAGE_SIZES, Pagination } from '../features/products/pagination';
import { ProductDrawer } from '../features/products/product-drawer';
import { ProductTable } from '../features/products/product-table';
import { SearchInput } from '../features/products/search-input';
import { PageHeader } from '../layouts/page-header';
import { cn } from '../lib/cn';
import { ApiError } from '../lib/api-client';
import { formatNumber } from '../lib/format';

/** Status filter options; `undefined` means every status. */
const STATUS_FILTERS: { value: StockStatus | undefined; label: string }[] = [
  { value: undefined, label: 'All' },
  { value: 'HEALTHY', label: 'Healthy' },
  { value: 'LOW_STOCK', label: 'Low stock' },
  { value: 'OUT_OF_STOCK', label: 'Out of stock' },
];

export function ProductsPage() {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const deleteProduct = useDeleteProduct();
  const [pendingDelete, setPendingDelete] = useState<ProductDto | null>(null);

  // Parse the URL through the same schema the API uses, so a hand-edited URL falls back safely.
  const parsed = listProductsQuerySchema.safeParse({
    page: params.get('page') ?? undefined,
    search: params.get('search') ?? undefined,
    sort: params.get('sort') ?? undefined,
    order: params.get('order') ?? undefined,
    status: params.get('status') ?? undefined,
    limit: params.get('limit') ?? undefined,
  });
  const q = parsed.success ? parsed.data : listProductsQuerySchema.parse({});
  const search = q.search ?? '';
  // Only the offered page sizes are honoured; anything else in the URL falls back to the default.
  const limit = (PAGE_SIZES as readonly number[]).includes(q.limit) ? q.limit : PAGE_SIZES[0];
  const list = useProducts({
    page: q.page,
    limit,
    search,
    sort: q.sort,
    order: q.order,
    ...(q.status ? { status: q.status } : {}),
  });

  const update = useCallback(
    (changes: Record<string, string | null>) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value === null || value === '') next.delete(key);
          else next.set(key, value);
        }
        return next;
      }),
    [setParams],
  );

  const onSearch = useCallback((value: string) => update({ search: value, page: null }), [update]); // new search -> page 1
  const onStatus = (status: StockStatus | undefined) =>
    update({ status: status ?? null, page: null });
  const onPageSize = (size: number) => update({ limit: String(size), page: null });
  const hasFilters = search !== '' || q.status !== undefined;
  const clearFilters = () => update({ search: null, status: null, page: null });
  const onPage = (page: number) => update({ page: page <= 1 ? null : String(page) });
  const onSort = (field: ProductSortField) =>
    update({
      sort: field,
      order: q.sort === field && q.order === 'asc' ? 'desc' : 'asc',
      page: null,
    });

  const total = list.data?.meta.total;
  const rows = list.data?.products ?? [];

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteProduct.mutateAsync(pendingDelete.id);
      toast.success(`Deleted ${pendingDelete.name}`);
      // EDGE CASE: deleting the last row of the last page would leave an empty page; step back.
      if (rows.length === 1 && q.page > 1) onPage(q.page - 1);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not delete the product.');
    } finally {
      setPendingDelete(null);
    }
  }

  const openAdd = () => update({ new: '1', edit: null });

  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title="Products"
        description="Everything you stock, with live status."
        action={
          <div className="flex items-center gap-3">
            {total !== undefined && (
              <Badge>
                {formatNumber(total)} {total === 1 ? 'product' : 'products'}
              </Badge>
            )}
            <Button onClick={openAdd}>Add Product</Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map(({ value, label }) => (
            <button
              key={label}
              type="button"
              aria-pressed={q.status === value}
              onClick={() => onStatus(value)}
              className={cn(
                'rounded-sm border px-3 py-1.5 text-sm font-medium transition-colors',
                q.status === value
                  ? 'border-forest bg-forest text-on-forest'
                  : 'border-sandstone bg-paper text-graphite-soft hover:text-graphite',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <SearchInput value={search} onChange={onSearch} />
      </div>

      {list.isPending && <TableSkeleton rows={6} columns={6} />}

      {list.isError && (
        <ErrorState
          message="We could not load your products."
          onRetry={() => void list.refetch()}
        />
      )}

      {list.data && rows.length === 0 && !hasFilters && (
        <EmptyState
          title="No products yet"
          description="Add your first product to start tracking stock levels."
          action={<Button onClick={openAdd}>Add your first product</Button>}
        />
      )}

      {list.data && rows.length === 0 && hasFilters && (
        <EmptyState
          title={search ? `No results for “${search}”` : 'No products match this filter'}
          description="Check the spelling, try part of the name or SKU, or change the status filter."
          action={
            <Button variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      )}

      {list.data && rows.length > 0 && (
        <div
          aria-busy={list.isPlaceholderData}
          className={list.isPlaceholderData ? 'opacity-70 transition-opacity' : undefined}
        >
          <ThresholdLegend />
          <ProductTable
            products={rows}
            sort={q.sort}
            order={q.order}
            onSort={onSort}
            onDelete={setPendingDelete}
          />
          <Pagination meta={list.data.meta} onPage={onPage} onPageSize={onPageSize} />
        </div>
      )}

      <ProductDrawer />

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete ${pendingDelete?.name ?? 'product'}?`}
        description={`This permanently removes ${pendingDelete?.name ?? 'this product'} (SKU ${pendingDelete?.sku ?? ''}). This cannot be undone.`}
        confirmLabel="Delete product"
        destructive
        loading={deleteProduct.isPending}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
