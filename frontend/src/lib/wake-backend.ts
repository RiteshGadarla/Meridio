/**
 * FILE: frontend/src/lib/wake-backend.ts
 * PURPOSE: Fire-and-forget ping that wakes the sleeping API (Render) and database (Neon) as soon as
 *          any page, including the public intro page, is opened.
 * LAYER: Library
 * USED BY: main.tsx
 * NOTES: WHY: the free Render tier sleeps after inactivity and a cold start can take ~1 minute.
 *        Pinging on first load means the server is usually awake by the time the visitor signs in.
 *        /health/ready is used (not /live) because it also runs SELECT 1, waking Neon.
 */

/**
 * Sends one background GET to the readiness endpoint. Never throws and never blocks rendering.
 * @returns a promise that always resolves (useful only for tests)
 */
export async function wakeBackend(): Promise<void> {
  try {
    // keepalive lets the request finish even if the visitor navigates away immediately.
    await fetch('/api/v1/health/ready', { method: 'GET', cache: 'no-store', keepalive: true });
  } catch {
    // EDGE CASE: offline or server still booting. The ping is best-effort; real requests retry normally.
  }
}
