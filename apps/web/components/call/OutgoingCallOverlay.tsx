/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/components/call/OutgoingCallOverlay.tsx
 * Layer:   Web / Call UI
 * Purpose: The caller's "Calling X…" ringback screen with a Cancel button.
 *          Pure presentation; the CallProvider drives state + handlers.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import { motion } from 'framer-motion';
import { PhoneOff } from 'lucide-react';
import type { CallMode } from '@vertxing/shared';

interface OutgoingCallOverlayProps {
  peer: { id: string; name: string };
  mode: CallMode;
  onCancel: () => void;
}

export function OutgoingCallOverlay({ peer, mode, onCancel }: OutgoingCallOverlayProps) {
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
        <div style={{ position: 'relative', width: 96, height: 96, margin: '0 auto 18px' }}>
          <motion.span
            animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: 'easeOut' }}
            style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--brand-1)' }}
          />
          <div
            style={{
              position: 'relative',
              width: 96,
              height: 96,
              borderRadius: '50%',
              background: 'var(--grad-brand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 34,
              fontWeight: 700,
            }}
          >
            {peer.name.slice(0, 1).toUpperCase()}
          </div>
        </div>

        <h2 style={{ fontSize: 22 }}>{peer.name}</h2>
        <p className="muted" style={{ marginTop: 4, marginBottom: 28 }}>
          Calling… ({mode === 'VIDEO' ? 'video' : 'audio'})
        </p>

        <button className="ctrl danger" style={{ width: 62, height: 62, margin: '0 auto' }} title="Cancel" onClick={onCancel}>
          <PhoneOff size={24} />
        </button>
      </div>
    </div>
  );
}
