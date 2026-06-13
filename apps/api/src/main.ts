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
  // Allow: requests with no Origin (curl / same-origin / native webview), any
  // explicitly-configured origin, and ANY Vercel deployment of this app — so the
  // web works even before CORS_ORIGINS is pinned to the exact production domain.
  app.enableCors({
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void): void => {
      if (!origin) return cb(null, true);
      let host = '';
      try {
        host = new URL(origin).hostname;
      } catch {
        /* malformed origin → falls through to the allow-list check */
      }
      cb(null, corsOrigins.includes(origin) || host.endsWith('.vercel.app'));
    },
    credentials: true,
  });
  app.enableShutdownHooks();

  // Bind 0.0.0.0 so the process is reachable inside a container / on a VM, not
  // just on loopback.
  await app.listen(port, '0.0.0.0');

  Logger.log(`Vertxing API listening on port ${port} (prefix /api)`, 'Bootstrap');
}

void bootstrap();
