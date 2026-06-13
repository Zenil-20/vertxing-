/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/roles/roles.service.ts
 * Layer:   Application / Domain service (Dynamic roles)
 * Purpose: CRUD for super-admin-defined roles, with the invariants that keep the
 *          authorization model safe:
 *            • a role's permissions are clamped to ASSIGNABLE_PERMISSIONS, so a
 *              custom role can NEVER include license.manage (no escalation)
 *            • the default landing must be a page the role can actually see
 *            • keys are unique, stable slugs
 *          Assignment of roles to users lives in UsersService; this owns the
 *          definitions only.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  ASSIGNABLE_PERMISSIONS,
  type CreateRoleRequest,
  type CustomRole,
  type Permission,
  Permission as Perm,
  toPermissions,
  type UpdateRoleRequest,
  visibleNav,
} from '@vertxing/shared';
import { type RoleWithCount, RolesRepository } from './roles.repository';

@Injectable()
export class RolesService {
  constructor(private readonly roles: RolesRepository) {}

  list(): Promise<CustomRole[]> {
    return this.roles.list().then((roles) => roles.map((r) => this.toCustomRole(r)));
  }

  async create(dto: CreateRoleRequest): Promise<CustomRole> {
    const name = (dto.name ?? '').trim();
    if (!name) throw new BadRequestException('Role name is required');

    const permissions = this.sanitizePermissions(dto.permissions);
    if (permissions.length === 0) {
      throw new BadRequestException('Pick at least one permission');
    }
    const defaultLanding = this.clampLanding(dto.defaultLanding, permissions);
    const key = await this.uniqueKey(name);

    const role = await this.roles.create({ name, key, permissions, defaultLanding });
    return this.toCustomRole(role);
  }

  async update(id: string, dto: UpdateRoleRequest): Promise<CustomRole> {
    const existing = await this.roles.findById(id);
    if (!existing) throw new NotFoundException('Role not found');

    const data: Prisma.RoleUpdateInput = {};
    let permissions = toPermissions(existing.permissions);

    if (dto.permissions !== undefined) {
      permissions = this.sanitizePermissions(dto.permissions);
      if (permissions.length === 0) throw new BadRequestException('Pick at least one permission');
      data.permissions = permissions;
    }
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('Role name is required');
      data.name = name; // the key stays stable so assignments never break
    }
    if (dto.defaultLanding !== undefined) {
      data.defaultLanding = this.clampLanding(dto.defaultLanding, permissions);
    } else if (dto.permissions !== undefined) {
      // Permissions changed — make sure the existing landing is still reachable.
      data.defaultLanding = this.clampLanding(existing.defaultLanding, permissions);
    }

    const role = await this.roles.update(id, data);
    return this.toCustomRole(role);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.roles.findById(id);
    if (!existing) throw new NotFoundException('Role not found');
    // Members revert to their built-in role via the schema's onDelete: SetNull.
    await this.roles.delete(id);
  }

  // ── internals ───────────────────────────────────────────────────────────────

  /** Keep only known, ASSIGNABLE permissions (drops license.manage + junk). */
  private sanitizePermissions(values: readonly string[]): Permission[] {
    const allowed = new Set<Permission>(ASSIGNABLE_PERMISSIONS);
    return [...new Set(toPermissions(values))].filter((p) => allowed.has(p));
  }

  /** A landing must be a nav href the role can see, else fall back to Home. */
  private clampLanding(landing: string | undefined, permissions: Permission[]): string {
    const allowed = new Set<string>(visibleNav(permissions).map((n) => n.href));
    if (permissions.includes(Perm.UsersManage)) {
      allowed.add('/app/admin/users');
      allowed.add('/app/admin/roles');
    }
    return landing && allowed.has(landing) ? landing : '/app';
  }

  /** Slug from the name, made unique with a numeric suffix if needed. */
  private async uniqueKey(name: string): Promise<string> {
    const base =
      name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'role';
    let key = base;
    let n = 2;
    // eslint-disable-next-line no-await-in-loop
    while (await this.roles.findByKey(key)) {
      key = `${base}-${n}`;
      n += 1;
    }
    return key;
  }

  private toCustomRole(role: RoleWithCount): CustomRole {
    return {
      id: role.id,
      name: role.name,
      key: role.key,
      permissions: toPermissions(role.permissions),
      defaultLanding: role.defaultLanding,
      memberCount: role._count.members,
      createdAt: role.createdAt.toISOString(),
    };
  }
}
