/**
 * FILE: frontend/src/features/products/pagination.tsx
 * PURPOSE: Previous/next controls driven entirely by API pagination meta (server-side paging).
 * LAYER: Feature UI
 * USED BY: pages/products-page.tsx
 */
import type { PaginationMeta } from '@meridio/contracts';
import { Button } from '../../components/ui/button';
import { formatNumber } from '../../lib/format';

export function Pagination({
  meta,
  onPage,
}: {
  meta: PaginationMeta;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(meta.totalPages, 1);
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-4 text-sm">
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
