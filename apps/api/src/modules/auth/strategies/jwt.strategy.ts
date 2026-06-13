/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/auth/strategies/jwt.strategy.ts
 * Layer:   Auth / Strategy
 * Purpose: Verify the Bearer access token on protected routes. Passport calls
 *          `validate()` only AFTER the signature + expiry check pass, so by the
 *          time we're here the claims are trustworthy. The returned object
 *          becomes `req.user` (typed as AuthenticatedUser everywhere else).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtPayload } from '@vertxing/shared';
import type { AppConfig } from '../../../config/configuration';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    const { accessSecret } = config.getOrThrow<AppConfig['jwt']>('jwt');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: accessSecret,
    });
  }

  /** Shape `req.user` from the verified claims. */
  validate(payload: JwtPayload): AuthenticatedUser {
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
