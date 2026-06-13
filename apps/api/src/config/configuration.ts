/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/config/configuration.ts
 * Layer:   Configuration
 * Purpose: Shape the validated, flat environment into a typed, namespaced config
 *          tree. The rest of the app reads strongly-typed slices via
 *          `ConfigService.getOrThrow<AppConfig['jwt']>('jwt')` and never touches
 *          `process.env` directly — that indirection keeps env access testable
 *          and the surface area auditable.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface AppConfig {
  env: string;
  port: number;
  /** Parsed list of CORS origins. */
  corsOrigins: string[];
  database: { url: string };
  redis: { url: string };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: number;
    refreshTtl: number;
  };
  livekit: {
    url: string;
    apiKey: string;
    apiSecret: string;
  };
  license: {
    secret: string;
    /** Email designated as super-admin on registration (operator-controlled). */
    superAdminEmail: string | null;
  };
  /** Web Push (VAPID) for background call notifications. Null ⇒ push disabled. */
  push: {
    vapidPublicKey: string | null;
    vapidPrivateKey: string | null;
    vapidSubject: string;
    /** Base64 of the Firebase service-account JSON (FCM sender). Null ⇒ FCM off. */
    fcmServiceAccountBase64: string | null;
  };
}

/** ConfigModule `load` factory. Runs after `validateEnv`, so values are sane. */
export default (): AppConfig => ({
  env: process.env.NODE_ENV ?? 'development',
  // Hosts like Render/Fly/Heroku inject PORT; honour it first so the container is
  // reachable. API_PORT is the explicit local override; 4000 is the dev default.
  port: parseInt(process.env.PORT ?? process.env.API_PORT ?? '4000', 10),
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  database: {
    url: process.env.DATABASE_URL!,
  },
  redis: {
    url: process.env.REDIS_URL!,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET!,
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    accessTtl: parseInt(process.env.JWT_ACCESS_TTL ?? '900', 10),
    refreshTtl: parseInt(process.env.JWT_REFRESH_TTL ?? '1209600', 10),
  },
  livekit: {
    url: process.env.LIVEKIT_URL!,
    apiKey: process.env.LIVEKIT_API_KEY!,
    apiSecret: process.env.LIVEKIT_API_SECRET!,
  },
  license: {
    secret: process.env.LICENSE_SECRET!,
    superAdminEmail: process.env.SUPER_ADMIN_EMAIL?.toLowerCase().trim() || null,
  },
  push: {
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY || null,
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || null,
    vapidSubject: process.env.VAPID_SUBJECT || 'mailto:admin@vertxing.dev',
    fcmServiceAccountBase64: process.env.FCM_SERVICE_ACCOUNT_BASE64 || null,
  },
});
