/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/lib/native-fcm.ts
 * Layer:   Web / Native bridge
 * Purpose: On the native Android app (Capacitor), fetch this device's FCM token
 *          via the native Fcm plugin and register it with the API — so the server
 *          can ring THIS device with a full-screen, screen-waking incoming call.
 *          A no-op in a normal browser.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import { api } from './api-client';
import { isNativeApp } from './platform';

interface FcmBridge {
  Capacitor?: { Plugins?: { Fcm?: { getToken?: () => Promise<{ token: string }> } } };
}

/** Register the native device's FCM token with the API (native app only). */
export async function registerNativeFcm(): Promise<void> {
  if (!isNativeApp()) return;
  const fcm = (window as unknown as FcmBridge).Capacitor?.Plugins?.Fcm;
  if (!fcm?.getToken) return;
  try {
    const { token } = await fcm.getToken();
    if (token) await api.registerFcmToken({ token });
  } catch {
    /* token unavailable — ignore */
  }
}
