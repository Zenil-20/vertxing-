/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/app/app/layout.tsx
 * Layer:   Web / App shell (route group layout)
 * Purpose: Wrap every authenticated /app/* route in the AppShell (sidebar +
 *          bottom-nav + auth guard). One layout = one place for the product
 *          frame and the signed-in guard.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { AppShell } from '@/components/shell/AppShell';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
