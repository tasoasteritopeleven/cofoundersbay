import { Body, Controller, Delete, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { VerificationService } from './verification.service';

@Controller('verification')
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: { id: string }) {
    return this.verification.me(user.id);
  }

  /**
   * How someone is verified, for the badge beside their name on a profile,
   * a need card or a public card: methods only, never the work domain, a
   * date or whether a check is pending. Public because those pages are.
   */
  @Get('of/:userId')
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  async of(@Param('userId') userId: string) {
    if (!userId || userId.length > 64) return { methods: [] };
    return { methods: await this.verification.publicMethods(userId) };
  }

  @Post('work-email/start')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 10 * 60_000, limit: 3 } })
  startWorkEmail(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    return this.verification.startWorkEmail(user.id, body);
  }

  @Post('work-email/confirm')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 10 * 60_000, limit: 10 } })
  confirmWorkEmail(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    return this.verification.confirmWorkEmail(user.id, body);
  }

  @Delete(':method')
  @UseGuards(JwtAuthGuard)
  remove(@CurrentUser() user: { id: string }, @Param('method') method: string) {
    return this.verification.remove(user.id, method);
  }

  /** Where the browser goes to consent on LinkedIn; the page navigates to the returned URL. */
  @Get('linkedin/start')
  @UseGuards(JwtAuthGuard)
  linkedInStart(@CurrentUser() user: { id: string }) {
    return { url: this.verification.linkedInAuthorizeUrl(user.id) };
  }

  /** LinkedIn redirects here; the signed `state` names the person, so no session cookie is needed. */
  @Get('linkedin/callback')
  async linkedInCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    res.redirect(await this.verification.linkedInCallback(code ?? '', state ?? ''));
  }
}
