/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/app/app/settings/page.tsx
 * Layer:   Web / Route — Settings
 * Purpose: Profile (read-only for now) + availability (Do-Not-Disturb) + sign
 *          out. DnD persists via PATCH /users/me and is respected by the call
 *          gate (callers see "they're on Do-Not-Disturb").
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import {
  Bell,
  BellRing,
  ChevronRight,
  KeyRound,
  LogOut,
  Moon,
  Music,
  Play,
  ShieldCheck,
  Square,
  Trash2,
  Upload,
  UserCog,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { hasPermission, Permission } from '@vertxing/shared';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { disablePush, enablePush, getPushState, type PushState } from '@/lib/push';
import {
  builtinRingtones,
  clearCustomRingtone,
  type CustomRingtoneMeta,
  getCustomRingtoneMeta,
  getRingSeconds,
  getRingtoneId,
  previewRingtone,
  saveCustomRingtone,
  setRingSeconds,
  setRingtoneId,
  stopPreview,
} from '@/lib/ringtone';
import { useToast } from '@/lib/toast-context';

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { show } = useToast();
  const [dnd, setDnd] = useState(user?.doNotDisturb ?? false);
  const [busy, setBusy] = useState(false);

  async function toggleDnd(next: boolean) {
    setDnd(next);
    setBusy(true);
    try {
      await api.updateProfile({ doNotDisturb: next });
      show(next ? 'Do-Not-Disturb on — calls are blocked' : 'You’re available for calls', 'success');
    } catch {
      setDnd(!next); // revert on failure
      show('Could not update availability', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await logout();
    router.push('/');
  }

  return (
    <div className="container fade-up" style={{ maxWidth: 640 }}>
      <h1 style={{ marginBottom: 24 }}>Settings</h1>

      <section className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 16 }}>Profile</h3>
        <div className="field">
          <label>Display name</label>
          <input className="input" value={user?.displayName ?? ''} readOnly />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Email</label>
          <input className="input" value={user?.email ?? ''} readOnly />
        </div>
      </section>

      <section className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 4 }}>Availability</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
          Control whether people can call you.
        </p>
        <label className="between" style={{ cursor: 'pointer' }}>
          <span className="row" style={{ gap: 10 }}>
            <Moon size={18} style={{ color: dnd ? 'var(--brand-3)' : 'var(--text-dim)' }} />
            <span>
              <span style={{ fontWeight: 600 }}>Do Not Disturb</span>
              <span className="faint" style={{ display: 'block', fontSize: 13 }}>
                Incoming calls are blocked while this is on.
              </span>
            </span>
          </span>
          <input
            type="checkbox"
            checked={dnd}
            disabled={busy}
            onChange={(e) => toggleDnd(e.target.checked)}
            style={{ width: 20, height: 20, accentColor: 'var(--brand-1)' }}
          />
        </label>
      </section>

      <BackgroundCallsSettings />

      <RingtoneSettings />

      {user && hasPermission(user.permissions, Permission.UsersManage) && (
        <section className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 4 }}>Administration</h3>
          <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
            Manage who can access the platform and what each role can do.
          </p>
          <div className="stack" style={{ gap: 8 }}>
            <AdminLink
              href="/app/admin/users"
              icon={<UserCog size={18} style={{ color: 'var(--brand-3)' }} />}
              title="Users & Roles"
              subtitle="Assign roles, privileges, and call access"
            />
            <AdminLink
              href="/app/admin/roles"
              icon={<KeyRound size={18} style={{ color: 'var(--brand-3)' }} />}
              title="Roles & Access"
              subtitle="Preview exactly what each role can see and do"
            />
            {hasPermission(user.permissions, Permission.LicenseManage) && (
              <AdminLink
                href="/app/license"
                icon={<ShieldCheck size={18} style={{ color: 'var(--brand-3)' }} />}
                title="License"
                subtitle="Plan, seats, and activation"
              />
            )}
          </div>
        </section>
      )}

      <button className="btn btn-danger" onClick={signOut}>
        <LogOut size={16} /> Sign out
      </button>
    </div>
  );
}

