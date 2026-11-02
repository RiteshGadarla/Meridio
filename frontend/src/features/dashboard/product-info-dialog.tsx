/**
 * FILE: frontend/src/features/dashboard/product-info-dialog.tsx
 * PURPOSE: Read-only "product card" pop-up (styled like an ID card) opened from a dashboard row.
 * LAYER: Feature UI
 * USED BY: features/dashboard/attention-table.tsx
 * DEPENDS ON: components/ui/overlay.tsx, components/threshold-cell.tsx, components/logo.tsx
 * NOTES: Shows only what the API already returned for the row (no extra request). Editing stays
 *        on /products via the "Edit product" link, so there is one place that changes data.
 *        BUSINESS RULE: the status and effective threshold come from the API; the stock-level
 *        meter and "units above/below" line only visualise them, they never decide the status.
 */
import type { ProductDto } from '@meridio/contracts';
import { Package, X } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LogoMark } from '../../components/logo';
import { ThresholdCell } from '../../components/threshold-cell';
import { StatusBadge } from '../../components/ui/badge';
import { buttonStyles } from '../../components/ui/button';
import { Overlay } from '../../components/ui/overlay';
import { cn } from '../../lib/cn';
import { formatNumber } from '../../lib/format';
import { useMoney } from '../../lib/use-money';

const dateTime = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });

type Status = ProductDto['stockStatus'];

const ACCENT: Record<Status, string> = {
  HEALTHY: 'bg-status-healthy',
  LOW_STOCK: 'bg-status-low',
  OUT_OF_STOCK: 'bg-status-out',
};
const INK: Record<Status, string> = {
  HEALTHY: 'text-status-healthy-ink',
  LOW_STOCK: 'text-status-low-ink',
  OUT_OF_STOCK: 'text-status-out-ink',
};

function Label({ children }: { children: ReactNode }) {
  return (
    <span className="text-[0.6875rem] font-semibold tracking-[0.14em] text-graphite-soft uppercase">
      {children}
    </span>
  );
}

/**
 * Horizontal meter: fill = quantity on hand, tick = effective threshold. Scale runs to 120% of
 * the larger of the two so neither ever sits on the far edge.
 */
function StockMeter({ product: p }: { product: ProductDto }) {
  const scale = Math.max(p.quantityOnHand, p.effectiveThreshold, 1) * 1.2;
  const fill = (p.quantityOnHand / scale) * 100;
  const tick = (p.effectiveThreshold / scale) * 100;
  const diff = p.quantityOnHand - p.effectiveThreshold;
  const note =
    p.quantityOnHand === 0
      ? 'No units left'
      : diff > 0
        ? `${formatNumber(diff)} above threshold`
        : diff === 0
          ? 'At threshold'
          : `${formatNumber(-diff)} below threshold`;
  return (
    <div>
      <div className="relative h-2 bg-sandstone" aria-hidden="true">
        <div
          className={cn('absolute inset-y-0 left-0', ACCENT[p.stockStatus])}
          style={{ width: `${fill}%` }}
        />
        <div
          className="absolute -top-1.5 -bottom-1.5 w-0.5 bg-graphite"
          style={{ left: `${tick}%` }}
        />
      </div>
      <p className="mt-2 flex justify-between text-xs">
        <span className={cn('font-medium', INK[p.stockStatus])}>{note}</span>
        <span className="text-graphite-soft">Tick = threshold</span>
      </p>
    </div>
  );
}

/** Selling price minus cost as a share of the selling price; null when it cannot be computed. */
function marginPercent(p: ProductDto): number | null {
  const cost = Number(p.costPrice);
  const sell = Number(p.sellingPrice);
  if (p.costPrice === null || p.sellingPrice === null || !(sell > 0) || !Number.isFinite(cost)) {
    return null;
  }
  return Math.round(((sell - cost) / sell) * 100);
}

/**
 * @param product the row that was clicked, or null when closed
 * @example <ProductInfoDialog product={selected} onClose={() => setSelected(null)} />
 */
