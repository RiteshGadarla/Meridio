/**
 * FILE: frontend/src/features/products/pagination.tsx
 * PURPOSE: Previous/next controls driven entirely by API pagination meta (server-side paging).
 * LAYER: Feature UI
 * USED BY: pages/products-page.tsx
 */
import type { PaginationMeta } from '@meridio/contracts';
import { Button } from '../../components/ui/button';
import { formatNumber } from '../../lib/format';

/** Rows-per-page options (the most rows one page may hold). */
export const PAGE_SIZES = [10, 25, 50] as const;

export function Pagination({
  meta,
  onPage,
  onPageSize,
}: {
  meta: PaginationMeta;
  onPage: (page: number) => void;
  /** When given, shows the rows-per-page selector. */
  onPageSize?: (size: number) => void;
}) {
  const pages = Math.max(meta.totalPages, 1);
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-4 text-sm">
      {onPageSize && (
        <label className="hidden items-center gap-2 text-graphite-soft sm:inline-flex">
          Rows per page
          <select
            value={meta.limit}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className="h-8 rounded-sm border border-sandstone bg-paper px-2 text-sm text-graphite"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="font-data text-graphite-soft">
        Page {meta.page} of {pages} · {formatNumber(meta.total)}{' '}
        {meta.total === 1 ? 'product' : 'products'}
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={meta.page <= 1}
          onClick={() => onPage(meta.page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={meta.page >= pages}
          onClick={() => onPage(meta.page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
