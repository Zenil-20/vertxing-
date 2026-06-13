/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/auth/dto/register.dto.ts
 * Layer:   Presentation / Validation (DTO)
 * Purpose: Define and VALIDATE the POST /auth/register body at the edge. The
 *          global ValidationPipe rejects anything that doesn't satisfy these
 *          rules before a single line of service code runs — invalid input never
 *          reaches the domain.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import type { RegisterRequest } from '@vertxing/shared';

export class RegisterDto implements RegisterRequest {
  @IsEmail({}, { message: 'A valid email address is required' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName!: string;
}
