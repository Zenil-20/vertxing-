/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/lib/platform.ts
 * Layer:   Web / Platform detection
 * Purpose: Tell whether the web app is running inside the native (Capacitor)
 *          Android shell vs a normal browser. Used to hide capabilities the
 *          Android WebView can't do — e.g. screen share (getDisplayMedia is
 *          unsupported in the system WebView), so we don't show a dead button.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import { useEffect, useState } from 'react';

/** True when running inside the Capacitor native shell. */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
}

/** Hook form — resolves after mount to avoid SSR/hydration mismatch. */
export function useIsNativeApp(): boolean {
  const [native, setNative] = useState(false);
  useEffect(() => setNative(isNativeApp()), []);
  return native;
}
