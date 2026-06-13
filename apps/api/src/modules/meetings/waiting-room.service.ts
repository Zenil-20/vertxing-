/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/meetings/waiting-room.service.ts
 * Layer:   Application / Domain service (realtime admission state)
 * Purpose: Own the waiting-room state in Redis — VOLATILE by design:
 *            • waiting hash  `waiting:room:<room>`   identity → display name
 *            • admitted set  `admitted:room:<room>`  identities allowed in
 *            • denied  set   `denied:room:<room>`    identities KICKED from the
 *                            call (a removal blocklist — checked on (re)join)
 *          The denied set closes a real security hole: a removed/kicked guest
 *          must NOT be able to silently re-join off a stale `admitted` entry.
 *          Admit clears any prior denial; remove sets it and drops admission.
 *          All keys carry a TTL so abandoned meetings self-clean.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Injectable } from '@nestjs/common';
import type { WaitingParticipant } from '@vertxing/shared';
import { RedisService } from '../../infrastructure/redis/redis.service';

@Injectable()
export class WaitingRoomService {
  /** Auto-expire stale waiting/admitted/denied state after 4h. */
  private readonly ttlSeconds = 60 * 60 * 4;

  constructor(private readonly redis: RedisService) {}

  /** Guest asks to be let in. */
  async knock(roomName: string, identity: string, name: string): Promise<void> {
    const key = this.waitingKey(roomName);
    await this.redis.hashSet(key, identity, name);
    await this.redis.expire(key, this.ttlSeconds);
  }

  /** Guest gives up / disconnects before being admitted. */
  async cancelKnock(roomName: string, identity: string): Promise<void> {
    await this.redis.hashDelete(this.waitingKey(roomName), identity);
  }

  /**
   * Host lets a guest in: mark admitted, drop from the waiting list, and clear
   * any prior denial (admitting is an explicit decision to allow re-entry).
   */
  async admit(roomName: string, identity: string): Promise<void> {
    const key = this.admittedKey(roomName);
    await this.redis.addToSet(key, identity);
    await this.redis.expire(key, this.ttlSeconds);
    await this.redis.hashDelete(this.waitingKey(roomName), identity);
    await this.redis.removeFromSet(this.deniedKey(roomName), identity);
  }

  /**
   * Host rejects a KNOCK: remove from the waiting list and revoke any admission
   * (defensive). Does NOT permanently block — the guest may knock again.
   */
  async deny(roomName: string, identity: string): Promise<void> {
    await this.redis.hashDelete(this.waitingKey(roomName), identity);
    await this.redis.removeFromSet(this.admittedKey(roomName), identity);
  }

  /**
   * Host KICKS a participant who is already in the call: revoke admission and
   * add to the denial blocklist so they can't immediately re-join. Re-entry
   * requires an explicit admit() by the host.
   */
  async block(roomName: string, identity: string): Promise<void> {
    const key = this.deniedKey(roomName);
    await this.redis.addToSet(key, identity);
    await this.redis.expire(key, this.ttlSeconds);
    await this.redis.removeFromSet(this.admittedKey(roomName), identity);
    await this.redis.hashDelete(this.waitingKey(roomName), identity);
  }

  /** Whether a guest has been admitted (consulted by the join flow). */
  isAdmitted(roomName: string, identity: string): Promise<boolean> {
    return this.redis.setHas(this.admittedKey(roomName), identity);
  }

  /** Whether a guest is on the kick blocklist (blocked from re-joining). */
  isDenied(roomName: string, identity: string): Promise<boolean> {
    return this.redis.setHas(this.deniedKey(roomName), identity);
  }

  /** Current knockers, for the host's waiting tray. */
  async listWaiting(roomName: string): Promise<WaitingParticipant[]> {
    const map = await this.redis.hashGetAll(this.waitingKey(roomName));
    return Object.entries(map ?? {}).map(([identity, name]) => ({ identity, name }));
  }

  /** Tear down all waiting-room state for a meeting (on end/cancel). */
  async clearRoom(roomName: string): Promise<void> {
    await this.redis.delete(this.waitingKey(roomName));
    await this.redis.delete(this.admittedKey(roomName));
    await this.redis.delete(this.deniedKey(roomName));
  }

  private waitingKey(roomName: string): string {
    return `waiting:room:${roomName}`;
  }

  private admittedKey(roomName: string): string {
    return `admitted:room:${roomName}`;
  }

  private deniedKey(roomName: string): string {
    return `denied:room:${roomName}`;
  }
}
