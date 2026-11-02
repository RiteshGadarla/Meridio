/**
 * FILE: frontend/src/features/auth/auth-layout.tsx
 * PURPOSE: Deliberately minimal centered frame shared by login and signup.
 * LAYER: Feature UI
 * USED BY: pages/login-page.tsx, pages/signup-page.tsx
 * NOTES: TEMPORARY visuals: the owner designs the final auth pages. Behaviour must stay intact.
 */
import type { ReactNode } from 'react';
import { Logo } from '../../components/logo';

export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-12">
      <Logo className="mb-8 text-forest" />
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h1>
      {children}
    </main>
  );
}
