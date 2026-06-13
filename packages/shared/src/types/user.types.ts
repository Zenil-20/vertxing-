/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    packages/shared/src/types/user.types.ts
 * Layer:   Shared / Contracts
 * Purpose: The user identity contract. `PublicUser` is the ONLY user shape that
 *          ever crosses the wire — it deliberately omits the password hash and
 *          any other sensitive column, so leaking it client-side is harmless.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Type-only imports (erased at compile) so there is no runtime cycle with
// permission.types (which imports UserRole as a value) or role.types.
import type { Permission } from './permission.types';
import type { RoleSummary } from './role.types';

/** Platform-level authorization role. Meeting-level roles are separate. */
export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

/** Safe, client-facing representation of a user account. */
export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  /**
   * Effective permissions (role base + per-user call lever), resolved server-side
   * by `permissionsForUser`. The client drives the sidebar and feature gates off
   * THIS — it never recomputes role→permission logic, so the two can't drift.
   */
  permissions: Permission[];
  /** Display label of the user's role (built-in label or custom role name). */
  roleName: string;
  /** Where this user should land after sign-in (their role's default landing). */
  landingPath: string;
  /** The per-user "may start direct calls" lever (locked-by-default policy). */
  callsEnabled: boolean;
  /** User has set themselves unavailable for direct calls. */
  doNotDisturb: boolean;
  createdAt: string;
}

/** A user in the call directory, with live reachability for "call now". */
export interface DirectoryUser extends PublicUser {
  online: boolean;
}

/** Body for PATCH /users/me — self-service profile/availability updates. */
export interface UpdateProfileRequest {
  doNotDisturb?: boolean;
}

/** A user as seen in the Users & Roles admin (privilege management). */
export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  /** Built-in tier (stays USER when a custom role is assigned). */
  role: UserRole;
  /** The assigned dynamic role, if any (overlays permissions; null ⇒ built-in). */
  customRole: RoleSummary | null;
  /** The per-user call lever (only meaningful for the USER role). */
  callsEnabled: boolean;
  createdAt: string;
}

/**
 * Body for PATCH /admin/users/:id — partial privilege update. Assignment is
 * EITHER a built-in `role` OR a `customRoleId` (string = assign, null = clear
 * back to the built-in role); the server keeps the two consistent.
 */
export interface UpdateUserRequest {
  role?: UserRole;
  customRoleId?: string | null;
  callsEnabled?: boolean;
}

/** Body for POST /admin/users/bulk — apply one change to many users at once. */
export interface BulkUpdateUsersRequest {
  userIds: string[];
  role?: UserRole;
  customRoleId?: string | null;
  callsEnabled?: boolean;
}

/** @deprecated Superseded by {@link UpdateUserRequest}; kept for any old callers. */
export interface UpdateUserRoleRequest {
  role: UserRole;
}
