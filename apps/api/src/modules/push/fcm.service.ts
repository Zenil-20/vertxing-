/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/push/fcm.service.ts
 * Layer:   Application / Domain service (Firebase Cloud Messaging)
 * Purpose: Ring the NATIVE Android app with a full-screen, screen-waking call.
 *          Sends a HIGH-PRIORITY DATA message via FCM, which the app's native
 *          messaging service turns into a full-screen incoming-call screen — even
 *          when the app is killed or the phone is locked (web push can't do this).
 *          Credentials come from FCM_SERVICE_ACCOUNT_BASE64 (Render) or a
 *          gitignored local file. Absent ⇒ FCM is simply disabled.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type App, cert, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import type { IncomingCallPushData } from '@vertxing/shared';
import type { AppConfig } from '../../config/configuration';

@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);
  private app: App | null = null;

  constructor(private readonly config: ConfigService) {
    const account = this.loadServiceAccount();
    if (account) {
      try {
        this.app = initializeApp({ credential: cert(account) }, 'vertxing-fcm');
        this.logger.log('FCM enabled — native full-screen calls can ring');
      } catch (e) {
        this.logger.error('FCM init failed: ' + (e as Error).message);
      }
    } else {
      this.logger.warn('FCM DISABLED (set FCM_SERVICE_ACCOUNT_BASE64) — native calls off');
    }
  }

  /**
   * Send a high-priority DATA message the native app renders as a full-screen
   * incoming call. Data values must be strings, so the payload is flattened.
   */
  async sendCall(token: string, data: IncomingCallPushData): Promise<void> {
    if (!this.app) return;
    try {
      await getMessaging(this.app).send({
        token,
        data: {
          type: data.type,
          callId: data.callId,
          fromId: data.from.id,
          fromName: data.from.name,
          mode: data.mode,
        },
        android: { priority: 'high' },
      });
    } catch (e) {
      // Stale/invalid token (e.g. app reinstalled) — replaced on next app open.
      this.logger.warn(`FCM send failed (${(e as { code?: string }).code ?? 'error'})`);
    }
  }

  private loadServiceAccount(): Record<string, unknown> | null {
    const b64 = this.config.getOrThrow<AppConfig['push']>('push').fcmServiceAccountBase64;
    if (b64) {
      try {
        return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
      } catch {
        this.logger.error('FCM_SERVICE_ACCOUNT_BASE64 is not valid base64 JSON');
        return null;
      }
    }
    // Local dev fallback: a gitignored file beside the API.
    const file = join(process.cwd(), 'firebase-service-account.json');
    if (existsSync(file)) {
      try {
        return JSON.parse(readFileSync(file, 'utf8'));
      } catch {
        return null;
      }
    }
    return null;
  }
}
