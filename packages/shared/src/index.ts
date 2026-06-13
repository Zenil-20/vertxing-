/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    packages/shared/src/index.ts
 * Layer:   Shared / Contracts
 * Purpose: Public barrel for the shared package. Consumers import from
 *          "@vertxing/shared" and never reach into individual files.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export * from './types/common.types';
export * from './types/user.types';
export * from './types/permission.types';
export * from './types/role.types';
export * from './types/auth.types';
export * from './types/meeting.types';
export * from './types/realtime.types';
export * from './types/call.types';
export * from './types/push.types';
export * from './types/license.types';
