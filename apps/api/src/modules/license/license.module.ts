/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/license/license.module.ts
 * Layer:   Module wiring
 * Purpose: Compose licensing. Imports UsersModule (seat usage = account count)
 *          and JwtModule (sign/verify keys — secret passed per call). Exports
 *          LicenseService so AuthService can enforce seats at registration.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { LicenseController } from './license.controller';
import { LicenseService } from './license.service';

@Module({
  imports: [UsersModule, JwtModule.register({})],
  controllers: [LicenseController],
  providers: [LicenseService, SuperAdminGuard],
  exports: [LicenseService],
})
export class LicenseModule {}
