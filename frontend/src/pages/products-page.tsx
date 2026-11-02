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
} from '@meridio/contracts';
import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { TableSkeleton } from '../components/ui/skeleton';
import { EmptyState, ErrorState } from '../components/ui/states';
import { useToast } from '../components/ui/toast';
import { useDeleteProduct, useProducts } from '../features/products/hooks';
import { Pagination } from '../features/products/pagination';
import { ProductDrawer } from '../features/products/product-drawer';
import { ProductTable } from '../features/products/product-table';
import { SearchInput } from '../features/products/search-input';
import { PageHeader } from '../layouts/page-header';
import { ApiError } from '../lib/api-client';
import { formatNumber } from '../lib/format';

const PAGE_SIZE = 20;

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
  });
  const q = parsed.success ? parsed.data : listProductsQuerySchema.parse({});
  const search = q.search ?? '';
  const list = useProducts({
    page: q.page,
    limit: PAGE_SIZE,
    search,
    sort: q.sort,
    order: q.order,
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

      <div className="mb-4">
        <SearchInput value={search} onChange={onSearch} />
      </div>

      {list.isPending && <TableSkeleton rows={6} columns={6} />}

      {list.isError && (
        <ErrorState
          message="We could not load your products."
          onRetry={() => void list.refetch()}
        />
      )}

      {list.data && rows.length === 0 && search === '' && (
        <EmptyState
          title="No products yet"
          description="Add your first product to start tracking stock levels."
          action={<Button onClick={openAdd}>Add your first product</Button>}
        />
      )}

      {list.data && rows.length === 0 && search !== '' && (
        <EmptyState
          title={`No results for “${search}”`}
          description="Check the spelling, or try part of the name or SKU."
          action={
            <Button variant="secondary" onClick={() => onSearch('')}>
              Clear search
            </Button>
          }
        />
      )}

      {list.data && rows.length > 0 && (
        <div
          aria-busy={list.isPlaceholderData}
          className={list.isPlaceholderData ? 'opacity-70 transition-opacity' : undefined}
        >
          <ProductTable
            products={rows}
            sort={q.sort}
            order={q.order}
            onSort={onSort}
            onDelete={setPendingDelete}
          />
          <Pagination meta={list.data.meta} onPage={onPage} />
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
