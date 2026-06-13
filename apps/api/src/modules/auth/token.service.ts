/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/auth/token.service.ts
 * Layer:   Auth / Domain service (security-critical)
 * Purpose: Mint and manage the access/refresh token pair.
 *            • Access token  — short-lived, STATELESS (verified by signature).
 *            • Refresh token — long-lived, STATEFUL: each carries a unique `jti`
 *              recorded in a Redis allow-list. Rotation deletes the old jti and
 *              issues a new one (one-time use), so a stolen refresh token stops
 *              working the moment the legitimate user refreshes — and an admin
 *              can revoke a session by dropping its key.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import type { AuthTokens, JwtPayload, UserRole } from '@vertxing/shared';
import type { AppConfig } from '../../config/configuration';
import { RedisService } from '../../infrastructure/redis/redis.service';

/** Identity slice needed to mint tokens — never the full DB row. */
export interface TokenSubject {
  id: string;
  email: string;
  role: UserRole;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  /** Issue a fresh access + refresh pair and record the refresh jti in Redis. */
  async issueTokens(subject: TokenSubject): Promise<AuthTokens> {
    const { accessSecret, refreshSecret, accessTtl, refreshTtl } = this.jwtConfig();
    const payload: JwtPayload = {
      sub: subject.id,
      email: subject.email,
      role: subject.role,
    };
    const jti = randomUUID();

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, { secret: accessSecret, expiresIn: accessTtl }),
      this.jwt.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: refreshTtl,
        jwtid: jti,
      }),
    ]);

    await this.redis.set(this.refreshKey(subject.id, jti), '1', refreshTtl);

    return { accessToken, refreshToken, expiresIn: accessTtl };
  }

  /**
   * Verify a refresh token, enforce one-time use against the allow-list, and
   * rotate it for a brand-new pair. Throws 401 if the token is invalid, expired,
   * already used, or revoked.
   */
  async rotate(refreshToken: string): Promise<AuthTokens> {
    const decoded = await this.verifyRefresh(refreshToken);
    const key = this.refreshKey(decoded.sub, decoded.jti);

    const present = await this.redis.get(key);
    if (!present) {
      // Unknown jti = already rotated, revoked, or replayed. Reject.
      throw new UnauthorizedException('Refresh token is no longer valid');
    }

    await this.redis.delete(key); // consume — one-time use
    return this.issueTokens({
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
    });
  }

  /** Revoke a single refresh session (logout). Idempotent. */
  async revoke(refreshToken: string): Promise<void> {
    const decoded = await this.verifyRefresh(refreshToken);
    await this.redis.delete(this.refreshKey(decoded.sub, decoded.jti));
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private async verifyRefresh(
    token: string,
  ): Promise<JwtPayload & { jti: string }> {
    const { refreshSecret } = this.jwtConfig();
    try {
      const decoded = await this.jwt.verifyAsync<JwtPayload & { jti?: string }>(
        token,
        { secret: refreshSecret },
      );
      if (!decoded.jti) {
        throw new UnauthorizedException('Malformed refresh token');
      }
      return decoded as JwtPayload & { jti: string };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private refreshKey(userId: string, jti: string): string {
    return `refresh:${userId}:${jti}`;
  }

  private jwtConfig(): AppConfig['jwt'] {
    return this.config.getOrThrow<AppConfig['jwt']>('jwt');
  }
}
