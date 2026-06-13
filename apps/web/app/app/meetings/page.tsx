/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/app/app/meetings/page.tsx
 * Layer:   Web / Route — Meetings
 * Purpose: Create/schedule meetings and manage the ones you host (open, copy
 *          link, reschedule, cancel). Lives inside the app shell. NOTE: detail /
 *          edit / delete pages, pagination, and the LIVE-state fix are the next
 *          Stabilization items — this is the IA move that gives them a home.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import { Calendar, Check, Copy, ShieldCheck, Trash2, Video, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { type Meeting, MeetingStatus } from '@vertxing/shared';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useDialog } from '@/lib/dialog-context';
import { useToast } from '@/lib/toast-context';

const STATUS_STYLE: Record<MeetingStatus, string> = {
  [MeetingStatus.SCHEDULED]: 'badge-muted-meta',
  [MeetingStatus.LIVE]: 'badge-live',
  [MeetingStatus.ENDED]: 'badge-muted-meta',
  [MeetingStatus.CANCELLED]: 'badge-muted-meta',
};

export default function MeetingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { show } = useToast();
  const { confirm } = useDialog();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [title, setTitle] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [reschedId, setReschedId] = useState<string | null>(null);
  const [reschedAt, setReschedAt] = useState('');

  useEffect(() => {
    refresh();
  }, []);

  function refresh() {
    api.listMeetings().then(setMeetings).catch(() => undefined);
  }

  const meetingTitle = () => title.trim() || `${user?.displayName ?? 'My'}'s meeting`;

  async function startNow() {
    setBusy(true);
    setError(null);
    try {
      const m = await api.createMeeting({ title: meetingTitle(), waitingRoomEnabled: waitingRoom });
      router.push(`/room/${m.roomName}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not start meeting');
      setBusy(false);
    }
  }

  async function schedule() {
    if (!scheduleAt) {
      setError('Pick a date and time to schedule.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.createMeeting({
        title: meetingTitle(),
        scheduledStartAt: new Date(scheduleAt).toISOString(),
        waitingRoomEnabled: waitingRoom,
      });
      setTitle('');
      setScheduleAt('');
      refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not schedule meeting');
    } finally {
      setBusy(false);
    }
  }

  function joinByCode(event: React.FormEvent) {
    event.preventDefault();
    const code = joinCode.trim();
    if (code) router.push(`/room/${code}`);
  }

  async function copyLink(m: Meeting) {
    await navigator.clipboard.writeText(`${window.location.origin}/room/${m.roomName}`);
    setCopiedId(m.id);
    window.setTimeout(() => setCopiedId(null), 1600);
  }

  async function saveReschedule(m: Meeting) {
    if (!reschedAt) return;
    await api
      .updateMeeting(m.roomName, { scheduledStartAt: new Date(reschedAt).toISOString() })
      .catch(() => undefined);
    setReschedId(null);
    setReschedAt('');
    refresh();
  }

  async function cancelMeeting(m: Meeting) {
    const ok = await confirm({
      title: `Cancel "${m.title}"?`,
      message: 'Invitees won’t be able to join.',
      confirmLabel: 'Cancel meeting',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.cancelMeeting(m.roomName);
      show('Meeting cancelled', 'success');
    } catch {
      show('Could not cancel meeting', 'error');
    }
    refresh();
  }

  async function deleteMeeting(m: Meeting) {
    const ok = await confirm({
      title: `Delete "${m.title}"?`,
      message: 'This permanently removes the meeting. It can’t be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteMeeting(m.roomName);
      show('Meeting deleted', 'success');
    } catch {
      show('Could not delete meeting', 'error');
    }
    refresh();
  }

  return (
    <div className="container fade-up">
      <h1 style={{ marginBottom: 6 }}>Meetings</h1>
      <p className="muted" style={{ marginBottom: 24 }}>Start now, schedule for later, or hop into a code.</p>

      {error && <p className="error">{error}</p>}

      <section className="card" style={{ marginBottom: 28 }}>
        <div className="field">
          <label>Meeting title</label>
          <input
            className="input"
            placeholder={`${user?.displayName ?? 'My'}'s meeting`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <label className="row" style={{ gap: 10, cursor: 'pointer', marginBottom: 18 }}>
          <input
            type="checkbox"
            checked={waitingRoom}
            onChange={(e) => setWaitingRoom(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: 'var(--brand-1)' }}
          />
          <span className="row" style={{ gap: 6 }}>
            <ShieldCheck size={16} style={{ color: 'var(--brand-3)' }} />
            <span style={{ fontSize: 14 }}>
              Waiting room <span className="faint">— approve guests before they enter</span>
            </span>
          </span>
        </label>

        <div className="row wrap" style={{ alignItems: 'flex-end', gap: 12 }}>
          <button className="btn" onClick={startNow} disabled={busy}>
            <Video size={17} /> Start now
          </button>

          <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 220 }}>
            <label>Schedule for later</label>
            <div className="row" style={{ gap: 8 }}>
              <input
                className="input"
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
              />
              <button className="btn btn-ghost" onClick={schedule} disabled={busy}>
                <Calendar size={16} /> Schedule
              </button>
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--border)', margin: '20px 0' }} />

        <form className="row" onSubmit={joinByCode} style={{ gap: 8 }}>
          <input
            className="input"
            placeholder="Have a code? e.g. abcd-efgh-ijkl"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
          />
          <button className="btn btn-ghost" type="submit">Join</button>
        </form>
      </section>

      <h3 style={{ marginBottom: 14 }}>Your meetings</h3>
      {meetings.length === 0 ? (
        <p className="muted">No meetings yet — start or schedule one above.</p>
      ) : (
        <div className="stack">
          {meetings.map((m) => (
            <div key={m.id} className="card card-hover" style={{ padding: 18 }}>
              <div className="between" style={{ flexWrap: 'wrap', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 10 }}>
                    <span style={{ fontWeight: 600 }}>{m.title}</span>
                    <span className={`badge ${STATUS_STYLE[m.status]}`}>
                      {m.status === MeetingStatus.LIVE && <span className="dot" />}
                      {m.status}
                    </span>
                  </div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>
                    <span style={{ fontFamily: 'ui-monospace, monospace' }}>{m.roomName}</span>
                    {m.scheduledStartAt && ` · ${new Date(m.scheduledStartAt).toLocaleString()}`}
                    {m.status === MeetingStatus.LIVE && ` · ${m.participantCount} in call`}
                  </div>
                </div>

                <div className="row wrap" style={{ gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => copyLink(m)}>
                    {copiedId === m.id ? <Check size={15} /> : <Copy size={15} />}
                    {copiedId === m.id ? 'Copied' : 'Link'}
                  </button>
                  {m.status === MeetingStatus.SCHEDULED && (
                    <>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setReschedId(reschedId === m.id ? null : m.id);
                          setReschedAt('');
                        }}
                      >
                        <Calendar size={15} /> Reschedule
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => cancelMeeting(m)}>
                        <X size={15} /> Cancel
                      </button>
                    </>
                  )}
                  {m.status !== MeetingStatus.ENDED && m.status !== MeetingStatus.CANCELLED && (
                    <button className="btn btn-sm" onClick={() => router.push(`/room/${m.roomName}`)}>
                      Open
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm" title="Delete" onClick={() => deleteMeeting(m)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {reschedId === m.id && (
                <div className="row" style={{ gap: 8, marginTop: 14 }}>
                  <input
                    className="input"
                    type="datetime-local"
                    value={reschedAt}
                    onChange={(e) => setReschedAt(e.target.value)}
                  />
                  <button className="btn btn-sm" onClick={() => saveReschedule(m)}>Save</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
