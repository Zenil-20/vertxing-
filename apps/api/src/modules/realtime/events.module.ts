/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/realtime/events.module.ts
 * Layer:   Module wiring
 * Purpose: Compose the realtime gateway. Imports MeetingsModule (RBAC + waiting-
 *          room state), UsersModule (display names), and JwtModule (verify the
 *          socket's access token — secret passed per-call, mirroring REST auth).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MeetingsModule } from '../meetings/meetings.module';
import { MediaModule } from '../media/media.module';
import { UsersModule } from '../users/users.module';
import { PushModule } from '../push/push.module';
import { EventsGateway } from './events.gateway';
import { CallService } from './call.service';

@Module({
  imports: [MeetingsModule, MediaModule, UsersModule, PushModule, JwtModule.register({})],
  providers: [EventsGateway, CallService],
})
export class EventsModule {}
