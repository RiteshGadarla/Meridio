/**
 * FILE: backend/test/api/error-handling.test.ts
 * PURPOSE: Verifies the error handler mapping and the validate() middleware.
 * LAYER: Test (Supertest against the real middleware stack)
 */
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { validate } from '../../src/middleware/validate.js';
import { ok } from '../../src/utils/api-response.js';
import { AppError } from '../../src/utils/app-error.js';
import { makeTestApp } from '../helpers.js';

const bodySchema = z.object({
  email: z.string().email('Enter a valid email'),
  sku: z.string().trim().toUpperCase().min(1, 'SKU is required'),
});

const app = makeTestApp((router) => {
  router.get('/boom', () => {
    throw new Error('SELECT * FROM "User" failed at /srv/app/secret.ts:42');
  });
  router.get('/app-error', () => {
    throw new AppError('NOT_FOUND', 'Product not found');
  });
  router.get('/duplicate-sku', () => {
    throw Object.assign(new Error('unique'), {
      code: 'P2002',
      meta: { target: ['organizationId', 'sku'] },
    });
  });
  router.get('/duplicate-email', () => {
    throw Object.assign(new Error('unique'), { code: 'P2002', meta: { target: ['email'] } });
  });
  router.get('/duplicate-other', () => {
    throw Object.assign(new Error('unique'), {
      code: 'P2002',
      meta: { target: ['somethingElse'] },
    });
  });
  router.post('/validated', validate(bodySchema, 'body'), (req, res) => ok(res, req.body));
  router.get(
    '/paged',
    validate(z.object({ page: z.coerce.number().int().default(1) }), 'query'),
    (req, res) => ok(res, req.query),
  );
});

// Protects: SECURITY: unexpected failures never leak stack traces, SQL or file paths.
describe('unexpected errors', () => {
  it('returns a generic 500 with no stack and no SQL', async () => {
    const res = await request(app).get('/api/v1/boom');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/SELECT|secret\.ts|stack/i);
  });
});

// Protects: expected errors become the documented envelope with the right status.
describe('known errors', () => {
  it('maps AppError to its code and status', async () => {
    const res = await request(app).get('/api/v1/app-error');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Product not found' } });
  });

  it('maps a SKU unique violation to 409 DUPLICATE_SKU with a field error', async () => {
    const res = await request(app).get('/api/v1/duplicate-sku');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_SKU');
    expect(res.body.error.fieldErrors.sku).toBe('This SKU already exists in your organization.');
  });

  it('maps an email unique violation to 409 EMAIL_TAKEN', async () => {
    const res = await request(app).get('/api/v1/duplicate-email');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('treats an unknown unique violation as a 500, not a misleading 409', async () => {
    const res = await request(app).get('/api/v1/duplicate-other');
    expect(res.status).toBe(500);
  });
});

// Protects: controllers only ever see validated, normalised input.
describe('validate middleware', () => {
  it('returns VALIDATION_ERROR with fieldErrors keyed by field name', async () => {
    const res = await request(app).post('/api/v1/validated').send({ email: 'nope', sku: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fieldErrors).toEqual({
      email: 'Enter a valid email',
      sku: 'SKU is required',
    });
  });

  it('replaces the body with the parsed (normalised) value', async () => {
    const res = await request(app)
      .post('/api/v1/validated')
      .send({ email: 'a@b.co', sku: '  key-001 ', extra: 'dropped' });
    expect(res.body.data).toEqual({ email: 'a@b.co', sku: 'KEY-001' });
  });

  it('works on query strings despite Express 5 read-only req.query', async () => {
    const res = await request(app).get('/api/v1/paged?page=3');
    expect(res.body.data).toEqual({ page: 3 });
    const defaults = await request(app).get('/api/v1/paged');
    expect(defaults.body.data).toEqual({ page: 1 });
  });
});
