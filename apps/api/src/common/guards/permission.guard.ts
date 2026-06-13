/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/common/guards/permission.guard.ts
 * Layer:   Common / Auth (RBAC)
 * Purpose: The authoritative permission gate. Runs after the global JWT guard and
 *          re-resolves the caller's permissions from the DATABASE (never the JWT)
 *          via the same `permissionsForUser` rule the wire shape uses — so a
 *          promote/demote or a revoked call-grant takes effect IMMEDIATELY and a
 *          stale token can't retain access. Hiding nav in the UI is only cosmetic;
 *          THIS is the line attackers hit.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Permission } from '@vertxing/shared';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../types/authenticated-user';
import { UsersService } from '../../modules/users/users.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true; // no permission declared ⇒ JWT guard alone suffices

    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as AuthenticatedUser | undefined;
    if (!user) throw new ForbiddenException('Authentication required');

    let permissions: readonly Permission[] = [];
    try {
      permissions = (await this.users.getPublicById(user.userId)).permissions;
    } catch {
      permissions = [];
    }
    if (!permissions.includes(required)) {
      throw new ForbiddenException('You do not have permission to do that');
    }
    return true;
  }
}
