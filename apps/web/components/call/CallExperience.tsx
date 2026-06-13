/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/components/call/CallExperience.tsx
 * Layer:   Web / Call UI (in-room shell)
 * Purpose: Compose the live meeting once connected to the SFU: header (title,
 *          LIVE state, live headcount), the video stage with a floating reactions
 *          overlay, an animated side panel (participants / chat / invite), and
 *          the control dock. Rendered inside <LiveKitRoom> so all hooks resolve.
 *          Leaving disconnects (the room page navigates); "End for all" also
 *          calls the host API to tear down the SFU room.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import { useParticipants, useRoomContext } from '@livekit/components-react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useState } from 'react';
import type { Meeting } from '@vertxing/shared';
import { api } from '@/lib/api-client';
import { useDialog } from '@/lib/dialog-context';
import { ChatPanel } from './ChatPanel';
import { ControlBar, type CallPanel } from './ControlBar';
import { HostWaitingTray } from './HostWaitingTray';
import { InvitePanel } from './InvitePanel';
import { ParticipantsPanel } from './ParticipantsPanel';
import { ReactionsOverlay } from './ReactionsOverlay';
import { useReactions } from './useReactions';
import { VideoGrid } from './VideoGrid';

interface CallExperienceProps {
  meeting: Meeting;
  isHost: boolean;
  localIdentity: string;
}

const PANEL_TITLE: Record<Exclude<CallPanel, 'none'>, string> = {
  people: 'Participants',
  chat: 'Chat',
  invite: 'Invite people',
};

export function CallExperience({ meeting, isHost, localIdentity }: CallExperienceProps) {
  const room = useRoomContext();
  const participants = useParticipants();
  const { reactions, sendReaction } = useReactions();
  const { confirm } = useDialog();
  const [panel, setPanel] = useState<CallPanel>('none');

  async function leave() {
    await room.disconnect();
  }

  async function endForAll() {
    const ok = await confirm({
      title: 'End the meeting for everyone?',
      message: 'Everyone will be disconnected immediately.',
      confirmLabel: 'End for all',
      danger: true,
    });
    if (!ok) return;
    await api.endMeeting(meeting.roomName).catch(() => undefined);
    await room.disconnect();
  }

  return (
    <div className="call-shell">
      {/* Header */}
      <header className="glass between" style={{ padding: '12px 18px', borderRadius: 16 }}>
        <div className="row" style={{ gap: 12, minWidth: 0 }}>
          <span
            style={{
              fontWeight: 700,
              fontSize: 16,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {meeting.title}
          </span>
          <span className="badge badge-live">
            <span className="dot" /> LIVE
          </span>
        </div>
        <span className="chip">
          {participants.length} {participants.length === 1 ? 'person' : 'people'}
        </span>
      </header>

      {/* Stage + side panel */}
      <div className="call-main">
        <div className="call-stage" style={{ position: 'relative' }}>
          <VideoGrid />
          <ReactionsOverlay reactions={reactions} />
          {isHost && meeting.waitingRoomEnabled && (
            <HostWaitingTray roomName={meeting.roomName} />
          )}
        </div>

        <AnimatePresence>
          {panel !== 'none' && (
            <motion.aside
              key={panel}
              className="call-panel glass"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            >
              <div className="between" style={{ marginBottom: 14 }}>
                <strong style={{ fontSize: 15 }}>{PANEL_TITLE[panel]}</strong>
                <button className="ctrl" style={{ width: 34, height: 34 }} onClick={() => setPanel('none')}>
                  <X size={16} />
                </button>
              </div>

              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: panel === 'chat' ? 'hidden' : 'auto',
                }}
              >
                {panel === 'people' && (
                  <ParticipantsPanel
                    roomName={meeting.roomName}
                    isHost={isHost}
                    localIdentity={localIdentity}
                    hostId={meeting.hostId}
                  />
                )}
                {panel === 'chat' && <ChatPanel localIdentity={localIdentity} />}
                {panel === 'invite' && <InvitePanel roomName={meeting.roomName} />}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* Control dock */}
      <div className="call-dock">
        <ControlBar
          panel={panel}
          onPanel={setPanel}
          participantCount={participants.length}
          isHost={isHost}
          onReact={sendReaction}
          onLeave={leave}
          onEnd={endForAll}
        />
      </div>
    </div>
  );
}
