/**
 * FILE: frontend/src/layouts/page-header.tsx
 * PURPOSE: Page title block: eyebrow label with a copper rule, large title, description, action.
 * LAYER: Layout
 * USED BY: every page
 */
import type { ReactNode } from 'react';

export interface PageHeaderProps {
  /** Small uppercase section label, for example "Inventory". */
  eyebrow: string;
  title: string;
  description?: string;
  /** Primary action slot (for example an "Add product" button). */
  action?: ReactNode;
}

/** @example <PageHeader eyebrow="Inventory" title="Products" action={<Button>Add product</Button>} /> */
export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-semibold tracking-[0.14em] text-graphite-soft uppercase">
          {eyebrow}
        </p>
        <div className="mt-1.5 mb-3 h-px w-10 bg-copper" aria-hidden="true" />
        <h1 className="text-3xl font-semibold tracking-tight text-graphite">{title}</h1>
        {description && (
          <p className="mt-2 max-w-prose text-sm text-graphite-soft">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
