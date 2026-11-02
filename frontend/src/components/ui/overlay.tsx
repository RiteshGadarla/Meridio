/**
 * FILE: frontend/src/components/ui/overlay.tsx
 * PURPOSE: Accessible modal base shared by Drawer and ConfirmDialog: portal, backdrop, focus trap,
 *          Escape to close, body scroll lock, and focus restoration to the trigger.
 * LAYER: UI primitive
 * USED BY: drawer.tsx, confirm-dialog.tsx
 * NOTES: Rendered only while open, so closed overlays cost nothing and leave no hidden focusables.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/cn';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export interface OverlayProps {
  open: boolean;
  onClose: () => void;
  /** id of the element that titles the dialog (aria-labelledby). */
  labelledBy: string;
  /** Layout classes for the positioned wrapper (for example flex alignment). */
  wrapperClassName?: string;
  /** Classes for the dialog panel itself. */
  panelClassName?: string;
  /** role="alertdialog" for confirmations that need an explicit answer. */
  role?: 'dialog' | 'alertdialog';
  /** Close when the backdrop is clicked. Default true. */
  closeOnBackdrop?: boolean;
  children: ReactNode;
}

/**
 * Modal container.
 * - Focus moves to the first focusable element (or the panel) when it opens, is trapped with Tab /
 *   Shift+Tab, and returns to the previously focused element on close.
 * - Escape calls onClose. Page scroll is locked while open.
 * @example <Overlay open={open} onClose={close} labelledBy="t"><h2 id="t">Title</h2></Overlay>
 */
export function Overlay({
  open,
  onClose,
  labelledBy,
  wrapperClassName,
  panelClassName,
  role = 'dialog',
  closeOnBackdrop = true,
  children,
}: OverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // WHY ref: the latest onClose is used without re-running the focus effect on every render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; // scroll lock

    const panel = panelRef.current;
    const focusables = () => Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    (focusables()[0] ?? panel)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus(); // restore focus to the trigger
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className={cn('fixed inset-0 z-50 flex', wrapperClassName)}>
      <div
        className="animate-fade-in absolute inset-0 bg-graphite/40"
        aria-hidden="true"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={cn('relative bg-paper shadow-overlay outline-none', panelClassName)}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
