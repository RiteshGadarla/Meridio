/**
 * FILE: backend/src/app.test.ts
 * PURPOSE: Verifies the app boots in-process and the placeholder route and workspace link work.
 * LAYER: Test
 */
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { PRODUCT_NAME } from '@meridio/contracts';
import { createApp } from './app.js';

// Protects: the app factory is testable without listening and uses the success envelope.
describe('GET /api/v1/ping', () => {
  it('returns 200 and the success envelope', async () => {
    const res = await request(createApp()).get('/api/v1/ping');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { pong: true } });
  });
});

// Protects: the npm workspace link to @meridio/contracts resolves from the API.
describe('workspace link', () => {
  it('imports @meridio/contracts', () => {
    expect(PRODUCT_NAME).toBe('StockFlow');
  });
});
