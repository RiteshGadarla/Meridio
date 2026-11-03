/**
 * FILE: frontend/src/layouts/app-shell.tsx
 * PURPOSE: Authenticated layout: collapsible sidebar (logo, organization, nav, account, theme,
 *          logout) and the workspace. Off-canvas menu with a top bar on mobile.
 * LAYER: Layout
 * USED BY: app/routes.tsx
 * DEPENDS ON: react-router-dom (NavLink, Outlet), components/logo.tsx, components/theme-toggle.tsx
 * NOTES: NavLink sets aria-current="page" on the active item. The sidebar surface uses the
 *        `sidebar` tokens, which are Deep Forest in light mode and a darker green-black in dark mode.
 *        The collapsed state (icons only) applies from `md` up and is remembered in localStorage;
 *        on mobile the menu is always the full off-canvas panel.
 */
import type { AvatarStyle } from '@meridio/contracts';
import {
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ScrollText,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Avatar } from '../components/avatar';
import { ActivityFeed } from '../features/activity/activity-feed';
import { Logo, LogoMark } from '../components/logo';
import { ThemeToggle } from '../components/theme-toggle';
import { cn } from '../lib/cn';

export interface ShellUser {
  email: string;
  /** Stored gradient for the user's initial tile. */
  avatar?: AvatarStyle | null;
  /** Stored gradient + symbol for the organization tile. */
  organizationAvatar?: AvatarStyle | null;
  /** Google display name, if any. */
  name?: string | null;
  /** Google avatar URL, if any. */
  pictureUrl?: string | null;
  organizationName: string;
}

const NAV: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/logs', label: 'Logs', icon: ScrollText },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const COLLAPSE_KEY = 'stockflow-sidebar-collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false; // EDGE CASE: blocked storage; default to expanded.
  }
}

/** Sidebar + workspace. Renders the matched child route through <Outlet />. */
export function AppShell({ user, onLogout }: { user?: ShellUser; onLogout?: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);

  function toggleCollapsed() {
    setCollapsed((v) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, v ? '0' : '1');
      } catch {
        // EDGE CASE: ignore blocked storage; the choice still applies this session.
      }
      return !v;
    });
  }

  // Labels hide only on desktop when collapsed; the mobile panel always shows them.
  const label = cn(collapsed && 'md:hidden');

  return (
    <div className="min-h-dvh md:flex">
      {/* Mobile top bar */}
      <div className="flex h-14 items-center justify-between bg-sidebar px-4 text-on-forest md:hidden">
        <Logo />
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          className="rounded-sm p-2 hover:bg-sidebar-soft"
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
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          aria-hidden="true"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside
        id="primary-navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-sidebar text-on-forest transition-[transform,width] duration-200',
          // WHY self-start + inset-y-auto: in the flex row the sidebar must keep its own viewport height
          // and pin to the top while the page scrolls; the mobile fixed insets would otherwise fight
          // the sticky offsets. shrink-0 stops the width collapsing when the page content is wide.
          'md:sticky md:inset-y-auto md:top-0 md:h-dvh md:shrink-0 md:self-start md:translate-x-0 md:border-r md:border-on-forest/10',
          collapsed ? 'md:w-20' : 'md:w-72',
          menuOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* ===== Brand + collapse ===== */}
        <div
          className={cn(
            'flex h-16 shrink-0 items-center justify-between px-5',
            collapsed && 'md:justify-center md:px-0',
          )}
        >
          {collapsed ? (
            <>
              <Logo className="md:hidden" />
              <LogoMark className="hidden md:block" />
            </>
          ) : (
            <Logo />
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-pressed={collapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'hidden rounded-sm p-2 text-on-forest/70 hover:bg-sidebar-soft hover:text-white md:block',
              collapsed && 'md:absolute md:top-[4.5rem] md:left-1/2 md:-translate-x-1/2',
            )}
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden="true" className="size-5" />
            ) : (
              <PanelLeftClose aria-hidden="true" className="size-5" />
            )}
          </button>
        </div>

        {/* ===== Organization: the tenant you are working in, so it gets room ===== */}
        {user && (
          <div
            className={cn(
              'mx-4 mt-2 rounded-sm bg-sidebar-soft p-4',
              collapsed && 'md:mt-14 md:mx-3 md:p-0',
            )}
          >
            <div className={cn('flex items-center gap-3', collapsed && 'md:justify-center')}>
              <span title={user.organizationName}>
                <Avatar
                  variant="organization"
                  name={user.organizationName}
                  avatar={user.organizationAvatar}
                  className="size-11"
                />
              </span>
              <div className={cn('min-w-0', label)}>
                <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-on-forest/60 uppercase">
                  Organization
                </p>
                <p className="mt-0.5 text-xl leading-tight font-semibold break-words text-white">
                  {user.organizationName}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ===== Navigation ===== */}
        <div className="mt-6 flex min-h-0 flex-1 flex-col">
          <nav aria-label="Primary" className="shrink-0 px-3">
            <ul className="space-y-1">
              {NAV.map(({ to, label: text, icon: Icon }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    title={collapsed ? text : undefined}
                    aria-label={collapsed ? text : undefined}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-sm border-l-2 px-3 py-3 text-[0.9375rem] font-medium transition-colors',
                        collapsed && 'md:justify-center md:px-0',
                        isActive
                          ? 'border-copper bg-sidebar-soft text-white'
                          : 'border-transparent text-on-forest/75 hover:bg-sidebar-soft/70 hover:text-white',
                      )
                    }
                  >
                    <Icon aria-hidden="true" className="size-5 shrink-0" />
                    <span className={label}>{text}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          {/* Hidden when the sidebar is collapsed to icons; there is no room for sentences. */}
          <div className={cn('flex min-h-0 flex-1 flex-col', collapsed && 'md:hidden')}>
            <ActivityFeed />
          </div>
        </div>

        {/* ===== Account: identity, theme switch, logout ===== */}
        <div className={cn('border-t border-on-forest/10 p-4', collapsed && 'md:px-3')}>
          {user && (
            <div
              className={cn(
                'flex items-center gap-3 px-2 pb-4',
                collapsed && 'md:justify-center md:px-0',
              )}
            >
              <Avatar
                name={user.name ?? user.email}
                pictureUrl={user.pictureUrl}
                avatar={user.avatar}
                className="size-10"
              />
              <div className={cn('min-w-0', label)}>
                {user.name && (
                  <p className="truncate text-sm font-medium text-white" title={user.name}>
                    {user.name}
                  </p>
                )}
                <p className="truncate text-xs text-on-forest/70" title={user.email}>
                  {user.email}
                </p>
              </div>
            </div>
          )}
          <div className="space-y-1">
            <ThemeToggle
              label
              hideLabelClassName={label}
              className={cn(
                'w-full px-3 py-2.5 text-on-forest/75 hover:bg-sidebar-soft/70 hover:text-white',
                collapsed && 'md:justify-center md:px-0',
              )}
            />
            <button
              type="button"
              onClick={onLogout}
              title={collapsed ? 'Log out' : undefined}
              className={cn(
                'flex w-full items-center gap-2 rounded-sm px-3 py-2.5 text-sm font-medium text-on-forest/75 transition-colors hover:bg-sidebar-soft/70 hover:text-white',
                collapsed && 'md:justify-center md:px-0',
              )}
            >
              <LogOut aria-hidden="true" className="size-4 shrink-0" />
              <span className={label}>Log out</span>
            </button>
          </div>
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
