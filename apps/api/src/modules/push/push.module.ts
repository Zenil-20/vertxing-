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
import { PushController } from './push.controller';
import { PushService } from './push.service';
import { PushRepository } from './push.repository';

@Module({
  controllers: [PushController],
  providers: [PushService, PushRepository],
  exports: [PushService],
})
export class PushModule {}
