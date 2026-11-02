/**
 * FILE: frontend/src/features/dashboard/kpi-cards.tsx
 * PURPOSE: The three headline KPI cards: Total Products, Total Units, Low Stock Products.
 * LAYER: Feature UI
 * USED BY: pages/dashboard-page.tsx
 * NOTES: Exactly three cards. Restrained by design: 1px sandstone border, no shadow, no gradient,
 *        a small plain icon (no coloured circle), mono numerals, and a one-line caption that says
 *        what the number means. Only Low Stock takes emphasis (amber number + copper top rule),
 *        and only when its count is above 0. Semantics stay a description list (term + value).
 */
import { AlertTriangle, Boxes, Package, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';
import { formatNumber } from '../../lib/format';

interface KpiCardProps {
  label: string;
  value: number;
  caption: string;
  icon: LucideIcon;
  /** Amber number and copper top rule. */
  emphasis?: boolean;
}

function KpiCard({ label, value, caption, icon: Icon, emphasis = false }: KpiCardProps) {
  return (
    <div
      className={cn(
        'rounded-sm border border-t-2 border-sandstone bg-paper px-5 py-4',
        emphasis ? 'border-t-copper' : 'border-t-sandstone',
      )}
    >
      <div className="flex items-center justify-between">
        <dt className="text-xs font-semibold tracking-wide text-graphite-soft uppercase">
          {label}
        </dt>
        <Icon aria-hidden="true" className="size-4 text-graphite-soft" />
      </div>
      <dd
        data-emphasis={emphasis || undefined}
        className={cn(
          'font-data mt-3 text-3xl font-medium',
          emphasis ? 'text-status-low' : 'text-graphite',
        )}
      >
        {formatNumber(value)}
      </dd>
      <p className="mt-1 text-xs text-graphite-soft">{caption}</p>
    </div>
  );
}

export function KpiCards({
  totalProducts,
  totalUnits,
  lowStockCount,
}: {
  totalProducts: number;
  totalUnits: number;
  lowStockCount: number;
}) {
  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <KpiCard
        label="Total Products"
        value={totalProducts}
        caption="Distinct items in your catalogue"
        icon={Package}
      />
      <KpiCard
        label="Total Units"
        value={totalUnits}
        caption="Units on hand across all products"
        icon={Boxes}
      />
      {/* BUSINESS RULE: low stock includes out-of-stock items (quantity <= threshold). */}
      <KpiCard
        label="Low Stock Products"
        value={lowStockCount}
        caption="At or below threshold, incl. out of stock"
        icon={AlertTriangle}
        emphasis={lowStockCount > 0}
      />
    </dl>
  );
}
