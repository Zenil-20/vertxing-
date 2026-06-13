/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    packages/shared/src/types/auth.types.ts
 * Layer:   Shared / Contracts
 * Purpose: Authentication request/response contracts plus the JWT payload shape.
 *          Access tokens are short-lived and stateless; refresh tokens are
 *          long-lived and tracked in Redis so they can be rotated/revoked.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { PublicUser, UserRole } from './user.types';

/** Body for POST /auth/register. */
export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}

/** Body for POST /auth/login. */
export interface LoginRequest {
  email: string;
  password: string;
}

/** The signed/verifiable claims embedded in every access token. */
export interface JwtPayload {
  /** Subject — the user id. */
  sub: string;
  email: string;
  role: UserRole;
}

/** Token pair returned by register/login/refresh. */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
}

/** Full auth result: the user plus a fresh token pair. */
export interface AuthResult {
  user: PublicUser;
  tokens: AuthTokens;
}
