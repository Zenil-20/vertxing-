/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/push/push.controller.ts
 * Layer:   Presentation / HTTP
 * Purpose: The browser's interface to Web Push: fetch the VAPID public key, then
 *          register / drop this device's subscription. Authenticated (global JWT
 *          guard) — a subscription is always tied to the calling user.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import type { PushPublicKeyDto } from '@vertxing/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PushService } from './push.service';
import { SavePushSubscriptionDto } from './dto/save-push-subscription.dto';
import { RemovePushSubscriptionDto } from './dto/remove-push-subscription.dto';

@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  /** GET /push/public-key — the VAPID key to subscribe with (null ⇒ disabled). */
  @Get('public-key')
  publicKey(): PushPublicKeyDto {
    return { publicKey: this.push.getPublicKey() };
  }

  /** POST /push/subscribe — register this browser for background call rings. */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('subscribe')
  async subscribe(
    @CurrentUser('userId') userId: string,
    @Body() dto: SavePushSubscriptionDto,
  ): Promise<void> {
    await this.push.saveSubscription(userId, dto);
  }

  /** POST /push/unsubscribe — drop this browser's subscription. */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('unsubscribe')
  async unsubscribe(@Body() dto: RemovePushSubscriptionDto): Promise<void> {
    await this.push.removeSubscription(dto.endpoint);
  }
}
