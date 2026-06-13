/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    packages/shared/src/types/call.types.ts
 * Layer:   Shared / Contracts (WebSocket — Direct Calls)
 * Purpose: The wire protocol for TEAMS-STYLE DIRECT CALLS (1:1, audio-first,
 *          escalatable to video). This is SIGNALING only — ring/accept/decline/
 *          cancel/hangup — the media itself flows over LiveKit once accepted.
 *          One source of truth so the gateway and every client (web + future
 *          mobile) speak the same language and can't drift.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Whether a call starts as audio (default) or video. Either side can escalate. */
export type CallMode = 'AUDIO' | 'VIDEO';

/** Terminal reasons a call ends (for analytics + the callee's "missed" badge). */
export type CallEndReason = 'DECLINED' | 'CANCELLED' | 'MISSED' | 'ENDED';

/** Why an invite couldn't even start ringing. */
export type CallFailureReason =
  | 'offline' // callee isn't connected
  | 'busy' // a call already exists between this pair (glare loser / in another call)
  | 'unavailable' // callee has Do-Not-Disturb on
  | 'unauthorized' // caller hasn't been granted call access (ask an administrator)
  | 'self' // can't call yourself
  | 'gone' // the call no longer exists / already transitioned
  | 'forbidden' // not your call to act on
  | 'error';

/** Call signaling event names — client→server and server→client in one place. */
export const CallEvents = {
  // client → server
  Invite: 'call:invite',
  Accept: 'call:accept',
  Decline: 'call:decline',
  Cancel: 'call:cancel', // caller withdraws before answer
  Hangup: 'call:hangup', // either party leaves an active call
  Add: 'call:add', // a participant rings a new person into the active call
  // server → client
  Incoming: 'call:incoming', // → callee: someone is calling you
  Ringing: 'call:ringing', // → caller: it's ringing on their end
  Accepted: 'call:accepted', // → both: here's your LiveKit token, connect
  Ended: 'call:ended', // → the other party: declined/cancelled/missed/hung up
  Failed: 'call:failed', // → caller: couldn't place the call
} as const;

export interface InviteCallPayload {
  calleeId: string;
  mode: CallMode;
}

export interface CallIdPayload {
  callId: string;
}

/** Ring a new person into the active call identified by `callId`. */
export interface AddToCallPayload {
  callId: string;
  calleeId: string;
}

export interface IncomingCallPayload {
  callId: string;
  from: { id: string; name: string };
  mode: CallMode;
}

export interface CallRingingPayload {
  callId: string;
  calleeId: string;
}

export interface CallAcceptedPayload {
  callId: string;
  mode: CallMode;
  livekit: { url: string; token: string };
}

export interface CallEndedPayload {
  callId: string;
  reason: CallEndReason;
}

export interface CallFailedPayload {
  callId?: string;
  reason: CallFailureReason;
}
