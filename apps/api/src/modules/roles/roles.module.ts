/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/roles/roles.module.ts
 * Layer:   Module wiring
 * Purpose: Compose the dynamic-roles feature. Imports UsersModule so the
 *          SuperAdminGuard can read the caller's role live from the DB.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { RolesRepository } from './roles.repository';

@Module({
  imports: [UsersModule],
  controllers: [RolesController],
  providers: [RolesService, RolesRepository, PermissionGuard, SuperAdminGuard],
  exports: [RolesService],
})
export class RolesModule {}
