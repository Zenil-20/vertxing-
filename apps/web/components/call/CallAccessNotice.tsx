/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/components/call/CallAccessNotice.tsx
 * Layer:   Web / Call UI
 * Purpose: The friendly wall a user hits when they reach a call surface without
 *          call access (locked-by-default). The nav already hides these routes;
 *          this covers DIRECT navigation and makes the next step obvious — ask an
 *          administrator. No dead ends, no browser-native anything.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import { Lock } from 'lucide-react';

export function CallAccessNotice() {
  return (
    <div className="card" style={{ textAlign: 'center', padding: 48 }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'var(--surface-hi)',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          color: 'var(--text-dim)',
        }}
      >
        <Lock size={24} />
      </div>
      <strong>Calling isn’t enabled for your account</strong>
      <p className="muted" style={{ fontSize: 14, marginTop: 6, maxWidth: 360, marginInline: 'auto' }}>
        Direct calls are turned off for you. Contact your administrator to request access.
      </p>
    </div>
  );
}
