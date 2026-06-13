/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/meetings/livekit-webhook.controller.ts
 * Layer:   Presentation / Ops (webhook sink)
 * Purpose: Receive LiveKit room/participant webhooks and reconcile meeting state
 *          from them — the authoritative source of "who's actually in the room".
 *          @Public (LiveKit has no Vertxing JWT) but NOT unauthenticated: the
 *          signature is verified against the raw body via MediaService before we
 *          trust a single field, so forged events are rejected.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  type RawBodyRequest,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { MediaService } from '../media/media.service';
import { MeetingsService } from './meetings.service';

@Controller('webhooks/livekit')
export class LivekitWebhookController {
  constructor(
    private readonly media: MediaService,
    private readonly meetings: MeetingsService,
  ) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post()
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('authorization') auth: string,
  ): Promise<{ received: true }> {
    const body = req.rawBody?.toString('utf8') ?? '';
    const event = await this.media.receiveWebhook(body, auth); // throws on bad signature
    await this.meetings.handleRoomEvent(event);
    return { received: true };
  }
}
