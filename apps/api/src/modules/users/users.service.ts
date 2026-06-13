/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/users/users.service.ts
 * Layer:   Application / Domain service
 * Purpose: User-centric business operations: self-service profile, the call
 *          directory, the "can this person start calls" gate, and PRIVILEGED user
 *          management (assign a built-in OR dynamic role, grant/revoke call
 *          access, delete). Assignment keeps one invariant: a custom role always
 *          sits at USER tier, so it can never escalate. The management hierarchy
 *          lives in ONE place (`assertActorMayManage`) so no controller bypasses it.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  type AdminUser,
  type BulkUpdateUsersRequest,
  type DirectoryUser,
  Permission,
  type PublicUser,
  resolveUserPermissions,
  toPermissions,
  type UpdateProfileRequest,
  type UpdateUserRequest,
  UserRole,
} from '@vertxing/shared';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { type UserWithRole, UsersRepository } from './users.repository';
import { toPrismaUserRole, toPublicUser, toUserRole } from './user.mapper';

/** The presence set the realtime gateway maintains (see CallService). */
const PRESENCE_ONLINE_KEY = 'presence:online';

/** Hierarchy tiers — a custom role never changes a user's tier (stays USER). */
const TIER: Record<UserRole, number> = {
  [UserRole.USER]: 1,
  [UserRole.ADMIN]: 2,
  [UserRole.SUPER_ADMIN]: 3,
};

@Injectable()
export class UsersService {
  constructor(
    private readonly users: UsersRepository,
    private readonly redis: RedisService,
  ) {}

  async getPublicById(id: string): Promise<PublicUser> {
    const user = await this.users.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return toPublicUser(user);
  }

  /** The call directory: everyone else, tagged with live reachability. */
  async getDirectory(currentUserId: string): Promise<DirectoryUser[]> {
    const [users, onlineIds] = await Promise.all([
      this.users.listExcept(currentUserId),
      this.redis.setMembers(PRESENCE_ONLINE_KEY),
    ]);
    const online = new Set(onlineIds);
    return users.map((u) => ({ ...toPublicUser(u), online: online.has(u.id) }));
  }

  /** Update the caller's own profile/availability. */
  async updateMe(userId: string, changes: UpdateProfileRequest): Promise<PublicUser> {
    const user = await this.users.update(userId, {
      ...(changes.doNotDisturb !== undefined ? { doNotDisturb: changes.doNotDisturb } : {}),
    });
    return toPublicUser(user);
  }

  /** Whether a user currently accepts INCOMING direct calls (privacy v1). */
  async acceptsCalls(userId: string): Promise<boolean> {
    const user = await this.users.findById(userId);
    return Boolean(user && !user.doNotDisturb);
  }

  /**
   * Whether a user is AUTHORIZED to START calls — the locked-by-default gate,
   * resolved through the custom-role overlay so the server agrees with the UI.
   */
  async canStartCalls(userId: string): Promise<boolean> {
    const user = await this.users.findById(userId);
    if (!user) return false;
    return this.permissionsOf(user).includes(Permission.CallsStart);
  }

  /** Store the native device's FCM token (for full-screen calls). */
  async setFcmToken(userId: string, token: string): Promise<void> {
    await this.users.update(userId, { fcmToken: token });
  }

  /** The user's latest native FCM token, or null. */
  async getFcmToken(userId: string): Promise<string | null> {
    const user = await this.users.findById(userId);
    return user?.fcmToken ?? null;
  }

  // ── Privileged user management (Permission.UsersManage) ─────────────────────

  /** Every account with its role + dynamic role + call lever. */
  async listAll(): Promise<AdminUser[]> {
    const users = await this.users.listAll();
    return users.map((u) => this.toAdminUser(u));
  }

  /**
   * Partially update a target: built-in role OR dynamic role, and/or call access.
   * Assigning a custom role drops the user to USER tier (the overlay can't
   * escalate); a built-in role clears any overlay. Authorized against the
   * hierarchy first.
   */
  async updateUser(
    actorId: string,
    targetId: string,
    changes: UpdateUserRequest,
  ): Promise<AdminUser> {
    const [actor, target] = await Promise.all([
      this.users.findById(actorId),
      this.users.findById(targetId),
    ]);
    if (!actor) throw new ForbiddenException('Authentication required');
    if (!target) throw new NotFoundException('User not found');

    await this.assertActorMayManage(actor, target, this.effectiveNewRole(changes));

    const data: Prisma.UserUpdateInput = {};
    if (changes.callsEnabled !== undefined) data.callsEnabled = changes.callsEnabled;

    if (changes.customRoleId !== undefined) {
      if (changes.customRoleId === null) {
        data.customRole = { disconnect: true };
      } else {
        if (!(await this.users.roleExists(changes.customRoleId))) {
          throw new NotFoundException('Role not found');
        }
        data.customRole = { connect: { id: changes.customRoleId } };
        data.role = toPrismaUserRole(UserRole.USER); // overlay sits at base tier
      }
    } else if (changes.role !== undefined) {
      data.role = toPrismaUserRole(changes.role);
      data.customRole = { disconnect: true }; // a built-in role replaces the overlay
    }

    const updated = await this.users.update(targetId, data);
    return this.toAdminUser(updated);
  }

