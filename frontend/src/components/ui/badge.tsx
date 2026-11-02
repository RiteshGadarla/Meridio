/**
 * FILE: frontend/src/components/ui/badge.tsx
 * PURPOSE: Badge (neutral label) and StatusBadge (stock status pill with marker + text).
 * LAYER: UI primitive
 * USED BY: product table, dashboard, product form
 * NOTES: Never relies on colour alone: each status has a distinct marker SHAPE and a text label.
 *        BUSINESS RULE: the status itself is computed by the API; this only renders it.
 */
import type { StockStatus } from '@meridio/contracts';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

/** Small neutral label (for example a count). */
export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-xs border border-sandstone bg-paper px-1.5 py-0.5 text-xs font-medium text-graphite-soft',
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATUS: Record<StockStatus, { label: string; classes: string }> = {
  HEALTHY: { label: 'Healthy', classes: 'bg-status-healthy-tint text-[#2f6249]' },
  LOW_STOCK: { label: 'Low stock', classes: 'bg-status-low-tint text-[#8a5320]' },
  OUT_OF_STOCK: { label: 'Out of stock', classes: 'bg-status-out-tint text-[#8f3a31]' },
};

/** 12px square marker: filled = healthy, half-filled = low, hollow with diagonal = out. */
function Marker({ status }: { status: StockStatus }) {
  return (
    <svg viewBox="0 0 12 12" className="size-3 shrink-0" aria-hidden="true" data-marker={status}>
      <rect
        x="0.75"
        y="0.75"
        width="10.5"
        height="10.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {status === 'HEALTHY' && (
        <rect x="0.75" y="0.75" width="10.5" height="10.5" fill="currentColor" />
      )}
      {status === 'LOW_STOCK' && (
        <rect x="0.75" y="6" width="10.5" height="5.25" fill="currentColor" />
      )}
      {status === 'OUT_OF_STOCK' && (
        <line x1="1" y1="11" x2="11" y2="1" stroke="currentColor" strokeWidth="1.5" />
      )}
    </svg>
  );
}

/**
 * Stock status pill.
 * @example <StatusBadge status={product.stockStatus} />
 */
export function StatusBadge({ status, className }: { status: StockStatus; className?: string }) {
  const { label, classes } = STATUS[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-xs px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        classes,
        className,
      )}
    >
      <Marker status={status} />
      {label}
    </span>
  );
}
