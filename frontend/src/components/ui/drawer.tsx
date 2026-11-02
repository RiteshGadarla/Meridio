/**
 * FILE: frontend/src/components/ui/drawer.tsx
 * PURPOSE: Side drawer: right-hand panel from md up, full-screen on mobile.
 * LAYER: UI primitive
 * USED BY: product form (Stage 9)
 * DEPENDS ON: overlay.tsx
 * NOTES: Slide animation is 180ms and neutralised by the global prefers-reduced-motion rule.
 */
import { useId, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './button';
import { Overlay } from './overlay';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** Body content (for example a form). */
  children: ReactNode;
  /** Pinned bottom bar (for example Save / Cancel). */
  footer?: ReactNode;
}

/**
 * Drawer with a labelled title, close button, scrollable body and optional pinned footer.
 * Focus is trapped, Escape closes, and focus returns to the trigger.
 */
export function Drawer({ open, onClose, title, description, children, footer }: DrawerProps) {
  const titleId = useId();
  return (
    <Overlay
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      wrapperClassName="justify-end"
      panelClassName="animate-drawer-in flex h-full w-full flex-col md:max-w-md md:border-l md:border-sandstone"
    >
      <header className="flex items-start justify-between gap-4 border-b border-sandstone px-6 py-5">
        <div>
          <h2 id={titleId} className="text-lg font-semibold text-graphite">
            {title}
          </h2>
          {description && <p className="mt-1 text-sm text-graphite-soft">{description}</p>}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
          <X aria-hidden="true" className="size-4" />
        </Button>
      </header>
      <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      {footer && <footer className="border-t border-sandstone px-6 py-4">{footer}</footer>}
    </Overlay>
  );
}
