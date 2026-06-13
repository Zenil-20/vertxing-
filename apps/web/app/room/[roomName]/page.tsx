/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/app/room/[roomName]/page.tsx
 * Layer:   Web / Route (client component) — the call screen
 * Purpose: Orchestrate the join journey across phases:
 *            loading → lobby → (waiting) → in-call → (ended | error).
 *          It fetches the meeting for the lobby, then on "Join" exchanges the
 *          room code for an SFU token. If the meeting gates guests, join returns
 *          WAITING and we show the knock screen until the host admits; then we
 *          re-join and mount <LiveKitRoom> with our CUSTOM <CallExperience>.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import { LiveKitRoom } from '@livekit/components-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  type JoinMeetingResult,
  type Meeting,
  MeetingStatus,
  ParticipantRole,
} from '@vertxing/shared';
import { CallExperience } from '@/components/call/CallExperience';
import { PreJoinLobby, type JoinChoices } from '@/components/call/PreJoinLobby';
import { WaitingScreen } from '@/components/call/WaitingScreen';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

type Phase = 'loading' | 'lobby' | 'waiting' | 'incall' | 'ended' | 'error';

interface Connection {
  url: string;
  token: string;
  choices: JoinChoices;
  isHost: boolean;
}

export default function RoomPage() {
  const router = useRouter();
  const params = useParams<{ roomName: string }>();
  const roomName = params.roomName;
  const { user, loading } = useAuth();

  const [phase, setPhase] = useState<Phase>('loading');
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [joining, setJoining] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  // Remembered device choices so a re-join after admission keeps mic/cam state.
  const [choices, setChoices] = useState<JoinChoices>({ audio: true, video: true });

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  // Fetch the meeting for the green-room.
  useEffect(() => {
    if (!user) return;
    let active = true;
    api
      .getMeeting(roomName)
      .then((m) => {
        if (!active) return;
        setMeeting(m);
        setPhase(
          m.status === MeetingStatus.ENDED || m.status === MeetingStatus.CANCELLED
            ? 'ended'
            : 'lobby',
        );
      })
      .catch((err) => {
        if (!active) return;
        setErrorMsg(err instanceof ApiClientError ? err.message : 'Could not load meeting');
        setPhase('error');
      });
    return () => {
      active = false;
    };
  }, [user, roomName]);

  /** Move an ADMITTED join result into the live call. */
  const enterCall = useCallback(
    (result: Extract<JoinMeetingResult, { status: 'ADMITTED' }>, picked: JoinChoices) => {
      setMeeting(result.meeting);
      setConnection({
        url: result.livekit.url,
        token: result.livekit.accessToken,
        choices: picked,
        isHost:
          result.role === ParticipantRole.HOST ||
          result.role === ParticipantRole.CO_HOST,
      });
      setPhase('incall');
    },
    [],
  );

  async function handleJoin(picked: JoinChoices) {
    setJoining(true);
    setErrorMsg('');
    setChoices(picked);
    try {
      const result = await api.joinMeeting(roomName);
      setMeeting(result.meeting);
      if (result.status === 'WAITING') {
        setPhase('waiting');
        return;
      }
      enterCall(result, picked);
    } catch (err) {
      setErrorMsg(err instanceof ApiClientError ? err.message : 'Could not join meeting');
      setJoining(false);
    }
  }

  /** The host admitted us — re-join (now allowed) and enter the call. */
  const onAdmitted = useCallback(async () => {
    try {
      const result = await api.joinMeeting(roomName);
      if (result.status === 'ADMITTED') {
        enterCall(result, choices);
      }
    } catch (err) {
      setErrorMsg(err instanceof ApiClientError ? err.message : 'Could not join meeting');
      setPhase('error');
    }
  }, [roomName, choices, enterCall]);

  if (loading || phase === 'loading' || !user) {
    return <CenterMessage title="Loading…" />;
  }

  if (phase === 'error') {
    return (
      <CenterMessage title="Something went wrong" subtitle={errorMsg}>
        <button className="btn" onClick={() => router.push('/app')}>
          Back to dashboard
        </button>
      </CenterMessage>
    );
  }

  if (phase === 'ended') {
    return (
      <CenterMessage
        title="This meeting has ended"
        subtitle="The host closed the room or it was cancelled."
      >
        <button className="btn" onClick={() => router.push('/app')}>
          Back to dashboard
        </button>
      </CenterMessage>
    );
  }

  if (phase === 'lobby' && meeting) {
    return (
      <>
        {errorMsg && (
          <div className="container" style={{ paddingBottom: 0 }}>
            <p className="error">{errorMsg}</p>
          </div>
        )}
        <PreJoinLobby
          meeting={meeting}
          displayName={user.displayName}
          joining={joining}
          onJoin={handleJoin}
        />
      </>
    );
  }

  if (phase === 'waiting' && meeting) {
    return (
      <WaitingScreen
        meeting={meeting}
        onAdmitted={onAdmitted}
        onLeave={() => router.push('/app')}
      />
    );
  }

  if (phase === 'incall' && connection && meeting) {
    return (
      <LiveKitRoom
        token={connection.token}
        serverUrl={connection.url}
        connect
        audio={connection.choices.audio}
        video={connection.choices.video}
        // Audio quality: native cleanup (echo/noise/gain) + RED redundancy and
        // DTX so voice survives packet loss instead of breaking up. Browser/SFU
        // only — no extra server load. Krisp-grade AI suppression is a later opt-in.
        options={{
          audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          publishDefaults: { red: true, dtx: true },
        }}
        data-lk-theme="default"
        style={{ height: '100dvh' }}
        onDisconnected={() => router.push('/app')}
        onError={(e) => {
          setErrorMsg(e?.message || 'Connection to the call failed');
          setPhase('error');
        }}
      >
        <CallExperience meeting={meeting} isHost={connection.isHost} localIdentity={user.id} />
      </LiveKitRoom>
    );
  }

  return <CenterMessage title="Loading…" />;
}

/** Small centered status layout reused across phases. */
function CenterMessage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="fade-up"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        textAlign: 'center',
        padding: 20,
      }}
    >
      <h1 className="gradient-text">{title}</h1>
      {subtitle && <p className="muted">{subtitle}</p>}
      {children}
    </div>
  );
}
