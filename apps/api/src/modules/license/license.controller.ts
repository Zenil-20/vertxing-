/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/modules/license/license.controller.ts
 * Layer:   Presentation / HTTP (super-admin)
 * Purpose: License management surface, locked to SUPER_ADMIN. View live status +
 *          usage, activate a pasted key, or mint a key for a tier.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { GeneratedLicense, LicenseStatusDto } from '@vertxing/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { LicenseService } from './license.service';
import { ActivateLicenseDto, GenerateLicenseDto } from './license.dto';

@Controller('license')
@UseGuards(SuperAdminGuard)
export class LicenseController {
  constructor(private readonly license: LicenseService) {}

  /** GET /license/status — current tier, seats, and usage. */
  @Get('status')
  status(): Promise<LicenseStatusDto> {
    return this.license.status();
  }

  /** POST /license/activate — apply a pasted license key. */
  @HttpCode(HttpStatus.OK)
  @Post('activate')
  activate(
    @CurrentUser('userId') userId: string,
    @Body() dto: ActivateLicenseDto,
  ): Promise<LicenseStatusDto> {
    return this.license.activate(dto.key, userId);
  }

  /** POST /license/generate — mint a signed key for a tier. */
  @HttpCode(HttpStatus.OK)
  @Post('generate')
  async generate(@Body() dto: GenerateLicenseDto): Promise<GeneratedLicense> {
    return { key: await this.license.generate(dto) };
  }
}
