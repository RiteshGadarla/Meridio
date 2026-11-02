/**
 * FILE: frontend/src/features/dashboard/attention-table.tsx
 * PURPOSE: "Inventory attention" table: products at or below their threshold.
 * LAYER: Feature UI
 * USED BY: pages/dashboard-page.tsx
 * NOTES: The whole row is clickable for pointer users; the Edit link is the keyboard/screen reader
 *        path to the same place. Status and threshold come from the API (never recomputed here).
 */
import type { ProductDto } from '@meridio/contracts';
import { Link, useNavigate } from 'react-router-dom';
import { StatusBadge } from '../../components/ui/badge';
import { Table, TBody, TD, TH, THead, TR } from '../../components/ui/table';
import { formatNumber } from '../../lib/format';

export function AttentionTable({ products }: { products: ProductDto[] }) {
  const navigate = useNavigate();
  return (
    <Table caption="Products that need attention">
      <THead>
        <TR>
          <TH>Product</TH>
          <TH>SKU</TH>
          <TH numeric>Quantity</TH>
          <TH numeric>Threshold</TH>
          <TH>Status</TH>
          <TH>
            <span className="sr-only">Actions</span>
          </TH>
        </TR>
      </THead>
      <TBody>
        {products.map((p) => {
          const editPath = `/products?edit=${encodeURIComponent(p.id)}`;
          return (
            <TR key={p.id} className="cursor-pointer" onClick={() => navigate(editPath)}>
              <TD className="font-medium">{p.name}</TD>
              <TD mono>{p.sku}</TD>
              <TD numeric>{formatNumber(p.quantityOnHand)}</TD>
              <TD numeric>
                {formatNumber(p.effectiveThreshold)}
                {/* A null product threshold means the value is inherited from the org default. */}
                {p.lowStockThreshold === null && (
                  <span className="ml-2 rounded-xs border border-sandstone px-1 py-0.5 font-sans text-[0.6875rem] text-graphite-soft">
                    default
                  </span>
                )}
              </TD>
              <TD>
                <StatusBadge status={p.stockStatus} />
              </TD>
              <TD>
                <Link
                  to={editPath}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Edit ${p.name}`}
                  className="text-sm font-medium text-forest underline underline-offset-4"
                >
                  Edit
                </Link>
              </TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}
