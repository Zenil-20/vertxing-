/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/common/permissions.spec.ts
 * Layer:   Test (unit)
 * Purpose: Pin down the ONE authorization rule the whole product reads from:
 *          role → base permissions, the per-user call lever, and the nav that
 *          falls out of it. If these drift, the sidebar and the server gate drift
 *          together — exactly the mismatch this model exists to prevent.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  Permission,
  permissionsForUser,
  roleAlwaysHasCalls,
  UserRole,
  visibleNav,
} from '@vertxing/shared';

describe('permission resolver', () => {
  it('USER is locked out of calls until the lever is on', () => {
    expect(permissionsForUser(UserRole.USER, { callsEnabled: false })).toEqual([
      Permission.MeetingsHost,
    ]);
    expect(permissionsForUser(UserRole.USER, { callsEnabled: true })).toContain(
      Permission.CallsStart,
    );
  });

  it('ADMIN/SUPER_ADMIN always hold calls regardless of the lever', () => {
    expect(roleAlwaysHasCalls(UserRole.USER)).toBe(false);
    expect(roleAlwaysHasCalls(UserRole.ADMIN)).toBe(true);
    expect(roleAlwaysHasCalls(UserRole.SUPER_ADMIN)).toBe(true);
    expect(permissionsForUser(UserRole.ADMIN, { callsEnabled: false })).toContain(
      Permission.CallsStart,
    );
  });

  it('only SUPER_ADMIN holds license.manage; ADMIN holds users.manage', () => {
    expect(permissionsForUser(UserRole.ADMIN, { callsEnabled: false })).toContain(
      Permission.UsersManage,
    );
    expect(permissionsForUser(UserRole.ADMIN, { callsEnabled: false })).not.toContain(
      Permission.LicenseManage,
    );
    expect(permissionsForUser(UserRole.SUPER_ADMIN, { callsEnabled: false })).toContain(
      Permission.LicenseManage,
    );
  });
});

describe('navigation visibility', () => {
  it('hides Contacts + Calls until call access is granted', () => {
    const lockedKeys = visibleNav(
      permissionsForUser(UserRole.USER, { callsEnabled: false }),
    ).map((n) => n.key);
    expect(lockedKeys).toEqual(['home', 'meetings', 'settings']);

    const grantedKeys = visibleNav(
      permissionsForUser(UserRole.USER, { callsEnabled: true }),
    ).map((n) => n.key);
    expect(grantedKeys).toEqual(['home', 'meetings', 'contacts', 'calls', 'settings']);
  });
});
