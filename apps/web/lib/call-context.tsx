/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/lib/call-context.tsx
 * Layer:   Web / Client state (React context) — Direct Calls
 * Purpose: One app-wide socket + the CLIENT call state machine, mirroring the
 *          server's. Holds a single connection per session so an incoming call
 *          can ring on ANY page, and renders the call overlays (incoming /
 *          ringback / active) above everything. Components call `useCall()` —
 *          never the socket directly. If a call arrives while you're busy, it's
 *          auto-declined so the caller isn't left hanging.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  type AddToCallPayload,
  type CallAcceptedPayload,
  CallEvents,
  type CallFailedPayload,
  type CallIdPayload,
  type CallMode,
  type IncomingCallPayload,
  type CallRingingPayload,
  type CallEndedPayload,
} from '@vertxing/shared';
import { IncomingCallModal } from '@/components/call/IncomingCallModal';
import { OutgoingCallOverlay } from '@/components/call/OutgoingCallOverlay';
import { CallScreen } from '@/components/call/CallScreen';
import { useAuth } from './auth-context';
import { registerNativeFcm } from './native-fcm';
import { createSocket } from './realtime';
import { getRingSeconds, ringtone } from './ringtone';
import { session } from './session';

type CallStatus = 'idle' | 'outgoing' | 'incoming' | 'active';

interface Peer {
  id: string;
  name: string;
}

interface CallState {
  status: CallStatus;
  callId?: string;
  peer?: Peer;
  mode: CallMode;
  livekit?: { url: string; token: string };
}

interface CallContextValue {
  status: CallStatus;
  /** Place a call to another user. */
  callUser: (callee: Peer, mode?: CallMode) => void;
}

const IDLE: CallState = { status: 'idle', mode: 'AUDIO' };

