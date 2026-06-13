/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/realtime/events.gateway.ts
 * Layer:   Realtime / WebSocket gateway (Socket.IO)
 * Purpose: The signaling channel for the WAITING ROOM (media never flows here).
 *          On connect it authenticates the socket with the SAME JWT access token
 *          as REST, joins a per-user room for targeted messages, then brokers:
 *            • guest  → knock / cancel-knock
 *            • host   → host-watch (subscribe to the list) / admit / deny
 *          Every host action is RBAC-checked via MeetingsService.canManage, so a
 *          guest can't forge an admit. Waiting state lives in Redis
 *          (WaitingRoomService); this class is pure transport + authorization.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  type AddToCallPayload,
  CallEvents,
  type InviteCallPayload,
  type CallIdPayload,
  type JwtPayload,
  RealtimeEvents,
  type RoomScopedPayload,
  type TargetParticipantPayload,
} from '@vertxing/shared';
import type { AppConfig } from '../../config/configuration';
import { MeetingsService } from '../meetings/meetings.service';
import { WaitingRoomService } from '../meetings/waiting-room.service';
import { UsersService } from '../users/users.service';
import { PushService } from '../push/push.service';
import { CallService } from './call.service';

interface SocketUser {
  userId: string;
  name: string;
}

/** Per-socket state we attach after authentication. */
interface SocketData {
  user: SocketUser;
  /** The room this socket is currently knocking on (for disconnect cleanup). */
  knockingRoom?: string;
  /** The call this socket is participating in (for disconnect teardown). */
  callId?: string;
}

