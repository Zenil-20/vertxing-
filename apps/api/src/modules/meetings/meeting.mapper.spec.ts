/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/meetings/meeting.mapper.spec.ts
 * Layer:   Test (unit)
 * Purpose: Pin the meeting boundary mapper: Date→ISO, DB enum→shared enum, and
 *          the new participantCount/waitingRoom fields cross the wire correctly.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { MeetingStatus, ParticipantRole } from '@vertxing/shared';
import { toMeeting, toPrismaParticipantRole } from './meeting.mapper';

describe('meeting.mapper', () => {
  const row = {
    id: 'm1',
    title: 'Test',
    roomName: 'abc-def-ghi',
    status: 'LIVE',
    hostId: 'h1',
    waitingRoomEnabled: true,
    participantCount: 3,
    scheduledStartAt: null,
    startedAt: new Date('2026-01-01T00:00:00Z'),
    endedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  } as never;

  it('maps a row to the wire contract (ISO dates + enum + new fields)', () => {
    const m = toMeeting(row);
    expect(m.status).toBe(MeetingStatus.LIVE);
    expect(m.participantCount).toBe(3);
    expect(m.waitingRoomEnabled).toBe(true);
    expect(m.startedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(m.scheduledStartAt).toBeNull();
  });

  it('maps participant roles to the Prisma enum exhaustively', () => {
    expect(toPrismaParticipantRole(ParticipantRole.HOST)).toBe('HOST');
    expect(toPrismaParticipantRole(ParticipantRole.CO_HOST)).toBe('CO_HOST');
    expect(toPrismaParticipantRole(ParticipantRole.GUEST)).toBe('GUEST');
  });
});
