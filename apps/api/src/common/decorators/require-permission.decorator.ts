/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/common/decorators/require-permission.decorator.ts
 * Layer:   Common / Auth (RBAC)
 * Purpose: Declare the Permission a route requires. Paired with PermissionGuard,
 *          which reads this metadata and checks the caller's LIVE permissions.
 *          One decorator + one guard replaces a fleet of role-specific guards.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@vertxing/shared';

export const PERMISSION_KEY = 'required_permission';

/** Gate a controller or handler behind a single permission. */
export const RequirePermission = (permission: Permission) =>
  SetMetadata(PERMISSION_KEY, permission);
