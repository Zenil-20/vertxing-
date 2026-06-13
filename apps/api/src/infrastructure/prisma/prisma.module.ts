/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/infrastructure/prisma/prisma.module.ts
 * Layer:   Infrastructure / Persistence
 * Purpose: Expose PrismaService application-wide. Marked @Global so feature
 *          modules can inject the database without re-importing this everywhere.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
