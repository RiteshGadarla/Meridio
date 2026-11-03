/**
 * FILE: frontend/src/pages/not-found-page.tsx
 * PURPOSE: Shown for any unknown URL, with recovery actions that fit whether or not the visitor is
 *          signed in.
 * LAYER: Page
 * USED BY: app/routes.tsx
 * NOTES: WHY the primary link depends on the session: a signed-out visitor sent to /dashboard would
 *        just be bounced to /login, so they get "Back to home" instead.
 */
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useCurrentUser } from '../features/auth/hooks';
import { buttonStyles } from '../components/ui/button';

export function NotFoundPage() {
  const { data: user } = useCurrentUser();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // history.length is 1 for a fresh tab; there is nothing to go back to then.
  const canGoBack = window.history.length > 1;

  return (
    <main className="mx-auto max-w-xl px-4 py-24">
      <p className="text-xs font-semibold tracking-[0.14em] text-graphite-soft uppercase">404</p>
      <div className="mt-1.5 mb-3 h-px w-10 bg-copper" aria-hidden="true" />
      <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-graphite-soft">
        <span className="font-data break-all">{pathname}</span> does not exist in StockFlow.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link to={user ? '/dashboard' : '/'} className={buttonStyles('primary')}>
          {user ? 'Go to overview' : 'Back to home'}
        </Link>
        {user && (
          <Link to="/products" className={buttonStyles('secondary')}>
            View products
          </Link>
        )}
        {canGoBack && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-sm font-medium text-brand underline underline-offset-4"
          >
            Go back
          </button>
        )}
      </div>
    </main>
  );
}