@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly meetings: MeetingsService,
    private readonly waitingRoom: WaitingRoomService,
    private readonly users: UsersService,
    private readonly calls: CallService,
    private readonly push: PushService,
  ) {}

  /**
   * Authenticate during the Socket.IO HANDSHAKE via middleware. Middleware
   * BLOCKS the connection until it resolves, so by the time the client fires
   * 'connect' (and immediately emits) `socket.data.user` is already set. Doing
   * this async work in handleConnection instead caused a race where the first
   * messages arrived before auth finished and saw `user === undefined`.
   */
  afterInit(server: Server): void {
    server.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth?.token as string | undefined;
        if (!token) throw new Error('missing token');

        const { accessSecret } = this.config.getOrThrow<AppConfig['jwt']>('jwt');
        const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
          secret: accessSecret,
        });
        const profile = await this.users.getPublicById(payload.sub);
        (socket.data as SocketData).user = {
          userId: payload.sub,
          name: profile.displayName,
        };
        // Presence + user-room join happen HERE (the handshake blocks until this
        // resolves) so by the time the client can emit, it is already "online"
        // and in its user room. Doing this in handleConnection instead races: an
        // invite could arrive before the callee was registered or joined.
        await this.calls.markOnline(payload.sub);
        await socket.join(this.userRoom(payload.sub));
        next();
      } catch {
        this.logger.debug(`Rejected unauthenticated socket ${socket.id}`);
        next(new Error('unauthorized'));
      }
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    // Auth, presence, and the user-room join are all done in the handshake
    // middleware above — this only rejects a socket that somehow slipped through.
    const data = client.data as SocketData;
    if (!data?.user) client.disconnect(true);
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const data = client.data as SocketData;
    if (!data?.user) return;

    await this.calls.markOffline(data.user.userId);

    // If the guest was waiting, withdraw their knock and refresh the host view.
    if (data.knockingRoom) {
      await this.waitingRoom.cancelKnock(data.knockingRoom, data.user.userId);
      await this.broadcastWaitingList(data.knockingRoom);
    }

    // If they were in a call, tear it down and notify the other party.
    if (data.callId) {
      const ended = await this.calls.drop(data.callId, data.user.userId);
      if (ended) {
        this.server
          .to(this.userRoom(ended.otherId))
          .emit(CallEvents.Ended, { callId: ended.callId, reason: ended.reason });
      }
    }
  }

  /** Host subscribes to the waiting list for a meeting they manage. */
  @SubscribeMessage(RealtimeEvents.HostWatch)
  async onHostWatch(client: Socket, payload: RoomScopedPayload): Promise<void> {
    const user = this.requireUser(client);
    if (!user) return;
    if (!(await this.meetings.canManage(payload.roomName, user.userId))) return;

    await client.join(this.hostRoom(payload.roomName));
    const waiting = await this.waitingRoom.listWaiting(payload.roomName);
    client.emit(RealtimeEvents.WaitingList, { roomName: payload.roomName, waiting });
  }

  /** Guest asks to be let in. */
  @SubscribeMessage(RealtimeEvents.Knock)
  async onKnock(client: Socket, payload: RoomScopedPayload): Promise<void> {
    const user = this.requireUser(client);
    if (!user) return;

    // If the meeting has no waiting room, let them through immediately.
    if (!(await this.meetings.isWaitingRoomMeeting(payload.roomName))) {
      client.emit(RealtimeEvents.Admitted, { roomName: payload.roomName });
      return;
    }

    (client.data as SocketData).knockingRoom = payload.roomName;
    await this.waitingRoom.knock(payload.roomName, user.userId, user.name);
    await this.broadcastWaitingList(payload.roomName);
  }

  /** Guest gives up waiting. */
  @SubscribeMessage(RealtimeEvents.CancelKnock)
  async onCancelKnock(client: Socket, payload: RoomScopedPayload): Promise<void> {
    const user = this.requireUser(client);
    if (!user) return;
    (client.data as SocketData).knockingRoom = undefined;
    await this.waitingRoom.cancelKnock(payload.roomName, user.userId);
    await this.broadcastWaitingList(payload.roomName);
  }

  /** Host admits a specific guest. */
  @SubscribeMessage(RealtimeEvents.Admit)
  async onAdmit(client: Socket, payload: TargetParticipantPayload): Promise<void> {
    const user = this.requireUser(client);
    if (!user) return;
    if (!(await this.meetings.canManage(payload.roomName, user.userId))) return;
    // Only someone actually knocking can be admitted — no admitting arbitrary ids.
    if (!(await this.isWaiting(payload.roomName, payload.identity))) return;

    await this.waitingRoom.admit(payload.roomName, payload.identity);
    this.server
      .to(this.userRoom(payload.identity))
      .emit(RealtimeEvents.Admitted, { roomName: payload.roomName });
    await this.broadcastWaitingList(payload.roomName);
  }

  /** Host rejects a specific guest. */
  @SubscribeMessage(RealtimeEvents.Deny)
  async onDeny(client: Socket, payload: TargetParticipantPayload): Promise<void> {
    const user = this.requireUser(client);
    if (!user) return;
    if (!(await this.meetings.canManage(payload.roomName, user.userId))) return;
    if (!(await this.isWaiting(payload.roomName, payload.identity))) return;

    await this.waitingRoom.deny(payload.roomName, payload.identity);
    this.server
      .to(this.userRoom(payload.identity))
      .emit(RealtimeEvents.Denied, { roomName: payload.roomName });
    await this.broadcastWaitingList(payload.roomName);
  }

  /** Guard: is this identity currently in the room's waiting list? */
  private async isWaiting(roomName: string, identity: string): Promise<boolean> {
    const waiting = await this.waitingRoom.listWaiting(roomName);
    return waiting.some((w) => w.identity === identity);
  }

  // ── Direct Calls (Teams-style 1:1 signaling) ───────────────────────────────

  /** Caller places a call. Rings the callee; arms the no-answer timeout. */
  @SubscribeMessage(CallEvents.Invite)
  async onCallInvite(client: Socket, payload: InviteCallPayload): Promise<void> {
    const user = this.requireUser(client);
    if (!user) return;

    const result = await this.calls.invite(user, payload.calleeId, payload.mode);
    if (!result.ok) {
      client.emit(CallEvents.Failed, { reason: result.reason });
      return;
    }

    (client.data as SocketData).callId = result.callId;
    this.server.to(this.userRoom(payload.calleeId)).emit(CallEvents.Incoming, {
      callId: result.callId,
      from: { id: user.userId, name: user.name },
      mode: payload.mode,
    });
    client.emit(CallEvents.Ringing, { callId: result.callId, calleeId: payload.calleeId });

    // Closed/backgrounded callee (no live socket) → ring via Web Push so the
    // call reaches them even with the app not running.
    if (!(await this.calls.isOnline(payload.calleeId))) {
      await this.push.sendCallNotification(payload.calleeId, {
        type: 'incoming-call',
        callId: result.callId,
        from: { id: user.userId, name: user.name },
        mode: payload.mode,
      });
    }

    this.scheduleRingTimeout(result.callId);
  }

  /** Callee answers. Both sides receive their own LiveKit token to connect. */
  @SubscribeMessage(CallEvents.Accept)
  async onCallAccept(client: Socket, payload: CallIdPayload): Promise<void> {
    const user = this.requireUser(client);
    if (!user) return;

    const result = await this.calls.accept(payload.callId, user);
    if (!result.ok) {
      client.emit(CallEvents.Failed, { callId: payload.callId, reason: result.reason });
      return;
    }

    (client.data as SocketData).callId = payload.callId;
    client.emit(CallEvents.Accepted, {
      callId: result.callId,
      mode: result.mode,
      livekit: { url: result.url, token: result.calleeToken },
    });
    this.server.to(this.userRoom(result.callerId)).emit(CallEvents.Accepted, {
      callId: result.callId,
      mode: result.mode,
      livekit: { url: result.url, token: result.callerToken },
    });
  }

  /** Callee rejects a ringing call. */
  @SubscribeMessage(CallEvents.Decline)
  async onCallDecline(client: Socket, payload: CallIdPayload): Promise<void> {
    const user = this.requireUser(client);
    if (!user) return;
    this.notifyEnded(await this.calls.decline(payload.callId, user.userId));
  }

  /** Caller withdraws before answer. */
  @SubscribeMessage(CallEvents.Cancel)
  async onCallCancel(client: Socket, payload: CallIdPayload): Promise<void> {
    const user = this.requireUser(client);
    if (!user) return;
    (client.data as SocketData).callId = undefined;
    this.notifyEnded(await this.calls.cancel(payload.callId, user.userId));
  }

  /** Either party leaves an active call. */
  @SubscribeMessage(CallEvents.Hangup)
  async onCallHangup(client: Socket, payload: CallIdPayload): Promise<void> {
    const user = this.requireUser(client);
    if (!user) return;
    (client.data as SocketData).callId = undefined;
    this.notifyEnded(await this.calls.hangup(payload.callId, user.userId));
  }

  /** A participant rings a new person into the active call (1:1 → group). */
  @SubscribeMessage(CallEvents.Add)
  async onCallAdd(client: Socket, payload: AddToCallPayload): Promise<void> {
    const user = this.requireUser(client);
    if (!user) return;

    const result = await this.calls.addParticipant(user, payload.callId, payload.calleeId);
    if (!result.ok) {
      client.emit(CallEvents.Failed, { reason: result.reason });
      return;
    }
    // The added person rings through the normal incoming flow → on accept they
    // get a token for the SAME room and join the group.
    this.server.to(this.userRoom(payload.calleeId)).emit(CallEvents.Incoming, {
      callId: result.callId,
      from: { id: user.userId, name: user.name },
      mode: 'AUDIO',
    });
    if (!(await this.calls.isOnline(payload.calleeId))) {
      await this.push.sendCallNotification(payload.calleeId, {
        type: 'incoming-call',
        callId: result.callId,
        from: { id: user.userId, name: user.name },
        mode: 'AUDIO',
      });
    }
    this.scheduleRingTimeout(result.callId);
  }

  /** Fire the no-answer timeout; CAS makes it a no-op if already answered. */
  private scheduleRingTimeout(callId: string): void {
    setTimeout(() => {
      void this.onRingTimeout(callId);
    }, CallService.RING_TIMEOUT_MS);
  }

  private async onRingTimeout(callId: string): Promise<void> {
    const result = await this.calls.timeout(callId);
    if (!result) return; // already answered / cancelled / declined
    for (const userId of [result.callerId, result.calleeId]) {
      this.server.to(this.userRoom(userId)).emit(CallEvents.Ended, { callId, reason: 'MISSED' });
    }
  }

  /** Notify the other party that a call ended (shared by decline/cancel/hangup). */
  private notifyEnded(
    ended: { callId: string; otherId: string; reason: 'DECLINED' | 'CANCELLED' | 'MISSED' | 'ENDED' } | null,
  ): void {
    if (!ended) return;
    this.server
      .to(this.userRoom(ended.otherId))
      .emit(CallEvents.Ended, { callId: ended.callId, reason: ended.reason });
  }

  // ── helpers ─────────────────────────────────────────────────────────────────

  private async broadcastWaitingList(roomName: string): Promise<void> {
    const waiting = await this.waitingRoom.listWaiting(roomName);
    this.server.to(this.hostRoom(roomName)).emit(RealtimeEvents.WaitingList, {
      roomName,
      waiting,
    });
  }

  private requireUser(client: Socket): SocketUser | null {
    const user = (client.data as SocketData)?.user;
    return user ?? null;
  }

  private userRoom(userId: string): string {
    return `user:${userId}`;
  }

  private hostRoom(roomName: string): string {
    return `host:${roomName}`;
  }
}
