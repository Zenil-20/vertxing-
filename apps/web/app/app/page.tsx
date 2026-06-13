/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/app/app/page.tsx
 * Layer:   Web / Route — Home (/app)
 * Purpose: The signed-in landing inside the shell: a greeting, quick actions
 *          (start instant, schedule, call), and a peek at upcoming meetings.
 *          Deep management lives in the dedicated sections.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import { ArrowRight, Calendar, Phone, Video } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { type Meeting, MeetingStatus } from '@vertxing/shared';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [upcoming, setUpcoming] = useState<Meeting[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .listMeetings()
      .then((ms) =>
        setUpcoming(
          ms
            .filter((m) => m.status === MeetingStatus.SCHEDULED || m.status === MeetingStatus.LIVE)
            .slice(0, 4),
        ),
      )
      .catch(() => undefined);
  }, []);

  async function startInstant() {
    setBusy(true);
    try {
      const m = await api.createMeeting({ title: `${user?.displayName ?? 'My'}'s meeting` });
      router.push(`/room/${m.roomName}`);
    } catch {
      setBusy(false);
    }
  }

  const first = user?.displayName?.split(' ')[0] ?? '';

  return (
    <div className="container fade-up">
      <h1 style={{ marginBottom: 6 }}>
        Hey <span className="gradient-text">{first}</span> 👋
      </h1>
      <p className="muted" style={{ marginBottom: 28 }}>What would you like to do?</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 36 }}>
        <button className="card card-hover" style={{ textAlign: 'left', cursor: 'pointer', border: 'none' }} onClick={startInstant} disabled={busy}>
          <ActionIcon icon={Video} />
          <strong style={{ display: 'block', marginTop: 12 }}>Start instant meeting</strong>
          <span className="muted" style={{ fontSize: 14 }}>Spin up a room right now.</span>
        </button>

        <Link href="/app/meetings" className="card card-hover" style={{ display: 'block' }}>
          <ActionIcon icon={Calendar} />
          <strong style={{ display: 'block', marginTop: 12 }}>Schedule a meeting</strong>
          <span className="muted" style={{ fontSize: 14 }}>Plan one for later.</span>
        </Link>

        <Link href="/app/contacts" className="card card-hover" style={{ display: 'block' }}>
          <ActionIcon icon={Phone} />
          <strong style={{ display: 'block', marginTop: 12 }}>Call someone</strong>
          <span className="muted" style={{ fontSize: 14 }}>Ring a teammate directly.</span>
        </Link>
      </div>

      <div className="between" style={{ marginBottom: 14 }}>
        <h3>Upcoming</h3>
        <Link href="/app/meetings" className="muted" style={{ fontSize: 14 }}>
          View all <ArrowRight size={13} />
        </Link>
      </div>

      {upcoming.length === 0 ? (
        <p className="muted">Nothing scheduled. Start or schedule one above.</p>
      ) : (
        <div className="stack">
          {upcoming.map((m) => (
            <div key={m.id} className="card between" style={{ padding: 16 }}>
              <div>
                <div className="row" style={{ gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>{m.title}</span>
                  <span className={`badge ${m.status === MeetingStatus.LIVE ? 'badge-live' : 'badge-muted-meta'}`}>
                    {m.status === MeetingStatus.LIVE && <span className="dot" />}
                    {m.status}
                  </span>
                </div>
                {m.scheduledStartAt && (
                  <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                    {new Date(m.scheduledStartAt).toLocaleString()}
                  </div>
                )}
              </div>
              <button className="btn btn-sm" onClick={() => router.push(`/room/${m.roomName}`)}>Open</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionIcon({ icon: Icon }: { icon: typeof Video }) {
  return (
    <div
      style={{
        width: 46,
        height: 46,
        borderRadius: 12,
        background: 'var(--grad-brand-soft)',
        border: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--brand-3)',
      }}
    >
      <Icon size={22} />
    </div>
  );
}
