/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/push/push.module.ts
 * Layer:   Module wiring
 * Purpose: Compose Web Push. Exports PushService so the realtime gateway can ring
 *          a closed app when a call comes in.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { PushController } from './push.controller';
import { PushService } from './push.service';
import { PushRepository } from './push.repository';
import { FcmService } from './fcm.service';

@Module({
  imports: [UsersModule],
  controllers: [PushController],
  providers: [PushService, PushRepository, FcmService],
  exports: [PushService, FcmService],
})
export class PushModule {}
