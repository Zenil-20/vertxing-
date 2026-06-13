/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/common/filters/all-exceptions.filter.ts
 * Layer:   Common / Cross-cutting
 * Purpose: Convert ANY thrown error into the single `ApiError` envelope the
 *          client is built to expect. Catching everything here means controllers
 *          and services just `throw new NotFoundException(...)` and trust that
 *          the shape, status code, and logging are handled in one place.
 *          Unexpected (non-HTTP) errors are logged with a stack and reduced to a
 *          generic 500 so we never leak internals to the caller.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiError } from '@vertxing/shared';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';
    let details: Record<string, string[]> | undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const payload = exception.getResponse();

      if (typeof payload === 'string') {
        message = payload;
      } else if (typeof payload === 'object' && payload !== null) {
        const body = payload as Record<string, unknown>;
        // class-validator returns `message` as a string[]; flatten for display
        // and preserve the full list under `details` for field-level UI.
        if (Array.isArray(body.message)) {
          message = String(body.message[0]);
          details = { _errors: body.message.map(String) };
        } else if (typeof body.message === 'string') {
          message = body.message;
        }
        if (typeof body.code === 'string') {
          code = body.code;
        }
      }
      // Default the machine code from the status if the thrower didn't set one.
      if (code === 'INTERNAL_ERROR') {
        code = this.codeFromStatus(statusCode);
      }
    } else if (exception instanceof Error) {
      // Truly unexpected — log loudly, expose nothing.
      this.logger.error(
        `Unhandled ${exception.name} on ${request.method} ${request.url}: ${exception.message}`,
        exception.stack,
      );
    }

    const body: ApiError = {
      success: false,
      error: { statusCode, code, message, details },
      timestamp: new Date().toISOString(),
    };

    response.status(statusCode).json(body);
  }

  /** Map a status code to a stable, screaming-snake machine code. */
  private codeFromStatus(status: number): string {
    const map: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
    };
    return map[status] ?? 'INTERNAL_ERROR';
  }
}
