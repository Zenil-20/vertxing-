/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/meetings/meetings.service.ts
 * Layer:   Application / Domain service (the meeting use-cases)
 * Purpose: Own the meeting lifecycle and the JOIN handshake — the heart of the
 *          product. On join it: authorises the user, lazily flips the meeting to
 *          LIVE, records the participant, marks live presence in Redis, and asks
 *          MediaService for an SFU token. The browser gets back everything it
 *          needs to open its WebRTC connection. Persistence and media specifics
 *          stay behind their respective collaborators.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Meeting as MeetingRow } from '@prisma/client';
import type { WebhookEvent } from 'livekit-server-sdk';
import {
  type JoinMeetingResult,
  type Meeting,
  ParticipantRole,
} from '@vertxing/shared';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { MediaService } from '../media/media.service';
import { UsersService } from '../users/users.service';
import { MeetingsRepository } from './meetings.repository';
import { WaitingRoomService } from './waiting-room.service';
import { toMeeting, toPrismaParticipantRole } from './meeting.mapper';
import type { CreateMeetingDto } from './dto/create-meeting.dto';

@Injectable()
export class MeetingsService {
  constructor(
    private readonly meetings: MeetingsRepository,
    private readonly media: MediaService,
    private readonly users: UsersService,
    private readonly redis: RedisService,
    private readonly waitingRoom: WaitingRoomService,
  ) {}

  /** Create a meeting owned by `hostId`. Omitting a start time = instant. */
  async create(hostId: string, dto: CreateMeetingDto): Promise<Meeting> {
    this.assertFuture(dto.scheduledStartAt);
    const meeting = await this.meetings.create({
      title: dto.title.trim(),
      roomName: this.generateRoomName(),
      waitingRoomEnabled: dto.waitingRoomEnabled ?? false,
      scheduledStartAt: dto.scheduledStartAt
        ? new Date(dto.scheduledStartAt)
        : null,
      host: { connect: { id: hostId } },
    });
    return toMeeting(meeting);
  }

  /** Meetings the user hosts, newest first (status reconciled against the SFU). */
  async listMine(hostId: string): Promise<Meeting[]> {
    const rows = await this.meetings.listByHost(hostId);
    const reconciled = await Promise.all(rows.map((r) => this.reconcile(r)));
    return reconciled.map(toMeeting);
  }

