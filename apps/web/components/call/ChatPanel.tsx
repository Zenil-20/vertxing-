/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/components/call/ChatPanel.tsx
 * Layer:   Web / Call UI
 * Purpose: In-call text chat over LiveKit's data channel via `useChat` — no
 *          backend round-trip, messages flow peer↔SFU↔peers. Own messages align
 *          right with the brand gradient; others left. Auto-scrolls to newest.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import { useChat } from '@livekit/components-react';
import { Send } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';

export function ChatPanel({ localIdentity }: { localIdentity: string }) {
  const { chatMessages, send } = useChat();
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');
    await send(trimmed);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="stack" style={{ flex: 1, overflowY: 'auto', gap: 10, paddingRight: 2 }}>
        {chatMessages.length === 0 && (
          <p className="faint" style={{ fontSize: 13 }}>
            No messages yet. Say hi 👋
          </p>
        )}
        {chatMessages.map((m) => {
          const mine = m.from?.identity === localIdentity;
          return (
            <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
              {!mine && (
                <div className="faint" style={{ fontSize: 11, marginBottom: 2, paddingLeft: 4 }}>
                  {m.from?.name || 'Guest'}
                </div>
              )}
              <div
                style={{
                  background: mine ? 'var(--grad-brand)' : 'var(--surface-hi)',
                  color: '#fff',
                  padding: '8px 12px',
                  borderRadius: 13,
                  fontSize: 14,
                  border: mine ? 'none' : '1px solid var(--border)',
                  wordBreak: 'break-word',
                }}
              >
                {m.message}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="row" style={{ gap: 8, marginTop: 12 }}>
        <input
          className="input"
          placeholder="Message everyone…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn" type="submit" aria-label="Send">
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
