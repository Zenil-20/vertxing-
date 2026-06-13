/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/common/decorators/public.decorator.ts
 * Layer:   Common / Cross-cutting / Auth
 * Purpose: Opt a route OUT of the global JWT guard. The guard is applied app-
 *          wide (secure-by-default); endpoints like login/register/health mark
 *          themselves @Public() rather than the inverse — so a new endpoint is
 *          protected unless someone deliberately opens it.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
