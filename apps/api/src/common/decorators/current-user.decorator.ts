/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/common/decorators/current-user.decorator.ts
 * Layer:   Common / Cross-cutting / Auth
 * Purpose: Ergonomic access to the authenticated identity inside controllers:
 *            handler(@CurrentUser() user: AuthenticatedUser)        // whole obj
 *            handler(@CurrentUser('userId') userId: string)        // one field
 *          Keeps controllers free of `req.user` casting and the Express request.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../types/authenticated-user';

export const CurrentUser = createParamDecorator(
  (
    field: keyof AuthenticatedUser | undefined,
    ctx: ExecutionContext,
  ): AuthenticatedUser | AuthenticatedUser[keyof AuthenticatedUser] => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser;
    return field ? user?.[field] : user;
  },
);
