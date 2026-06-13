/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/app/login/page.tsx
 * Layer:   Web / Route (client component)
 * Purpose: Sign-in screen. Delegates the actual auth to useAuth().login (which
 *          owns token persistence) and only handles form state + error display,
 *          then routes to the dashboard on success.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Logo } from '@/components/brand/Logo';
import { ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me = await login({ email, password });
      router.push(me.landingPath);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to sign in');
      setBusy(false);
    }
  }

  return (
    <div className="container fade-up" style={{ maxWidth: 420, paddingTop: 64 }}>
      <div style={{ marginBottom: 28 }}>
        <Logo size={28} />
      </div>
      <h1 style={{ marginBottom: 6 }}>Welcome back</h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        Sign in to start or join a meeting.
      </p>

      <form className="card" onSubmit={onSubmit}>
        {error && <p className="error">{error}</p>}

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
            autoComplete="current-password"
          />
        </div>

        <button className="btn" type="submit" disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="muted" style={{ marginTop: 16, textAlign: 'center' }}>
        No account? <Link href="/register">Create one</Link>
      </p>
    </div>
  );
}
