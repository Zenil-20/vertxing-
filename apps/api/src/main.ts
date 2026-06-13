/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/main.ts
 * Layer:   Process entrypoint / bootstrap
 * Purpose: Build and start the HTTP server. Responsibilities here are
 *          deliberately minimal — read config, set the global `/api` prefix,
 *          enable CORS for the known web origins, turn on shutdown hooks (so
 *          Prisma/Redis disconnect cleanly), and listen. Everything else is
 *          configured declaratively in AppModule.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  // rawBody is needed to verify the LiveKit webhook signature against the
  // exact bytes LiveKit sent (a parsed body would change them).
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);

  const port = config.getOrThrow<number>('port');
  const corsOrigins = config.getOrThrow<string[]>('corsOrigins');

  app.setGlobalPrefix('api');
  app.enableCors({ origin: corsOrigins, credentials: true });
  app.enableShutdownHooks();

  // Bind 0.0.0.0 so the process is reachable inside a container / on a VM, not
  // just on loopback.
  await app.listen(port, '0.0.0.0');

  Logger.log(`Vertxing API listening on port ${port} (prefix /api)`, 'Bootstrap');
}

void bootstrap();
