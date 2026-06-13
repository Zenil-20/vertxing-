/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/app.module.ts
 * Layer:   Composition root
 * Purpose: Wire the whole API together. It:
 *            • loads + validates configuration globally (fail-fast on bad env)
 *            • registers the global infra modules (Prisma, Redis)
 *            • mounts the feature modules (Auth, Users, Meetings, Media)
 *            • installs the APP-WIDE cross-cutting providers so EVERY route is
 *              authenticated, validated, logged, response-wrapped, and has its
 *              errors normalised — without repeating a single decorator.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';

import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';

import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { RedisModule } from './infrastructure/redis/redis.module';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { MeetingsModule } from './modules/meetings/meetings.module';
import { MediaModule } from './modules/media/media.module';
import { EventsModule } from './modules/realtime/events.module';
import { LicenseModule } from './modules/license/license.module';
import { PushModule } from './modules/push/push.module';
import { HealthController } from './modules/health/health.controller';

import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnv,
      // Run from apps/api; the canonical .env lives at the monorepo root.
      envFilePath: ['../../.env', '.env'],
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    RolesModule,
    MeetingsModule,
    MediaModule,
    EventsModule,
    LicenseModule,
    PushModule,
  ],
  controllers: [HealthController],
  providers: [
    // Secure-by-default: every route needs a valid token unless @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Observability first, then envelope the payload.
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    // One uniform error shape for the whole API.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Validate + strip unknown fields + coerce types on every DTO.
    {
      provide: APP_PIPE,
      useFactory: () =>
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
          transformOptions: { enableImplicitConversion: true },
        }),
    },
  ],
})
export class AppModule {}
