/**
 * FILE: frontend/src/lib/wake-backend.test.ts
 * PURPOSE: Tests for the cold-start wake-up ping.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { wakeBackend } from './wake-backend';

// Protects: the ping hits the relative health endpoint and can never break the app.
describe('wakeBackend', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('calls the relative readiness endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    await wakeBackend();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/health/ready',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('swallows network errors (why: a failed ping must never surface to the user)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(wakeBackend()).resolves.toBeUndefined();
  });
});
