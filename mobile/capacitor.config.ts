/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    mobile/capacitor.config.ts
 * Layer:   Mobile / Native shell (Capacitor)
 * Purpose: Wrap the LIVE web app in a native Android container. We run in "server"
 *          mode — the app loads the deployed PWA in a WebView, so 100% of the web
 *          UI is reused with no rewrite. The native layer adds only what the web
 *          can't do: a full-screen, screen-waking incoming-call experience driven
 *          by FCM (added in Phase 2).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vertxing.app',
  appName: 'Vertxing',
  webDir: 'www',
  server: {
    // The native app loads the deployed web app. Change this if your web URL changes.
    url: 'https://vertxing-web.vercel.app',
    androidScheme: 'https',
  },
};

export default config;
