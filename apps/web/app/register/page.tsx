/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/app/register/page.tsx
 * Layer:   Web / Route (client component)
 * Purpose: Account creation screen. Mirrors login — useAuth().register handles
 *          persistence; this component is pure form + error UX. Server-side
 *          validation (password length, email shape) surfaces here via the
 *          API error message, so the rules live in ONE place (the DTO).
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Logo } from '@/components/brand/Logo';
import { ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me = await register({ displayName, email, password });
      router.push(me.landingPath);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to register');
      setBusy(false);
    }
  }

  return (
    <div className="container fade-up" style={{ maxWidth: 420, paddingTop: 64 }}>
      <div style={{ marginBottom: 28 }}>
        <Logo size={28} />
      </div>
      <h1 style={{ marginBottom: 6 }}>Create your account</h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        Free to start. No credit card.
      </p>

      <form className="card" onSubmit={onSubmit}>
        {error && <p className="error">{error}</p>}

        <div className="field">
          <label htmlFor="displayName">Display name</label>
          <input
            id="displayName"
            className="input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            autoComplete="name"
          />
        </div>

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        <button className="btn" type="submit" disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="muted" style={{ marginTop: 16, textAlign: 'center' }}>
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </div>
  );
}
