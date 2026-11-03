/**
 * FILE: frontend/src/components/error-boundary.tsx
 * PURPOSE: Catches render-time crashes anywhere below it and shows a recovery screen instead of a
 *          blank page.
 * LAYER: UI (class component: React has no hook equivalent of componentDidCatch)
 * USED BY: App.tsx (wraps the whole route table)
 * NOTES: WHY recovery actions use plain <a>/location: after a crash, router or query state may be
 *        broken, so "Reload" and "Go to overview" do a full page load that always starts clean.
 *        "Try again" re-renders the same page first, which is enough for transient failures.
 *        `resetKey` (the current URL) clears the error when the user navigates elsewhere.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { buttonStyles } from './ui/button';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** When this value changes, a shown error is cleared (pass the current pathname). */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

/** The recovery screen. Exported so tests and the design page can render it directly. */
export function CrashScreen({ error, onRetry }: { error?: Error | null; onRetry?: () => void }) {
  return (
    <main role="alert" className="mx-auto max-w-xl px-4 py-24">
      <p className="text-xs font-semibold tracking-[0.14em] text-graphite-soft uppercase">Error</p>
      <div className="mt-1.5 mb-3 h-px w-10 bg-copper" aria-hidden="true" />
      <h1 className="text-3xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-sm text-graphite-soft">
        This page hit an unexpected problem. Your data is safe. Try again, or reload the page.
      </p>
      {import.meta.env.DEV && error && (
        <pre className="font-data mt-4 overflow-x-auto rounded-sm border border-sandstone p-3 text-xs">
          {error.message}
        </pre>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {onRetry && (
          <button type="button" onClick={onRetry} className={buttonStyles('primary')}>
            Try again
          </button>
        )}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className={buttonStyles('secondary')}
        >
          Reload page
        </button>
        <a
          href="/dashboard"
          className="text-sm font-medium text-brand underline underline-offset-4"
        >
          Go to overview
        </a>
      </div>
    </main>
  );
}

/** Error boundary with a recovery screen. @example <ErrorBoundary resetKey={pathname}><Routes/></ErrorBoundary> */
export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // WHY console: no error-reporting service is in scope; this keeps the stack visible in devtools.
    console.error('Unhandled UI error', error, info.componentStack);
  }

  override componentDidUpdate(prev: ErrorBoundaryProps) {
    // EDGE CASE: navigating away from the crashed page must not leave the error screen stuck.
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  override render() {
    if (this.state.error) {
      return (
        <CrashScreen error={this.state.error} onRetry={() => this.setState({ error: null })} />
      );
    }
    return this.props.children;
  }
}
