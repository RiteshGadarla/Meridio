/**
 * FILE: frontend/src/components/threshold-cell.tsx
 * PURPOSE: The low-stock threshold as a number with a source symbol (building = organization
 *          default, pin = the product's own), and the legend that explains the symbols.
 * LAYER: UI
 * USED BY: features/dashboard/attention-table.tsx, features/products/product-table.tsx
 * NOTES: BUSINESS RULE: the effective threshold comes from the API; this only displays it.
 */
import type { ProductDto } from '@meridio/contracts';
import { Building2, Pin } from 'lucide-react';
import { cn } from '../lib/cn';
import { formatNumber } from '../lib/format';

/**
 * Threshold as a bare number with a source symbol beside it (explained by the legend under the
 * table): a building = inherited from the organization default, a pin = this product's own value.
 * The symbol also has a tooltip and screen-reader text, so it never relies on shape alone.
 */
export function ThresholdCell({ product: p }: { product: ProductDto }) {
  const inherited = p.lowStockThreshold === null;
  const Icon = inherited ? Building2 : Pin;
  const text = inherited ? 'Org default' : 'Custom';
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span title={inherited ? 'Organization default' : "This product's own threshold"}>
        <Icon
          aria-hidden="true"
          className={cn('size-4', inherited ? 'text-copper-deep' : 'text-graphite-soft')}
        />
        <span className="sr-only">{text}</span>
      </span>
      <span className="min-w-6 text-right">{formatNumber(p.effectiveThreshold)}</span>
    </span>
  );
}

/** Key for the threshold symbols; sits outside (above) the table. */
export function ThresholdLegend() {
  return (
    <p className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-graphite-soft">
      <span className="font-semibold tracking-wide uppercase">Threshold</span>
      <span className="inline-flex items-center gap-1.5">
        <Building2 aria-hidden="true" className="size-4 text-copper-deep" />
        Organization default (change it in Settings)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Pin aria-hidden="true" className="size-4" />
        Set on this product
      </span>
    </p>
  );
}
