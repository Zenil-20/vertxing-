/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/roles/roles.controller.ts
 * Layer:   Presentation / HTTP (super-admin)
 * Purpose: Manage dynamic roles. DEFINING roles is defining authorization, so
 *          create/edit/delete are locked to SUPER_ADMIN. LISTING is open to anyone
 *          who can manage users (admins need it to ASSIGN roles). Both guards read
 *          the caller's role live from the DB.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { type CustomRole, Permission } from '@vertxing/shared';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

// Class gate: you must be able to manage users to even see roles. Mutations add a
// stricter SuperAdminGuard on top (both must pass).
@Controller('admin/roles')
@UseGuards(PermissionGuard)
@RequirePermission(Permission.UsersManage)
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  /** GET /admin/roles — all dynamic roles with live member counts. */
  @Get()
  list(): Promise<CustomRole[]> {
    return this.roles.list();
  }

  /** POST /admin/roles — define a new dynamic role (super-admin only). */
  @UseGuards(SuperAdminGuard)
  @Post()
  create(@Body() dto: CreateRoleDto): Promise<CustomRole> {
    return this.roles.create(dto);
  }

  /** PATCH /admin/roles/:id — edit name, permissions, or landing (super-admin). */
  @UseGuards(SuperAdminGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto): Promise<CustomRole> {
    return this.roles.update(id, dto);
  }

  /** DELETE /admin/roles/:id — members revert to their built-in role (super-admin). */
  @UseGuards(SuperAdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.roles.remove(id);
  }
}
