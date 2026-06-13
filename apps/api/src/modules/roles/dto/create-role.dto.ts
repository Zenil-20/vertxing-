/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/roles/dto/create-role.dto.ts
 * Layer:   Presentation / Validation (DTO)
 * Purpose: Body for POST /admin/roles. Validates SHAPE and rejects any permission
 *          outside the assignable set early; the service still clamps as defense.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ArrayNotEmpty, IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ASSIGNABLE_PERMISSIONS, type CreateRoleRequest, type Permission } from '@vertxing/shared';

const ASSIGNABLE = ASSIGNABLE_PERMISSIONS as readonly string[];

export class CreateRoleDto implements CreateRoleRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsIn(ASSIGNABLE, { each: true })
  permissions!: Permission[];

  @IsOptional()
  @IsString()
  defaultLanding?: string;
}
