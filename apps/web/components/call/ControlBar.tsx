/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/components/call/ControlBar.tsx
 * Layer:   Web / Call UI
 * Purpose: The floating glass control dock — mic, camera, screen-share,
 *          reactions (emoji popover), people, chat, invite, and leave/end. Reads
 *          live device state from `useLocalParticipant`. Host gets a destructive
 *          "End for all". The reactions popover sends through `onReact`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import { useLocalParticipant } from '@livekit/components-react';
import {
  Mic,
  MicOff,
  MessageSquareText,
  MonitorUp,
  PhoneOff,
  Share2,
  Smile,
  Users,
  Video,
  VideoOff,
} from 'lucide-react';
import { useState } from 'react';
import { useIsNativeApp } from '@/lib/platform';

export type CallPanel = 'none' | 'people' | 'invite' | 'chat';

const EMOJIS = ['👍', '❤️', '😂', '🎉', '👏', '😮', '🙌', '🔥'];

interface ControlBarProps {
  panel: CallPanel;
  onPanel: (panel: CallPanel) => void;
  participantCount: number;
  isHost: boolean;
  onReact: (emoji: string) => void;
  onLeave: () => void;
  onEnd: () => void;
}

export function ControlBar({
  panel,
  onPanel,
  participantCount,
  isHost,
  onReact,
  onLeave,
  onEnd,
}: ControlBarProps) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } =
    useLocalParticipant();
  const [emojiOpen, setEmojiOpen] = useState(false);
  // Screen share isn't available in the Android WebView — hide it in the native app.
  const isNative = useIsNativeApp();

  const togglePanel = (next: CallPanel) => onPanel(panel === next ? 'none' : next);

  return (
    <div
      className="glass"
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 999 }}
    >
      <button
        className={`ctrl ${isMicrophoneEnabled ? '' : 'off'}`}
        title={isMicrophoneEnabled ? 'Mute' : 'Unmute'}
        onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
      >
        {isMicrophoneEnabled ? <Mic size={20} /> : <MicOff size={20} />}
      </button>

      <button
        className={`ctrl ${isCameraEnabled ? '' : 'off'}`}
        title={isCameraEnabled ? 'Stop video' : 'Start video'}
        onClick={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
      >
        {isCameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
      </button>

      {!isNative && (
        <button
          className={`ctrl ${isScreenShareEnabled ? 'active' : ''}`}
          title={isScreenShareEnabled ? 'Stop sharing' : 'Share screen'}
          onClick={() => localParticipant.setScreenShareEnabled(!isScreenShareEnabled)}
        >
          <MonitorUp size={20} />
        </button>
      )}

      {/* Reactions with emoji popover */}
      <div style={{ position: 'relative' }}>
        <button
          className={`ctrl ${emojiOpen ? 'active' : ''}`}
          title="React"
          onClick={() => setEmojiOpen((v) => !v)}
        >
          <Smile size={20} />
        </button>
        {emojiOpen && (
          <div
            className="glass"
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 10px)',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: 4,
              padding: 8,
              borderRadius: 14,
            }}
          >
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => {
                  onReact(e);
                  setEmojiOpen(false);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 22,
                  padding: 4,
                  borderRadius: 8,
                }}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ width: 1, height: 28, background: 'var(--border)' }} />

      <button
        className={`ctrl ${panel === 'people' ? 'active' : ''}`}
        title="Participants"
        onClick={() => togglePanel('people')}
        style={{ position: 'relative' }}
      >
        <Users size={20} />
        <span
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: 18,
            height: 18,
            padding: '0 5px',
            borderRadius: 999,
            background: 'var(--grad-brand)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {participantCount}
        </span>
      </button>

      <button
        className={`ctrl ${panel === 'chat' ? 'active' : ''}`}
        title="Chat"
        onClick={() => togglePanel('chat')}
      >
        <MessageSquareText size={20} />
      </button>

      <button
        className={`ctrl ${panel === 'invite' ? 'active' : ''}`}
        title="Invite"
        onClick={() => togglePanel('invite')}
      >
        <Share2 size={20} />
      </button>

      <div style={{ width: 1, height: 28, background: 'var(--border)' }} />

      <button className="ctrl danger" title="Leave" onClick={onLeave}>
        <PhoneOff size={20} />
      </button>

      {isHost && (
        <button
          className="btn btn-danger btn-sm"
          style={{ whiteSpace: 'nowrap' }}
          onClick={onEnd}
        >
          End for all
        </button>
      )}
    </div>
  );
}
