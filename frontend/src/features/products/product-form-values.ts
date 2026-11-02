/**
 * FILE: frontend/src/features/products/product-form-values.ts
 * PURPOSE: Converts between form strings and the API payload; computes the PATCH diff.
 * LAYER: Feature logic (pure, unit-testable)
 * USED BY: product-form.tsx
 * DEPENDS ON: @meridio/contracts
 * NOTES: HTML inputs only produce strings. These helpers turn them into the shapes that
 *        createProductSchema validates, so the validation rules stay defined in ONE place.
 */
import type { CreateProductInput, ProductDto, UpdateProductInput } from '@meridio/contracts';

/** What the inputs hold (all strings). */
export interface ProductFormValues {
  name: string;
  sku: string;
  description: string;
  quantityOnHand: string;
  costPrice: string;
  sellingPrice: string;
  lowStockThreshold: string;
}

export const EMPTY_FORM: ProductFormValues = {
  name: '',
  sku: '',
  description: '',
  quantityOnHand: '0',
  costPrice: '',
  sellingPrice: '',
  lowStockThreshold: '',
};

export function productToFormValues(p: ProductDto): ProductFormValues {
  return {
    name: p.name,
    sku: p.sku,
    description: p.description ?? '',
    quantityOnHand: String(p.quantityOnHand),
    costPrice: p.costPrice ?? '',
    sellingPrice: p.sellingPrice ?? '',
    lowStockThreshold: p.lowStockThreshold === null ? '' : String(p.lowStockThreshold),
  };
}

/** "" -> null (cleared), otherwise the number (NaN is left for the schema to reject). */
const numberOrNull = (v: string): number | null => (v.trim() === '' ? null : Number(v));

/**
 * Raw form strings -> object for createProductSchema.
 * EDGE CASE: an empty optional field becomes null (explicitly "no value"), never 0 or "".
 */
export function formToPayload(v: ProductFormValues): Record<string, unknown> {
  return {
    name: v.name,
    sku: v.sku,
    description: v.description.trim() === '' ? null : v.description,
    quantityOnHand: v.quantityOnHand.trim() === '' ? undefined : Number(v.quantityOnHand),
    costPrice: numberOrNull(v.costPrice),
    sellingPrice: numberOrNull(v.sellingPrice),
    lowStockThreshold: numberOrNull(v.lowStockThreshold),
  };
}

const sameNumber = (a: string | null, b: number | null | undefined) =>
  (a === null ? null : Number(a)) === (b ?? null);

/**
 * Builds the PATCH body with ONLY the fields the user changed.
 * EDGE CASE: clearing the threshold yields `lowStockThreshold: null`, which tells the API to fall
 * back to the organization default.
 * @param validated output of createProductSchema for the current form
 */
export function diffForUpdate(
  original: ProductDto,
  validated: CreateProductInput,
): UpdateProductInput {
  const changes: UpdateProductInput = {};
  if (validated.name !== original.name) changes.name = validated.name;
  if (validated.sku !== original.sku) changes.sku = validated.sku;
  if ((validated.description ?? null) !== original.description)
    changes.description = validated.description ?? null;
  if (validated.quantityOnHand !== original.quantityOnHand)
    changes.quantityOnHand = validated.quantityOnHand;
  if (!sameNumber(original.costPrice, validated.costPrice as number | null | undefined))
    changes.costPrice = validated.costPrice ?? null;
  if (!sameNumber(original.sellingPrice, validated.sellingPrice as number | null | undefined))
    changes.sellingPrice = validated.sellingPrice ?? null;
  if ((validated.lowStockThreshold ?? null) !== original.lowStockThreshold)
    changes.lowStockThreshold = validated.lowStockThreshold ?? null;
  return changes;
}
