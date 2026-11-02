/**
 * FILE: frontend/src/components/ui/button.tsx
 * PURPOSE: The one button. Variants, sizes, loading and disabled states share a single look.
 * LAYER: UI primitive
 * USED BY: everywhere
 */
import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = Deep Forest fill; secondary = outline; ghost = text only; danger = destructive red. */
  variant?: ButtonVariant;
  /** sm = 32px high, md = 40px high. */
  size?: ButtonSize;
  /** Shows a spinner, sets aria-busy and blocks clicks. The label stays so the width is stable. */
  loading?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-forest text-on-forest hover:bg-forest-soft active:bg-forest',
  secondary:
    'border border-brand/40 bg-transparent text-brand hover:bg-sandstone/60 active:bg-sandstone',
  ghost: 'bg-transparent text-graphite hover:bg-sandstone/60 active:bg-sandstone',
  danger: 'bg-status-out text-white hover:bg-[#a3433a] active:bg-status-out',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
};

/**
 * Class string for a button look, so a router <Link> can match a <Button> exactly.
 * @example <Link to="/products?new=1" className={buttonStyles('primary')}>Add Product</Link>
 */
export function buttonStyles(variant: ButtonVariant = 'primary', size: ButtonSize = 'md'): string {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-sm font-medium transition-colors',
    'disabled:cursor-not-allowed disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
  );
}

/**
 * @example <Button variant="primary" loading={isPending}>Save product</Button>
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  type = 'button', // WHY: a button inside a form must not submit unless asked to
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonStyles(variant, size), className)}
      {...rest}
    >
      {loading && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
      {children}
    </button>
  );
}
