/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/users/dto/update-profile.dto.ts
 * Layer:   Presentation / Validation (DTO)
 * Purpose: Body for PATCH /users/me — self-service availability (more profile
 *          fields land here as Settings grows).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { IsBoolean, IsOptional } from 'class-validator';
import type { UpdateProfileRequest } from '@vertxing/shared';

export class UpdateProfileDto implements UpdateProfileRequest {
  @IsOptional()
  @IsBoolean()
  doNotDisturb?: boolean;
}
