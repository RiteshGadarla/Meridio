/**
 * FILE: frontend/src/features/products/product-table.tsx
 * PURPOSE: Product list table with sortable headers and Edit/Delete actions.
 * LAYER: Feature UI
 * USED BY: pages/products-page.tsx
 * NOTES: Columns: Product, SKU, Quantity, Stock status, Selling price, Actions. On narrow screens
 *        the table scrolls horizontally and the SKU is also shown under the product name.
 */
import type { ProductDto, ProductSortField } from '@meridio/contracts';
import { ArrowDown, ArrowUp, ChevronsUpDown, Pencil, Diff, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ThresholdCell } from '../../components/threshold-cell';
import { StatusBadge } from '../../components/ui/badge';
import { Table, TBody, TD, TH, THead, TR } from '../../components/ui/table';
import { formatNumber } from '../../lib/format';
import { useMoney } from '../../lib/use-money';

interface SortHeaderProps {
  label: string;
  field: ProductSortField;
  sort: ProductSortField;
  order: 'asc' | 'desc';
  numeric?: boolean;
  onSort: (field: ProductSortField) => void;
}

function SortHeader({ label, field, sort, order, numeric, onSort }: SortHeaderProps) {
  const active = sort === field;
  const Icon = !active ? ChevronsUpDown : order === 'asc' ? ArrowUp : ArrowDown;
  return (
    <TH
      numeric={numeric}
      aria-sort={active ? (order === 'asc' ? 'ascending' : 'descending') : 'none'}
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

export interface ProductTableProps {
  products: ProductDto[];
  sort: ProductSortField;
  order: 'asc' | 'desc';
  onSort: (field: ProductSortField) => void;
  onAdjust: (product: ProductDto) => void;
  onDelete: (product: ProductDto) => void;
}

export function ProductTable({
  products,
  sort,
  order,
  onSort,
  onAdjust,
  onDelete,
}: ProductTableProps) {
  const money = useMoney();
  return (
    <Table caption="Products" centered>
      <THead>
        <TR>
          <SortHeader label="Product" field="name" sort={sort} order={order} onSort={onSort} />
          <SortHeader label="SKU" field="sku" sort={sort} order={order} onSort={onSort} />
          <SortHeader
            label="Quantity"
            field="quantityOnHand"
            sort={sort}
            order={order}
            numeric
            onSort={onSort}
          />
          <TH numeric>Threshold</TH>
          <TH>Stock status</TH>
          <SortHeader
            label="Selling price"
            field="sellingPrice"
            sort={sort}
            order={order}
            numeric
            onSort={onSort}
          />
          <TH>
            <span className="sr-only">Actions</span>
          </TH>
        </TR>
      </THead>
      <TBody>
        {products.map((p) => (
          <TR key={p.id}>
            <TD>
              <p className="font-medium">{p.name}</p>
              <p className="font-data mt-0.5 text-xs text-graphite-soft sm:hidden">{p.sku}</p>
              {p.description && (
                <p className="mt-0.5 mx-auto line-clamp-1 max-w-xs text-xs text-graphite-soft">
                  {p.description}
                </p>
              )}
            </TD>
            <TD mono>{p.sku}</TD>
            <TD numeric>{formatNumber(p.quantityOnHand)}</TD>
            <TD numeric>
              <ThresholdCell product={p} />
            </TD>
            <TD>
              <StatusBadge status={p.stockStatus} />
            </TD>
            <TD numeric>{money(p.sellingPrice)}</TD>
            <TD>
              <div className="flex justify-center gap-1">
                <button
                  type="button"
                  aria-label={`Adjust stock for ${p.name}`}
                  onClick={() => onAdjust(p)}
                  className="rounded-sm p-2 text-graphite-soft hover:bg-sandstone/60 hover:text-graphite"
                >
                  <Diff aria-hidden="true" className="size-4" />
                </button>
                <Link
                  to={`/products?edit=${encodeURIComponent(p.id)}`}
                  aria-label={`Edit ${p.name}`}
                  className="rounded-sm p-2 text-graphite-soft hover:bg-sandstone/60 hover:text-graphite"
                >
                  <Pencil aria-hidden="true" className="size-4" />
                </Link>
                <button
                  type="button"
                  aria-label={`Delete ${p.name}`}
                  onClick={() => onDelete(p)}
                  className="rounded-sm p-2 text-graphite-soft hover:bg-status-out-tint hover:text-status-out"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              </div>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
