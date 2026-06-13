/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    packages/shared/src/types/license.types.ts
 * Layer:   Shared / Contracts (Licensing)
 * Purpose: The license model the whole app is gated on. A super-admin activates
 *          a signed license KEY from the UI; capacity (seats = max accounts) is
 *          enforced live at registration. When seats are full, sign-up fails
 *          with the LICENSE_LIMIT_REACHED code so the UI shows "contact your
 *          administrator".
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Tiers, by usage/pricing. `seats` is the per-tier default capacity. */
export enum LicensePlan {
  STARTER = 'STARTER',
  TEAM = 'TEAM',
  BUSINESS = 'BUSINESS',
}

/** Error code returned when registration is blocked by a full license. */
export const LICENSE_LIMIT_REACHED = 'LICENSE_LIMIT_REACHED';

/** Default tier limits applied when no license key has been activated yet. */
export const PLAN_SEATS: Record<LicensePlan, number> = {
  [LicensePlan.STARTER]: 10,
  [LicensePlan.TEAM]: 50,
  [LicensePlan.BUSINESS]: 250,
};

/** Live license status + usage, shown on the super-admin license page. */
export interface LicenseStatusDto {
  plan: LicensePlan;
  seats: number;
  used: number;
  remaining: number;
  /** True when running on the built-in free tier (no key activated). */
  isDefault: boolean;
  activatedAt: string | null;
  expiresAt: string | null;
}

/** Body for POST /license/activate — paste a signed key. */
export interface ActivateLicenseRequest {
  key: string;
}

/** Body for POST /license/generate (super-admin convenience to mint keys). */
export interface GenerateLicenseRequest {
  plan: LicensePlan;
  /** Override the plan's default seat count. */
  seats?: number;
  /** Days until the key expires (omit for perpetual). */
  days?: number;
}

export interface GeneratedLicense {
  key: string;
}
