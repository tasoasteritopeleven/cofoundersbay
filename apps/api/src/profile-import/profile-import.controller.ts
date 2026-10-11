import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProfileImportService } from './profile-import.service';

@Controller('profile-import')
export class ProfileImportController {
  constructor(private readonly imports: ProfileImportService) {}

  @Get('linkedin/status')
  @UseGuards(JwtAuthGuard)
  status() {
    return { available: this.imports.available() };
  }

  @Get('linkedin/start')
  @UseGuards(JwtAuthGuard)
  start(@CurrentUser() user: { id: string }) {
    return { url: this.imports.authorizeUrl(user.id) };
  }

  /** LinkedIn redirects here; the signed `state` names the person. */
  @Get('linkedin/callback')
  async callback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    res.redirect(await this.imports.callback(code ?? '', state ?? ''));
  }

  @Get('draft')
  @UseGuards(JwtAuthGuard)
  draft(@CurrentUser() user: { id: string }) {
    return this.imports.takeDraft(user.id);
  }
}
