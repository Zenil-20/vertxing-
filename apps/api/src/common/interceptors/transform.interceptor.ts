/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/common/interceptors/transform.interceptor.ts
 * Layer:   Common / Cross-cutting
 * Purpose: Wrap every successful controller return value in the `ApiSuccess<T>`
 *          envelope. Controllers return plain domain objects; the client always
 *          receives `{ success: true, data, timestamp }`. Pairs with
 *          AllExceptionsFilter so success and failure share one contract.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';
import type { ApiSuccess } from '@vertxing/shared';

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiSuccess<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccess<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
