/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/meetings/meetings.module.ts
 * Layer:   Module wiring
 * Purpose: Compose the Meetings feature. Imports UsersModule (display names) and
 *          MediaModule (SFU tokens); Prisma and Redis are global so they need no
 *          local import.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { MediaModule } from '../media/media.module';
import { MeetingsController } from './meetings.controller';
import { LivekitWebhookController } from './livekit-webhook.controller';
import { MeetingsService } from './meetings.service';
import { MeetingsRepository } from './meetings.repository';
import { WaitingRoomService } from './waiting-room.service';

@Module({
  imports: [UsersModule, MediaModule],
  controllers: [MeetingsController, LivekitWebhookController],
  providers: [MeetingsService, MeetingsRepository, WaitingRoomService],
  // Exported so the realtime gateway can drive admission + RBAC checks.
  exports: [MeetingsService, WaitingRoomService],
})
export class MeetingsModule {}
