/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/media/media.module.ts
 * Layer:   Module wiring
 * Purpose: Expose MediaService to any feature that needs SFU access tokens
 *          (today: Meetings on join). No controller — media tokens are only ever
 *          issued as part of a higher-level flow, never on their own endpoint.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Module } from '@nestjs/common';
import { MediaService } from './media.service';

@Module({
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
