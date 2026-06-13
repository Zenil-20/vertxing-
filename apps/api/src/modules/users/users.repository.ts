/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/users/users.repository.ts
 * Layer:   Infrastructure / Persistence (repository)
 * Purpose: The ONLY component that issues Prisma queries for the `users` table.
 *          Reads include the optional `customRole` relation so the mapper can
 *          resolve effective permissions in one place. Services depend on this
 *          narrow interface, not on Prisma directly.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Injectable } from '@nestjs/common';
import type { Prisma, Role, User } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

/** A user joined with its (optional) dynamic role — the shape the mapper wants. */
export type UserWithRole = User & { customRole: Role | null };

// Always pull the custom role alongside the user so permission resolution never
// needs a second round-trip.
const WITH_ROLE = { customRole: true } as const;

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  findByEmail(email: string): Promise<UserWithRole | null> {
    return this.prisma.user.findUnique({ where: { email }, include: WITH_ROLE });
  }

  findById(id: string): Promise<UserWithRole | null> {
    return this.prisma.user.findUnique({ where: { id }, include: WITH_ROLE });
  }

  /** Total account count — the seat usage for license enforcement. */
  count(): Promise<number> {
    return this.prisma.user.count();
  }

  update(id: string, data: Prisma.UserUpdateInput): Promise<UserWithRole> {
    return this.prisma.user.update({ where: { id }, data, include: WITH_ROLE });
  }

  /**
   * Apply one change to many accounts in a single statement (bulk admin op).
   * Uses the UNCHECKED input so the `customRoleId`/`role` scalar columns can be
   * set directly (updateMany has no relation-connect form).
   */
  updateMany(ids: string[], data: Prisma.UserUncheckedUpdateManyInput): Promise<{ count: number }> {
    return this.prisma.user.updateMany({ where: { id: { in: ids } }, data });
  }

  /** Hard-delete an account. Cascades to its meetings/participations (schema). */
  delete(id: string): Promise<User> {
    return this.prisma.user.delete({ where: { id } });
  }

  /** Load several accounts at once (bulk authorization checks). */
  findManyByIds(ids: string[]): Promise<UserWithRole[]> {
    return this.prisma.user.findMany({ where: { id: { in: ids } }, include: WITH_ROLE });
  }

  /** Everyone except the caller, alphabetical — the call directory source. */
  listExcept(userId: string, limit = 100): Promise<UserWithRole[]> {
    return this.prisma.user.findMany({
      where: { id: { not: userId } },
      orderBy: { displayName: 'asc' },
      take: limit,
      include: WITH_ROLE,
    });
  }

  /** All accounts (Users & Roles admin), oldest first. */
  listAll(limit = 500): Promise<UserWithRole[]> {
    return this.prisma.user.findMany({ orderBy: { createdAt: 'asc' }, take: limit, include: WITH_ROLE });
  }

  /** How many super-admins exist — used to protect the last one. */
  countSuperAdmins(): Promise<number> {
    return this.prisma.user.count({ where: { role: 'SUPER_ADMIN' } });
  }

  /** Does a dynamic role exist? (validates an assignment without a module cycle) */
  async roleExists(roleId: string): Promise<boolean> {
    return (await this.prisma.role.count({ where: { id: roleId } })) > 0;
  }
}
