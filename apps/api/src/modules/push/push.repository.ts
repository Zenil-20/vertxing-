/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/push/push.repository.ts
 * Layer:   Infrastructure / Persistence (repository)
 * Purpose: The ONLY component that queries `push_subscriptions`. Upsert by the
 *          unique endpoint so re-subscribing the same browser updates in place;
 *          delete by endpoint when a push proves the subscription is stale.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Injectable } from '@nestjs/common';
import type { PushSubscription } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class PushRepository {
  constructor(private readonly prisma: PrismaService) {}

  upsert(userId: string, endpoint: string, p256dh: string, auth: string): Promise<PushSubscription> {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId, p256dh, auth },
      create: { userId, endpoint, p256dh, auth },
    });
  }

  deleteByEndpoint(endpoint: string): Promise<{ count: number }> {
    return this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
  }

  listByUser(userId: string): Promise<PushSubscription[]> {
    return this.prisma.pushSubscription.findMany({ where: { userId } });
  }

  countByUser(userId: string): Promise<number> {
    return this.prisma.pushSubscription.count({ where: { userId } });
  }
}
