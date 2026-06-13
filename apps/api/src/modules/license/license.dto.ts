/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/license/license.dto.ts
 * Layer:   Presentation / Validation (DTO)
 * Purpose: Bodies for the super-admin license endpoints.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import {
  type ActivateLicenseRequest,
  type GenerateLicenseRequest,
  LicensePlan,
} from '@vertxing/shared';

export class ActivateLicenseDto implements ActivateLicenseRequest {
  @IsString()
  @IsNotEmpty()
  key!: string;
}

export class GenerateLicenseDto implements GenerateLicenseRequest {
  @IsEnum(LicensePlan)
  plan!: LicensePlan;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  seats?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  days?: number;
}
