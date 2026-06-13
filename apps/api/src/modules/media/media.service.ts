/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/media/media.service.ts
 * Layer:   Media / Integration (SFU boundary)
 * Purpose: The single point of contact with the LiveKit SFU. Two roles:
 *            1. Mint short-lived, room-scoped ACCESS TOKENS for participants
 *               (what a browser uses to publish/subscribe media).
 *            2. ADMIN / moderation via RoomServiceClient — server-authoritative
 *               mute, remove, and end-room actions that hosts trigger through
 *               our RBAC-guarded REST endpoints, applied directly on the SFU.
 *          Keeping all SFU specifics here means the rest of the app never learns
 *          which media engine we use.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccessToken,
  RoomServiceClient,
  TrackType,
  WebhookReceiver,
  type WebhookEvent,
} from 'livekit-server-sdk';
import { ParticipantRole } from '@vertxing/shared';
import type { AppConfig } from '../../config/configuration';

/** Token TTL — long enough to outlast a meeting, short enough to limit reuse. */
const TOKEN_TTL_SECONDS = 60 * 60 * 4; // 4 hours

export interface RoomGrantOptions {
  roomName: string;
  /** Stable per-user identity inside the room (we use the user id). */
  identity: string;
  /** Human-readable name other participants see. */
  displayName: string;
  role: ParticipantRole;
}

@Injectable()
export class MediaService {
  /** Server-side admin client (HTTP control plane), created once. */
  private readonly roomService: RoomServiceClient;
  /** Verifies + parses signed LiveKit room/participant webhooks. */
  private readonly webhookReceiver: WebhookReceiver;

  constructor(private readonly config: ConfigService) {
    const { apiKey, apiSecret } = this.livekitConfig();
    this.roomService = new RoomServiceClient(this.httpUrl, apiKey, apiSecret);
    this.webhookReceiver = new WebhookReceiver(apiKey, apiSecret);
  }

  /** Verify the signature on a LiveKit webhook and return the parsed event. */
  receiveWebhook(body: string, authHeader: string): Promise<WebhookEvent> {
    return this.webhookReceiver.receive(body, authHeader);
  }

  /** Public WebSocket URL the browser dials to reach the SFU. */
  get serverUrl(): string {
    return this.livekitConfig().url;
  }

  /** Mint a room-scoped LiveKit access token for one participant. */
  async createAccessToken(opts: RoomGrantOptions): Promise<string> {
    const { apiKey, apiSecret } = this.livekitConfig();
    const isPrivileged =
      opts.role === ParticipantRole.HOST ||
      opts.role === ParticipantRole.CO_HOST;

    const token = new AccessToken(apiKey, apiSecret, {
      identity: opts.identity,
      name: opts.displayName,
      ttl: TOKEN_TTL_SECONDS,
    });

    token.addGrant({
      room: opts.roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true, // chat, reactions, raise-hand over the data channel
      roomAdmin: isPrivileged,
    });

    return token.toJwt();
  }

  // ── Moderation (server-authoritative; callers must already pass RBAC) ───────

  /** Mute (or request-unmute) every audio track a participant publishes. */
  async setParticipantMicMuted(
    roomName: string,
    identity: string,
    muted: boolean,
  ): Promise<void> {
    const participant = await this.roomService.getParticipant(roomName, identity);
    const audioTracks = participant.tracks.filter(
      (t) => t.type === TrackType.AUDIO,
    );
    await Promise.all(
      audioTracks.map((t) =>
        this.roomService.mutePublishedTrack(roomName, identity, t.sid, muted),
      ),
    );
  }

  /** Forcibly disconnect a participant from the room. */
  async removeParticipant(roomName: string, identity: string): Promise<void> {
    await this.roomService.removeParticipant(roomName, identity);
  }

  /** End the meeting for everyone by deleting the SFU room. */
  async endRoom(roomName: string): Promise<void> {
    await this.roomService.deleteRoom(roomName);
  }

  /**
   * Live participant count from the SFU, or null if the room doesn't exist.
   * Used to reconcile a meeting's status when webhooks aren't wired (so a
   * meeting can't stay "LIVE" after everyone has actually left).
   */
  async roomParticipantCount(roomName: string): Promise<number | null> {
    try {
      const rooms = await this.roomService.listRooms([roomName]);
      return rooms.length > 0 ? rooms[0].numParticipants : null;
    } catch {
      return null;
    }
  }

  // ── internals ──────────────────────────────────────────────────────────────

  /** RoomServiceClient speaks HTTP(S); derive it from the ws(s) signaling URL. */
  private get httpUrl(): string {
    return this.livekitConfig().url.replace(/^ws/, 'http');
  }

  private livekitConfig(): AppConfig['livekit'] {
    return this.config.getOrThrow<AppConfig['livekit']>('livekit');
  }
}
