/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/push/dto/remove-push-subscription.dto.ts
 * Layer:   Presentation / Validation (DTO)
 * Purpose: Body for POST /push/unsubscribe — drop one device's subscription.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { IsNotEmpty, IsString } from 'class-validator';
import type { RemovePushSubscriptionRequest } from '@vertxing/shared';

export class RemovePushSubscriptionDto implements RemovePushSubscriptionRequest {
  @IsString()
  @IsNotEmpty()
  endpoint!: string;
}
