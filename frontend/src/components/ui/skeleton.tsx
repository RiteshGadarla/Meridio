/**
 * FILE: frontend/src/components/ui/skeleton.tsx
 * PURPOSE: Loading placeholders: Skeleton, TableSkeleton, MetricSkeleton.
 * LAYER: UI primitive
 * USED BY: dashboard, products list while loading
 * NOTES: Subtle opacity pulse (not a bright shimmer). Placeholders are aria-hidden; the busy
 *        region should carry aria-busy / a visible loading label.
 */
import { cn } from '../../lib/cn';
import { Table, TBody, TD, TH, THead, TR } from './table';

/** A grey block. Size it with className (for example "h-4 w-32"). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('animate-shimmer rounded-xs bg-sandstone', className)} />
  );
}

/** Table-shaped placeholder with the same column count as the real table. */
export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading">
      <Table aria-hidden="true">
        <THead>
          <TR>
            {Array.from({ length: columns }, (_, c) => (
              <TH key={c}>
                <Skeleton className="h-3 w-16" />
              </TH>
            ))}
          </TR>
        </THead>
        <TBody>
          {Array.from({ length: rows }, (_, r) => (
            <TR key={r}>
              {Array.from({ length: columns }, (_, c) => (
                <TD key={c}>
                  <Skeleton className={cn('h-4', c === 0 ? 'w-40' : 'w-16')} />
                </TD>
              ))}
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}

/** Placeholder for one dashboard metric. */
export function MetricSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      className="border-t border-sandstone pt-4"
    >
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-8 w-20" />
    </div>
  );
}