/** Enable/disable background-call notifications (Web Push) for this device. */
function BackgroundCallsSettings() {
  const { show } = useToast();
  const [state, setState] = useState<PushState | 'loading'>('loading');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPushState().then(setState).catch(() => setState('unsupported'));
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const s = await enablePush();
      setState(s);
      if (s === 'enabled') show('Background calls on — you’ll ring even when the app is closed', 'success');
      else if (s === 'denied') show('Notifications are blocked in your browser settings', 'error');
      else if (s === 'unsupported') show('Background calls need Chrome on Android over HTTPS', 'error');
      else show('Couldn’t enable background calls', 'error');
    } catch {
      show('Couldn’t enable background calls', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      await disablePush();
      setState('disabled');
      show('Background calls turned off', 'success');
    } catch {
      show('Couldn’t turn off background calls', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading') return null;

  return (
    <section className="card" style={{ marginBottom: 20 }}>
      <h3 style={{ marginBottom: 4 }}>
        <BellRing size={16} style={{ verticalAlign: -2, marginRight: 6, color: 'var(--brand-3)' }} />
        Background calls
      </h3>
      <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
        Get a ringing notification when someone calls — even with the app closed. Best on Android (Chrome), installed as an app.
      </p>

      {state === 'unsupported' ? (
        <p className="faint" style={{ fontSize: 13 }}>
          Not available in this browser. Install the app and open it in Chrome on Android (over HTTPS).
        </p>
      ) : state === 'denied' ? (
        <p className="faint" style={{ fontSize: 13 }}>
          Notifications are blocked. Allow them for this site in your browser settings, then reload.
        </p>
      ) : (
        <div className="between">
          <span className={`badge ${state === 'enabled' ? 'badge-host' : 'badge-muted-meta'}`}>
            {state === 'enabled' ? 'On' : 'Off'}
          </span>
          {state === 'enabled' ? (
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={disable}>
              Turn off
            </button>
          ) : (
            <button className="btn btn-sm" disabled={busy} onClick={enable}>
              Enable
            </button>
          )}
        </div>
      )}
    </section>
  );
}

const RING_DURATIONS = [15, 20, 30, 45, 60];

/** Pick / test / upload a ringtone and set ring duration — all client-side. */
function RingtoneSettings() {
  const { show } = useToast();
  const [selected, setSelected] = useState('classic');
  const [custom, setCustom] = useState<CustomRingtoneMeta | null>(null);
  const [seconds, setSeconds] = useState(30);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSelected(getRingtoneId());
    setSeconds(getRingSeconds());
    getCustomRingtoneMeta().then(setCustom).catch(() => undefined);
    return () => stopPreview();
  }, []);

  const options = [
    ...builtinRingtones(),
    ...(custom ? [{ id: 'custom', name: custom.name, custom: true }] : []),
  ];

  function choose(id: string) {
    setSelected(id);
    setRingtoneId(id);
  }

  function togglePreview(id: string) {
    if (previewing === id) {
      stopPreview();
      setPreviewing(null);
      return;
    }
    previewRingtone(id);
    setPreviewing(id);
    window.setTimeout(() => setPreviewing((p) => (p === id ? null : p)), 5000);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    setBusy(true);
    try {
      const meta = await saveCustomRingtone(file);
      setCustom(meta);
      choose('custom');
      show(`Custom ringtone “${meta.name}” saved`, 'success');
    } catch (err) {
      show(err instanceof Error ? err.message : 'Could not use that file', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function removeCustom() {
    stopPreview();
    setPreviewing(null);
    await clearCustomRingtone().catch(() => undefined);
    setCustom(null);
    if (selected === 'custom') choose('classic');
    show('Custom ringtone removed', 'success');
  }

  function changeSeconds(n: number) {
    setSeconds(n);
    setRingSeconds(n);
  }

  return (
    <section className="card" style={{ marginBottom: 20 }}>
      <h3 style={{ marginBottom: 4 }}>
        <Bell size={16} style={{ verticalAlign: -2, marginRight: 6, color: 'var(--brand-3)' }} />
        Ringtone &amp; calls
      </h3>
      <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
        Choose your ring, test it, or add your own — your custom ringtone stays on this device only.
      </p>

      <div className="stack" style={{ gap: 8, marginBottom: 18 }}>
        {options.map((o) => (
          <label
            key={o.id}
            className="between"
            style={{
              cursor: 'pointer',
              padding: '10px 12px',
              borderRadius: 10,
              background: 'var(--surface-hi)',
              border: `1px solid ${selected === o.id ? 'var(--brand-3)' : 'var(--border)'}`,
            }}
          >
            <span className="row" style={{ gap: 10, minWidth: 0 }}>
              <input
                type="radio"
                name="ringtone"
                checked={selected === o.id}
                onChange={() => choose(o.id)}
                style={{ width: 16, height: 16, accentColor: 'var(--brand-1)' }}
              />
              {o.custom && <Music size={15} style={{ color: 'var(--brand-3)', flexShrink: 0 }} />}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {o.name}
              </span>
            </span>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={(e) => {
                e.preventDefault();
                togglePreview(o.id);
              }}
            >
              {previewing === o.id ? <Square size={14} /> : <Play size={14} />}
              {previewing === o.id ? 'Stop' : 'Test'}
            </button>
          </label>
        ))}
      </div>

      <div className="row wrap" style={{ gap: 10, marginBottom: 18 }}>
        <label className="btn btn-ghost btn-sm" style={{ cursor: busy ? 'wait' : 'pointer' }}>
          <Upload size={14} /> {custom ? 'Replace custom' : 'Upload custom'}
          <input type="file" accept="audio/*" hidden disabled={busy} onChange={onFile} />
        </label>
        {custom && (
          <button className="btn btn-ghost btn-sm" onClick={removeCustom} style={{ color: 'var(--danger)' }}>
            <Trash2 size={14} /> Remove
          </button>
        )}
        <span className="faint" style={{ fontSize: 12, alignSelf: 'center' }}>
          Audio only · ≤ 1.5 MB · ≤ 15s
        </span>
      </div>

      <div className="between">
        <span className="row" style={{ gap: 8 }}>
          <span style={{ fontWeight: 600 }}>Ringtone length</span>
          <span className="faint" style={{ fontSize: 13 }}>how long the ringtone keeps playing</span>
        </span>
        <select
          className="input"
          style={{ width: 110 }}
          value={seconds}
          onChange={(e) => changeSeconds(Number(e.target.value))}
        >
          {RING_DURATIONS.map((n) => (
            <option key={n} value={n}>{n}s</option>
          ))}
        </select>
      </div>
    </section>
  );
}

function AdminLink({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="between card-hover"
      style={{
        padding: 14,
        borderRadius: 12,
        background: 'var(--surface-hi)',
        border: '1px solid var(--border)',
      }}
    >
      <span className="row" style={{ gap: 12 }}>
        {icon}
        <span>
          <strong style={{ display: 'block' }}>{title}</strong>
          <span className="faint" style={{ fontSize: 13 }}>{subtitle}</span>
        </span>
      </span>
      <ChevronRight size={18} className="muted" />
    </Link>
  );
}
