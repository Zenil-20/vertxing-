/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/meetings/dto/create-meeting.dto.ts
 * Layer:   Presentation / Validation (DTO)
 * Purpose: Validate POST /meetings. `scheduledStartAt` is optional — omit it for
 *          an instant meeting, provide an ISO-8601 timestamp to schedule one.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  IsBoolean,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { CreateMeetingRequest } from '@vertxing/shared';

export class CreateMeetingDto implements CreateMeetingRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsISO8601({}, { message: 'scheduledStartAt must be an ISO-8601 date string' })
  scheduledStartAt?: string;

  @IsOptional()
  @IsBoolean()
  waitingRoomEnabled?: boolean;
}
