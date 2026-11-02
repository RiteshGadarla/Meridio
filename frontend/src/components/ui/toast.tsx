/**
 * FILE: frontend/src/components/ui/toast.tsx
 * PURPOSE: Toast notifications with an aria-live region. ToastProvider + useToast().
 * LAYER: UI primitive
 * USED BY: app/providers.tsx, any mutation feedback
 * NOTES: Success toasts use polite announcements; errors use assertive ones. Auto-dismiss after
 *        5s, and can be dismissed by keyboard (the close button is focusable).
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

export type ToastKind = 'success' | 'error';
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
const DISMISS_MS = 5000;

/** Provides useToast() to the tree and renders the live regions. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback(
    (id: number) => setItems((list) => list.filter((t) => t.id !== id)),
    [],
  );
  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current++;
      setItems((list) => [...list, { id, kind, message }]);
      setTimeout(() => dismiss(id), DISMISS_MS);
    },
    [dismiss],
  );
  const api = useMemo<ToastApi>(
    () => ({ success: (m) => push('success', m), error: (m) => push('error', m) }),
    [push],
  );

  const renderList = (kind: ToastKind) =>
    items
      .filter((t) => t.kind === kind)
      .map((t) => (
        <div
          key={t.id}
          className={cn(
            'animate-fade-in pointer-events-auto flex items-start gap-3 rounded-sm border bg-paper px-4 py-3 text-sm text-graphite shadow-overlay',
            kind === 'success' ? 'border-status-healthy' : 'border-status-out',
          )}
        >
          <span className="flex-1">{t.message}</span>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss notification"
            className="rounded-xs text-graphite-soft hover:text-graphite"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      ));

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        <div aria-live="polite" role="status" className="flex flex-col gap-2">
          {renderList('success')}
        </div>
        <div aria-live="assertive" role="alert" className="flex flex-col gap-2">
          {renderList('error')}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

/** @throws if used outside <ToastProvider> */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
