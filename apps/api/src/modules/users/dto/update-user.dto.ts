/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/users/dto/update-user.dto.ts
 * Layer:   Presentation / Validation (DTO)
 * Purpose: Body for PATCH /admin/users/:id — a partial privilege update. Either
 *          field may be present; the hierarchy is enforced in the service, not
 *          here (this only validates SHAPE).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { type UpdateUserRequest, UserRole } from '@vertxing/shared';

export class UpdateUserDto implements UpdateUserRequest {
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
