/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/lib/session.ts
 * Layer:   Web / Client state
 * Purpose: Persist the auth token pair + cached user in the browser. Kept tiny
 *          and SSR-safe (every access guards `window`). NOTE: localStorage is
 *          fine for an MVP but is XSS-readable — a production build should move
 *          tokens to httpOnly, SameSite cookies set by the API.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { AuthTokens, PublicUser } from '@vertxing/shared';

const ACCESS_KEY = 'vertxing.accessToken';
const REFRESH_KEY = 'vertxing.refreshToken';
const USER_KEY = 'vertxing.user';

const hasWindow = (): boolean => typeof window !== 'undefined';

export const session = {
  get accessToken(): string | null {
    return hasWindow() ? window.localStorage.getItem(ACCESS_KEY) : null;
  },

  get refreshToken(): string | null {
    return hasWindow() ? window.localStorage.getItem(REFRESH_KEY) : null;
  },

  get user(): PublicUser | null {
    if (!hasWindow()) return null;
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as PublicUser) : null;
  },

  saveTokens(tokens: AuthTokens): void {
    if (!hasWindow()) return;
    window.localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    window.localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  },

  saveUser(user: PublicUser): void {
    if (!hasWindow()) return;
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  clear(): void {
    if (!hasWindow()) return;
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
    window.localStorage.removeItem(USER_KEY);
  },
};
