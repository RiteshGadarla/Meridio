/**
 * FILE: frontend/src/components/ui/table.tsx
 * PURPOSE: "Ledger" table primitives: hairline dividers, airy rows, right-aligned mono numerals.
 * LAYER: UI primitive
 * USED BY: dashboard attention table, products table
 * NOTES: Responsive strategy: the wrapper scrolls horizontally on narrow screens so every column
 *        stays readable; `numeric` cells are right-aligned in the data font.
 */
import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

/** Scroll container + table. `caption` is read by screen readers only. */
export function Table({
  caption,
  className,
  children,
  centered,
  ...rest
}: HTMLAttributes<HTMLTableElement> & { caption?: string; centered?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-sm border border-sandstone bg-paper">
      <table
        className={cn(
          'w-full min-w-[40rem] border-collapse text-left text-sm',
          // `centered` overrides the per-cell numeric right-alignment too (descendant selector
          // outranks the single-class `text-right`), so headers and content share one axis.
          centered && '[&_td]:text-center [&_th]:text-center',
          className,
        )}
        {...rest}
      >
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return <thead className="border-b border-sandstone bg-limestone/60">{children}</thead>;
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-sandstone">{children}</tbody>;
}

export function TR({ className, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('hover:bg-limestone/50', className)} {...rest} />;
}

/** Header cell. Add `numeric` to right-align over numeric columns. */
export function TH({
  numeric,
  className,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        'px-4 py-3 text-xs font-semibold tracking-wide text-graphite-soft uppercase',
        numeric && 'text-right',
        className,
      )}
      {...rest}
    />
  );
}

/** Body cell. `numeric` = right-aligned mono; `mono` = mono, left-aligned (SKUs). */
export function TD({
  numeric,
  mono,
  className,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean; mono?: boolean }) {
  return (
    <td
      className={cn(
        'px-4 py-3.5 align-middle',
        (numeric || mono) && 'font-data',
        numeric && 'text-right',
        className,
      )}
      {...rest}
    />
  );
}
