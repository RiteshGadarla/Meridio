/**
 * FILE: frontend/src/pages/not-found-page.tsx
 * PURPOSE: Shown for any unknown URL.
 * LAYER: Page
 * USED BY: app/routes.tsx
 */
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-24">
      <p className="text-xs font-semibold tracking-[0.14em] text-graphite-soft uppercase">404</p>
      <div className="mt-1.5 mb-3 h-px w-10 bg-copper" aria-hidden="true" />
      <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-graphite-soft">That address does not exist in StockFlow.</p>
      <Link
        to="/dashboard"
        className="mt-6 inline-block text-sm font-medium text-brand underline underline-offset-4"
      >
        Go to overview
      </Link>
    </main>
  );
}
