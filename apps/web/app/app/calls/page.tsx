/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/app/app/calls/page.tsx
 * Layer:   Web / Route — Calls
 * Purpose: Call history + missed calls. Honest stub: we don't persist a `calls`
 *          log yet (Stabilization Phase 2 adds the Postgres table). The route
 *          exists now so the IA is complete and the feature has a home.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import { Phone } from 'lucide-react';
import Link from 'next/link';
import { hasPermission, Permission } from '@vertxing/shared';
import { CallAccessNotice } from '@/components/call/CallAccessNotice';
import { useAuth } from '@/lib/auth-context';

export default function CallsPage() {
  const { user } = useAuth();
  const canCall = !!user && hasPermission(user.permissions, Permission.CallsStart);

  return (
    <div className="container fade-up">
      <h1 style={{ marginBottom: 6 }}>Calls</h1>
      <p className="muted" style={{ marginBottom: 24 }}>Your recent and missed calls will live here.</p>

      {!canCall ? (
        <CallAccessNotice />
      ) : (
      <div className="card" style={{ textAlign: 'center', padding: 48 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'var(--surface-hi)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            color: 'var(--text-dim)',
          }}
        >
          <Phone size={24} />
        </div>
        <strong>Call history is coming soon</strong>
        <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>
          Make a call from <Link href="/app/contacts">Contacts</Link> — recent and missed calls will be logged here.
        </p>
      </div>
      )}
    </div>
  );
}
