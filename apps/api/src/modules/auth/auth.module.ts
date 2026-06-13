/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/auth/auth.module.ts
 * Layer:   Module wiring
 * Purpose: Compose the Auth feature. Imports UsersModule (for credential
 *          persistence), JwtModule (token signing — secrets are passed per-call
 *          in TokenService, so register({}) is intentional), and PassportModule.
 *          Registering JwtStrategy here makes the global JwtAuthGuard work.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { LicenseModule } from '../license/license.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [UsersModule, LicenseModule, PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, TokenService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
