/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/components/call/IncomingCallModal.tsx
 * Layer:   Web / Call UI
 * Purpose: Full-screen "X is calling you" with a pulsing avatar and Accept/
 *          Decline. Pure presentation — the CallProvider owns the state and
 *          passes the handlers.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import { motion } from 'framer-motion';
import { Phone, PhoneOff } from 'lucide-react';
import type { CallMode } from '@vertxing/shared';

interface IncomingCallModalProps {
  peer: { id: string; name: string };
  mode: CallMode;
  onAccept: () => void;
  onDecline: () => void;
}

export function IncomingCallModal({ peer, mode, onAccept, onDecline }: IncomingCallModalProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(3,4,9,0.7)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div className="card fade-up" style={{ width: 360, maxWidth: '92vw', textAlign: 'center', padding: 36 }}>
        <motion.div
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
          style={{
            width: 96,
            height: 96,
            borderRadius: '50%',
            margin: '0 auto 18px',
            background: 'var(--grad-brand)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 34,
            fontWeight: 700,
            boxShadow: '0 0 0 8px rgba(124,92,255,0.18)',
          }}
        >
          {peer.name.slice(0, 1).toUpperCase()}
        </motion.div>

        <h2 style={{ fontSize: 22 }}>{peer.name}</h2>
        <p className="muted" style={{ marginTop: 4, marginBottom: 28 }}>
          Incoming {mode === 'VIDEO' ? 'video' : 'audio'} call…
        </p>

        <div className="row" style={{ justifyContent: 'center', gap: 28 }}>
          <button
            className="ctrl danger"
            style={{ width: 62, height: 62 }}
            title="Decline"
            onClick={onDecline}
          >
            <PhoneOff size={24} />
          </button>
          <button
            className="ctrl"
            style={{ width: 62, height: 62, background: 'var(--success)', color: '#06241b', borderColor: 'transparent' }}
            title="Accept"
            onClick={onAccept}
          >
            <Phone size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}
