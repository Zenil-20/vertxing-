/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/app/app/license/page.tsx
 * Layer:   Web / Route — License (super-admin)
 * Purpose: The license control center. Shows the live tier + seat usage, lets a
 *          super-admin paste a license key to activate, or mint a key for a tier
 *          (provisioning). Guarded client-side AND server-side (super-admin).
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import { KeyRound, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LicensePlan, type LicenseStatusDto, UserRole } from '@vertxing/shared';
import { api, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';

export default function LicensePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { show } = useToast();
  const [status, setStatus] = useState<LicenseStatusDto | null>(null);
  const [key, setKey] = useState('');
  const [plan, setPlan] = useState<LicensePlan>(LicensePlan.BUSINESS);
  const [seats, setSeats] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user && user.role !== UserRole.SUPER_ADMIN) router.replace('/app');
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.role === UserRole.SUPER_ADMIN) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function refresh() {
    api.getLicenseStatus().then(setStatus).catch(() => undefined);
  }

  if (loading || !user) return <div className="container">Loading…</div>;
  if (user.role !== UserRole.SUPER_ADMIN) {
    return (
      <div className="container">
        <p className="muted">Not authorized.</p>
      </div>
    );
  }

  async function activate(k: string) {
    setBusy(true);
    try {
      const s = await api.activateLicense(k);
      setStatus(s);
      setKey('');
      show(`Activated ${s.plan} — ${s.seats} seats`, 'success');
    } catch (e) {
      show(e instanceof ApiClientError ? e.message : 'Activation failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function generateAndActivate() {
    setBusy(true);
    try {
      const { key: k } = await api.generateLicense({
        plan,
        ...(seats ? { seats: Number(seats) } : {}),
      });
      await activate(k);
    } catch (e) {
      show(e instanceof ApiClientError ? e.message : 'Could not generate key', 'error');
      setBusy(false);
    }
  }

  const pct = status ? Math.min(100, Math.round((status.used / Math.max(1, status.seats)) * 100)) : 0;

  return (
    <div className="container fade-up" style={{ maxWidth: 760 }}>
      <div className="row" style={{ gap: 10, marginBottom: 6 }}>
        <ShieldCheck size={24} style={{ color: 'var(--brand-3)' }} />
        <h1>Licensing</h1>
      </div>
      <p className="muted" style={{ marginBottom: 24 }}>Manage your plan and seats. Super-admin only.</p>

      {/* Current status */}
      <section className="card" style={{ marginBottom: 20 }}>
        <div className="between" style={{ marginBottom: 14 }}>
          <div className="row" style={{ gap: 10 }}>
            <strong style={{ fontSize: 18 }}>{status?.plan ?? '…'}</strong>
            {status?.isDefault && <span className="badge badge-muted-meta">Free tier</span>}
          </div>
          <span className="chip">
            {status ? `${status.used} / ${status.seats} seats` : '—'}
          </span>
        </div>

        <div style={{ height: 10, borderRadius: 999, background: 'var(--surface-hi)', overflow: 'hidden' }}>
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: pct >= 90 ? 'var(--danger)' : 'var(--grad-brand)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        <div className="between" style={{ marginTop: 8 }}>
          <span className="faint" style={{ fontSize: 13 }}>
            {status ? `${status.remaining} seats remaining` : ''}
          </span>
          {status?.expiresAt && (
            <span className="faint" style={{ fontSize: 13 }}>
              Expires {new Date(status.expiresAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </section>

      {/* Activate by key */}
      <section className="card" style={{ marginBottom: 20 }}>
        <div className="row" style={{ gap: 8, marginBottom: 12 }}>
          <KeyRound size={18} style={{ color: 'var(--brand-2)' }} />
          <strong>Activate a license key</strong>
        </div>
        <textarea
          className="input"
          rows={3}
          placeholder="Paste your license key…"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          style={{ resize: 'vertical', fontFamily: 'ui-monospace, monospace', fontSize: 13 }}
        />
        <button
          className="btn"
          style={{ marginTop: 12 }}
          disabled={busy || !key.trim()}
          onClick={() => activate(key.trim())}
        >
          Activate
        </button>
      </section>

      {/* Generate (provisioning) */}
      <section className="card">
        <strong style={{ display: 'block', marginBottom: 4 }}>Provision a tier</strong>
        <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
          Mint and apply a key for a plan (handy for testing the tiers).
        </p>
        <div className="row wrap" style={{ gap: 12, alignItems: 'flex-end' }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Plan</label>
            <select className="input" value={plan} onChange={(e) => setPlan(e.target.value as LicensePlan)}>
              <option value={LicensePlan.STARTER}>Starter (10)</option>
              <option value={LicensePlan.TEAM}>Team (50)</option>
              <option value={LicensePlan.BUSINESS}>Business (250)</option>
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Seats (optional)</label>
            <input
              className="input"
              type="number"
              min={1}
              placeholder="tier default"
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
              style={{ width: 140 }}
            />
          </div>
          <button className="btn btn-ghost" disabled={busy} onClick={generateAndActivate}>
            Generate &amp; activate
          </button>
        </div>
      </section>
    </div>
  );
}
