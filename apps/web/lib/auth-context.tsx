/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/lib/auth-context.tsx
 * Layer:   Web / Client state (React context)
 * Purpose: Single source of truth for "who is logged in" across the app. Hydrates
 *          the cached user on mount (and revalidates against /users/me), and
 *          exposes login/register/logout that keep both React state and the
 *          token session in sync. Components call `useAuth()` — never the API or
 *          localStorage directly — so auth logic lives in exactly one place.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { LoginRequest, PublicUser, RegisterRequest } from '@vertxing/shared';
import { api } from './api-client';
import { session } from './session';

interface AuthContextValue {
  user: PublicUser | null;
  /** True until the initial hydrate completes — guard redirects on this. */
  loading: boolean;
  /** Resolves to the signed-in user so callers can land on their role's page. */
  login: (payload: LoginRequest) => Promise<PublicUser>;
  register: (payload: RegisterRequest) => Promise<PublicUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  // On first load, trust the cached user optimistically, then revalidate.
  useEffect(() => {
    const cached = session.user;
    if (cached) setUser(cached);

    if (session.accessToken) {
      api
        .getMe()
        .then((fresh) => {
          setUser(fresh);
          session.saveUser(fresh);
        })
        .catch(() => {
          session.clear();
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      async login(payload) {
        const result = await api.login(payload);
        session.saveTokens(result.tokens);
        session.saveUser(result.user);
        setUser(result.user);
        return result.user;
      },
      async register(payload) {
        const result = await api.register(payload);
        session.saveTokens(result.tokens);
        session.saveUser(result.user);
        setUser(result.user);
        return result.user;
      },
      async logout() {
        const token = session.refreshToken;
        if (token) {
          await api.logout(token).catch(() => undefined);
        }
        session.clear();
        setUser(null);
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return ctx;
}
