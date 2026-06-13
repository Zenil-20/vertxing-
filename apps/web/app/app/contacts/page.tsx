/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/app/app/contacts/page.tsx
 * Layer:   Web / Route — Contacts
 * Purpose: People you can call, with live online status. Gated by call access —
 *          without it (locked-by-default) the directory is replaced by a notice
 *          to contact an administrator. The nav hides this route too; this guards
 *          direct navigation.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import { hasPermission, Permission } from '@vertxing/shared';
import { CallAccessNotice } from '@/components/call/CallAccessNotice';
import { PeopleDirectory } from '@/components/call/PeopleDirectory';
import { useAuth } from '@/lib/auth-context';

export default function ContactsPage() {
  const { user } = useAuth();
  const canCall = !!user && hasPermission(user.permissions, Permission.CallsStart);

  return (
    <div className="container fade-up">
      <h1 style={{ marginBottom: 6 }}>Contacts</h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        {canCall ? 'Call anyone who’s online.' : 'Your people directory.'}
      </p>
      {canCall ? <PeopleDirectory /> : <CallAccessNotice />}
    </div>
  );
}
