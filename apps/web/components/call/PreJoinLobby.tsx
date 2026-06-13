/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/components/call/PreJoinLobby.tsx
 * Layer:   Web / Call UI (pre-join)
 * Purpose: The green-room before entering — a live self-preview with mic/cam
 *          pre-toggles so people compose themselves before joining. Builds the
 *          preview from a real LocalVideoTrack (cleaned up on unmount/toggle to
 *          release the camera). Returns the chosen device state to the room page,
 *          which connects to the SFU with exactly those settings.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import { createLocalVideoTrack, type LocalVideoTrack } from 'livekit-client';
import { Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Meeting } from '@vertxing/shared';

export interface JoinChoices {
  audio: boolean;
  video: boolean;
}

interface PreJoinLobbyProps {
  meeting: Meeting;
  displayName: string;
  joining: boolean;
  onJoin: (choices: JoinChoices) => void;
}

export function PreJoinLobby({ meeting, displayName, joining, onJoin }: PreJoinLobbyProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<LocalVideoTrack | null>(null);
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function startPreview() {
      try {
        const track = await createLocalVideoTrack();
        if (cancelled) {
          track.stop();
          return;
        }
        trackRef.current = track;
        if (videoRef.current) track.attach(videoRef.current);
      } catch {
        // Permission denied / no camera — fall back to the avatar placeholder.
      }
    }

    if (camOn) startPreview();

    return () => {
      cancelled = true;
      if (trackRef.current) {
        trackRef.current.detach();
        trackRef.current.stop();
        trackRef.current = null;
      }
    };
  }, [camOn]);

  return (
    <div className="container fade-up" style={{ maxWidth: 920, paddingTop: 56 }}>
      <div
        className="card"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
          gap: 28,
          alignItems: 'center',
        }}
      >
        {/* Preview */}
        <div>
          <div
            style={{
              position: 'relative',
              aspectRatio: '16 / 9',
              borderRadius: 18,
              overflow: 'hidden',
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)',
                display: camOn ? 'block' : 'none',
              }}
            />
            {!camOn && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    width: 84,
                    height: 84,
                    borderRadius: '50%',
                    background: 'var(--grad-brand)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 30,
                    fontWeight: 700,
                  }}
                >
                  {displayName.slice(0, 1).toUpperCase()}
                </div>
              </div>
            )}

            <div
              style={{
                position: 'absolute',
                bottom: 14,
                left: 0,
                right: 0,
                display: 'flex',
                justifyContent: 'center',
                gap: 12,
              }}
            >
              <button className={`ctrl ${micOn ? '' : 'off'}`} onClick={() => setMicOn((v) => !v)}>
                {micOn ? <Mic size={20} /> : <MicOff size={20} />}
              </button>
              <button className={`ctrl ${camOn ? '' : 'off'}`} onClick={() => setCamOn((v) => !v)}>
                {camOn ? <Video size={20} /> : <VideoOff size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Details + join */}
        <div className="stack">
          <span className="badge badge-host" style={{ alignSelf: 'flex-start' }}>
            Ready to join
          </span>
          <h1 style={{ fontSize: 26 }}>{meeting.title}</h1>
          <p className="muted" style={{ marginTop: -6 }}>
            Joining as <strong style={{ color: 'var(--text)' }}>{displayName}</strong>
          </p>
          <div className="chip" style={{ alignSelf: 'flex-start', fontFamily: 'ui-monospace, monospace' }}>
            {meeting.roomName}
          </div>

          <button
            className="btn"
            style={{ width: '100%', padding: '14px', fontSize: 16, marginTop: 6 }}
            disabled={joining}
            onClick={() => onJoin({ audio: micOn, video: camOn })}
          >
            {joining ? 'Connecting…' : 'Join now'}
          </button>
        </div>
      </div>
    </div>
  );
}
