/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/auth/dto/refresh.dto.ts
 * Layer:   Presentation / Validation (DTO)
 * Purpose: Body for POST /auth/refresh and POST /auth/logout — carries the
 *          long-lived refresh token to be rotated or revoked.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { IsJWT } from 'class-validator';

export class RefreshDto {
  @IsJWT({ message: 'A valid refresh token is required' })
  refreshToken!: string;
}
