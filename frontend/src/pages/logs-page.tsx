/**
 * FILE: frontend/src/pages/logs-page.tsx
 * PURPOSE: /logs: the activity log as a paged, filterable table (by action and by product name/SKU):
 *          when, action, product, what changed, note and who.
 * LAYER: Page
 * USED BY: app/routes.tsx, linked from the sidebar "Logs" item and the feed's "View all"
 * DEPENDS ON: features/activity/hooks.ts, ui/table, ui/states
 * NOTES: Read-only. A basic log, not an audit trail. Newest first.
 */
import { listActivityQuerySchema, type ActivityAction } from '@meridio/contracts';
import { Diff, Pencil, Plus, Trash2, type LucideIcon } from 'lucide-react';
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { TableSkeleton } from '../components/ui/skeleton';
import { EmptyState, ErrorState } from '../components/ui/states';
import { Table, TBody, TD, TH, THead, TR } from '../components/ui/table';
import { useActivity } from '../features/activity/hooks';
import { PAGE_SIZES, Pagination } from '../features/products/pagination';
import { SearchInput } from '../features/products/search-input';
import { PageHeader } from '../layouts/page-header';
import { cn } from '../lib/cn';
import { formatDateTime, formatNumber } from '../lib/format';

const ACTIONS: Record<ActivityAction, { icon: LucideIcon; label: string }> = {
  PRODUCT_CREATED: { icon: Plus, label: 'Added' },
  PRODUCT_UPDATED: { icon: Pencil, label: 'Edited' },
  STOCK_ADJUSTED: { icon: Diff, label: 'Stock change' },
  PRODUCT_DELETED: { icon: Trash2, label: 'Deleted' },
};

/** Action filter options; `undefined` means every kind of change. */
const ACTION_FILTERS: { value: ActivityAction | undefined; label: string }[] = [
  { value: undefined, label: 'All' },
  { value: 'PRODUCT_CREATED', label: 'Added' },
  { value: 'PRODUCT_UPDATED', label: 'Edited' },
  { value: 'STOCK_ADJUSTED', label: 'Stock changes' },
  { value: 'PRODUCT_DELETED', label: 'Deleted' },
];

/**
 * All list state lives in the URL (?page=&limit=&action=&search=) so refresh, back and shared links
 * work. Paging and filtering are server-side.
 */
export function LogsPage() {
  const [params, setParams] = useSearchParams();

  // Parse through the same schema the API uses, so a hand-edited URL falls back safely.
  const parsed = listActivityQuerySchema.safeParse({
    page: params.get('page') ?? undefined,
    limit: params.get('limit') ?? undefined,
    action: params.get('action') ?? undefined,
    search: params.get('search') ?? undefined,
  });
  const q = parsed.success ? parsed.data : listActivityQuerySchema.parse({});
  const search = q.search ?? '';
  // Only the offered page sizes are honoured (the API default of 15 is not one of them).
  const limit = (PAGE_SIZES as readonly number[]).includes(q.limit) ? q.limit : PAGE_SIZES[0];
  const log = useActivity({
    page: q.page,
    limit,
    ...(q.action ? { action: q.action } : {}),
    ...(search ? { search } : {}),
  });
  const rows = log.data?.entries ?? [];
  const hasFilters = search !== '' || q.action !== undefined;

  const update = useCallback(
    (changes: Record<string, string | null>) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value === null || value === '') next.delete(key);
          else next.set(key, value);
        }
        return next;
      }),
    [setParams],
  );
  const onSearch = useCallback((value: string) => update({ search: value, page: null }), [update]);
  const onAction = (action: ActivityAction | undefined) =>
    update({ action: action ?? null, page: null });
  const onPage = (page: number) => update({ page: page <= 1 ? null : String(page) });
  const onPageSize = (size: number) => update({ limit: String(size), page: null });
  const clearFilters = () => update({ search: null, action: null, page: null });

  return (
    <>
      <PageHeader
        eyebrow="History"
        title="Logs"
        description="Recent changes to your products, with stock-adjustment notes."
        action={
          log.data ? (
            <Badge>
              {formatNumber(log.data.meta.total)} {log.data.meta.total === 1 ? 'entry' : 'entries'}
            </Badge>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="group" aria-label="Filter by action" className="flex flex-wrap gap-2">
          {ACTION_FILTERS.map(({ value, label }) => (
            <button
              key={label}
              type="button"
              aria-pressed={q.action === value}
              onClick={() => onAction(value)}
              className={cn(
                'rounded-sm border px-3 py-1.5 text-sm font-medium transition-colors',
                q.action === value
                  ? 'border-forest bg-forest text-on-forest'
                  : 'border-sandstone bg-paper text-graphite-soft hover:text-graphite',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <SearchInput value={search} onChange={onSearch} />
      </div>

      {log.isPending && <TableSkeleton rows={6} columns={5} />}
      {log.isError && (
        <ErrorState message="We could not load the logs." onRetry={() => void log.refetch()} />
      )}
      {log.data && rows.length === 0 && !hasFilters && (
        <EmptyState
          title="No activity yet"
          description="Adding, editing, adjusting or deleting a product will show up here."
        />
      )}
      {log.data && rows.length === 0 && hasFilters && (
        <EmptyState
          title="No log entries match"
          description="Try a different product name or SKU, or change the action filter."
          action={
            <Button variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      )}
      {log.data && rows.length > 0 && (
        <div
          aria-busy={log.isPlaceholderData}
          className={log.isPlaceholderData ? 'opacity-70 transition-opacity' : undefined}
        >
          <Table caption="Activity log">
            <THead>
              <TR>
                <TH>When</TH>
                <TH>Action</TH>
                <TH>Product</TH>
                <TH>Details</TH>
                <TH>By</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((e) => {
                const { icon: Icon, label } = ACTIONS[e.action];
                return (
                  <TR key={e.id}>
                    <TD>
                      <time dateTime={e.createdAt} className="text-xs whitespace-nowrap">
                        {formatDateTime(e.createdAt)}
                      </time>
                    </TD>
                    <TD>
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <Icon aria-hidden="true" className="size-3.5 text-graphite-soft" />
                        {label}
                      </span>
                    </TD>
                    <TD>
                      <p className="font-medium">{e.productName}</p>
                      <p className="font-data text-xs text-graphite-soft">{e.productSku}</p>
                    </TD>
                    <TD>
                      <p className="font-data text-sm">{e.summary}</p>
                      {e.note && (
                        <p className="mt-0.5 text-xs break-words text-graphite-soft italic">
                          “{e.note}”
                        </p>
                      )}
                    </TD>
                    <TD>
                      <span className="text-xs text-graphite-soft">{e.actorName ?? 'Unknown'}</span>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          <Pagination
            meta={log.data.meta}
            onPage={onPage}
            onPageSize={onPageSize}
            nouns={['entry', 'entries']}
          />
        </div>
      )}
    </>
  );
}
