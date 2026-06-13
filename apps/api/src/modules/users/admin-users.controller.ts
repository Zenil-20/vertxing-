/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/users/admin-users.controller.ts
 * Layer:   Presentation / HTTP (privileged)
 * Purpose: The user-management surface, gated by Permission.UsersManage (ADMIN and
 *          SUPER_ADMIN). List accounts, change a user's role, grant/revoke call
 *          access, bulk-apply, and delete. ACCESS is enforced live by
 *          PermissionGuard; the management HIERARCHY (who may touch whom) is
 *          enforced in UsersService — controllers stay thin.
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
import { type AdminUser, Permission } from '@vertxing/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { BulkUpdateUsersDto } from './dto/bulk-update-users.dto';

@Controller('admin/users')
@UseGuards(PermissionGuard)
@RequirePermission(Permission.UsersManage)
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}

  /** GET /admin/users — all accounts with role + call access. */
  @Get()
  list(): Promise<AdminUser[]> {
    return this.users.listAll();
  }

  /** POST /admin/users/bulk — apply one change to many users (all-or-nothing). */
  @Post('bulk')
  bulk(
    @CurrentUser('userId') actorId: string,
    @Body() dto: BulkUpdateUsersDto,
  ): Promise<AdminUser[]> {
    return this.users.bulkUpdate(actorId, dto);
  }

  /** PATCH /admin/users/:id — change role and/or call access for one user. */
  @Patch(':id')
  update(
    @CurrentUser('userId') actorId: string,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<AdminUser> {
    return this.users.updateUser(actorId, id, dto);
  }

  /** DELETE /admin/users/:id — permanently remove an account. */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(
    @CurrentUser('userId') actorId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.users.deleteUser(actorId, id);
  }
}
