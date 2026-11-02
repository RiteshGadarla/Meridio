/**
 * FILE: frontend/src/lib/slow-requests.ts
 * PURPOSE: Tracks API requests that are taking unusually long, so the UI can say "waking up the
 *          server" instead of looking frozen.
 * LAYER: Library (tiny external store)
 * USED BY: lib/api-client.ts (begins/ends tracking), components/server-waking-notice.tsx (reads it)
 * NOTES: WHY: the free Render tier sleeps after inactivity, and the first request afterwards can
 *        take up to about a minute. Only requests still pending after SLOW_AFTER_MS count.
 */

/** A request still pending after this long is considered "slow". */
export const SLOW_AFTER_MS = 5000;

let slowCount = 0;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

/** useSyncExternalStore subscribe function. */
export function subscribeSlowRequests(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** True while at least one request has been pending longer than SLOW_AFTER_MS. */
export function hasSlowRequests(): boolean {
  return slowCount > 0;
}

/**
 * Starts watching one request.
 * @returns a function to call when the request settles (success, error or abort)
 * @example const done = trackRequest(); try { await fetch(...) } finally { done(); }
 */
export function trackRequest(): () => void {
  let flagged = false;
  let finished = false;
  const timer = setTimeout(() => {
    if (finished) return;
    flagged = true;
    slowCount += 1;
    emit();
  }, SLOW_AFTER_MS);

  return () => {
    if (finished) return; // EDGE CASE: settling twice must not corrupt the counter
    finished = true;
    clearTimeout(timer);
    if (flagged) {
      slowCount -= 1;
      emit();
    }
  };
}
