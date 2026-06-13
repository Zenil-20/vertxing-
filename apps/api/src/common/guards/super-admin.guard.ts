/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/common/guards/super-admin.guard.ts
 * Layer:   Common / Auth (RBAC)
 * Purpose: Restrict a route to SUPER_ADMIN. Runs after the global JWT guard.
 *          IMPORTANT: it re-reads the role from the DATABASE, not from the JWT —
 *          so a promote/demote takes effect IMMEDIATELY, and a stale token can't
 *          retain super-admin privileges. This is the authoritative gate; hiding
 *          the nav in the UI is only cosmetic.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '@vertxing/shared';
import type { AuthenticatedUser } from '../types/authenticated-user';
import { UsersService } from '../../modules/users/users.service';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly users: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as AuthenticatedUser | undefined;
    if (!user) throw new ForbiddenException('Authentication required');

    let role: UserRole | undefined;
    try {
      role = (await this.users.getPublicById(user.userId)).role;
    } catch {
      role = undefined;
    }
    if (role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Super-admin access required');
    }
    return true;
  }
}
