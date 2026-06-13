/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/components/call/WaitingScreen.tsx
 * Layer:   Web / Call UI (waiting room — guest side)
 * Purpose: Shown when join returns WAITING. Opens the realtime socket, KNOCKS,
 *          and waits for the host's decision: on `admitted` it re-runs join (now
 *          allowed) via onAdmitted; on `denied` it shows a graceful dead-end.
 *          Cleanup withdraws the knock and closes the socket.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { type Meeting, RealtimeEvents } from '@vertxing/shared';
import { createSocket } from '@/lib/realtime';
import { session } from '@/lib/session';

interface WaitingScreenProps {
  meeting: Meeting;
  onAdmitted: () => void;
  onLeave: () => void;
}

export function WaitingScreen({ meeting, onAdmitted, onLeave }: WaitingScreenProps) {
  const [denied, setDenied] = useState(false);

  // Hold callbacks in refs so the socket effect depends ONLY on roomName.
  // Otherwise an inline parent callback changes identity each render, re-running
  // the effect and creating a new socket → duplicate knocks (a real race).
  const onAdmittedRef = useRef(onAdmitted);
  const onLeaveRef = useRef(onLeave);
  onAdmittedRef.current = onAdmitted;
  onLeaveRef.current = onLeave;

  useEffect(() => {
    const token = session.accessToken;
    if (!token) {
      onLeaveRef.current();
      return;
    }

    const socket = createSocket(token);
    // Runs on first connect AND on auto-reconnect — re-knocking is idempotent.
    socket.on('connect', () => {
      socket.emit(RealtimeEvents.Knock, { roomName: meeting.roomName });
    });
    socket.on(RealtimeEvents.Admitted, () => onAdmittedRef.current());
    socket.on(RealtimeEvents.Denied, () => setDenied(true));

    return () => {
      socket.emit(RealtimeEvents.CancelKnock, { roomName: meeting.roomName });
      socket.disconnect();
    };
  }, [meeting.roomName]);

  return (
    <div
      className="fade-up"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div className="card" style={{ maxWidth: 440, width: '100%', textAlign: 'center', padding: 40 }}>
        {denied ? (
          <>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🚪</div>
            <h1 style={{ fontSize: 24, marginBottom: 8 }}>Not this time</h1>
            <p className="muted" style={{ marginBottom: 24 }}>
              The host didn’t let you into “{meeting.title}”.
            </p>
            <button className="btn" onClick={onLeave}>
              Back to dashboard
            </button>
          </>
        ) : (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
              style={{ display: 'inline-flex', marginBottom: 18, color: 'var(--brand-2)' }}
            >
              <Loader2 size={40} />
            </motion.div>
            <h1 style={{ fontSize: 24, marginBottom: 8 }}>Waiting to be let in</h1>
            <p className="muted" style={{ marginBottom: 6 }}>
              The host has been notified you’re here.
            </p>
            <p className="faint" style={{ fontSize: 13, marginBottom: 26 }}>
              “{meeting.title}”
            </p>
            <button className="btn btn-ghost" onClick={onLeave}>
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
