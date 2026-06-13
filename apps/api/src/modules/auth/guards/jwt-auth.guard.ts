/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/auth/guards/jwt-auth.guard.ts
 * Layer:   Auth / Guard
 * Purpose: The guard registered GLOBALLY in AppModule — every route requires a
 *          valid access token UNLESS it is decorated @Public(). Secure-by-
 *          default: forget the decorator on a new endpoint and it stays locked,
 *          which is the failure mode you want.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }
}
