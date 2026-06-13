/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/roles/dto/update-role.dto.ts
 * Layer:   Presentation / Validation (DTO)
 * Purpose: Body for PATCH /admin/roles/:id — every field optional (partial edit).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ArrayNotEmpty, IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ASSIGNABLE_PERMISSIONS, type Permission, type UpdateRoleRequest } from '@vertxing/shared';

const ASSIGNABLE = ASSIGNABLE_PERMISSIONS as readonly string[];

export class UpdateRoleDto implements UpdateRoleRequest {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(ASSIGNABLE, { each: true })
  permissions?: Permission[];

  @IsOptional()
  @IsString()
  defaultLanding?: string;
}
