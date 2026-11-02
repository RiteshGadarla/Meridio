/**
 * FILE: frontend/src/features/products/product-form.tsx
 * PURPOSE: Create/edit form. React Hook Form + createProductSchema, live status preview, server
 *          error mapping, and dirty-state reporting for the drawer.
 * LAYER: Feature UI
 * USED BY: product-drawer.tsx
 * DEPENDS ON: @meridio/contracts, react-hook-form, product-form-values.ts
 * NOTES: Validation is the shared createProductSchema (never re-implemented here). The status
 *        under "Preview" uses the shared getStockStatus, but the server value is authoritative
 *        after save.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createProductSchema,
  getEffectiveThreshold,
  getStockStatus,
  type CreateProductInput,
  type ProductDto,
} from '@meridio/contracts';
import { useEffect, type KeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { StatusBadge } from '../../components/ui/badge';
import { Field, Input, Textarea } from '../../components/ui/form';
import { ApiError } from '../../lib/api-client';
import {
  EMPTY_FORM,
  diffForUpdate,
  formToPayload,
  productToFormValues,
  type ProductFormValues,
} from './product-form-values';
import type { UpdateProductInput } from '@meridio/contracts';

export const PRODUCT_FORM_ID = 'product-form';

const FIELDS = [
  'name',
  'sku',
  'description',
  'quantityOnHand',
  'costPrice',
  'sellingPrice',
  'lowStockThreshold',
] as const;

// WHY a piped schema: inputs are strings, createProductSchema wants typed values. Converting first
// and then validating with the shared schema means error messages and rules come from one place.
const formSchema = z.custom<ProductFormValues>().transform(formToPayload).pipe(createProductSchema);

/** Blocks characters that can never be valid in a whole-number field. */
const blockNonInteger = (e: KeyboardEvent<HTMLInputElement>) => {
  if (['-', '+', '.', ',', 'e', 'E'].includes(e.key)) e.preventDefault();
};
/** Blocks sign and exponent characters in a price field (a dot is allowed). */
const blockNonPrice = (e: KeyboardEvent<HTMLInputElement>) => {
  if (['-', '+', ',', 'e', 'E'].includes(e.key)) e.preventDefault();
};

export interface ProductFormProps {
  /** Present in edit mode. */
  product?: ProductDto;
  /** Organization default threshold, for the helper text and the preview. */
  orgDefaultThreshold: number;
  onCreate: (input: CreateProductInput) => Promise<unknown>;
  onUpdate: (changes: UpdateProductInput) => Promise<unknown>;
  /** Reports unsaved changes so the drawer can guard closing. */
  onDirtyChange: (dirty: boolean) => void;
  onSubmittingChange: (submitting: boolean) => void;
}

export function ProductForm({
  product,
  orgDefaultThreshold,
  onCreate,
  onUpdate,
  onDirtyChange,
  onSubmittingChange,
}: ProductFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(formSchema) as never,
    defaultValues: product ? productToFormValues(product) : EMPTY_FORM,
  });

  useEffect(() => onDirtyChange(isDirty), [isDirty, onDirtyChange]);
  useEffect(() => onSubmittingChange(isSubmitting), [isSubmitting, onSubmittingChange]);

  // ===== Live preview =====
  const quantity = watch('quantityOnHand');
  const thresholdText = watch('lowStockThreshold');
  const qty = quantity.trim() === '' ? 0 : Number(quantity);
  const own = thresholdText.trim() === '' ? null : Number(thresholdText);
  const previewable =
    Number.isInteger(qty) && qty >= 0 && (own === null || (Number.isInteger(own) && own >= 0));
  const preview = previewable
    ? getStockStatus(qty, getEffectiveThreshold(own, orgDefaultThreshold))
    : null;

  // ===== Submit =====
  // handleSubmit passes the resolver output: createProductSchema's parsed (normalised) value.
  const submit = handleSubmit(async (validatedUnknown) => {
    const validated = validatedUnknown as unknown as CreateProductInput;
    try {
      if (product) await onUpdate(diffForUpdate(product, validated));
      else await onCreate(validated);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) {
        for (const field of FIELDS) {
          const message = error.fieldErrors[field];
          if (message) setError(field, { message });
        }
        if (FIELDS.some((f) => error.fieldErrors?.[f])) return;
      }
      setError('root', {
        message:
          error instanceof ApiError ? error.message : 'Something went wrong. Please try again.',
      });
    }
  });

  return (
    <form id={PRODUCT_FORM_ID} onSubmit={submit} noValidate className="grid gap-4">
      {errors.root?.message && (
        <p
          role="alert"
          className="rounded-sm border border-status-out/40 bg-status-out-tint/50 px-3 py-2 text-sm"
        >
          {errors.root.message}
        </p>
      )}

      <Field label="Product name" required error={errors.name?.message}>
        {(p) => <Input autoComplete="off" {...p} {...register('name')} />}
      </Field>

      <Field
        label="SKU"
        required
        error={errors.sku?.message}
        hint="Unique within your organization. Saved in capitals."
      >
        {(p) => (
          <Input
            mono
            autoComplete="off"
            {...p}
            {...register('sku', {
              // Normalise on blur so users see exactly what will be saved.
              onBlur: (e) =>
                setValue('sku', e.target.value.trim().toUpperCase(), { shouldDirty: true }),
            })}
          />
        )}
      </Field>

      <Field label="Description" error={errors.description?.message}>
        {(p) => <Textarea {...p} {...register('description')} />}
      </Field>

      <Field label="Quantity on hand" error={errors.quantityOnHand?.message}>
        {(p) => (
          <Input
            mono
            type="text"
            inputMode="numeric"
            onKeyDown={blockNonInteger}
            {...p}
            {...register('quantityOnHand')}
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cost price" error={errors.costPrice?.message}>
          {(p) => (
            <Input
              mono
              type="text"
              inputMode="decimal"
              onKeyDown={blockNonPrice}
              {...p}
              {...register('costPrice')}
            />
          )}
        </Field>
        <Field label="Selling price" error={errors.sellingPrice?.message}>
          {(p) => (
            <Input
              mono
              type="text"
              inputMode="decimal"
              onKeyDown={blockNonPrice}
              {...p}
              {...register('sellingPrice')}
            />
          )}
        </Field>
      </div>

      <Field
        label="Low-stock threshold"
        error={errors.lowStockThreshold?.message}
        hint={`Leave empty to use your organization default of ${orgDefaultThreshold}.`}
      >
        {(p) => (
          <Input
            mono
            type="text"
            inputMode="numeric"
            onKeyDown={blockNonInteger}
            {...p}
            {...register('lowStockThreshold')}
          />
        )}
      </Field>

      <div className="flex items-center justify-between border-t border-sandstone pt-4">
        <span className="text-sm text-graphite-soft">Preview</span>
        {preview ? (
          <StatusBadge status={preview} />
        ) : (
          <span className="text-sm text-graphite-soft">Enter valid numbers</span>
        )}
      </div>
    </form>
  );
}
