/**
 * FILE: frontend/src/components/theme-toggle.tsx
 * PURPOSE: Button that switches between the light and dark theme.
 * LAYER: UI
 * USED BY: layouts/app-shell.tsx, pages/landing-page.tsx
 * DEPENDS ON: lib/theme.tsx
 */
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../lib/theme';
import { cn } from '../lib/cn';

/**
 * Icon button showing the theme you will switch TO. `label` adds visible text.
 * @example <ThemeToggle label className="text-on-forest" />
 */
export function ThemeToggle({
  label = false,
  hideLabelClassName,
  className,
}: {
  label?: boolean;
  /** Extra classes for the text label (for example to hide it when the sidebar is collapsed). */
  hideLabelClassName?: string;
  className?: string;
}) {
  const { theme, toggleTheme } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  const Icon = next === 'dark' ? Moon : Sun;
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={cn(
        'inline-flex items-center gap-2 rounded-sm text-sm font-medium transition-colors',
        label ? 'px-0 py-1' : 'p-2',
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
      {label && (
        <span className={hideLabelClassName}>{next === 'dark' ? 'Dark theme' : 'Light theme'}</span>
      )}
    </button>
  );
}
