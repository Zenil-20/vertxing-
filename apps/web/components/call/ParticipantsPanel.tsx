/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/components/call/ParticipantsPanel.tsx
 * Layer:   Web / Call UI
 * Purpose: Live participant roster sourced from LiveKit's `useParticipants`
 *          (auto-updates as people join/leave — no custom socket needed). Shows
 *          role badges and live mic state. A host/co-host sees moderation
 *          actions per row (mute, remove) that hit the RBAC-guarded API; LiveKit
 *          then enforces them on the SFU.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import { useParticipants } from '@livekit/components-react';
import { Mic, MicOff, UserMinus } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api-client';
import { useDialog } from '@/lib/dialog-context';

interface ParticipantsPanelProps {
  roomName: string;
  isHost: boolean;
  localIdentity: string;
  hostId: string;
}

function initialsFor(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function ParticipantsPanel({
  roomName,
  isHost,
  localIdentity,
  hostId,
}: ParticipantsPanelProps) {
  const participants = useParticipants();
  const { confirm } = useDialog();
  const [pending, setPending] = useState<string | null>(null);

  async function toggleMute(identity: string, currentlyOn: boolean) {
    setPending(identity + ':mute');
    await api.muteParticipant(roomName, identity, currentlyOn).catch(() => undefined);
    setPending(null);
  }

  async function remove(identity: string, label: string) {
    const ok = await confirm({
      title: `Remove ${label}?`,
      message: 'They’ll be disconnected from the meeting.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    setPending(identity + ':remove');
    await api.removeParticipant(roomName, identity).catch(() => undefined);
    setPending(null);
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>
        {participants.length} in the meeting
      </div>

      {participants.map((p) => {
        const name = p.name || p.identity;
        const isThisHost = p.identity === hostId;
        const isYou = p.identity === localIdentity;
        const micOn = p.isMicrophoneEnabled;

        return (
          <div
            key={p.identity}
            className="row"
            style={{
              justifyContent: 'space-between',
              padding: '10px 12px',
              borderRadius: 12,
              background: 'var(--surface-hi)',
              border: '1px solid var(--border)',
            }}
          >
            <div className="row" style={{ gap: 10, minWidth: 0 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'var(--grad-brand)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {initialsFor(name)}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 14,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {name} {isYou && <span className="faint">(you)</span>}
                </div>
                <div className="row" style={{ gap: 6, marginTop: 2 }}>
                  {isThisHost && <span className="badge badge-host">Host</span>}
                  <span style={{ color: micOn ? 'var(--success)' : 'var(--text-faint)' }}>
                    {micOn ? <Mic size={13} /> : <MicOff size={13} />}
                  </span>
                </div>
              </div>
            </div>

            {isHost && !isYou && (
              <div className="row" style={{ gap: 6 }}>
                <button
                  className="ctrl"
                  style={{ width: 36, height: 36 }}
                  title={micOn ? 'Mute' : 'Ask to unmute'}
                  disabled={pending === p.identity + ':mute'}
                  onClick={() => toggleMute(p.identity, micOn)}
                >
                  {micOn ? <Mic size={16} /> : <MicOff size={16} />}
                </button>
                <button
                  className="ctrl off"
                  style={{ width: 36, height: 36 }}
                  title="Remove"
                  disabled={pending === p.identity + ':remove'}
                  onClick={() => remove(p.identity, name)}
                >
                  <UserMinus size={16} />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
