/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/license/license.service.ts
 * Layer:   Application / Licensing
 * Purpose: Own the license: which tier is active, how many seats it grants, and
 *          whether there's room for one more account. A super-admin activates a
 *          signed KEY (HS256, our LICENSE_SECRET); capacity is enforced LIVE at
 *          registration (`assertSeatAvailable`). With no key, a built-in free
 *          tier applies so the app still works out of the box.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { LicensePlan as PrismaLicensePlan } from '@prisma/client';
import {
  type GenerateLicenseRequest,
  LICENSE_LIMIT_REACHED,
  LicensePlan,
  type LicenseStatusDto,
  PLAN_SEATS,
} from '@vertxing/shared';
import type { AppConfig } from '../../config/configuration';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { UsersRepository } from '../users/users.repository';

const DEFAULT_PLAN = LicensePlan.STARTER;

const PLAN_TO_PRISMA: Record<LicensePlan, PrismaLicensePlan> = {
  [LicensePlan.STARTER]: PrismaLicensePlan.STARTER,
  [LicensePlan.TEAM]: PrismaLicensePlan.TEAM,
  [LicensePlan.BUSINESS]: PrismaLicensePlan.BUSINESS,
};
const PLAN_FROM_PRISMA: Record<PrismaLicensePlan, LicensePlan> = {
  STARTER: LicensePlan.STARTER,
  TEAM: LicensePlan.TEAM,
  BUSINESS: LicensePlan.BUSINESS,
};

interface ActiveLicense {
  plan: LicensePlan;
  seats: number;
  isDefault: boolean;
  activatedAt: Date | null;
  expiresAt: Date | null;
}

@Injectable()
export class LicenseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Live status + usage for the super-admin license page. */
  async status(): Promise<LicenseStatusDto> {
    const active = await this.active();
    const used = await this.users.count();
    return {
      plan: active.plan,
      seats: active.seats,
      used,
      remaining: Math.max(0, active.seats - used),
      isDefault: active.isDefault,
      activatedAt: active.activatedAt?.toISOString() ?? null,
      expiresAt: active.expiresAt?.toISOString() ?? null,
    };
  }

  /** Block a new account when seats are exhausted (enforced at registration). */
  async assertSeatAvailable(): Promise<void> {
    const active = await this.active();
    const used = await this.users.count();
    if (used >= active.seats) {
      throw new ForbiddenException({
        code: LICENSE_LIMIT_REACHED,
        message: 'License limit reached. Please contact your administrator.',
      });
    }
  }

  /** Verify a pasted key and make it the active license (super-admin). */
  async activate(key: string, byUserId: string): Promise<LicenseStatusDto> {
    let claims: { plan?: string; seats?: number; exp?: number };
    try {
      claims = await this.jwt.verifyAsync(key, { secret: this.secret });
    } catch {
      throw new ForbiddenException({ code: 'LICENSE_INVALID', message: 'Invalid or expired license key.' });
    }
    const plan = this.parsePlan(claims.plan);
    const seats = typeof claims.seats === 'number' && claims.seats > 0 ? claims.seats : PLAN_SEATS[plan];
    const prismaPlan = PLAN_TO_PRISMA[plan];
    const expiresAt = claims.exp ? new Date(claims.exp * 1000) : null;

    // Demote any current license, then make THIS key active. Upsert keeps it
    // idempotent — re-pasting a key (or re-activating an old one) just works.
    await this.prisma.license.updateMany({ where: { status: 'ACTIVE' }, data: { status: 'REVOKED' } });
    await this.prisma.license.upsert({
      where: { key },
      create: { key, plan: prismaPlan, seats, status: 'ACTIVE', activatedById: byUserId, expiresAt },
      update: { plan: prismaPlan, seats, status: 'ACTIVE', activatedById: byUserId, activatedAt: new Date(), expiresAt },
    });
    return this.status();
  }

  /** Mint a signed key for any tier (super-admin convenience / provisioning). */
  generate(dto: GenerateLicenseRequest): Promise<string> {
    const plan = this.parsePlan(dto.plan);
    const seats = dto.seats && dto.seats > 0 ? dto.seats : PLAN_SEATS[plan];
    // jti makes every minted key unique, even for the same tier in the same tick.
    return this.jwt.signAsync(
      { plan, seats },
      { secret: this.secret, jwtid: randomUUID(), ...(dto.days ? { expiresIn: `${dto.days}d` } : {}) },
    );
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private get secret(): string {
    return this.config.getOrThrow<AppConfig['license']>('license').secret;
  }

  private async active(): Promise<ActiveLicense> {
    const lic = await this.prisma.license.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { activatedAt: 'desc' },
    });
    if (lic && (!lic.expiresAt || lic.expiresAt.getTime() > Date.now())) {
      return {
        plan: PLAN_FROM_PRISMA[lic.plan],
        seats: lic.seats,
        isDefault: false,
        activatedAt: lic.activatedAt,
        expiresAt: lic.expiresAt,
      };
    }
    return { plan: DEFAULT_PLAN, seats: PLAN_SEATS[DEFAULT_PLAN], isDefault: true, activatedAt: null, expiresAt: null };
  }

  private parsePlan(value: unknown): LicensePlan {
    if (value === LicensePlan.STARTER || value === LicensePlan.TEAM || value === LicensePlan.BUSINESS) {
      return value;
    }
    throw new ForbiddenException({ code: 'LICENSE_INVALID', message: 'Unknown license plan.' });
  }
}
