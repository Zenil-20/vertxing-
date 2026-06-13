/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/auth/auth.service.ts
 * Layer:   Auth / Application service
 * Purpose: Orchestrate the credential flows. Hashing lives here (bcrypt, cost
 *          12); token mechanics are delegated to TokenService; persistence to
 *          UsersRepository. Security notes baked in:
 *            • emails are normalised to lower-case to prevent dupe accounts
 *            • login returns an IDENTICAL error for "no such user" and "wrong
 *              password" so attackers can't enumerate registered emails
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import type { AuthResult, AuthTokens } from '@vertxing/shared';
import type { AppConfig } from '../../config/configuration';
import { UsersRepository } from '../users/users.repository';
import { toPublicUser, toUserRole } from '../users/user.mapper';
import { LicenseService } from '../license/license.service';
import { TokenService } from './token.service';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';

const BCRYPT_COST = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly tokens: TokenService,
    private readonly license: LicenseService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const email = dto.email.toLowerCase().trim();

    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    // The owner is either the operator-designated SUPER_ADMIN_EMAIL or, as a
    // bootstrap fallback, the very first account. The owner bypasses the seat
    // gate and is granted SUPER_ADMIN; everyone else must fit within the active
    // license's seats (else "contact your administrator").
    const designated = this.config.getOrThrow<AppConfig['license']>('license').superAdminEmail;
    const isFirstUser = (await this.users.count()) === 0;
    const isOwner = isFirstUser || (designated !== null && email === designated);

    if (!isOwner) {
      await this.license.assertSeatAvailable();
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);
    const user = await this.users.create({
      email,
      passwordHash,
      displayName: dto.displayName.trim(),
      role: isOwner ? 'SUPER_ADMIN' : 'USER',
    });

    const tokens = await this.tokens.issueTokens({
      id: user.id,
      email: user.email,
      role: toUserRole(user.role),
    });

    return { user: toPublicUser(user), tokens };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.users.findByEmail(email);

    // Same failure for missing user and bad password — no account enumeration.
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.tokens.issueTokens({
      id: user.id,
      email: user.email,
      role: toUserRole(user.role),
    });

    return { user: toPublicUser(user), tokens };
  }

  /** Rotate a refresh token for a new pair. */
  refresh(refreshToken: string): Promise<AuthTokens> {
    return this.tokens.rotate(refreshToken);
  }

  /** Revoke the given refresh session. */
  logout(refreshToken: string): Promise<void> {
    return this.tokens.revoke(refreshToken);
  }
}
