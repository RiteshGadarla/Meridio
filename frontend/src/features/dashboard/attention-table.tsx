/**
 * FILE: frontend/src/features/dashboard/attention-table.tsx
 * PURPOSE: "Inventory attention" table: products at or below their threshold.
 * LAYER: Feature UI
 * USED BY: pages/dashboard-page.tsx
 * NOTES: The whole row is clickable for pointer users; the Edit link is the keyboard/screen reader
 *        path to the same place. Status and threshold come from the API (never recomputed here).
 */
import type { ProductDto } from '@meridio/contracts';
import { ArrowDown, ArrowUp, ChevronRight, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../../components/ui/badge';
import { Table, TBody, TD, TH, THead, TR } from '../../components/ui/table';
import { cn } from '../../lib/cn';
import { ThresholdCell, ThresholdLegend } from '../../components/threshold-cell';
import { formatNumber } from '../../lib/format';
import { ProductInfoDialog } from './product-info-dialog';

const QTY_COLOR: Record<ProductDto['stockStatus'], string> = {
  HEALTHY: 'text-graphite',
  LOW_STOCK: 'text-status-low-ink',
  OUT_OF_STOCK: 'text-status-out-ink',
};

const RAIL_COLOR: Record<ProductDto['stockStatus'], string> = {
  HEALTHY: 'border-l-status-healthy',
  LOW_STOCK: 'border-l-status-low',
  OUT_OF_STOCK: 'border-l-status-out',
};

/** Columns the dashboard table can be sorted by. */
export type AttentionSortKey = 'name' | 'sku' | 'quantity' | 'threshold' | 'status';
export interface AttentionSort {
  key: AttentionSortKey;
  order: 'asc' | 'desc';
}

function SortHeader({
  label,
  field,
  sort,
  sortable,
  onSort,
  numeric,
  className,
}: {
  label: string;
  field: AttentionSortKey;
  sort: AttentionSort | null;
  sortable: readonly AttentionSortKey[];
  onSort: (key: AttentionSortKey) => void;
  numeric?: boolean;
  className?: string;
}) {
  // A column the current data source cannot sort (server-side views) renders as plain text.
  if (!sortable.includes(field)) {
    return (
      <TH numeric={numeric} className={className}>
        {label}
      </TH>
    );
  }
  const active = sort?.key === field;
  const Icon = !active ? ChevronsUpDown : sort?.order === 'asc' ? ArrowUp : ArrowDown;
  return (
    <TH
      numeric={numeric}
      className={className}
      aria-sort={active ? (sort?.order === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1 rounded-xs uppercase hover:text-graphite"
      >
        {label}
        <Icon aria-hidden="true" className="size-3" />
      </button>
    </TH>
  );
}

export function AttentionTable({
  products,
  sort,
  sortable,
  onSort,
}: {
  products: ProductDto[];
  sort: AttentionSort | null;
  sortable: readonly AttentionSortKey[];
  onSort: (key: AttentionSortKey) => void;
}) {
  const [selected, setSelected] = useState<ProductDto | null>(null);
  return (
    <>
      <ThresholdLegend />
      <Table caption="Products that need attention" className="min-w-[44rem]" centered>
        <THead>
          <TR className="hover:bg-transparent">
            <SortHeader
              label="Product"
              field="name"
              className="pl-5"
              {...{ sort, sortable, onSort }}
            />
            <SortHeader label="SKU" field="sku" {...{ sort, sortable, onSort }} />
            <SortHeader label="Quantity" field="quantity" numeric {...{ sort, sortable, onSort }} />
            <SortHeader
              label="Threshold"
              field="threshold"
              numeric
              {...{ sort, sortable, onSort }}
            />
            <SortHeader
              label="Status"
              field="status"

              {...{ sort, sortable, onSort }}
            />
            <TH>
              <span className="sr-only">Actions</span>
            </TH>
          </TR>
        </THead>
        <TBody>
          {products.map((p) => {
            const editPath = `/products?edit=${encodeURIComponent(p.id)}`;
            return (
              <TR key={p.id} className="group cursor-pointer" onClick={() => setSelected(p)}>
                {/* Left rail repeats the status colour; the badge text/marker carry the meaning. */}
                <TD
                  className={cn('border-l-[3px] py-4 pl-4 font-medium', RAIL_COLOR[p.stockStatus])}
                >
                  {/* Keyboard path to the same pop-up the row click opens. */}
                  <button
                    type="button"
                    onClick={() => setSelected(p)}
                    aria-label={`View details for ${p.name}`}
                    className="rounded-xs font-medium hover:underline"
                  >
                    {p.name}
                  </button>
                </TD>
                <TD mono className="text-graphite-soft">
                  {p.sku}
                </TD>
                <TD numeric className={cn('text-base font-medium', QTY_COLOR[p.stockStatus])}>
                  {formatNumber(p.quantityOnHand)}
                </TD>
                <TD numeric>
                  <ThresholdCell product={p} />
                </TD>
                <TD>
                  <StatusBadge status={p.stockStatus} />
                </TD>
                <TD>
                  <Link
                    to={editPath}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Edit ${p.name}`}
                    className="inline-flex items-center gap-1 rounded-sm border border-sandstone px-2.5 py-1 text-sm font-medium text-brand transition-colors group-hover:border-brand/40 hover:bg-sandstone/50"
                  >
                    Edit
                    <ChevronRight aria-hidden="true" className="size-3.5" />
                  </Link>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
      <ProductInfoDialog product={selected} onClose={() => setSelected(null)} />
    </>
  );
}
