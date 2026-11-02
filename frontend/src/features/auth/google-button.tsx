/**
 * FILE: frontend/src/features/auth/google-button.tsx
 * PURPOSE: "Continue with Google" link plus the "or" divider, shown on /login and /signup.
 * LAYER: Feature UI
 * USED BY: pages/login-page.tsx, pages/signup-page.tsx
 * NOTES: It is a plain link (full-page navigation), not a fetch: the browser must leave for
 *        Google's consent screen and come back through the API callback. The relative URL goes
 *        through the Vite proxy in dev and the Vercel rewrite in production.
 */
import { buttonStyles } from '../../components/ui/button';
import { cn } from '../../lib/cn';
import { GOOGLE_START_URL } from './api';

/** Google's multicolour "G". Brand-mandated colours, so intentionally not theme tokens. */
function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.27-2.09 3.57-5.17 3.57-8.81z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.07.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.09A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.27a12 12 0 0 0 0 10.74l4-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.23 0 12 0A12 12 0 0 0 1.27 6.63l4 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

/**
 * @param action "signin" or "signup": only changes the wording.
 * @example <GoogleButton action="signin" />
 */
export function GoogleButton({ action }: { action: 'signin' | 'signup' }) {
  return (
    <div className="mt-6">
      <div className="mb-4 flex items-center gap-3 text-xs tracking-wide text-graphite-soft uppercase">
        <span className="h-px flex-1 bg-sandstone" aria-hidden="true" />
        or
        <span className="h-px flex-1 bg-sandstone" aria-hidden="true" />
      </div>
      <a
        href={GOOGLE_START_URL}
        className={cn(buttonStyles('secondary'), 'w-full border-sandstone text-graphite')}
      >
        <GoogleG />
        {action === 'signup' ? 'Sign up with Google' : 'Continue with Google'}
      </a>
    </div>
  );
}
