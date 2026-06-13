/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/meetings/meeting.mapper.ts
 * Layer:   Application / Mapping (anti-corruption boundary)
 * Purpose: Convert a persistence `Meeting` row into the `Meeting` wire contract —
 *          Date → ISO string, DB enum → shared enum. The Record map is
 *          exhaustive, so adding a status to the schema without handling it here
 *          is a compile error, not a silent bug.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { Meeting as PrismaMeeting } from '@prisma/client';
import { ParticipantRole as PrismaParticipantRole } from '@prisma/client';
import {
  type Meeting,
  MeetingStatus,
  ParticipantRole,
} from '@vertxing/shared';

const STATUS_MAP: Record<PrismaMeeting['status'], MeetingStatus> = {
  SCHEDULED: MeetingStatus.SCHEDULED,
  LIVE: MeetingStatus.LIVE,
  ENDED: MeetingStatus.ENDED,
  CANCELLED: MeetingStatus.CANCELLED,
};

const PARTICIPANT_ROLE_TO_PRISMA: Record<ParticipantRole, PrismaParticipantRole> = {
  [ParticipantRole.HOST]: PrismaParticipantRole.HOST,
  [ParticipantRole.CO_HOST]: PrismaParticipantRole.CO_HOST,
  [ParticipantRole.GUEST]: PrismaParticipantRole.GUEST,
};

/** Map the shared participant role to the Prisma enum for persistence. */
export function toPrismaParticipantRole(
  role: ParticipantRole,
): PrismaParticipantRole {
  return PARTICIPANT_ROLE_TO_PRISMA[role];
}

export function toMeeting(meeting: PrismaMeeting): Meeting {
  return {
    id: meeting.id,
    title: meeting.title,
    roomName: meeting.roomName,
    status: STATUS_MAP[meeting.status],
    hostId: meeting.hostId,
    waitingRoomEnabled: meeting.waitingRoomEnabled,
    participantCount: meeting.participantCount,
    scheduledStartAt: meeting.scheduledStartAt?.toISOString() ?? null,
    startedAt: meeting.startedAt?.toISOString() ?? null,
    endedAt: meeting.endedAt?.toISOString() ?? null,
    createdAt: meeting.createdAt.toISOString(),
  };
}
