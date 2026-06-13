/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    packages/shared/src/types/meeting.types.ts
 * Layer:   Shared / Contracts
 * Purpose: Meeting + participant contracts and the media-join handshake shape.
 *          A "meeting" is the durable, schedulable entity (persisted in
 *          Postgres). A LiveKit "room" is the ephemeral media session keyed by
 *          the meeting's `roomName`. `JoinMeetingResult` is what the client
 *          needs to actually connect its WebRTC tracks to the SFU.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Lifecycle of a meeting. */
export enum MeetingStatus {
  SCHEDULED = 'SCHEDULED',
  LIVE = 'LIVE',
  ENDED = 'ENDED',
  CANCELLED = 'CANCELLED',
}

/** Per-meeting authorization role (distinct from the platform UserRole). */
export enum ParticipantRole {
  HOST = 'HOST',
  CO_HOST = 'CO_HOST',
  GUEST = 'GUEST',
}

/** Durable meeting entity as exposed to clients. */
export interface Meeting {
  id: string;
  title: string;
  /** Stable, unguessable identifier used in the join URL and as the SFU room. */
  roomName: string;
  status: MeetingStatus;
  hostId: string;
  /** When true, guests must be admitted by a host before they get a token. */
  waitingRoomEnabled: boolean;
  /** Live participant count, reconciled from LiveKit room webhooks. */
  participantCount: number;
  scheduledStartAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
}

/** Body for POST /meetings. */
export interface CreateMeetingRequest {
  title: string;
  /** ISO-8601. Omit to start an instant meeting. */
  scheduledStartAt?: string;
  /** Default false. Enable to gate guests behind host approval. */
  waitingRoomEnabled?: boolean;
}

/** Body for PATCH /meetings/:roomName — reschedule and/or rename. */
export interface UpdateMeetingRequest {
  title?: string;
  /** ISO-8601 new start time. */
  scheduledStartAt?: string;
}

/**
 * Host/co-host moderation actions, enforced server-side with RBAC and applied
 * to the SFU via LiveKit's RoomServiceClient. `identity` is the target
 * participant's LiveKit identity (which is their user id).
 */
export interface MuteParticipantRequest {
  identity: string;
  /** true = mute, false = ask to unmute. */
  muted: boolean;
}

export interface RemoveParticipantRequest {
  identity: string;
}

/**
 * Result of POST /meetings/:roomName/join — a discriminated union:
 *   • ADMITTED — everything the browser needs to connect media to the SFU. The
 *     `accessToken` is a LiveKit-signed JWT scoped to this room and identity,
 *     NOT a Vertxing auth token.
 *   • WAITING  — the meeting has a waiting room and this guest hasn't been let
 *     in yet. The client should knock over the realtime channel and wait.
 */
export interface JoinAdmittedResult {
  status: 'ADMITTED';
  meeting: Meeting;
  role: ParticipantRole;
  livekit: {
    /** WebSocket URL of the SFU the client should dial. */
    url: string;
    /** Short-lived LiveKit access token granting room join + publish. */
    accessToken: string;
    /** The display identity the participant will appear as. */
    identity: string;
  };
}

export interface JoinWaitingResult {
  status: 'WAITING';
  meeting: Meeting;
}

export type JoinMeetingResult = JoinAdmittedResult | JoinWaitingResult;
