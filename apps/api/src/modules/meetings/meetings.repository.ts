/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/meetings/meetings.repository.ts
 * Layer:   Infrastructure / Persistence (repository)
 * Purpose: All Prisma access for the `meetings` and `participants` tables. The
 *          participant write is an UPSERT keyed on (meetingId, userId) so a user
 *          re-joining the same meeting updates their row instead of erroring on
 *          the unique constraint.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Injectable } from '@nestjs/common';
import type {
  Meeting,
  Participant,
  ParticipantRole,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class MeetingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.MeetingCreateInput): Promise<Meeting> {
    return this.prisma.meeting.create({ data });
  }

  findByRoomName(roomName: string): Promise<Meeting | null> {
    return this.prisma.meeting.findUnique({ where: { roomName } });
  }

  findById(id: string): Promise<Meeting | null> {
    return this.prisma.meeting.findUnique({ where: { id } });
  }

  /** Meetings hosted by a user, newest first. */
  listByHost(hostId: string): Promise<Meeting[]> {
    return this.prisma.meeting.findMany({
      where: { hostId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Transition a SCHEDULED/instant meeting to LIVE on first join. */
  markLive(id: string, startedAt: Date): Promise<Meeting> {
    return this.prisma.meeting.update({
      where: { id },
      data: { status: 'LIVE', startedAt },
    });
  }

  /** Generic update (reschedule, rename, cancel, end). */
  update(id: string, data: Prisma.MeetingUpdateInput): Promise<Meeting> {
    return this.prisma.meeting.update({ where: { id }, data });
  }

  /** Permanently remove a meeting (cascades participants). */
  delete(id: string): Promise<Meeting> {
    return this.prisma.meeting.delete({ where: { id } });
  }

  /** The participant row for a user in a meeting — used for co-host RBAC. */
  findParticipant(
    meetingId: string,
    userId: string,
  ): Promise<Participant | null> {
    return this.prisma.participant.findUnique({
      where: { meetingId_userId: { meetingId, userId } },
    });
  }

  /** Insert or update the participant ledger row for (meeting, user). */
  upsertParticipant(
    meetingId: string,
    userId: string,
    role: ParticipantRole,
  ): Promise<Participant> {
    return this.prisma.participant.upsert({
      where: { meetingId_userId: { meetingId, userId } },
      create: { meetingId, userId, role, leftAt: null },
      update: { role, leftAt: null },
    });
  }
}
