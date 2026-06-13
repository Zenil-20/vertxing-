/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/push/dto/save-fcm-token.dto.ts
 * Layer:   Presentation / Validation (DTO)
 * Purpose: Body for POST /push/fcm-token — the native device's FCM token.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { IsNotEmpty, IsString } from 'class-validator';
import type { SaveFcmTokenRequest } from '@vertxing/shared';

export class SaveFcmTokenDto implements SaveFcmTokenRequest {
  @IsString()
  @IsNotEmpty()
  token!: string;
}
