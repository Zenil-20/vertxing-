/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/realtime/call.service.ts
 * Layer:   Realtime / Domain service (Direct Calls — the race-safe engine)
 * Purpose: The call lifecycle state machine. State lives in Redis (volatile);
 *          EVERY transition is an atomic compare-and-set from an EXPECTED prior
 *          state, so racing events can never both win:
 *            RINGING ─accept▶ ACTIVE ─hangup▶ ENDED
 *            RINGING ─decline▶ DECLINED   ─cancel▶ CANCELLED   ─timeout▶ MISSED
 *          A per-pair lock (atomic SET-NX) resolves GLARE (A↔B at once): exactly
 *          one invite acquires it; the other is told "busy" and instead sees the
 *          winner's incoming call. Media is LiveKit; this class is pure control.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  type CallEndReason,
  type CallFailureReason,
  type CallMode,
  ParticipantRole,
} from '@vertxing/shared';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { MediaService } from '../media/media.service';
import { PushService } from '../push/push.service';
import { UsersService } from '../users/users.service';

export interface CallParty {
  userId: string;
  name: string;
}

export type InviteOutcome =
  | { ok: true; callId: string; roomName: string }
  | { ok: false; reason: CallFailureReason };

export type AcceptOutcome =
  | {
      ok: true;
      callId: string;
      mode: CallMode;
      url: string;
      callerId: string;
      callerToken: string;
      calleeToken: string;
    }
  | { ok: false; reason: CallFailureReason };

export interface EndResult {
  callId: string;
  otherId: string;
  reason: CallEndReason;
}

type CallMeta = Record<string, string>;
type RingingRole = 'caller' | 'callee';

@Injectable()
export class CallService {
  /** Ring duration before a call auto-transitions to MISSED. */
  static readonly RING_TIMEOUT_MS = 35_000;

  /** Redis TTLs: ringing keys live just past the timeout; active calls last hours. */
  private readonly ringTtl = 40;
  private readonly activeTtl = 60 * 60 * 4;
  private readonly onlineKey = 'presence:online';

  constructor(
    private readonly redis: RedisService,
    private readonly media: MediaService,
    private readonly users: UsersService,
    private readonly push: PushService,
  ) {}

  // ── Presence (ref-counted across a user's sockets) ──────────────────────────
  // A user may hold several sockets at once (the app-wide call socket plus a
  // transient waiting-room socket). We only flip them offline when the LAST one
  // closes — otherwise closing one socket would wrongly mark them unreachable.

  async markOnline(userId: string): Promise<void> {
    const count = await this.redis.increment(this.presenceCountKey(userId));
    if (count === 1) await this.redis.addToSet(this.onlineKey, userId);
  }

  async markOffline(userId: string): Promise<void> {
    const count = await this.redis.decrement(this.presenceCountKey(userId));
    if (count <= 0) {
      await this.redis.removeFromSet(this.onlineKey, userId);
      await this.redis.delete(this.presenceCountKey(userId));
    }
  }

  isOnline(userId: string): Promise<boolean> {
    return this.redis.setHas(this.onlineKey, userId);
  }

  private presenceCountKey(userId: string): string {
    return `presencecount:${userId}`;
  }

  // ── Lifecycle transitions ─────────────────────────────────────────────────

  /**
   * Place a call. Acquires the pair lock (glare guard) and starts ringing.
   * `existingRoom` is passed by addParticipant so an "add" rings the new person
   * into the SAME LiveKit room instead of creating a fresh one.
   */
  async invite(
    caller: CallParty,
    calleeId: string,
    mode: CallMode,
    existingRoom?: string,
  ): Promise<InviteOutcome> {
    if (calleeId === caller.userId) return { ok: false, reason: 'self' };
    // Authorization gate (locked-by-default): the CALLER must hold calls.start.
    // Enforced on the server, not just hidden in the UI — a revoked grant or a
    // forged client can't place a call. This is the super-admin's lever over
    // "who may call".
    if (!(await this.users.canStartCalls(caller.userId))) {
      return { ok: false, reason: 'unauthorized' };
    }
    // The callee may be CLOSED/backgrounded (no live socket) yet still reachable
    // by Web Push. Only fail "offline" when they have no live socket AND no push
    // subscription; otherwise ring on — the gateway sends the push.
    if (!(await this.isOnline(calleeId)) && !(await this.push.hasSubscriptions(calleeId))) {
      return { ok: false, reason: 'offline' };
    }
    // Respect Do-Not-Disturb (privacy v1).
    if (!(await this.users.acceptsCalls(calleeId))) return { ok: false, reason: 'unavailable' };

    const callId = randomUUID();
    const acquired = await this.redis.setIfAbsent(
      this.pairKey(caller.userId, calleeId),
      callId,
      this.ringTtl,
    );
    if (!acquired) return { ok: false, reason: 'busy' };

    const roomName = existingRoom ?? `call-${callId}`;
    await this.redis.hashSetObject(this.callKey(callId), {
      state: 'RINGING',
      callerId: caller.userId,
      callerName: caller.name,
      calleeId,
      mode,
      roomName,
    });
    await this.redis.expire(this.callKey(callId), this.ringTtl);
    return { ok: true, callId, roomName };
  }

