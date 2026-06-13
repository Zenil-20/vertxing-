/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/meetings/dto/participant-action.dto.ts
 * Layer:   Presentation / Validation (DTO)
 * Purpose: Bodies for host moderation endpoints. `identity` is the target
 *          participant's LiveKit identity (their user id).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { IsBoolean, IsString, MinLength } from 'class-validator';
import type {
  MuteParticipantRequest,
  RemoveParticipantRequest,
} from '@vertxing/shared';

export class MuteParticipantDto implements MuteParticipantRequest {
  @IsString()
  @MinLength(1)
  identity!: string;

  @IsBoolean()
  muted!: boolean;
}

export class RemoveParticipantDto implements RemoveParticipantRequest {
  @IsString()
  @MinLength(1)
  identity!: string;
}
