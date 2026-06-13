/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/infrastructure/redis/redis.module.ts
 * Layer:   Infrastructure / Cache & Realtime State
 * Purpose: Expose RedisService application-wide. @Global so auth (token store)
 *          and meetings (presence) can inject it without local re-imports.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
