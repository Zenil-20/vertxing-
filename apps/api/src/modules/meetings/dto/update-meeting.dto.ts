/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/meetings/dto/update-meeting.dto.ts
 * Layer:   Presentation / Validation (DTO)
 * Purpose: Validate PATCH /meetings/:roomName — rename and/or reschedule. Both
 *          fields are optional so a caller can change just one.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { UpdateMeetingRequest } from '@vertxing/shared';

export class UpdateMeetingDto implements UpdateMeetingRequest {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'scheduledStartAt must be an ISO-8601 date string' })
  scheduledStartAt?: string;
}
