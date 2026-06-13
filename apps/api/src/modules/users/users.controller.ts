/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/users/users.controller.ts
 * Layer:   Presentation / HTTP
 * Purpose: Thin HTTP surface for the user resource. Controllers do NO business
 *          logic — they bind the request to a service call and return the result
 *          (the TransformInterceptor wraps it in the success envelope).
 *          Protected by the global JWT guard; identity comes from @CurrentUser.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Body, Controller, Get, Patch } from '@nestjs/common';
import type { DirectoryUser, PublicUser } from '@vertxing/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** GET /users/me — the authenticated user's own profile. */
  @Get('me')
  getMe(@CurrentUser('userId') userId: string): Promise<PublicUser> {
    return this.users.getPublicById(userId);
  }

  /** PATCH /users/me — update your own profile/availability. */
  @Patch('me')
  updateMe(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<PublicUser> {
    return this.users.updateMe(userId, dto);
  }

  /** GET /users — the call directory (everyone else + who's online). */
  @Get()
  getDirectory(@CurrentUser('userId') userId: string): Promise<DirectoryUser[]> {
    return this.users.getDirectory(userId);
  }
}
