/**
 * FILE: frontend/src/components/ui/form.tsx
 * PURPOSE: Form primitives: Label, Input, Textarea, Select, FieldError, Field (wires them together).
 * LAYER: UI primitive
 * USED BY: auth forms, product form, settings
 * NOTES: Field generates ids and aria-describedby so every error is announced with its input.
 */
import {
  useId,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '../../lib/cn';

const CONTROL =
  'block w-full rounded-sm border bg-paper px-3 text-sm text-graphite placeholder:text-graphite-soft/70 ' +
  'disabled:cursor-not-allowed disabled:bg-sandstone/50 disabled:text-graphite-soft';

const borderFor = (invalid?: boolean) =>
  invalid ? 'border-status-out' : 'border-sandstone hover:border-graphite-soft/50';

/** Visible label. Required fields get a text marker, not just colour. */
export function Label({
  required,
  className,
  children,
  ...rest
}: LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label className={cn('mb-1.5 block text-sm font-medium text-graphite', className)} {...rest}>
      {children}
      {required && <span className="ml-1 text-graphite-soft"> (required)</span>}
    </label>
  );
}

export interface ControlProps {
  /** Marks the control invalid (red border + aria-invalid). */
  invalid?: boolean;
}

/** Single-line input. Pass `mono` for SKUs, quantities and prices. */
export function Input({
  invalid,
  mono,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & ControlProps & { mono?: boolean }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(CONTROL, 'h-10', borderFor(invalid), mono && 'font-data', className)}
      {...rest}
    />
  );
}

export function Textarea({
  invalid,
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & ControlProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(CONTROL, 'min-h-24 py-2', borderFor(invalid), className)}
      {...rest}
    />
  );
}

export function Select({
  invalid,
  className,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & ControlProps) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cn(CONTROL, 'h-10', borderFor(invalid), className)}
      {...rest}
    />
  );
}

/** Error text under a control. role="alert" so screen readers announce it when it appears. */
export function FieldError({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-sm text-status-out">
      {children}
    </p>
  );
}

export interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  /** Render the control; spread `controlProps` onto it. */
  children: (controlProps: {
    id: string;
    invalid: boolean;
    'aria-describedby': string | undefined;
  }) => ReactNode;
}

/**
 * Label + control + hint + error, wired with matching ids.
 * @example
 * <Field label="SKU" error={errors.sku}>{(p) => <Input mono {...p} {...register('sku')} />}</Field>
 */
export function Field({ label, error, hint, required, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {children({ id, invalid: Boolean(error), 'aria-describedby': describedBy })}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-sm text-graphite-soft">
          {hint}
        </p>
      )}
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
}
