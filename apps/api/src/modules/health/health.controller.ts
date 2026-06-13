/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/health/health.controller.ts
 * Layer:   Presentation / Ops
 * Purpose: Liveness endpoint for load balancers, container orchestrators, and
 *          uptime monitors. Public and dependency-free so it answers even while
 *          the app is starting up. Deeper readiness checks (DB/Redis reachable)
 *          can be added as the deployment matures.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check(): { status: string; uptimeSeconds: number } {
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()) };
  }
}
