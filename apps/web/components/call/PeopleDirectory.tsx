/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/components/call/PeopleDirectory.tsx
 * Layer:   Web / Call UI (directory)
 * Purpose: The "who can I call" list. Shows everyone else with a live online dot
 *          (refreshed every 10s) and a one-tap Call button that hands off to the
 *          CallProvider. Disabled when the person is offline or you're already on
 *          a call.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import { Phone } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { DirectoryUser } from '@vertxing/shared';
import { api } from '@/lib/api-client';
import { useCall } from '@/lib/call-context';

function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function PeopleDirectory() {
  const { callUser, status } = useCall();
  const [people, setPeople] = useState<DirectoryUser[]>([]);

  useEffect(() => {
    let active = true;
    const load = () =>
      api
        .getDirectory()
        .then((d) => {
          if (active) setPeople(d);
        })
        .catch(() => undefined);
    load();
    const id = window.setInterval(load, 10_000); // keep presence dots fresh
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, []);

  if (people.length === 0) {
    return (
      <p className="muted">
        No one else yet. Register a second account (another browser/profile), then call them.
      </p>
    );
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      {people.map((p) => (
        <div key={p.id} className="card between" style={{ padding: 14 }}>
          <div className="row" style={{ gap: 12, minWidth: 0 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'var(--grad-brand)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                {initials(p.displayName)}
              </div>
              <span
                title={p.online ? (p.doNotDisturb ? 'Do Not Disturb' : 'Online') : 'Offline'}
                style={{
                  position: 'absolute',
                  bottom: -1,
                  right: -1,
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: !p.online
                    ? 'var(--text-faint)'
                    : p.doNotDisturb
                      ? 'var(--warn)'
                      : 'var(--success)',
                  border: '2px solid var(--surface-solid)',
                }}
              />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {p.displayName}
              </div>
              <div className="faint" style={{ fontSize: 12 }}>
                {p.online ? (p.doNotDisturb ? 'Do Not Disturb' : 'Online') : 'Offline'}
              </div>
            </div>
          </div>

          <button
            className="btn btn-sm"
            disabled={!p.online || p.doNotDisturb || status !== 'idle'}
            onClick={() => callUser({ id: p.id, name: p.displayName })}
          >
            <Phone size={15} /> Call
          </button>
        </div>
      ))}
    </div>
  );
}
