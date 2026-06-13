/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/components/pwa/RegisterSW.tsx
 * Layer:   Web / PWA
 * Purpose: Register the service worker once on the client. Renders nothing.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import { useEffect } from 'react';

export function RegisterSW() {
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
  }, []);
  return null;
}
