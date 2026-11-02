/**
 * FILE: frontend/src/lib/api-client.test.ts
 * PURPOSE: Unit tests for the fetch wrapper (fetch is stubbed; no network).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, request, setUnauthorizedHandler } from './api-client';

const respond = (body: BodyInit | null, status = 200) =>
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status })));

afterEach(() => {
  vi.unstubAllGlobals();
  setUnauthorizedHandler(undefined);
});

// Protects: callers receive plain data on success and a typed ApiError on failure.
describe('api-client', () => {
  it('unwraps { data } and returns meta from request()', async () => {
    respond(JSON.stringify({ data: [1], meta: { total: 1 } }));
    expect(await request('/products')).toEqual({ data: [1], meta: { total: 1 } });
  });

  it('api.get returns only data and calls a relative /api/v1 url with same-origin credentials', async () => {
    respond(JSON.stringify({ data: { ok: true } }));
    expect(await api.get('/dashboard/overview', { query: { page: 2, search: '' } })).toEqual({
      ok: true,
    });
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe('/api/v1/dashboard/overview?page=2'); // empty search dropped
    expect(init?.credentials).toBe('same-origin');
  });

  it('sends JSON bodies with a content type', async () => {
    respond(JSON.stringify({ data: {} }), 201);
    await api.post('/products', { name: 'x' });
    const init = vi.mocked(fetch).mock.calls[0]![1]!;
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"name":"x"}');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('throws ApiError with code and fieldErrors from an error envelope', async () => {
    respond(
      JSON.stringify({
        error: { code: 'DUPLICATE_SKU', message: 'dup', fieldErrors: { sku: 'taken' } },
      }),
      409,
    );
    await expect(api.post('/products', {})).rejects.toMatchObject({
      name: 'ApiError',
      status: 409,
      code: 'DUPLICATE_SKU',
      message: 'dup',
      fieldErrors: { sku: 'taken' },
    });
  });

  // Why: a proxy 502 page is HTML; the UI must still get a clean error, not a JSON parse crash.
  it('handles a non-JSON error body gracefully', async () => {
    respond('<html>Bad gateway</html>', 502);
    const error = await api.get('/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502, code: 'UNKNOWN_ERROR' });
  });

  it('maps a network failure to NETWORK_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')));
    await expect(api.get('/x')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('calls the 401 hook, unless skipped', async () => {
    const hook = vi.fn();
    setUnauthorizedHandler(hook);
    respond(JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'no' } }), 401);
    await api.get('/auth/me').catch(() => undefined);
    expect(hook).toHaveBeenCalledTimes(1);

    respond(JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'no' } }), 401);
    await api.post('/auth/login', {}, { skipUnauthorizedHandler: true }).catch(() => undefined);
    expect(hook).toHaveBeenCalledTimes(1);
  });
});
