/**
 * FILE: backend/test/api/foundation.test.ts
 * PURPOSE: Verifies the API foundation: health probes, JSON error shapes, security headers, request ids.
 * LAYER: Test (Supertest against the real middleware stack)
 */
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { PRODUCT_NAME } from '@meridio/contracts';
import { ok } from '../../src/utils/api-response.js';
import { makeTestApp, TEST_ORIGIN } from '../helpers.js';

const app = makeTestApp((router) => {
  router.get('/echo', (_req, res) => ok(res, { echoed: true }));
  router.post('/echo', (_req, res) => ok(res, { echoed: true }));
});

// Protects: the npm workspace link to @meridio/contracts resolves from the backend.
describe('workspace link', () => {
  it('imports @meridio/contracts', () => {
    expect(PRODUCT_NAME).toBe('StockFlow');
  });
});

// Protects: platforms and monitors can tell if the process and database are healthy.
describe('health endpoints', () => {
  it('GET /health/live returns 200', async () => {
    const res = await request(app).get('/api/v1/health/live');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { status: 'live' } });
  });

  it('GET /health/ready returns 200 when the real database answers', async () => {
    const res = await request(makeTestApp()).get('/api/v1/health/ready');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { status: 'ready' } });
  });

  it('GET /health/ready returns 503 with an error envelope when the database fails', async () => {
    const failing = makeTestApp(undefined, {
      checkDatabase: () => Promise.reject(new Error('connection refused to 10.0.0.5')),
    });
    const res = await request(failing).get('/api/v1/health/ready');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    // Protects: internal error text never reaches the client.
    expect(JSON.stringify(res.body)).not.toContain('10.0.0.5');
  });
});

// Protects: JSON clients always get JSON errors, never Express's default HTML pages.
describe('error shapes', () => {
  it('unknown route returns a 404 envelope', async () => {
    const res = await request(app).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  it('malformed JSON returns a 400 envelope', async () => {
    const res = await request(app)
      .post('/api/v1/echo')
      .set('Content-Type', 'application/json')
      .send('{"broken":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('a body over 100kb returns a 413 envelope', async () => {
    const res = await request(app)
      .post('/api/v1/echo')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ blob: 'a'.repeat(150_000) }));
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

// Protects: SECURITY headers and no shared caching of tenant data.
describe('headers', () => {
  it('sets helmet headers and hides x-powered-by', async () => {
    const res = await request(app).get('/api/v1/echo');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('marks API responses private, no-store (but not health checks)', async () => {
    const api = await request(app).get('/api/v1/echo');
    expect(api.headers['cache-control']).toBe('private, no-store');
    const health = await request(app).get('/api/v1/health/live');
    expect(health.headers['cache-control']).toBeUndefined();
  });

  it('generates a request id and echoes an inbound safe one', async () => {
    const generated = await request(app).get('/api/v1/echo');
    expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    const echoed = await request(app).get('/api/v1/echo').set('x-request-id', 'trace-123');
    expect(echoed.headers['x-request-id']).toBe('trace-123');
  });

  it('replaces an unsafe inbound request id', async () => {
    const res = await request(app).get('/api/v1/echo').set('x-request-id', 'bad id\twith spaces');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

// Protects: SECURITY: a foreign website cannot make a browser change state on our API.
describe('origin check', () => {
  it('rejects a POST from a foreign Origin with 403', async () => {
    const res = await request(app).post('/api/v1/echo').set('Origin', 'https://evil.example');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_ORIGIN');
  });

  it('allows a POST from the app origin and from a request with no Origin', async () => {
    expect((await request(app).post('/api/v1/echo').set('Origin', TEST_ORIGIN)).status).toBe(200);
    expect((await request(app).post('/api/v1/echo')).status).toBe(200);
  });

  it('never blocks GET, even from a foreign Origin', async () => {
    const res = await request(app).get('/api/v1/echo').set('Origin', 'https://evil.example');
    expect(res.status).toBe(200);
  });
});
