/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/components/call/HostWaitingTray.tsx
 * Layer:   Web / Call UI (waiting room — host side)
 * Purpose: Rendered for a host/co-host in a waiting-room meeting. Subscribes to
 *          the live knocker list over the socket and offers admit/deny per
 *          person. Hidden entirely when nobody is waiting, so it never clutters
 *          the call. The gateway re-checks RBAC on every admit/deny.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  RealtimeEvents,
  type WaitingListPayload,
  type WaitingParticipant,
} from '@vertxing/shared';
import { createSocket } from '@/lib/realtime';
import { session } from '@/lib/session';

export function HostWaitingTray({ roomName }: { roomName: string }) {
  const [waiting, setWaiting] = useState<WaitingParticipant[]>([]);
  const socketRef = useRef<ReturnType<typeof createSocket> | null>(null);

  useEffect(() => {
    const token = session.accessToken;
    if (!token) return;

    const socket = createSocket(token);
    socketRef.current = socket;
    socket.on('connect', () => {
      socket.emit(RealtimeEvents.HostWatch, { roomName });
    });
    socket.on(RealtimeEvents.WaitingList, (payload: WaitingListPayload) => {
      if (payload.roomName === roomName) setWaiting(payload.waiting);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomName]);

  function admit(identity: string) {
    socketRef.current?.emit(RealtimeEvents.Admit, { roomName, identity });
  }
  function deny(identity: string) {
    socketRef.current?.emit(RealtimeEvents.Deny, { roomName, identity });
  }

  return (
    <AnimatePresence>
      {waiting.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="glass"
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            zIndex: 30,
            width: 300,
            maxWidth: 'calc(100% - 24px)',
            padding: 14,
            borderRadius: 16,
          }}
        >
          <div className="row" style={{ gap: 8, marginBottom: 10 }}>
            <strong style={{ fontSize: 14 }}>Waiting to join</strong>
            <span className="badge badge-host">{waiting.length}</span>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            {waiting.map((p) => (
              <div key={p.identity} className="between" style={{ gap: 8 }}>
                <span style={{ fontSize: 14, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name}
                </span>
                <div className="row" style={{ gap: 6 }}>
                  <button
                    className="ctrl"
                    style={{ width: 34, height: 34, background: 'var(--success)', color: '#06241b', borderColor: 'transparent' }}
                    title="Admit"
                    onClick={() => admit(p.identity)}
                  >
                    <Check size={16} />
                  </button>
                  <button
                    className="ctrl off"
                    style={{ width: 34, height: 34 }}
                    title="Deny"
                    onClick={() => deny(p.identity)}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
