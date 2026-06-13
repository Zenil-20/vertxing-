/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/app/manifest.ts
 * Layer:   Web / PWA
 * Purpose: The web app manifest (served at /manifest.webmanifest). It's what
 *          turns the site into an INSTALLABLE app: a home-screen icon, a name,
 *          and `display: standalone` so it launches full-screen with no browser
 *          chrome — looking and feeling like a native app from one codebase.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Vertxing — Meetings & Calls',
    short_name: 'Vertxing',
    description: 'Instant meetings and direct calls, without friction.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#06070d',
    theme_color: '#06070d',
    categories: ['business', 'productivity', 'social'],
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
