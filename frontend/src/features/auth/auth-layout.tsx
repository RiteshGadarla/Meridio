/**
 * FILE: frontend/src/features/auth/auth-layout.tsx
 * PURPOSE: Deliberately minimal centered frame shared by login and signup.
 * LAYER: Feature UI
 * USED BY: pages/login-page.tsx, pages/signup-page.tsx
 * NOTES: TEMPORARY visuals: the owner designs the final auth pages. Behaviour must stay intact.
 *        Includes a top-left "Back to home" link to the intro page.
 */
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../../components/logo';

export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="relative min-h-dvh">
      {/* Top-left escape hatch back to the intro page, outside the centered form column. */}
      <Link
        to="/"
        className="absolute top-4 left-4 inline-flex items-center gap-2 rounded-sm px-3 py-2 text-sm font-medium text-graphite-soft hover:bg-sandstone/60 hover:text-graphite sm:top-6 sm:left-6"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to home
      </Link>
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-12">
        <Logo className="mb-8 text-brand" />
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h1>
        {children}
      </main>
    </div>
  );
}
