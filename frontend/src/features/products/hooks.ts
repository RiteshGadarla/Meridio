/**
 * FILE: frontend/src/features/products/hooks.ts
 * PURPOSE: TanStack Query hooks for products. Every mutation invalidates dashboard + products.
 * LAYER: Feature hooks
 * USED BY: pages/products-page.tsx, product drawer
 * DEPENDS ON: features/products/api.ts, features/dashboard/hooks.ts (invalidateInventoryQueries)
 */
import type {
  AdjustStockInput,
  CreateProductInput,
  ProductDto,
  UpdateProductInput,
} from '@meridio/contracts';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { invalidateInventoryQueries } from '../dashboard/hooks';
import {
  adjustStock,
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
  type ProductListParams,
} from './api';

/**
 * Marks inventory queries stale WITHOUT waiting for the refetch.
 * WHY: a mutation's onSuccess that returns a promise keeps the mutation "pending" until it settles,
 * so the drawer/dialog would stay open while the list and dashboard reload. The data is already
 * saved; the screens update themselves as soon as the refetch lands.
 */
function refreshInBackground(queryClient: QueryClient): void {
  void invalidateInventoryQueries(queryClient);
}

/** Paginated, searchable list. keepPreviousData stops the table flashing empty between pages. */
export function useProducts(params: ProductListParams, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ['products', 'list', params],
    queryFn: ({ signal }) => listProducts(params, signal),
    placeholderData: keepPreviousData,
  });
}

/** Single product for the edit drawer. `id` undefined disables the query. */
export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ['products', 'detail', id],
    queryFn: () => getProduct(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation<ProductDto, Error, CreateProductInput>({
    mutationFn: createProduct,
    onSuccess: () => refreshInBackground(queryClient),
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation<ProductDto, Error, { id: string; changes: UpdateProductInput }>({
    mutationFn: ({ id, changes }) => updateProduct(id, changes),
    onSuccess: () => refreshInBackground(queryClient),
  });
}

/** Relative stock change. Invalidates dashboard + products so status and totals refresh. */
export function useAdjustStock() {
  const queryClient = useQueryClient();
  return useMutation<ProductDto, Error, { id: string; input: AdjustStockInput }>({
    mutationFn: ({ id, input }) => adjustStock(id, input),
    onSuccess: () => refreshInBackground(queryClient),
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation<{ id: string }, Error, string>({
    mutationFn: deleteProduct,
    onSuccess: () => refreshInBackground(queryClient),
  });
}
