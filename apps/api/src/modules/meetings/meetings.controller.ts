/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/meetings/meetings.controller.ts
 * Layer:   Presentation / HTTP
 * Purpose: The meeting resource endpoints. All require authentication (global
 *          JWT guard). The room name — not the database id — is the public
 *          handle used in URLs, so detail/join are keyed on it.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import type { JoinMeetingResult, Meeting } from '@vertxing/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { MeetingsService } from './meetings.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import {
  MuteParticipantDto,
  RemoveParticipantDto,
} from './dto/participant-action.dto';

@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  /** POST /meetings — create an instant or scheduled meeting. */
  @Post()
  create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateMeetingDto,
  ): Promise<Meeting> {
    return this.meetings.create(userId, dto);
  }

  /** GET /meetings — meetings the caller hosts. */
  @Get()
  listMine(@CurrentUser('userId') userId: string): Promise<Meeting[]> {
    return this.meetings.listMine(userId);
  }

  /** GET /meetings/:roomName — meeting detail by its shareable handle. */
  @Get(':roomName')
  getOne(@Param('roomName') roomName: string): Promise<Meeting> {
    return this.meetings.getByRoomName(roomName);
  }

  /** POST /meetings/:roomName/join — get an SFU token to connect media. */
  @Post(':roomName/join')
  join(
    @Param('roomName') roomName: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<JoinMeetingResult> {
    return this.meetings.join(roomName, user);
  }

  /** PATCH /meetings/:roomName — rename and/or reschedule (host/co-host). */
  @Patch(':roomName')
  update(
    @Param('roomName') roomName: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateMeetingDto,
  ): Promise<Meeting> {
    return this.meetings.update(roomName, userId, dto);
  }

  /** DELETE /meetings/:roomName — permanently delete a meeting (host/co-host). */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':roomName')
  async deleteMeeting(
    @Param('roomName') roomName: string,
    @CurrentUser('userId') userId: string,
  ): Promise<void> {
    await this.meetings.delete(roomName, userId);
  }

  /** POST /meetings/:roomName/cancel — cancel a scheduled meeting (host/co-host). */
  @HttpCode(HttpStatus.OK)
  @Post(':roomName/cancel')
  cancel(
    @Param('roomName') roomName: string,
    @CurrentUser('userId') userId: string,
  ): Promise<Meeting> {
    return this.meetings.cancel(roomName, userId);
  }

  /** POST /meetings/:roomName/end — end the meeting for everyone (host/co-host). */
  @HttpCode(HttpStatus.OK)
  @Post(':roomName/end')
  end(
    @Param('roomName') roomName: string,
    @CurrentUser('userId') userId: string,
  ): Promise<Meeting> {
    return this.meetings.end(roomName, userId);
  }

  /** POST /meetings/:roomName/participants/mute — mute a mic (host/co-host). */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post(':roomName/participants/mute')
  async mute(
    @Param('roomName') roomName: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: MuteParticipantDto,
  ): Promise<void> {
    await this.meetings.muteParticipant(roomName, userId, dto.identity, dto.muted);
  }

  /** POST /meetings/:roomName/participants/remove — kick a participant. */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post(':roomName/participants/remove')
  async remove(
    @Param('roomName') roomName: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: RemoveParticipantDto,
  ): Promise<void> {
    await this.meetings.removeParticipant(roomName, userId, dto.identity);
  }
}
