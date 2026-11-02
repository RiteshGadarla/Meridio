/**
 * FILE: frontend/src/components/server-waking-notice.tsx
 * PURPOSE: A non-blocking banner shown while the API is slow to answer (free-tier cold start).
 * LAYER: UI
 * USED BY: app/providers.tsx
 * DEPENDS ON: lib/slow-requests.ts
 * NOTES: role="status" so assistive tech announces it politely. It never blocks interaction and
 *        disappears by itself when the slow request settles.
 */
import { useSyncExternalStore } from 'react';
import { hasSlowRequests, subscribeSlowRequests } from '../lib/slow-requests';

export function ServerWakingNotice() {
  const slow = useSyncExternalStore(subscribeSlowRequests, hasSlowRequests, () => false);
  if (!slow) return null;
  return (
    <div
      role="status"
      className="fixed top-4 left-1/2 z-[70] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 rounded-sm border border-sandstone bg-paper px-4 py-3 text-sm text-graphite shadow-overlay"
    >
      <p className="font-medium">Waking up the server</p>
      <p className="mt-0.5 text-graphite-soft">
        This can take up to a minute the first time after a quiet period. Thanks for waiting.
      </p>
    </div>
  );
}
