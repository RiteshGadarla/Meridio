/**
 * FILE: frontend/src/features/products/hooks.ts
 * PURPOSE: TanStack Query hooks for products. Every mutation invalidates dashboard + products.
 * LAYER: Feature hooks
 * USED BY: pages/products-page.tsx, product drawer
 * DEPENDS ON: features/products/api.ts, features/dashboard/hooks.ts (invalidateInventoryQueries)
 */
import type { CreateProductInput, ProductDto, UpdateProductInput } from '@meridio/contracts';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateInventoryQueries } from '../dashboard/hooks';
import {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
  type ProductListParams,
} from './api';

/** Paginated, searchable list. keepPreviousData stops the table flashing empty between pages. */
export function useProducts(params: ProductListParams) {
  return useQuery({
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
    onSuccess: () => invalidateInventoryQueries(queryClient),
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation<ProductDto, Error, { id: string; changes: UpdateProductInput }>({
    mutationFn: ({ id, changes }) => updateProduct(id, changes),
    onSuccess: () => invalidateInventoryQueries(queryClient),
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation<{ id: string }, Error, string>({
    mutationFn: deleteProduct,
    onSuccess: () => invalidateInventoryQueries(queryClient),
  });
}
