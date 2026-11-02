/**
 * FILE: frontend/src/components/logo.tsx
 * PURPOSE: StockFlow wordmark: a small copper "flow" mark (two offset lines) + the name.
 * LAYER: UI
 * USED BY: layouts/app-shell.tsx
 * DEPENDS ON: @meridio/contracts (PRODUCT_NAME, so the name has one source)
 */
import { PRODUCT_NAME } from '@meridio/contracts';
import { cn } from '../lib/cn';

/** Mark only: two horizontal strokes, the lower one shifted right, suggesting stock moving through. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-6', className)} aria-hidden="true" fill="none">
      <path d="M3 8h13" stroke="#C46B48" strokeWidth="2.5" strokeLinecap="square" />
      <path d="M8 16h13" stroke="#C46B48" strokeWidth="2.5" strokeLinecap="square" />
    </svg>
  );
}

/** Mark + name. Inherits text colour (limestone on the sidebar). */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="text-lg font-semibold tracking-tight">{PRODUCT_NAME}</span>
    </span>
  );
}
