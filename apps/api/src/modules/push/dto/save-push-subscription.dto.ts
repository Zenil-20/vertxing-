/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/push/dto/save-push-subscription.dto.ts
 * Layer:   Presentation / Validation (DTO)
 * Purpose: Body for POST /push/subscribe — the browser's PushSubscription,
 *          flattened. Nested keys are validated explicitly.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import type { SavePushSubscriptionRequest } from '@vertxing/shared';

class PushKeysDto {
  @IsString()
  @IsNotEmpty()
  p256dh!: string;

  @IsString()
  @IsNotEmpty()
  auth!: string;
}

export class SavePushSubscriptionDto implements SavePushSubscriptionRequest {
  @IsString()
  @IsNotEmpty()
  endpoint!: string;

  @ValidateNested()
  @Type(() => PushKeysDto)
  keys!: PushKeysDto;
}
