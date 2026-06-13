/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/components/call/CallScreen.tsx
 * Layer:   Web / Call UI (active 1:1 / group call)
 * Purpose: The connected call. Mounts <LiveKitRoom> with the gateway-minted
 *          token and reuses <VideoGrid> (avatar tiles for audio). AUDIO-FIRST:
 *          camera starts off; the video button turns it on (escalation), and
 *          LiveKit propagates the track automatically. "Add person" rings a new
 *          user INTO this room — when they accept, they appear in the grid and
 *          it's a group call. Disconnect (either side leaves) calls onHangup.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import { LiveKitRoom, useLocalParticipant, useMediaDeviceSelect } from '@livekit/components-react';
import {
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  UserPlus,
  Video,
  VideoOff,
  Volume2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CallMode, DirectoryUser } from '@vertxing/shared';
import { api } from '@/lib/api-client';
import { VideoGrid } from './VideoGrid';

interface CallScreenProps {
  peer: { id: string; name: string };
  mode: CallMode;
  url: string;
  token: string;
  onHangup: () => void;
  onAddPerson: (calleeId: string) => void;
}

export function CallScreen({ peer, mode, url, token, onHangup, onAddPerson }: CallScreenProps) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 95 }}>
      <LiveKitRoom
        token={token}
        serverUrl={url}
        connect
        audio
        video={mode === 'VIDEO'}
        // Audio quality: native cleanup (echo/noise/gain) + RED redundancy and
        // DTX so voice survives packet loss instead of breaking up. All in the
        // browser/SFU — zero extra server cost.
        options={{
          audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          publishDefaults: { red: true, dtx: true },
        }}
        data-lk-theme="default"
        style={{ height: '100dvh' }}
        onDisconnected={onHangup}
      >
        <div className="call-shell">
          <header className="glass between" style={{ padding: '12px 18px', borderRadius: 16 }}>
            <strong style={{ fontSize: 16 }}>{peer.name}</strong>
            <span className="chip">{mode === 'VIDEO' ? 'Video call' : 'Audio call'}</span>
          </header>

          <div className="call-main">
            <div className="call-stage" style={{ position: 'relative' }}>
              <VideoGrid />
              {addOpen && (
                <AddPersonSheet
                  excludeId={peer.id}
                  onAdd={(id) => {
                    onAddPerson(id);
                    setAddOpen(false);
                  }}
                  onClose={() => setAddOpen(false)}
                />
              )}
            </div>
          </div>

          <div className="call-dock">
            <CallControls onAddClick={() => setAddOpen((v) => !v)} onHangup={onHangup} />
          </div>
        </div>
      </LiveKitRoom>
    </div>
  );
}

/** In-call controls: mic, video (escalate), screen share, speaker, add, hang up. */
function CallControls({ onAddClick, onHangup }: { onAddClick: () => void; onHangup: () => void }) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } =
    useLocalParticipant();

  return (
    <div
      className="glass"
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderRadius: 999 }}
    >
      <button
        className={`ctrl ${isMicrophoneEnabled ? '' : 'off'}`}
        title={isMicrophoneEnabled ? 'Mute' : 'Unmute'}
        onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
      >
        {isMicrophoneEnabled ? <Mic size={20} /> : <MicOff size={20} />}
      </button>

      <button
        className={`ctrl ${isCameraEnabled ? 'active' : ''}`}
        title={isCameraEnabled ? 'Turn off video' : 'Turn on video'}
        onClick={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
      >
        {isCameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
      </button>

      <button
        className={`ctrl ${isScreenShareEnabled ? 'active' : ''}`}
        title={isScreenShareEnabled ? 'Stop sharing' : 'Share screen'}
        onClick={() => localParticipant.setScreenShareEnabled(!isScreenShareEnabled)}
      >
        <MonitorUp size={20} />
      </button>

      <SpeakerControl />

      <button className="ctrl" title="Add person" onClick={onAddClick}>
        <UserPlus size={20} />
      </button>

      <button className="ctrl danger" style={{ width: 60 }} title="Hang up" onClick={onHangup}>
        <PhoneOff size={20} />
      </button>
    </div>
  );
}

/**
 * Audio output (speaker / earpiece / headset / Bluetooth) picker. Uses LiveKit's
 * device select, which wraps `setSinkId`. On platforms where the browser can't
 * switch output (notably iOS Safari, and some Android builds) there are no
 * selectable output devices — we hide the control and the OS routes audio
 * (typically the loudspeaker for media), so it degrades gracefully.
 */
function SpeakerControl() {
  const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({
    kind: 'audiooutput',
  });
  const [open, setOpen] = useState(false);

  if (!devices || devices.length === 0) return null;

  return (
    <div style={{ position: 'relative' }}>
      <button className="ctrl" title="Speaker / audio output" onClick={() => setOpen((v) => !v)}>
        <Volume2 size={20} />
      </button>
      {open && (
        <div
          className="glass"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 10px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 40,
            width: 240,
            maxWidth: '80vw',
            padding: 6,
            borderRadius: 14,
          }}
        >
          {devices.map((d) => (
            <button
              key={d.deviceId}
              onClick={() => {
                void setActiveMediaDevice(d.deviceId);
                setOpen(false);
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                borderRadius: 10,
                background: d.deviceId === activeDeviceId ? 'var(--surface-hi)' : 'transparent',
                color: 'var(--text)',
                fontSize: 14,
                fontWeight: d.deviceId === activeDeviceId ? 600 : 400,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {d.label || 'Audio output'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Pick an online user to ring into the call. */
function AddPersonSheet({
  excludeId,
  onAdd,
  onClose,
}: {
  excludeId: string;
  onAdd: (id: string) => void;
  onClose: () => void;
}) {
  const [people, setPeople] = useState<DirectoryUser[]>([]);

  useEffect(() => {
    let active = true;
    api
      .getDirectory()
      .then((d) => {
        if (active) setPeople(d.filter((p) => p.id !== excludeId));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [excludeId]);

  const online = people.filter((p) => p.online);

  return (
    <div
      className="glass"
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 30,
        width: 300,
        maxWidth: 'calc(100% - 24px)',
        padding: 16,
        borderRadius: 16,
        maxHeight: '70%',
        overflowY: 'auto',
      }}
    >
      <div className="between" style={{ marginBottom: 12 }}>
        <strong style={{ fontSize: 14 }}>Add someone</strong>
        <button className="ctrl" style={{ width: 30, height: 30 }} onClick={onClose}>
          <X size={14} />
        </button>
      </div>

      {online.length === 0 ? (
        <p className="faint" style={{ fontSize: 13 }}>
          No one else is online right now.
        </p>
      ) : (
        <div className="stack" style={{ gap: 8 }}>
          {online.map((p) => (
            <div key={p.id} className="between" style={{ gap: 8 }}>
              <span style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.displayName}
              </span>
              <button className="btn btn-sm" onClick={() => onAdd(p.id)}>
                Ring
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
