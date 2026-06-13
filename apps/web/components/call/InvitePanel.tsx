/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/components/call/InvitePanel.tsx
 * Layer:   Web / Call UI
 * Purpose: How people get in. Surfaces the shareable join LINK and the human-
 *          readable meeting CODE (the roomName), each with one-tap copy. The
 *          link is built from the current origin so it works in any environment.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import { Check, Copy, Link2 } from 'lucide-react';
import { useState } from 'react';

export function InvitePanel({ roomName }: { roomName: string }) {
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);
  const joinUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/room/${roomName}` : '';

  async function copy(value: string, which: 'link' | 'code') {
    await navigator.clipboard.writeText(value);
    setCopied(which);
    window.setTimeout(() => setCopied(null), 1600);
  }

  return (
    <div className="stack">
      <p className="muted" style={{ fontSize: 14 }}>
        Share this with anyone you want in the call.
      </p>

      <div className="field">
        <label>Meeting link</label>
        <div className="row" style={{ gap: 8 }}>
          <input className="input" readOnly value={joinUrl} />
          <button className="btn btn-sm" onClick={() => copy(joinUrl, 'link')}>
            {copied === 'link' ? <Check size={16} /> : <Link2 size={16} />}
            {copied === 'link' ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="field" style={{ marginBottom: 0 }}>
        <label>Meeting code</label>
        <div className="row" style={{ gap: 8 }}>
          <input
            className="input"
            readOnly
            value={roomName}
            style={{ fontFamily: 'ui-monospace, monospace', letterSpacing: '0.05em' }}
          />
          <button className="btn btn-ghost btn-sm" onClick={() => copy(roomName, 'code')}>
            {copied === 'code' ? <Check size={16} /> : <Copy size={16} />}
            {copied === 'code' ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}