  /** Hard-delete an account (cascades to its meetings/participations). */
  async deleteUser(actorId: string, targetId: string): Promise<void> {
    if (actorId === targetId) {
      throw new BadRequestException('You can’t delete your own account');
    }
    const [actor, target] = await Promise.all([
      this.users.findById(actorId),
      this.users.findById(targetId),
    ]);
    if (!actor) throw new ForbiddenException('Authentication required');
    if (!target) throw new NotFoundException('User not found');

    await this.assertActorMayManage(actor, target);
    if (
      toUserRole(target.role) === UserRole.SUPER_ADMIN &&
      (await this.users.countSuperAdmins()) <= 1
    ) {
      throw new BadRequestException('Cannot delete the last super-admin');
    }

    await this.users.delete(targetId);
  }

  /**
   * Apply ONE change (role / dynamic role / call access) to many users at once.
   * All-or-nothing: a single un-manageable target rejects the whole batch.
   */
  async bulkUpdate(actorId: string, dto: BulkUpdateUsersRequest): Promise<AdminUser[]> {
    const ids = [...new Set(dto.userIds)];
    if (ids.length === 0) return [];

    const actor = await this.users.findById(actorId);
    if (!actor) throw new ForbiddenException('Authentication required');

    const targets = await this.users.findManyByIds(ids);
    const newRole = this.effectiveNewRole(dto);
    for (const target of targets) {
      await this.assertActorMayManage(actor, target, newRole);
    }

    // Batch-level last-super-admin guard (per-target checks can't see the batch).
    if (newRole !== undefined && newRole !== UserRole.SUPER_ADMIN) {
      const demotedSupers = targets.filter(
        (t) => toUserRole(t.role) === UserRole.SUPER_ADMIN,
      ).length;
      if (demotedSupers > 0 && (await this.users.countSuperAdmins()) - demotedSupers < 1) {
        throw new BadRequestException('Cannot remove the last super-admin');
      }
    }

    const data: Prisma.UserUncheckedUpdateManyInput = {};
    if (dto.callsEnabled !== undefined) data.callsEnabled = dto.callsEnabled;
    if (dto.customRoleId !== undefined) {
      if (dto.customRoleId === null) {
        data.customRoleId = null;
      } else {
        if (!(await this.users.roleExists(dto.customRoleId))) {
          throw new NotFoundException('Role not found');
        }
        data.customRoleId = dto.customRoleId;
        data.role = toPrismaUserRole(UserRole.USER);
      }
    } else if (dto.role !== undefined) {
      data.role = toPrismaUserRole(dto.role);
      data.customRoleId = null;
    }

    await this.users.updateMany(ids, data);
    const updated = await this.users.findManyByIds(ids);
    return updated.map((u) => this.toAdminUser(u));
  }

  // ── internals ───────────────────────────────────────────────────────────────

  /** Resolve a row's effective permissions through the custom-role overlay. */
  private permissionsOf(user: UserWithRole): Permission[] {
    return resolveUserPermissions({
      role: toUserRole(user.role),
      callsEnabled: user.callsEnabled,
      customRolePermissions: user.customRole ? toPermissions(user.customRole.permissions) : null,
    });
  }

  /** The built-in tier a change resolves to (custom role ⇒ USER tier). */
  private effectiveNewRole(changes: { role?: UserRole; customRoleId?: string | null }): UserRole | undefined {
    if (changes.customRoleId !== undefined && changes.customRoleId !== null) return UserRole.USER;
    return changes.role;
  }

  /**
   * The ONE place the management hierarchy is enforced. Throws if `actor` may not
   * apply `newRole` (optional) to `target`:
   *   • you can't manage someone of a HIGHER built-in tier
   *   • only a super-admin may modify a super-admin or GRANT super-admin
   *   • the last super-admin can never be demoted (lock-out protection)
   */
  private async assertActorMayManage(
    actor: UserWithRole,
    target: UserWithRole,
    newRole?: UserRole,
  ): Promise<void> {
    const actorRole = toUserRole(actor.role);
    const targetRole = toUserRole(target.role);

    if (TIER[targetRole] > TIER[actorRole]) {
      throw new ForbiddenException('You can’t manage someone with a higher role');
    }
    if (newRole === UserRole.SUPER_ADMIN && actorRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only a super-admin can grant super-admin');
    }
    if (
      targetRole === UserRole.SUPER_ADMIN &&
      newRole !== undefined &&
      newRole !== UserRole.SUPER_ADMIN &&
      (await this.users.countSuperAdmins()) <= 1
    ) {
      throw new BadRequestException('Cannot remove the last super-admin');
    }
  }

  private toAdminUser(u: UserWithRole): AdminUser {
    return {
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      role: toUserRole(u.role),
      customRole: u.customRole ? { id: u.customRole.id, name: u.customRole.name } : null,
      callsEnabled: u.callsEnabled,
      createdAt: u.createdAt.toISOString(),
    };
  }
}
