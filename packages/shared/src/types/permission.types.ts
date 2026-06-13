/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    packages/shared/src/types/permission.types.ts
 * Layer:   Shared / Contracts (Authorization — the ONE flow)
 * Purpose: Permissions are the SINGLE SOURCE OF TRUTH for what a user can see and
 *          do. A role is a sealed bundle of permissions; the sidebar, the admin
 *          surfaces, and the "who can call" gate all read from the SAME resolved
 *          permission set — never from a second, divergent rule. This is what
 *          keeps the product on one flow: change a permission here and every
 *          consumer (server guards + client nav) moves in lock-step.
 *
 *          Roles are FIXED (no UI role-editor) by deliberate product choice —
 *          lowest mismatch risk. The only per-user lever is `calls.start`, which
 *          a manager grants/revokes; admins and super-admins always hold it.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { UserRole } from './user.types';

/** Atomic, enforceable capabilities. Add one here, wire it to a guard + nav. */
export enum Permission {
  /** Create and host meetings (everyone can still JOIN a meeting by link). */
  MeetingsHost = 'meetings.host',
  /** Start a direct call to another user. The per-user lever (see callsEnabled). */
  CallsStart = 'calls.start',
  /** Manage accounts: list users, assign roles, grant/revoke call access. */
  UsersManage = 'users.manage',
  /** Activate and manage the org license + seats. */
  LicenseManage = 'license.manage',
}

/** Stable iteration order for the access-matrix preview. */
export const ALL_PERMISSIONS: readonly Permission[] = [
  Permission.MeetingsHost,
  Permission.CallsStart,
  Permission.UsersManage,
  Permission.LicenseManage,
];

/**
 * The SEALED role → base-permissions map. `calls.start` is intentionally NOT in
 * USER's base set — it is granted per user via `callsEnabled` (locked-by-default
 * policy). ADMIN and SUPER_ADMIN carry it in their base set, so the per-user
 * toggle is irrelevant for them (they can always call).
 */
export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  [UserRole.USER]: [Permission.MeetingsHost],
  [UserRole.ADMIN]: [
    Permission.MeetingsHost,
    Permission.CallsStart,
    Permission.UsersManage,
  ],
  [UserRole.SUPER_ADMIN]: [
    Permission.MeetingsHost,
    Permission.CallsStart,
    Permission.UsersManage,
    Permission.LicenseManage,
  ],
};

/**
 * Permissions a CUSTOM (dynamic) role may include. Deliberately EXCLUDES
 * `license.manage` — license control stays bound to the built-in SUPER_ADMIN tier
 * so a custom role can never escalate to owning the org's seats.
 */
export const ASSIGNABLE_PERMISSIONS: readonly Permission[] = [
  Permission.MeetingsHost,
  Permission.CallsStart,
  Permission.UsersManage,
];

/** Narrow an arbitrary string to a Permission (drops anything unknown). */
export function isPermission(value: string): value is Permission {
  return (ALL_PERMISSIONS as readonly string[]).includes(value);
}

/** Coerce stored permission strings (DB text[]) into a clean Permission list. */
export function toPermissions(values: readonly string[]): Permission[] {
  return values.filter(isPermission);
}

/** True when a role ALWAYS holds calls.start regardless of the per-user toggle. */
export function roleAlwaysHasCalls(role: UserRole): boolean {
  return ROLE_PERMISSIONS[role].includes(Permission.CallsStart);
}

/**
 * Resolve a user's EFFECTIVE permissions, honoring an optional custom-role
 * overlay. SUPER_ADMIN is always full (a custom role can never lock an owner
 * down or strip license control). Otherwise the base is the custom role's
 * permissions when present, else the built-in role's, plus the per-user call
 * lever. This is THE rule — server mapper and client both call it.
 */
export function resolveUserPermissions(input: {
  role: UserRole;
  callsEnabled: boolean;
  customRolePermissions?: readonly Permission[] | null;
}): Permission[] {
  if (input.role === UserRole.SUPER_ADMIN) {
    return [...ROLE_PERMISSIONS[UserRole.SUPER_ADMIN]];
  }
  const set = new Set<Permission>(input.customRolePermissions ?? ROLE_PERMISSIONS[input.role]);
  if (input.callsEnabled) set.add(Permission.CallsStart);
  return [...set];
}

/**
 * Resolve a user's EFFECTIVE permissions: their role's base set, plus calls.start
 * if the per-user lever is on. This is the only place the two inputs combine —
 * server (mapper/guards) and client (nav) both call it, so they can never drift.
 */
export function permissionsForUser(
  role: UserRole,
  opts: { callsEnabled: boolean },
): Permission[] {
  const set = new Set<Permission>(ROLE_PERMISSIONS[role]);
  if (opts.callsEnabled) set.add(Permission.CallsStart);
  return [...set];
}

/** Membership check (kept as a named helper so call sites read intent-first). */
export function hasPermission(
  permissions: readonly Permission[],
  permission: Permission,
): boolean {
  return permissions.includes(permission);
}

/** Human-facing copy for the access-matrix / role-preview screens. */
export const PERMISSION_META: Record<
  Permission,
  { label: string; description: string }
> = {
  [Permission.MeetingsHost]: {
    label: 'Host meetings',
    description: 'Create, schedule, and run meetings (anyone can join by link).',
  },
  [Permission.CallsStart]: {
    label: 'Start calls',
    description: 'Place direct calls to people in the directory.',
  },
  [Permission.UsersManage]: {
    label: 'Manage users',
    description: 'List accounts, assign roles, and grant or revoke call access.',
  },
  [Permission.LicenseManage]: {
    label: 'Manage license',
    description: 'Activate the org license and control available seats.',
  },
};

/** Human-facing copy for each role on the preview screen. */
export const ROLE_META: Record<UserRole, { label: string; description: string }> = {
  [UserRole.USER]: {
    label: 'User',
    description: 'Joins and hosts meetings. Calling is granted per user.',
  },
  [UserRole.ADMIN]: {
    label: 'Admin',
    description: 'Everything a user can do, plus manages accounts and call access.',
  },
  [UserRole.SUPER_ADMIN]: {
    label: 'Super-admin',
    description: 'Full control, including the org license. Cannot be locked out.',
  },
};

/**
 * Navigation as DATA — the one list both the live sidebar and the role-preview
 * read. `requiredPermission` omitted ⇒ always visible. Icons live in the web
 * layer (keyed by `key`) because contracts must stay framework-free.
 */
export interface NavItemConfig {
  key: string;
  label: string;
  href: string;
  requiredPermission?: Permission;
}

export const APP_NAV: readonly NavItemConfig[] = [
  { key: 'home', label: 'Home', href: '/app' },
  { key: 'meetings', label: 'Meetings', href: '/app/meetings' },
  // Contacts + Calls both require call access — their only purpose is calling, so
  // a user without it sees neither (super-admin grants it per user).
  { key: 'contacts', label: 'Contacts', href: '/app/contacts', requiredPermission: Permission.CallsStart },
  { key: 'calls', label: 'Calls', href: '/app/calls', requiredPermission: Permission.CallsStart },
  { key: 'settings', label: 'Settings', href: '/app/settings' },
];

/** The nav items a given permission set may see, in canonical order. */
export function visibleNav(permissions: readonly Permission[]): NavItemConfig[] {
  return APP_NAV.filter(
    (item) => !item.requiredPermission || permissions.includes(item.requiredPermission),
  );
}