const CallContext = createContext<CallContextValue | undefined>(undefined);

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const socketRef = useRef<ReturnType<typeof createSocket> | null>(null);
  const [call, setCall] = useState<CallState>(IDLE);
  const [notice, setNotice] = useState<string | null>(null);

  // Keep a ref to the latest state so socket handlers (bound once) read fresh data.
  const callRef = useRef(call);
  callRef.current = call;

  const reset = useCallback(() => {
    ringtone.stop();
    setCall(IDLE);
  }, []);

  const flash = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3500);
  }, []);

  // Opened from a background-call notification? The URL carries the action. Run
  // it once the socket is live. The server call is still RINGING within the
  // window; if it already timed out we get a clean "no longer available".
  const handleDeepLink = useCallback((socket: ReturnType<typeof createSocket>) => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const acceptId = params.get('acceptCall');
    const declineId = params.get('declineCall');
    if (!acceptId && !declineId) return;
    try {
      window.history.replaceState({}, '', window.location.pathname); // idempotent
    } catch {
      /* ignore */
    }
    if (acceptId) {
      const from = params.get('from') || 'Call';
      const mode = (params.get('mode') as CallMode) || 'AUDIO';
      ringtone.stop();
      setCall({ status: 'incoming', callId: acceptId, peer: { id: '', name: from }, mode });
      socket.emit(CallEvents.Accept, { callId: acceptId } satisfies CallIdPayload);
    } else if (declineId) {
      socket.emit(CallEvents.Decline, { callId: declineId } satisfies CallIdPayload);
    }
  }, []);

  // One socket for the whole authenticated session.
  useEffect(() => {
    if (!user) return;
    const token = session.accessToken;
    if (!token) return;

    const socket = createSocket(token);
    socketRef.current = socket;

    // On the native Android app, register this device's FCM token so the server
    // can ring it with a full-screen call. No-op in a browser.
    void registerNativeFcm();

    socket.on(CallEvents.Incoming, (p: IncomingCallPayload) => {
      // Busy? Auto-decline so the caller gets a clean "ended".
      if (callRef.current.status !== 'idle') {
        socket.emit(CallEvents.Decline, { callId: p.callId } satisfies CallIdPayload);
        return;
      }
      setCall({ status: 'incoming', callId: p.callId, peer: p.from, mode: p.mode });
      ringtone.start();
    });

    socket.on(CallEvents.Ringing, (p: CallRingingPayload) => {
      // Caller side: capture the callId now that the call exists.
      setCall((prev) =>
        prev.status === 'outgoing' ? { ...prev, callId: p.callId } : prev,
      );
    });

    socket.on(CallEvents.Accepted, (p: CallAcceptedPayload) => {
      ringtone.stop();
      setCall((prev) => ({
        ...prev,
        status: 'active',
        callId: p.callId,
        mode: p.mode,
        livekit: p.livekit,
      }));
    });

    socket.on(CallEvents.Ended, (p: CallEndedPayload) => {
      if (callRef.current.callId && callRef.current.callId !== p.callId) return;
      const labels: Record<string, string> = {
        DECLINED: 'Call declined',
        CANCELLED: 'Call cancelled',
        MISSED: 'No answer',
        ENDED: 'Call ended',
      };
      flash(labels[p.reason] ?? 'Call ended');
      reset();
    });

    socket.on(CallEvents.Failed, (p: CallFailedPayload) => {
      const labels: Record<string, string> = {
        offline: 'They’re offline right now',
        busy: 'They’re on another call',
        unavailable: 'They have Do-Not-Disturb on',
        unauthorized: 'Calling isn’t enabled for your account — contact your administrator',
        self: 'You can’t call yourself',
        gone: 'That call is no longer available',
        forbidden: 'Not allowed',
        error: 'Could not place the call',
      };
      flash(labels[p.reason] ?? 'Could not place the call');
      reset();
    });

    // Cold start from a notification: act as soon as the socket connects.
    socket.on('connect', () => handleDeepLink(socket));

    return () => {
      ringtone.stop();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user, reset, flash, handleDeepLink]);

  // Cover the case where the socket is already connected when we arrive
  // (e.g. the app was backgrounded, not killed).
  useEffect(() => {
    const s = socketRef.current;
    if (s && s.connected) handleDeepLink(s);
  }, [handleDeepLink, user]);

  const callUser = useCallback(
    (callee: Peer, mode: CallMode = 'AUDIO') => {
      if (!socketRef.current || callRef.current.status !== 'idle') return;
      setCall({ status: 'outgoing', peer: callee, mode });
      ringtone.start();
      socketRef.current.emit(CallEvents.Invite, { calleeId: callee.id, mode });
    },
    [],
  );

  const emit = useCallback((event: string) => {
    const { callId } = callRef.current;
    if (socketRef.current && callId) {
      socketRef.current.emit(event, { callId } satisfies CallIdPayload);
    }
  }, []);

  const accept = useCallback(() => {
    ringtone.stop();
    emit(CallEvents.Accept);
  }, [emit]);

  const decline = useCallback(() => {
    emit(CallEvents.Decline);
    reset();
  }, [emit, reset]);

  const cancel = useCallback(() => {
    emit(CallEvents.Cancel);
    reset();
  }, [emit, reset]);

  const hangup = useCallback(() => {
    emit(CallEvents.Hangup);
    reset();
  }, [emit, reset]);

  const addToCall = useCallback((calleeId: string) => {
    const { callId, status } = callRef.current;
    if (socketRef.current && status === 'active' && callId) {
      socketRef.current.emit(CallEvents.Add, { callId, calleeId } satisfies AddToCallPayload);
    }
  }, []);

  // Ring-duration preference ONLY silences the local ring SOUND after N seconds.
  // It must NEVER end the call — the server's no-answer timeout is the single
  // authority for that. (A client timer ending calls caused the 15s drop.)
  useEffect(() => {
    if (call.status !== 'outgoing' && call.status !== 'incoming') return;
    const t = window.setTimeout(() => ringtone.stop(), getRingSeconds() * 1000);
    return () => window.clearTimeout(t);
  }, [call.status]);

  const value = useMemo<CallContextValue>(
    () => ({ status: call.status, callUser }),
    [call.status, callUser],
  );

  return (
    <CallContext.Provider value={value}>
      {children}

      {notice && (
        <div
          className="glass"
          style={{
            position: 'fixed',
            top: 18,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            padding: '10px 18px',
            borderRadius: 999,
            fontSize: 14,
          }}
        >
          {notice}
        </div>
      )}

      {call.status === 'incoming' && call.peer && (
        <IncomingCallModal peer={call.peer} mode={call.mode} onAccept={accept} onDecline={decline} />
      )}
      {call.status === 'outgoing' && call.peer && (
        <OutgoingCallOverlay peer={call.peer} mode={call.mode} onCancel={cancel} />
      )}
      {call.status === 'active' && call.livekit && call.peer && (
        <CallScreen
          peer={call.peer}
          mode={call.mode}
          url={call.livekit.url}
          token={call.livekit.token}
          onHangup={hangup}
          onAddPerson={addToCall}
        />
      )}
    </CallContext.Provider>
  );
}

export function useCall(): CallContextValue {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within a <CallProvider>');
  return ctx;
}
