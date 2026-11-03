/**
 * FILE: frontend/src/features/products/adjust-stock-dialog.tsx
 * PURPOSE: Small dialog for the PRD's "Adjust stock" control: enter "+/- N units" and an optional
 *          note, see the resulting quantity, and save without opening the full edit form.
 * LAYER: Feature UI
 * USED BY: pages/products-page.tsx (opened from the table's Actions column)
 * DEPENDS ON: ui/overlay, ui/form, hooks.ts (useAdjustStock), @meridio/contracts (adjustStockSchema)
 * NOTES: Validation is the shared adjustStockSchema. The preview is advisory; the server enforces
 *        0..max atomically and its message is shown on the field if it refuses.
 */
import { adjustStockSchema, MAX_QUANTITY, type ProductDto } from '@meridio/contracts';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/button';
import { Field, Input } from '../../components/ui/form';
import { Overlay } from '../../components/ui/overlay';
import { useToast } from '../../components/ui/toast';
import { ApiError } from '../../lib/api-client';
import { formatNumber } from '../../lib/format';
import { useAdjustStock } from './hooks';

export interface AdjustStockDialogProps {
  /** The product being adjusted; null keeps the dialog closed. */
  product: ProductDto | null;
  onClose: () => void;
}

/**
 * Parses the delta text ("+5", "-2", "7"). Returns NaN for anything that is not a whole number so
 * the shared schema can report it.
 */
function parseDelta(text: string): number {
  const trimmed = text.trim();
  return /^[+-]?\d+$/.test(trimmed) ? Number(trimmed) : NaN;
}

/**
 * Dialog shell. The form lives in a child that Overlay only mounts while open, so every open starts
 * from an empty form with no reset effect needed.
 */
export function AdjustStockDialog({ product, onClose }: AdjustStockDialogProps) {
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  return (
    <Overlay
      open={product !== null}
      onClose={busy ? () => undefined : onClose}
      labelledBy={titleId}
      wrapperClassName="items-center justify-center p-4"
      panelClassName="animate-fade-in w-full max-w-md rounded-md border border-sandstone p-6"
    >
      {product && (
        <AdjustStockForm
          key={product.id}
          product={product}
          titleId={titleId}
          onBusyChange={setBusy}
          onClose={onClose}
        />
      )}
    </Overlay>
  );
}

function AdjustStockForm({
  product,
  titleId,
  onBusyChange,
  onClose,
}: {
  product: ProductDto;
  titleId: string;
  onBusyChange: (busy: boolean) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const adjust = useAdjustStock();
  const [deltaText, setDeltaText] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();
  const [noteError, setNoteError] = useState<string>();

  useEffect(() => onBusyChange(adjust.isPending), [adjust.isPending, onBusyChange]);

  const delta = parseDelta(deltaText);
  const result = Number.isFinite(delta) ? product.quantityOnHand + delta : null;
  const outOfRange = result !== null && (result < 0 || result > MAX_QUANTITY);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    setNoteError(undefined);
    const parsed = adjustStockSchema.safeParse({
      delta,
      ...(note.trim() ? { note } : {}),
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === 'note') setNoteError(issue.message);
        else
          setError(
            deltaText.trim() === '' ? 'Enter a number of units, like +5 or -2' : issue.message,
          );
      }
      return;
    }
    try {
      const updated = await adjust.mutateAsync({ id: product.id, input: parsed.data });
      toast.success(`${product.name}: now ${formatNumber(updated.quantityOnHand)} in stock`);
      onClose();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? (e.fieldErrors?.delta ?? e.message)
          : 'Could not adjust stock. Please try again.',
      );
    }
  }

  return (
    <>
      <h2 id={titleId} className="text-lg font-semibold text-graphite">
        Adjust stock
      </h2>
      <p className="mt-1 text-sm text-graphite-soft">
        {product.name} <span className="font-data">({product.sku})</span>
      </p>

      <form onSubmit={(e) => void submit(e)} noValidate className="mt-5 grid gap-4">
        <Field
          label="Change (units)"
          error={error}
          hint="Use + to add and - to remove, for example +5 or -2."
        >
          {(p) => (
            <Input
              mono
              autoComplete="off"
              inputMode="text"
              placeholder="+5"
              value={deltaText}
              onChange={(e) => setDeltaText(e.target.value)}
              {...p}
            />
          )}
        </Field>
        <Field label="Note (optional)" error={noteError}>
          {(p) => (
            <Input
              autoComplete="off"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              {...p}
            />
          )}
        </Field>

        <div className="flex items-center justify-between border-t border-sandstone pt-4 text-sm">
          <span className="text-graphite-soft">New quantity</span>
          <span aria-live="polite" className="font-data">
            {result !== null && !outOfRange
              ? `${formatNumber(product.quantityOnHand)} → ${formatNumber(result)}`
              : `${formatNumber(product.quantityOnHand)} on hand`}
          </span>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={adjust.isPending}>
            Cancel
          </Button>
          <Button type="submit" loading={adjust.isPending}>
            Apply change
          </Button>
        </div>
      </form>
    </>
  );
}
