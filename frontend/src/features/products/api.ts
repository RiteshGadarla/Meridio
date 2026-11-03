/**
 * FILE: frontend/src/features/products/api.ts
 * PURPOSE: Typed calls to the /products endpoints.
 * LAYER: Feature API
 * USED BY: features/products/hooks.ts
 * DEPENDS ON: lib/api-client.ts, @meridio/contracts
 */
import type {
  AdjustStockInput,
  CreateProductInput,
  PaginationMeta,
  ProductDto,
  ProductSortField,
  StockStatus,
  UpdateProductInput,
} from '@meridio/contracts';
import { api, request } from '../../lib/api-client';

/** URL-backed list parameters. Empty values are dropped from the request. */
export interface ProductListParams {
  page: number;
  limit: number;
  search: string;
  sort: ProductSortField;
  order: 'asc' | 'desc';
  /** Optional stock status filter (the API supports it; empty = all). */
  status?: StockStatus;
}

export interface ProductPage {
  products: ProductDto[];
  meta: PaginationMeta;
}

export async function listProducts(
  params: ProductListParams,
  signal?: AbortSignal,
): Promise<ProductPage> {
  const { data, meta } = await request<ProductDto[]>('/products', { query: { ...params }, signal });
  return { products: data, meta: meta as unknown as PaginationMeta };
}

export const getProduct = (id: string) =>
  api.get<ProductDto>(`/products/${encodeURIComponent(id)}`);
export const createProduct = (input: CreateProductInput) =>
  api.post<ProductDto>('/products', input);
export const updateProduct = (id: string, input: UpdateProductInput) =>
  api.patch<ProductDto>(`/products/${encodeURIComponent(id)}`, input);
export const adjustStock = (id: string, input: AdjustStockInput) =>
  api.patch<ProductDto>(`/products/${encodeURIComponent(id)}/stock`, input);
export const deleteProduct = (id: string) =>
  api.delete<{ id: string }>(`/products/${encodeURIComponent(id)}`);
