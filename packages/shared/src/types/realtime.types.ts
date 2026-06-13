/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    packages/shared/src/types/realtime.types.ts
 * Layer:   Shared / Contracts (WebSocket)
 * Purpose: The wire protocol for the realtime (Socket.IO) channel that powers
 *          the WAITING ROOM. One source of truth for event names + payloads so
 *          the NestJS gateway and the browser client can't drift. Media itself
 *          never travels here — only admission control signals.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** A guest currently knocking on a meeting's waiting room. */
export interface WaitingParticipant {
  /** The user id (also their LiveKit identity once admitted). */
  identity: string;
  name: string;
}

/** Event names. Client→server and server→client, kept in one place. */
export const RealtimeEvents = {
  // client → server
  HostWatch: 'meeting:host-watch', // host starts receiving the waiting list
  Knock: 'meeting:knock', // guest asks to be let in
  CancelKnock: 'meeting:cancel-knock', // guest gives up waiting
  Admit: 'meeting:admit', // host lets a guest in
  Deny: 'meeting:deny', // host rejects a guest
  // server → client
  WaitingList: 'meeting:waiting-list', // → hosts: current knockers
  Admitted: 'meeting:admitted', // → guest: you're in, re-join now
  Denied: 'meeting:denied', // → guest: rejected
} as const;

export interface RoomScopedPayload {
  roomName: string;
}

export interface TargetParticipantPayload {
  roomName: string;
  identity: string;
}

export interface WaitingListPayload {
  roomName: string;
  waiting: WaitingParticipant[];
}
