/**
 * FILE: frontend/src/components/ui/confirm-dialog.tsx
 * PURPOSE: Confirmation dialog for destructive or irreversible actions.
 * LAYER: UI primitive
 * USED BY: product delete (Stage 9)
 * DEPENDS ON: overlay.tsx, button.tsx
 */
import { useId } from 'react';
import { Button } from './button';
import { Overlay } from './overlay';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as danger. Use for deletes. */
  destructive?: boolean;
  /** Disables buttons and shows a spinner on confirm while the request runs. */
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Centered dialog. Focus starts on Cancel (the first button), so Enter never confirms a delete by
 * accident. Escape and backdrop click cancel.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();
  return (
    <Overlay
      open={open}
      onClose={loading ? () => undefined : onCancel}
      labelledBy={titleId}
      role="alertdialog"
      wrapperClassName="items-center justify-center p-4"
      panelClassName="animate-fade-in w-full max-w-md rounded-md border border-sandstone p-6"
    >
      <h2 id={titleId} className="text-lg font-semibold text-graphite">
        {title}
      </h2>
      <p id={descId} className="mt-2 text-sm text-graphite-soft">
        {description}
      </p>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Overlay>
  );
}
