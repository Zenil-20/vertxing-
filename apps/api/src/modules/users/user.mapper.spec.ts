/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/users/user.mapper.spec.ts
 * Layer:   Test (unit)
 * Purpose: Guarantee the user boundary never leaks the password hash, maps all
 *          roles (incl. SUPER_ADMIN), exposes doNotDisturb, and resolves the
 *          EFFECTIVE permissions the client trusts (role base + call lever).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Permission, UserRole } from '@vertxing/shared';
import { toPublicUser, toUserRole } from './user.mapper';

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    email: 'a@b.c',
    passwordHash: 'super-secret',
    displayName: 'Alice',
    avatarUrl: null,
    role: 'USER',
    doNotDisturb: false,
    callsEnabled: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  } as never;
}

describe('user.mapper', () => {
  it('maps every role', () => {
    expect(toUserRole('USER')).toBe(UserRole.USER);
    expect(toUserRole('ADMIN')).toBe(UserRole.ADMIN);
    expect(toUserRole('SUPER_ADMIN')).toBe(UserRole.SUPER_ADMIN);
  });

  it('never exposes the password hash and carries availability', () => {
    const pub = toPublicUser(row({ doNotDisturb: true }));
    expect(pub).not.toHaveProperty('passwordHash');
    expect(pub.doNotDisturb).toBe(true);
    expect(pub.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('a locked USER has no call permission; granting the lever adds it', () => {
    const locked = toPublicUser(row({ role: 'USER', callsEnabled: false }));
    expect(locked.callsEnabled).toBe(false);
    expect(locked.permissions).not.toContain(Permission.CallsStart);

    const granted = toPublicUser(row({ role: 'USER', callsEnabled: true }));
    expect(granted.permissions).toContain(Permission.CallsStart);
  });

  it('ADMIN can always call + manage users (lever is irrelevant)', () => {
    const admin = toPublicUser(row({ role: 'ADMIN', callsEnabled: false }));
    expect(admin.permissions).toEqual(
      expect.arrayContaining([Permission.CallsStart, Permission.UsersManage]),
    );
    expect(admin.permissions).not.toContain(Permission.LicenseManage);
  });

  it('SUPER_ADMIN holds the license permission', () => {
    const sa = toPublicUser(row({ role: 'SUPER_ADMIN' }));
    expect(sa.permissions).toContain(Permission.LicenseManage);
  });
});