export function ProductInfoDialog({
  product,
  onClose,
}: {
  product: ProductDto | null;
  onClose: () => void;
}) {
  const titleId = useId();
  const money = useMoney();
  const margin = product ? marginPercent(product) : null;
  return (
    <Overlay
      open={product !== null}
      onClose={onClose}
      labelledBy={titleId}
      wrapperClassName="items-center justify-center p-4"
      panelClassName="animate-fade-in w-full max-w-md overflow-hidden rounded-md border border-sandstone"
    >
      {product && (
        <>
          {/* ===== Header band: brand, card type, close ===== */}
          <div className="relative flex items-center justify-between gap-4 bg-sidebar py-3 pr-4 pl-6 text-on-forest">
            <span className={cn('absolute inset-y-0 left-0 w-1.5', ACCENT[product.stockStatus])} />
            <div className="flex items-center gap-2.5">
              <LogoMark className="size-5" />
              <span className="text-sm font-semibold tracking-tight">StockFlow</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="rounded-sm p-1.5 text-on-forest/80 hover:bg-sidebar-soft hover:text-white"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>

          {/* ===== Identity: photo slot + name, SKU, status ===== */}
          <div className="flex gap-5 px-6 pt-6">
            <div
              aria-hidden="true"
              className="flex size-20 shrink-0 items-center justify-center rounded-sm bg-sidebar text-on-forest"
            >
              <Package className="size-9" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <h2
                id={titleId}
                className="text-2xl leading-tight font-semibold tracking-tight break-words text-graphite"
              >
                {product.name}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="font-data rounded-xs border border-sandstone bg-limestone/60 px-2 py-0.5 text-sm">
                  {product.sku}
                </p>
                <StatusBadge status={product.stockStatus} />
              </div>
            </div>
          </div>
          {product.description && (
            <p className="mt-4 px-6 text-sm text-graphite-soft">{product.description}</p>
          )}

          {/* ===== Stock level ===== */}
          <section className="mx-6 mt-5 border-t border-sandstone pt-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <Label>Quantity on hand</Label>
                <p className="font-data mt-1 text-4xl leading-none font-medium">
                  {formatNumber(product.quantityOnHand)}
                </p>
              </div>
              <div className="text-right">
                <Label>Threshold</Label>
                <p className="font-data mt-1 text-xl leading-none font-medium">
                  <ThresholdCell product={product} />
                </p>
              </div>
            </div>
            <div className="mt-4">
              <StockMeter product={product} />
            </div>
          </section>

          {/* ===== Pricing ===== */}
          <dl className="font-data mx-6 mt-5 grid grid-cols-3 divide-x divide-sandstone border-y border-sandstone">
            <div className="py-3 pr-3">
              <dt className="font-sans">
                <Label>Cost price</Label>
              </dt>
              <dd className="mt-1 text-base font-medium">{money(product.costPrice)}</dd>
            </div>
            <div className="px-3 py-3">
              <dt className="font-sans">
                <Label>Selling price</Label>
              </dt>
              <dd className="mt-1 text-base font-medium">{money(product.sellingPrice)}</dd>
            </div>
            <div className="py-3 pl-3">
              <dt className="font-sans">
                <Label>Margin</Label>
              </dt>
              <dd className="mt-1 text-base font-medium">{margin === null ? '—' : `${margin}%`}</dd>
            </div>
          </dl>

          {/* ===== Perforated footer: reference number and dates ===== */}
          <dl className="font-data mx-6 mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t-2 border-dashed border-sandstone pt-4 text-[0.6875rem] text-graphite-soft">
            <div>
              <dt className="inline">Ref </dt>
              <dd className="inline font-medium tracking-[0.12em] text-graphite uppercase">
                {product.id.slice(-8)}
              </dd>
            </div>
            <div>
              <dt className="inline">Updated </dt>
              <dd className="inline">{dateTime.format(new Date(product.updatedAt))}</dd>
            </div>
            <div>
              <dt className="inline">Created </dt>
              <dd className="inline">{dateTime.format(new Date(product.createdAt))}</dd>
            </div>
          </dl>

          <div className="flex justify-end gap-3 px-6 pt-5 pb-6">
            <button type="button" onClick={onClose} className={buttonStyles('secondary')}>
              Close
            </button>
            <Link
              to={`/products?edit=${encodeURIComponent(product.id)}`}
              className={buttonStyles('primary')}
            >
              Edit product
            </Link>
          </div>
        </>
      )}
    </Overlay>
  );
}
