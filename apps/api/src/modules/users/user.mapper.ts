/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/users/user.mapper.ts
 * Layer:   Application / Mapping (anti-corruption boundary)
 * Purpose: Translate a persistence-layer `User` row into the `PublicUser` wire
 *          contract. The ONLY place the password hash is dropped, DB enums are
 *          mapped, and a user's EFFECTIVE permissions are resolved — honoring an
 *          optional dynamic (custom) role overlay via the shared rule, so the
 *          wire shape already carries the authority the client trusts.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { UserRole as PrismaUserRole, type User } from '@prisma/client';
import {
  type PublicUser,
  resolveUserPermissions,
  ROLE_META,
  toPermissions,
  UserRole,
} from '@vertxing/shared';

/** The custom-role columns the mapper needs (a subset of the Role row). */
export interface CustomRoleData {
  id: string;
  name: string;
  permissions: string[];
  defaultLanding: string;
}

/** A user row plus its optional joined custom role (relation may be absent). */
export type UserForPublic = User & { customRole?: CustomRoleData | null };

/** Explicit, total mapping from the DB role to the shared enum (no casts). */
export function toUserRole(role: User['role']): UserRole {
  if (role === 'SUPER_ADMIN') return UserRole.SUPER_ADMIN;
  if (role === 'ADMIN') return UserRole.ADMIN;
  return UserRole.USER;
}

const ROLE_TO_PRISMA: Record<UserRole, PrismaUserRole> = {
  [UserRole.USER]: PrismaUserRole.USER,
  [UserRole.ADMIN]: PrismaUserRole.ADMIN,
  [UserRole.SUPER_ADMIN]: PrismaUserRole.SUPER_ADMIN,
};

/** Map the shared role to the Prisma enum for persistence. */
export function toPrismaUserRole(role: UserRole): PrismaUserRole {
  return ROLE_TO_PRISMA[role];
}

export function toPublicUser(user: UserForPublic): PublicUser {
  const role = toUserRole(user.role);
  const custom = user.customRole ?? null;
  const customPermissions = custom ? toPermissions(custom.permissions) : null;

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role,
    // Effective permissions resolved HERE, once, from the same shared rule the
    // client would use — custom role overlays the built-in role's base set.
    permissions: resolveUserPermissions({
      role,
      callsEnabled: user.callsEnabled,
      customRolePermissions: customPermissions,
    }),
    roleName: custom?.name ?? ROLE_META[role].label,
    landingPath: custom?.defaultLanding ?? '/app',
    callsEnabled: user.callsEnabled,
    doNotDisturb: user.doNotDisturb,
    createdAt: user.createdAt.toISOString(),
  };
}
