/**
 * FILE: frontend/src/layouts/app-shell.tsx
 * PURPOSE: Authenticated layout: Deep Forest sidebar (logo, organization, nav, account, logout) and
 *          a Limestone workspace. Off-canvas menu with a top bar on mobile.
 * LAYER: Layout
 * USED BY: app/routes.tsx
 * DEPENDS ON: react-router-dom (NavLink, Outlet), components/logo.tsx
 * NOTES: The user prop is supplied by the session layer in Stage 7. Until then no identity is shown
 *        (no placeholder data). NavLink sets aria-current="page" on the active item.
 */
import { LayoutDashboard, LogOut, Menu, Package, Settings, X, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Logo } from '../components/logo';
import { cn } from '../lib/cn';

export interface ShellUser {
  email: string;
  organizationName: string;
}

const NAV: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/settings', label: 'Settings', icon: Settings },
];

/** Sidebar + workspace. Renders the matched child route through <Outlet />. */
export function AppShell({ user, onLogout }: { user?: ShellUser; onLogout?: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-dvh md:flex">
      {/* Mobile top bar */}
      <div className="flex h-14 items-center justify-between bg-forest px-4 text-limestone md:hidden">
        <Logo />
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          className="rounded-sm p-2 hover:bg-forest-soft"
        >
          {menuOpen ? (
            <X aria-hidden="true" className="size-5" />
          ) : (
            <Menu aria-hidden="true" className="size-5" />
          )}
        </button>
      </div>

      {menuOpen && (
        <div
          className="fixed inset-0 z-30 bg-graphite/40 md:hidden"
          aria-hidden="true"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside
        id="primary-navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-forest text-limestone transition-transform',
          'md:sticky md:top-0 md:h-dvh md:translate-x-0',
          menuOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="hidden h-16 items-center px-6 md:flex">
          <Logo />
        </div>

        {user && (
          <div className="mx-6 mt-4 border-t border-limestone/15 pt-4 md:mt-0">
            <p className="text-xs tracking-wide text-limestone/70 uppercase">Organization</p>
            <p className="mt-1 truncate text-sm font-medium">{user.organizationName}</p>
          </div>
        )}

        <nav aria-label="Primary" className="mt-6 flex-1 px-3">
          <ul className="space-y-1">
            {NAV.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 border-l-2 px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'border-copper bg-forest-soft text-white'
                        : 'border-transparent text-limestone/80 hover:bg-forest-soft/60 hover:text-white',
                    )
                  }
                >
                  <Icon aria-hidden="true" className="size-4" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-limestone/15 px-6 py-4">
          {user && <p className="mb-3 truncate text-sm text-limestone/80">{user.email}</p>}
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-2 rounded-sm text-sm font-medium text-limestone/90 hover:text-white"
          >
            <LogOut aria-hidden="true" className="size-4" />
            Log out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
