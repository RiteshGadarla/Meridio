/**
 * FILE: frontend/src/test/fake-products-api.ts
 * PURPOSE: A small stateful in-memory /products API for MSW, with request recording.
 * LAYER: Test support
 */
import type { ProductDto } from '@meridio/contracts';
import { http, HttpResponse } from 'msw';
import { server } from './server';

export function makeProduct(i: number, over: Partial<ProductDto> = {}): ProductDto {
  return {
    id: `p${i}`,
    name: `Product ${i}`,
    sku: `SKU-${String(i).padStart(3, '0')}`,
    description: null,
    quantityOnHand: 10,
    costPrice: null,
    sellingPrice: '19.99',
    lowStockThreshold: null,
    effectiveThreshold: 5,
    stockStatus: 'HEALTHY',
    updatedById: null,
    updatedByName: null,
    createdAt: '2026-11-02T10:00:00.000Z',
    updatedAt: '2026-11-02T10:00:00.000Z',
    ...over,
  };
}

export interface Recorded {
  listUrls: URL[];
  posts: unknown[];
  patches: { id: string; body: Record<string, unknown> }[];
  adjusts: { id: string; body: Record<string, unknown> }[];
  deletes: string[];
}

/** Installs handlers for every /products route backed by `initial`. */
export function fakeProductsApi(initial: ProductDto[]) {
  let rows = [...initial];
  const rec: Recorded = { listUrls: [], posts: [], patches: [], adjusts: [], deletes: [] };
  const error = (
    code: string,
    message: string,
    status: number,
    fieldErrors?: Record<string, string>,
  ) => HttpResponse.json({ error: { code, message, fieldErrors } }, { status });

  server.use(
    http.get('*/api/v1/products', ({ request }) => {
      const url = new URL(request.url);
      rec.listUrls.push(url);
      const search = (url.searchParams.get('search') ?? '').toLowerCase();
      const page = Number(url.searchParams.get('page') ?? 1);
      const limit = Number(url.searchParams.get('limit') ?? 20);
      const filtered = rows.filter(
        (r) => r.name.toLowerCase().includes(search) || r.sku.toLowerCase().includes(search),
      );
      const slice = filtered.slice((page - 1) * limit, page * limit);
      return HttpResponse.json({
        data: slice,
        meta: {
          page,
          limit,
          total: filtered.length,
          totalPages: Math.ceil(filtered.length / limit),
        },
      });
    }),
    http.get('*/api/v1/products/:id', ({ params }) => {
      const row = rows.find((r) => r.id === params.id);
      return row ? HttpResponse.json({ data: row }) : error('NOT_FOUND', 'Product not found', 404);
    }),
    http.post('*/api/v1/products', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      rec.posts.push(body);
      if (rows.some((r) => r.sku === body.sku)) {
        return error('DUPLICATE_SKU', 'This SKU already exists in your organization.', 409, {
          sku: 'This SKU already exists in your organization.',
        });
      }
      const created = makeProduct(rows.length + 100, {
        ...(body as Partial<ProductDto>),
        id: `new${rows.length}`,
      });
      rows = [created, ...rows];
      return HttpResponse.json({ data: created }, { status: 201 });
    }),
    http.patch('*/api/v1/products/:id/stock', async ({ params, request }) => {
      const body = (await request.json()) as { delta: number };
      rec.adjusts.push({ id: String(params.id), body });
      const row = rows.find((r) => r.id === params.id);
      if (!row) return error('NOT_FOUND', 'Product not found', 404);
      if (row.quantityOnHand + body.delta < 0) {
        const message = `Only ${row.quantityOnHand} in stock; you cannot remove ${-body.delta}.`;
        return error('VALIDATION_ERROR', message, 400, { delta: message });
      }
      const updated = { ...row, quantityOnHand: row.quantityOnHand + body.delta };
      rows = rows.map((r) => (r.id === row.id ? updated : r));
      return HttpResponse.json({ data: updated });
    }),
    http.patch('*/api/v1/products/:id', async ({ params, request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      rec.patches.push({ id: String(params.id), body });
      rows = rows.map((r) => (r.id === params.id ? { ...r, ...(body as Partial<ProductDto>) } : r));
      return HttpResponse.json({ data: rows.find((r) => r.id === params.id) });
    }),
    http.delete('*/api/v1/products/:id', ({ params }) => {
      rec.deletes.push(String(params.id));
      rows = rows.filter((r) => r.id !== params.id);
      return HttpResponse.json({ data: { id: params.id } });
    }),
  );
  return rec;
}
