/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/users/dto/bulk-update-users.dto.ts
 * Layer:   Presentation / Validation (DTO)
 * Purpose: Body for POST /admin/users/bulk — apply ONE change (role and/or call
 *          access) to many users at once. The service authorizes every target
 *          before applying, all-or-nothing.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { type BulkUpdateUsersRequest, UserRole } from '@vertxing/shared';

export class BulkUpdateUsersDto implements BulkUpdateUsersRequest {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  userIds!: string[];

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  // string = assign a custom role; null = clear back to the built-in role.
  // @IsOptional() permits BOTH null and undefined, so an explicit null passes.
  @IsOptional()
  @IsString()
  customRoleId?: string | null;

  @IsOptional()
  @IsBoolean()
  callsEnabled?: boolean;
}
