/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/auth/dto/login.dto.ts
 * Layer:   Presentation / Validation (DTO)
 * Purpose: Validate the POST /auth/login body. Intentionally lax on the password
 *          rules here (length is enforced at registration) — login just needs a
 *          well-formed pair; credential correctness is decided by the service.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { IsEmail, IsString, IsNotEmpty } from 'class-validator';
import type { LoginRequest } from '@vertxing/shared';

export class LoginDto implements LoginRequest {
  @IsEmail({}, { message: 'A valid email address is required' })
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