  /**
   * Ring a new person INTO an existing active call (1:1 → group). The adder must
   * be a participant of the call; the new invite targets the same room, so when
   * the addee accepts they join the group. Media presence is then authoritative
   * via LiveKit; the per-invite records are just ring/accept bookkeeping.
   */
  async addParticipant(
    adder: CallParty,
    callId: string,
    calleeId: string,
  ): Promise<InviteOutcome> {
    const meta = await this.getMeta(callId);
    if (!meta || meta.state !== 'ACTIVE') return { ok: false, reason: 'gone' };
    if (adder.userId !== meta.callerId && adder.userId !== meta.calleeId) {
      return { ok: false, reason: 'forbidden' };
    }
    return this.invite(adder, calleeId, meta.mode as CallMode, meta.roomName);
  }

  /** Callee accepts. Atomic RINGING→ACTIVE; mints a LiveKit token for each side. */
  async accept(callId: string, callee: CallParty): Promise<AcceptOutcome> {
    const meta = await this.getMeta(callId);
    if (!meta) return { ok: false, reason: 'gone' };
    if (meta.calleeId !== callee.userId) return { ok: false, reason: 'forbidden' };

    const won = await this.redis.compareAndSetHashField(
      this.callKey(callId),
      'state',
      'RINGING',
      'ACTIVE',
    );
    if (!won) return { ok: false, reason: 'gone' };

    await this.redis.expire(this.callKey(callId), this.activeTtl);
    await this.redis.expire(this.pairKey(meta.callerId, meta.calleeId), this.activeTtl);

    const [callerToken, calleeToken] = await Promise.all([
      this.mint(meta.roomName, meta.callerId, meta.callerName),
      this.mint(meta.roomName, callee.userId, callee.name),
    ]);

    return {
      ok: true,
      callId,
      mode: meta.mode as CallMode,
      url: this.media.serverUrl,
      callerId: meta.callerId,
      callerToken,
      calleeToken,
    };
  }

  /** Callee rejects a ringing call. */
  decline(callId: string, userId: string): Promise<EndResult | null> {
    return this.terminateRinging(callId, userId, 'callee', 'DECLINED');
  }

  /** Caller withdraws a ringing call before it's answered. */
  cancel(callId: string, userId: string): Promise<EndResult | null> {
    return this.terminateRinging(callId, userId, 'caller', 'CANCELLED');
  }

  /** Either party leaves an ACTIVE call. */
  async hangup(callId: string, userId: string): Promise<EndResult | null> {
    const meta = await this.getMeta(callId);
    if (!meta) return null;
    if (meta.callerId !== userId && meta.calleeId !== userId) return null;

    const won = await this.redis.compareAndSetHashField(
      this.callKey(callId),
      'state',
      'ACTIVE',
      'ENDED',
    );
    if (!won) return null;

    await this.cleanup(callId, meta);
    return { callId, otherId: this.other(meta, userId), reason: 'ENDED' };
  }

  /** The ring window elapsed with no answer. */
  async timeout(callId: string): Promise<{ callerId: string; calleeId: string } | null> {
    const meta = await this.getMeta(callId);
    if (!meta) return null;

    const won = await this.redis.compareAndSetHashField(
      this.callKey(callId),
      'state',
      'RINGING',
      'MISSED',
    );
    if (!won) return null;

    await this.cleanup(callId, meta);
    return { callerId: meta.callerId, calleeId: meta.calleeId };
  }

  /**
   * A socket dropped (disconnect / network loss) — tear down whatever call it
   * was part of and report who to notify. Covers "caller hung up during
   * connect", "callee's phone died mid-ring", and "network drop in an active
   * call" — all without leaving a zombie call.
   */
  async drop(callId: string, userId: string): Promise<EndResult | null> {
    const meta = await this.getMeta(callId);
    if (!meta) return null;
    if (meta.state === 'ACTIVE') return this.hangup(callId, userId);
    if (meta.state === 'RINGING') {
      const role: RingingRole = meta.callerId === userId ? 'caller' : 'callee';
      const reason: CallEndReason = role === 'caller' ? 'CANCELLED' : 'DECLINED';
      return this.terminateRinging(callId, userId, role, reason);
    }
    return null;
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private async terminateRinging(
    callId: string,
    userId: string,
    role: RingingRole,
    reason: CallEndReason,
  ): Promise<EndResult | null> {
    const meta = await this.getMeta(callId);
    if (!meta) return null;
    const owner = role === 'caller' ? meta.callerId : meta.calleeId;
    if (owner !== userId) return null;

    const won = await this.redis.compareAndSetHashField(
      this.callKey(callId),
      'state',
      'RINGING',
      reason,
    );
    if (!won) return null;

    await this.cleanup(callId, meta);
    return { callId, otherId: this.other(meta, userId), reason };
  }

  private async cleanup(callId: string, meta: CallMeta): Promise<void> {
    await this.redis.deleteIfEquals(this.pairKey(meta.callerId, meta.calleeId), callId);
    await this.redis.delete(this.callKey(callId));
  }

  private other(meta: CallMeta, userId: string): string {
    return meta.callerId === userId ? meta.calleeId : meta.callerId;
  }

  private async getMeta(callId: string): Promise<CallMeta | null> {
    const meta = await this.redis.hashGetAll(this.callKey(callId));
    return meta && meta.state ? meta : null;
  }

  private mint(roomName: string, identity: string, name: string): Promise<string> {
    return this.media.createAccessToken({
      roomName,
      identity,
      displayName: name,
      role: ParticipantRole.GUEST,
    });
  }

  private callKey(callId: string): string {
    return `call:${callId}`;
  }

  /** Order-independent pair key so A→B and B→A contend for the SAME lock. */
  private pairKey(a: string, b: string): string {
    const [x, y] = [a, b].sort();
    return `calllock:${x}:${y}`;
  }
}
