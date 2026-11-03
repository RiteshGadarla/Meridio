/**
 * FILE: frontend/src/features/activity/activity-feed.tsx
 * PURPOSE: "Recent activity" list for the sidebar: who added, edited, adjusted or deleted what,
 *          with the stock-adjust note, newest first.
 * LAYER: Feature UI
 * USED BY: layouts/app-shell.tsx
 * DEPENDS ON: features/activity/hooks.ts, lib/format.ts
 * NOTES: Sits on the dark sidebar surface, so it uses on-forest text tokens. Each action has its own
 *        icon shape in addition to its words (never colour alone). Fails quietly: the feed is a
 *        convenience and must not add an error banner to the sidebar.
 */
import type { ActivityAction } from '@meridio/contracts';
import { Diff, Pencil, Plus, Trash2, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatRelativeTime } from '../../lib/format';
import { useActivity } from './hooks';

const ICONS: Record<ActivityAction, { icon: LucideIcon; label: string }> = {
  PRODUCT_CREATED: { icon: Plus, label: 'Added' },
  PRODUCT_UPDATED: { icon: Pencil, label: 'Edited' },
  STOCK_ADJUSTED: { icon: Diff, label: 'Stock change' },
  PRODUCT_DELETED: { icon: Trash2, label: 'Deleted' },
};

/** Most entries the sidebar ever shows; shorter screens show fewer (only what fully fits). */
const FEED_SIZE = 5;

export function ActivityFeed() {
  const { data: result, isPending, isError } = useActivity({ page: 1, limit: FEED_SIZE });
  const data = result?.entries;
  if (isError) return null;

  return (
    <section
      aria-labelledby="activity-heading"
      className="mt-6 flex min-h-0 flex-1 flex-col border-t border-on-forest/10 px-3 pt-4 pb-4"
    >
      <div className="flex items-baseline justify-between px-3">
        <h2
          id="activity-heading"
          className="text-[0.6875rem] font-semibold tracking-[0.14em] text-on-forest/60 uppercase"
        >
          Recent activity
        </h2>
        <Link
          to="/logs"
          className="text-xs text-on-forest/75 underline underline-offset-2 hover:text-white"
        >
          View all
        </Link>
      </div>
      {isPending && (
        <p role="status" className="px-3 py-3 text-xs text-on-forest/60">
          Loading…
        </p>
      )}
      {data && data.length === 0 && (
        <p className="px-3 py-3 text-xs text-on-forest/60">
          Changes to your products will appear here.
        </p>
      )}
      {data && data.length > 0 && (
        /* WHY a wrapping column: the list gets the height that is left; entries that do not fully fit
            wrap into a second column that overflow-hidden clips, so we never show a half-cut entry
            or a scrollbar. The Logs page has everything. */
        <ul className="mt-2 flex min-h-0 flex-1 flex-col flex-wrap content-start overflow-hidden">
          {data.map((entry) => {
            const { icon: Icon, label } = ICONS[entry.action];
            return (
              <li key={entry.id} className="flex w-full shrink-0 gap-2.5 rounded-sm px-3 py-2">
                <Icon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-on-forest/60" />
                <div className="min-w-0 text-xs">
                  <p className="truncate font-medium text-white" title={entry.productName}>
                    <span className="sr-only">{label}: </span>
                    {entry.productName}
                  </p>
                  <p className="font-data text-on-forest/75">{entry.summary}</p>
                  {entry.note && (
                    <p className="mt-0.5 break-words text-on-forest/75 italic">“{entry.note}”</p>
                  )}
                  <p className="mt-0.5 text-on-forest/55">
                    <time dateTime={entry.createdAt}>{formatRelativeTime(entry.createdAt)}</time>
                    {entry.actorName ? ` · ${entry.actorName}` : ''}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
