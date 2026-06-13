/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/users/users.module.ts
 * Layer:   Module wiring
 * Purpose: Compose the Users feature. Exports the service AND the repository so
 *          the Auth module can persist/lookup credentials without duplicating
 *          query logic.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Module } from '@nestjs/common';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { UsersController } from './users.controller';
import { AdminUsersController } from './admin-users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';

@Module({
  controllers: [UsersController, AdminUsersController],
  providers: [UsersService, UsersRepository, PermissionGuard],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
