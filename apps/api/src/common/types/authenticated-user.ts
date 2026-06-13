/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/common/types/authenticated-user.ts
 * Layer:   Common / Cross-cutting / Auth
 * Purpose: The request-scoped identity attached to `req.user` by the JWT
 *          strategy after a token is verified. This is the in-process shape the
 *          rest of the app trusts — deliberately minimal (no PII beyond email).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { UserRole } from '@vertxing/shared';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: UserRole;
}
