/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/lib/realtime.ts
 * Layer:   Web / Realtime
 * Purpose: Thin factory for the waiting-room Socket.IO connection. The gateway
 *          lives at the HTTP server ROOT (not under the /api prefix), so we dial
 *          the bare origin and authenticate with the same access token as REST,
 *          passed in the handshake `auth` payload.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import { io, type Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function createSocket(token: string): Socket {
  return io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    autoConnect: true,
  });
}
