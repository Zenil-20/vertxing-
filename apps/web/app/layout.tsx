/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/app/layout.tsx
 * Layer:   Web / App shell (Next.js root layout)
 * Purpose: The single HTML shell. Imports global + LiveKit styles, mounts the
 *          Auth + Call providers (so calls ring on any screen), and wires the
 *          PWA bits: manifest, app icons, theme color, standalone display, the
 *          service-worker registrar, and the install button — turning the web
 *          app into an installable, full-screen mobile app from one codebase.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/lib/auth-context';
import { CallProvider } from '@/lib/call-context';
import { DialogProvider } from '@/lib/dialog-context';
import { ToastProvider } from '@/lib/toast-context';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { RegisterSW } from '@/components/pwa/RegisterSW';
import '@livekit/components-styles';
import './globals.css';

export const metadata: Metadata = {
  applicationName: 'Vertxing',
  title: 'Vertxing — Meetings & Calls',
  description: 'Instant meetings and direct calls, without friction.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Vertxing',
  },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icon.svg' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#06070d',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <DialogProvider>
            <AuthProvider>
              <CallProvider>{children}</CallProvider>
            </AuthProvider>
          </DialogProvider>
        </ToastProvider>
        <RegisterSW />
        <InstallPrompt />
      </body>
    </html>
  );
}
