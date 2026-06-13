/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/components/shell/AppShell.tsx
 * Layer:   Web / App shell
 * Purpose: The authenticated product frame: a persistent sidebar on desktop, a
 *          bottom tab bar on mobile, and the content area. Owns the auth guard
 *          (redirect to /login when signed out) so every /app/* route is
 *          protected by one place. This is the information architecture that
 *          replaces the single crammed dashboard.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import { Home, type LucideIcon, LogOut, Phone, Settings, Users, Video } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { visibleNav } from '@vertxing/shared';
import { Logo } from '@/components/brand/Logo';
import { useAuth } from '@/lib/auth-context';

// The sidebar is DATA-DRIVEN from the shared APP_NAV + the user's resolved
// permissions (see `visibleNav`) — the same source the role-preview screen reads.
// Icons are the web's concern, so we map them by the shared nav `key`. Admin
// areas (Users & Roles, License) intentionally live UNDER Settings, not here.
const NAV_ICONS: Record<string, LucideIcon> = {
  home: Home,
  meetings: Video,
  contacts: Users,
  calls: Phone,
  settings: Settings,
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
        <span className="muted">Loading…</span>
      </div>
    );
  }

  const isActive = (href: string) =>
    href === '/app' ? pathname === '/app' : pathname.startsWith(href);

  async function signOut() {
    await logout();
    router.push('/');
  }

  // Only the nav items this user's permissions allow (e.g. Calls hides until the
  // user is granted call access). One rule, shared with the role-preview screen.
  const nav = visibleNav(user.permissions);

  return (
    <div className="app-shell">
      {/* Desktop sidebar */}
      <aside className="app-sidebar">
        <div style={{ padding: '4px 10px 18px' }}>
          <Logo size={24} />
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          {nav.map((item) => {
            const Icon = NAV_ICONS[item.key] ?? Home;
            return (
              <Link key={item.href} href={item.href} className={`nav-item ${isActive(item.href) ? 'active' : ''}`}>
                <Icon size={19} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="row" style={{ gap: 10, padding: '12px 8px', borderTop: '1px solid var(--border)' }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: 'var(--grad-brand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {user.displayName.slice(0, 1).toUpperCase()}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.displayName}
            </div>
          </div>
          <button className="ctrl" style={{ width: 32, height: 32 }} title="Sign out" onClick={signOut}>
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="app-content">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="app-bottomnav">
        {nav.map((item) => {
          const Icon = NAV_ICONS[item.key] ?? Home;
          return (
            <Link key={item.href} href={item.href} className={`bottomnav-item ${isActive(item.href) ? 'active' : ''}`}>
              <Icon size={20} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
