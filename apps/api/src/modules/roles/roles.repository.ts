/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/roles/roles.repository.ts
 * Layer:   Infrastructure / Persistence (repository)
 * Purpose: The ONLY component that issues Prisma queries for the `roles` table.
 *          Every read carries a live member count so the admin always sees how
 *          many users a role affects before editing or deleting it.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Injectable } from '@nestjs/common';
import type { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

const WITH_COUNT = { _count: { select: { members: true } } } as const;

export type RoleWithCount = Role & { _count: { members: number } };

@Injectable()
export class RolesRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<RoleWithCount[]> {
    return this.prisma.role.findMany({ orderBy: { createdAt: 'asc' }, include: WITH_COUNT });
  }

  findById(id: string): Promise<RoleWithCount | null> {
    return this.prisma.role.findUnique({ where: { id }, include: WITH_COUNT });
  }

  findByKey(key: string): Promise<Role | null> {
    return this.prisma.role.findUnique({ where: { key } });
  }

  create(data: Prisma.RoleCreateInput): Promise<RoleWithCount> {
    return this.prisma.role.create({ data, include: WITH_COUNT });
  }

  update(id: string, data: Prisma.RoleUpdateInput): Promise<RoleWithCount> {
    return this.prisma.role.update({ where: { id }, data, include: WITH_COUNT });
  }

  delete(id: string): Promise<Role> {
    return this.prisma.role.delete({ where: { id } });
  }
}
