/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/config/env.validation.ts
 * Layer:   Configuration
 * Purpose: Validate the process environment at boot. A misconfigured deployment
 *          (missing secret, non-numeric port) should crash LOUDLY on startup —
 *          never silently at the first request. ConfigModule runs this before
 *          the app is constructed; if it throws, the process exits.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { plainToInstance, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * Mirror of the variables in `.env.example`. Defaults are applied for anything
 * with a safe local value; secrets and connection strings are mandatory.
 */
class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  API_PORT: number = 4000;

  @IsString()
  @IsNotEmpty()
  CORS_ORIGINS!: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  REDIS_URL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  JWT_ACCESS_TTL: number = 900;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  JWT_REFRESH_TTL: number = 1_209_600;

  @IsString()
  @IsNotEmpty()
  LIVEKIT_URL!: string;

  @IsString()
  @IsNotEmpty()
  LIVEKIT_API_KEY!: string;

  @IsString()
  @IsNotEmpty()
  LIVEKIT_API_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  LICENSE_SECRET!: string;

  /** Optional: the email that is granted SUPER_ADMIN on registration. */
  @IsOptional()
  @IsString()
  SUPER_ADMIN_EMAIL?: string;

  /** Optional: Web Push (VAPID) keys. Absent ⇒ background push is disabled. */
  @IsOptional()
  @IsString()
  VAPID_PUBLIC_KEY?: string;

  @IsOptional()
  @IsString()
  VAPID_PRIVATE_KEY?: string;

  @IsOptional()
  @IsString()
  VAPID_SUBJECT?: string;
}

/**
 * ConfigModule `validate` hook. Coerces string env values to their declared
 * types and aborts boot with a readable report if anything is invalid.
 */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const report = errors
      .map((e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${report}`);
  }

  return validated;
}
