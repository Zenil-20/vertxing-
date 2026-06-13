/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    packages/shared/src/types/push.types.ts
 * Layer:   Shared / Contracts (Web Push — background calls)
 * Purpose: The wire contract for ringing a user whose app is CLOSED. The browser
 *          subscribes (Service Worker + Push API), sends the subscription here,
 *          and the server pushes an "incoming-call" payload that the Service
 *          Worker turns into a notification. One contract so the SW, the client,
 *          and the server agree on the shape.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { CallMode } from './call.types';

/** The VAPID public key the browser needs to subscribe (null ⇒ push disabled). */
export interface PushPublicKeyDto {
  publicKey: string | null;
}

/** A browser PushSubscription, flattened for the wire. */
export interface SavePushSubscriptionRequest {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Body for removing a subscription (sign-out / disable). */
export interface RemovePushSubscriptionRequest {
  endpoint: string;
}

/** The payload the Service Worker receives for an incoming call. */
export interface IncomingCallPushData {
  type: 'incoming-call';
  callId: string;
  from: { id: string; name: string };
  mode: CallMode;
}
