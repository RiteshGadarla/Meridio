/**
 * FILE: frontend/src/components/ui/states.tsx
 * PURPOSE: EmptyState and ErrorState: left-aligned, editorial, with a clear next action.
 * LAYER: UI primitive
 * USED BY: dashboard, products list
 */
import type { ReactNode } from 'react';
import { Button } from './button';

/**
 * "Nothing here yet" block. No illustration: a short title, one sentence, one action.
 * @example <EmptyState title="No products yet" description="..." action={<Button>Add product</Button>} />
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-sm border border-dashed border-sandstone px-6 py-10">
      <h3 className="text-base font-semibold text-graphite">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-prose text-sm text-graphite-soft">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Failure block with a retry action. role="alert" announces it to screen readers. */
export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-sm border border-status-out/40 bg-status-out-tint/50 px-6 py-6"
    >
      <h3 className="text-base font-semibold text-graphite">{title}</h3>
      <p className="mt-1.5 max-w-prose text-sm text-graphite-soft">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
