/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/common/interceptors/logging.interceptor.ts
 * Layer:   Common / Cross-cutting / Observability
 * Purpose: Emit one structured access-log line per request with its latency.
 *          This is the cheapest, most useful observability primitive — in
 *          production you'd ship these to a log aggregator and alert on p99.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, originalUrl } = request;
    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        const elapsedMs = Date.now() - startedAt;
        this.logger.log(`${method} ${originalUrl} — ${elapsedMs}ms`);
      }),
    );
  }
}
