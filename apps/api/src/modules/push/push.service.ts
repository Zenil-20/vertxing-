/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/push/push.service.ts
 * Layer:   Application / Domain service (Web Push)
 * Purpose: Ring a user whose app is CLOSED. Configures web-push with the VAPID
 *          keys (if present — otherwise push is simply disabled and nothing
 *          breaks). Stores subscriptions, reports whether a user is reachable by
 *          push, and fans an incoming-call payload out to all their devices —
 *          self-healing by deleting any subscription the push service reports as
 *          gone (404/410).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webPush from 'web-push';
import type { IncomingCallPushData, SavePushSubscriptionRequest } from '@vertxing/shared';
import type { AppConfig } from '../../config/configuration';
import { PushRepository } from './push.repository';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private enabled = false;
  private publicKey: string | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly repo: PushRepository,
  ) {
    const push = this.config.getOrThrow<AppConfig['push']>('push');
    if (push.vapidPublicKey && push.vapidPrivateKey) {
      webPush.setVapidDetails(push.vapidSubject, push.vapidPublicKey, push.vapidPrivateKey);
      this.enabled = true;
      this.publicKey = push.vapidPublicKey;
      this.logger.log('Web Push enabled — closed apps can be rung by notification');
    } else {
      this.logger.warn('Web Push DISABLED (set VAPID_* keys to ring a closed app)');
    }
  }

  /** The VAPID public key the browser subscribes with (null ⇒ push disabled). */
  getPublicKey(): string | null {
    return this.publicKey;
  }

  saveSubscription(userId: string, sub: SavePushSubscriptionRequest): Promise<unknown> {
    return this.repo.upsert(userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth);
  }

  async removeSubscription(endpoint: string): Promise<void> {
    await this.repo.deleteByEndpoint(endpoint);
  }

  /** Is this user reachable by push (push enabled AND has ≥1 subscription)? */
  async hasSubscriptions(userId: string): Promise<boolean> {
    if (!this.enabled) return false;
    return (await this.repo.countByUser(userId)) > 0;
  }

  /** Push an incoming-call payload to every device the user has registered. */
  async sendCallNotification(userId: string, data: IncomingCallPushData): Promise<void> {
    if (!this.enabled) return;
    const subs = await this.repo.listByUser(userId);
    if (subs.length === 0) return;

    const payload = JSON.stringify(data);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webPush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
            // A ringing invite is short-lived; deliver promptly, expire fast.
            { TTL: 30, urgency: 'high' },
          );
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) {
            await this.repo.deleteByEndpoint(s.endpoint); // gone — prune it
          } else {
            this.logger.warn(`push to user ${userId} failed (status ${code ?? 'unknown'})`);
          }
        }
      }),
    );
  }
}
