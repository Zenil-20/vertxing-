/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/lib/push.ts
 * Layer:   Web / Background calls (client)
 * Purpose: Turn the browser into a device that rings even when the app is closed.
 *          Asks notification permission, subscribes via the Service Worker's Push
 *          Manager using the server's VAPID public key, and registers the
 *          subscription with the API. All standard web APIs — no native code.
 *          NOTE: requires a SECURE CONTEXT (https, or localhost) and works on
 *          Android Chrome; iOS Safari support is limited.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import { api } from './api-client';

export type PushState = 'unsupported' | 'denied' | 'enabled' | 'disabled';

/** VAPID keys are base64url; the Push API wants an ArrayBuffer-backed view. */
function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalized);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    window.isSecureContext
  );
}

/** Current state without prompting the user. */
export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  return sub ? 'enabled' : 'disabled';
}

/** Prompt + subscribe + register with the API. */
export async function enablePush(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';

  const { publicKey } = await api.getPushPublicKey();
  if (!publicKey) return 'unsupported'; // server has push disabled (no VAPID keys)

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'disabled';

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return 'disabled';
  await api.subscribePush({
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  });
  return 'enabled';
}

/** Unsubscribe this device and drop it server-side. */
export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub) {
    await api.unsubscribePush({ endpoint: sub.endpoint }).catch(() => undefined);
    await sub.unsubscribe().catch(() => undefined);
  }
}