  /** Public-ish meeting detail by its shareable room name. */
  async getByRoomName(roomName: string): Promise<Meeting> {
    const meeting = await this.meetings.findByRoomName(roomName);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }
    return toMeeting(await this.reconcile(meeting));
  }

  /**
   * Keep a LIVE meeting honest. After a short grace (so a just-started meeting
   * whose first participant is still connecting isn't killed), if the SFU room
   * is empty or gone, mark it ENDED; otherwise sync the live participant count.
   * This is the no-webhook safety net behind the "stuck LIVE" fix.
   */
  private async reconcile(m: MeetingRow): Promise<MeetingRow> {
    if (m.status !== 'LIVE') return m;
    if (m.startedAt && Date.now() - m.startedAt.getTime() < 90_000) return m;

    const count = await this.media.roomParticipantCount(m.roomName);
    if (count === null || count === 0) {
      await this.tryEndRoom(m.roomName);
      return this.meetings.update(m.id, {
        status: 'ENDED',
        endedAt: new Date(),
        participantCount: 0,
      });
    }
    if (count !== m.participantCount) {
      return this.meetings.update(m.id, { participantCount: count });
    }
    return m;
  }

  /**
   * Join a meeting: returns the meeting, the caller's role, and a LiveKit token.
   * The host is whoever created the meeting; everyone else joins as GUEST.
   */
  async join(
    roomName: string,
    user: AuthenticatedUser,
  ): Promise<JoinMeetingResult> {
    let meeting = await this.meetings.findByRoomName(roomName);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }
    if (meeting.status === 'ENDED' || meeting.status === 'CANCELLED') {
      throw new ForbiddenException('This meeting is no longer active');
    }

    const role =
      meeting.hostId === user.userId
        ? ParticipantRole.HOST
        : ParticipantRole.GUEST;

    // A guest the host KICKED cannot silently re-join — even off a stale
    // admission — until a host explicitly re-admits them.
    if (
      role === ParticipantRole.GUEST &&
      (await this.waitingRoom.isDenied(roomName, user.userId))
    ) {
      throw new ForbiddenException('You were removed from this meeting');
    }

    // Waiting-room gate: a guest who hasn't been admitted is held in the lobby.
    // Hosts and co-hosts always bypass; an already-admitted guest proceeds.
    if (meeting.waitingRoomEnabled && role === ParticipantRole.GUEST) {
      const admitted = await this.waitingRoom.isAdmitted(roomName, user.userId);
      if (!admitted) {
        return { status: 'WAITING', meeting: toMeeting(meeting) };
      }
    }

    // First join transitions a scheduled/instant meeting to LIVE.
    if (meeting.status === 'SCHEDULED') {
      meeting = await this.meetings.markLive(meeting.id, new Date());
    }

    await this.meetings.upsertParticipant(
      meeting.id,
      user.userId,
      toPrismaParticipantRole(role),
    );
    await this.redis.addToSet(this.presenceKey(roomName), user.userId);

    // Use the real display name (not the email) for the in-room label.
    const profile = await this.users.getPublicById(user.userId);
    const accessToken = await this.media.createAccessToken({
      roomName,
      identity: user.userId,
      displayName: profile.displayName,
      role,
    });

    return {
      status: 'ADMITTED',
      meeting: toMeeting(meeting),
      role,
      livekit: {
        url: this.media.serverUrl,
        accessToken,
        identity: user.userId,
      },
    };
  }

  // ── Gateway-facing helpers (used by the realtime WebSocket layer) ───────────

  /** Boolean RBAC check (no throw) — may this user moderate this meeting? */
  async canManage(roomName: string, userId: string): Promise<boolean> {
    try {
      await this.requireManageable(roomName, userId);
      return true;
    } catch {
      return false;
    }
  }

  /** True only if the meeting exists AND has its waiting room enabled. */
  async isWaitingRoomMeeting(roomName: string): Promise<boolean> {
    const meeting = await this.meetings.findByRoomName(roomName);
    return Boolean(meeting?.waitingRoomEnabled);
  }

  // ── Host / co-host management (RBAC-guarded) ────────────────────────────────

  /** Rename and/or reschedule a meeting. Host or co-host only. */
  async update(
    roomName: string,
    userId: string,
    changes: { title?: string; scheduledStartAt?: string },
  ): Promise<Meeting> {
    this.assertFuture(changes.scheduledStartAt);
    const meeting = await this.requireManageable(roomName, userId);
    const updated = await this.meetings.update(meeting.id, {
      ...(changes.title !== undefined ? { title: changes.title.trim() } : {}),
      ...(changes.scheduledStartAt !== undefined
        ? { scheduledStartAt: new Date(changes.scheduledStartAt) }
        : {}),
    });
    return toMeeting(updated);
  }

  /** Cancel a scheduled meeting. Host or co-host only. */
  async cancel(roomName: string, userId: string): Promise<Meeting> {
    const meeting = await this.requireManageable(roomName, userId);
    await this.tryEndRoom(roomName);
    const updated = await this.meetings.update(meeting.id, {
      status: 'CANCELLED',
    });
    return toMeeting(updated);
  }

  /** End a live meeting for everyone (deletes the SFU room). Host/co-host only. */
  async end(roomName: string, userId: string): Promise<Meeting> {
    const meeting = await this.requireManageable(roomName, userId);
    await this.tryEndRoom(roomName);
    const updated = await this.meetings.update(meeting.id, {
      status: 'ENDED',
      endedAt: new Date(),
    });
    return toMeeting(updated);
  }

  /** Permanently delete a meeting (host/co-host). Tears down any live room. */
  async delete(roomName: string, userId: string): Promise<void> {
    const meeting = await this.requireManageable(roomName, userId);
    await this.tryEndRoom(roomName);
    await this.meetings.delete(meeting.id);
  }

  /**
   * Reconcile meeting state from an authoritative LiveKit room webhook — the
   * single source of truth for "is anyone actually in the room". This keeps
   * status honest (no more "LIVE with 0 participants") and drives the live count.
   */
  async handleRoomEvent(event: WebhookEvent): Promise<void> {
    const roomName = event.room?.name;
    if (!roomName) return;
    const meeting = await this.meetings.findByRoomName(roomName);
    if (!meeting) return;

    const count = event.room?.numParticipants ?? 0;

    switch (event.event) {
      case 'room_started':
        await this.meetings.update(meeting.id, {
          status: 'LIVE',
          startedAt: meeting.startedAt ?? new Date(),
          participantCount: count,
        });
        break;
      case 'participant_joined':
      case 'participant_left':
        await this.meetings.update(meeting.id, {
          participantCount: count,
          ...(meeting.status === 'SCHEDULED'
            ? { status: 'LIVE', startedAt: new Date() }
            : {}),
        });
        break;
      case 'room_finished':
        await this.meetings.update(meeting.id, {
          status: 'ENDED',
          endedAt: new Date(),
          participantCount: 0,
        });
        await this.waitingRoom.clearRoom(roomName);
        await this.redis.delete(this.presenceKey(roomName));
        break;
      default:
        break;
    }
  }

  /** Mute / request-unmute a participant's microphone. Host/co-host only. */
  async muteParticipant(
    roomName: string,
    userId: string,
    targetIdentity: string,
    muted: boolean,
  ): Promise<void> {
    await this.requireManageable(roomName, userId);
    await this.media.setParticipantMicMuted(roomName, targetIdentity, muted);
  }

  /** Remove a participant from the room. Host/co-host only. */
  async removeParticipant(
    roomName: string,
    userId: string,
    targetIdentity: string,
  ): Promise<void> {
    await this.requireManageable(roomName, userId);
    // Best-effort SFU removal — the target may have already dropped; the
    // security state below must still apply regardless.
    try {
      await this.media.removeParticipant(roomName, targetIdentity);
    } catch {
      // Participant not currently connected to the SFU; ignore.
    }
    await this.redis.removeFromSet(this.presenceKey(roomName), targetIdentity);
    // Block re-entry until a host explicitly re-admits them.
    await this.waitingRoom.block(roomName, targetIdentity);
  }

  /**
   * Load a meeting and assert the caller may manage it (is host or co-host).
   * Throws 404 if missing, 403 if the caller lacks the role.
   */
  private async requireManageable(
    roomName: string,
    userId: string,
  ): Promise<{ id: string; hostId: string }> {
    const meeting = await this.meetings.findByRoomName(roomName);
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }
    if (meeting.hostId === userId) {
      return meeting;
    }
    const participant = await this.meetings.findParticipant(meeting.id, userId);
    if (participant?.role === 'CO_HOST') {
      return meeting;
    }
    throw new ForbiddenException('Only the host or a co-host can do that');
  }

  /**
   * Best-effort teardown when a meeting ends/cancels: drop the SFU room and
   * purge all volatile Redis state (presence + waiting/admitted/denied) so a
   * finished meeting leaves nothing behind.
   */
  private async tryEndRoom(roomName: string): Promise<void> {
    try {
      await this.media.endRoom(roomName);
    } catch {
      // Room may never have been created (no one joined); safe to ignore.
    }
    await this.waitingRoom.clearRoom(roomName);
    await this.redis.delete(this.presenceKey(roomName));
  }

  /** Reject scheduling/rescheduling into the past. */
  private assertFuture(iso?: string): void {
    if (iso && new Date(iso).getTime() < Date.now()) {
      throw new BadRequestException('Scheduled time must be in the future');
    }
  }

  private presenceKey(roomName: string): string {
    return `presence:room:${roomName}`;
  }

  /**
   * Generate a shareable, hard-to-guess room name: 9 random bytes rendered as
   * 12 url-safe chars, grouped `xxxx-xxxx-xxxx` (à la Google Meet). The DB's
   * unique constraint on roomName is the final guard against the rare collision.
   */
  private generateRoomName(): string {
    const raw = randomBytes(9).toString('base64url').replace(/[-_]/g, '');
    const s = (raw + 'abcdefghijkl').slice(0, 12).toLowerCase();
    return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
  }
}
