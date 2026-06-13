/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/infrastructure/prisma/prisma.service.ts
 * Layer:   Infrastructure / Persistence
 * Purpose: A single, DI-managed PrismaClient bound to Nest's lifecycle. It opens
 *          the connection pool when the module boots and closes it on shutdown,
 *          so we never leak connections. Repositories depend on THIS, never on
 *          `new PrismaClient()` scattered around the codebase.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('PostgreSQL connection pool established');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('PostgreSQL connection pool closed');
  }
}
