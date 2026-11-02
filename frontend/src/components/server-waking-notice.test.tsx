/**
 * FILE: frontend/src/components/server-waking-notice.test.tsx
 * PURPOSE: Tests the cold-start notice: appears after 5s of a pending request, disappears on settle.
 * LAYER: Test (fake timers; fetch is stubbed, no network)
 */
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../lib/api-client';
import { SLOW_AFTER_MS, hasSlowRequests, trackRequest } from '../lib/slow-requests';
import { ServerWakingNotice } from './server-waking-notice';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** A fetch whose response we resolve by hand, to simulate a sleeping server. */
function pendingFetch() {
  let resolve!: (r: Response) => void;
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>((r) => (resolve = r))),
  );
  return {
    respond: () => resolve(new Response(JSON.stringify({ data: { ok: true } }), { status: 200 })),
  };
}

// Protects: users on a sleeping free-tier server see an explanation instead of a frozen screen.
describe('ServerWakingNotice', () => {
  it('stays hidden for fast requests', async () => {
    const server = pendingFetch();
    render(<ServerWakingNotice />);
    const call = api.get('/products');
    await act(() => vi.advanceTimersByTimeAsync(SLOW_AFTER_MS - 100));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    server.respond();
    await act(async () => void (await call));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('appears after 5s of a pending request and disappears when it settles', async () => {
    const server = pendingFetch();
    render(<ServerWakingNotice />);
    const call = api.get('/products');

    await act(() => vi.advanceTimersByTimeAsync(SLOW_AFTER_MS + 10));
    expect(screen.getByRole('status')).toHaveTextContent('Waking up the server');
    expect(screen.getByRole('status')).toHaveTextContent('up to a minute');

    server.respond();
    await act(async () => void (await call));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('also clears when the slow request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise((_, reject) => setTimeout(() => reject(new TypeError('x')), 6000))),
    );
    render(<ServerWakingNotice />);
    const call = api.get('/products').catch(() => 'failed');
    await act(() => vi.advanceTimersByTimeAsync(5500));
    expect(screen.getByRole('status')).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(await call).toBe('failed');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

// Protects: the counter never drifts, so the notice cannot get stuck on or off.
describe('trackRequest', () => {
  it('counts several slow requests and ignores a double settle', async () => {
    const a = trackRequest();
    const b = trackRequest();
    await vi.advanceTimersByTimeAsync(SLOW_AFTER_MS + 1);
    expect(hasSlowRequests()).toBe(true);
    a();
    a(); // second call must not decrement again
    expect(hasSlowRequests()).toBe(true);
    b();
    expect(hasSlowRequests()).toBe(false);
  });
});
