/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    packages/shared/src/types/role.types.ts
 * Layer:   Shared / Contracts (Dynamic roles)
 * Purpose: The wire contract for super-admin-defined CUSTOM roles — named bundles
 *          of permissions with a default landing page, assignable to many users.
 *          These overlay the built-in roles (see permission.types). One contract
 *          so the roles editor, the assignment UI, and the server never drift.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { Permission } from './permission.types';

/** A dynamic role as seen by the admin (full detail). */
export interface CustomRole {
  id: string;
  name: string;
  /** Stable slug derived from the name. */
  key: string;
  permissions: Permission[];
  /** A nav href members land on after sign-in (must be one they can see). */
  defaultLanding: string;
  /** How many users currently hold this role. */
  memberCount: number;
  createdAt: string;
}

/** Lightweight role reference for dropdowns and user rows. */
export interface RoleSummary {
  id: string;
  name: string;
}

/** Body for POST /admin/roles. */
export interface CreateRoleRequest {
  name: string;
  permissions: Permission[];
  defaultLanding?: string;
}

/** Body for PATCH /admin/roles/:id — partial. */
export interface UpdateRoleRequest {
  name?: string;
  permissions?: Permission[];
  defaultLanding?: string;
}
