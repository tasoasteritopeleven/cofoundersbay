import {
  Controller,
  Get,
  Post,
  Delete,
  UseGuards,
  Req,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { OAuthService } from './oauth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { GoogleProfile } from './strategies/google.strategy';
import { LINKEDIN_SCOPES, LinkedInProfile } from './strategies/linkedin.strategy';
import { setAuthCookies } from './cookie.utils';

@Controller('auth')
export class OAuthController {
  constructor(
    private readonly oauthService: OAuthService,
    private readonly config: ConfigService,
  ) {}

  private isConfigured(provider: 'google' | 'linkedin'): boolean {
    if (provider === 'google') {
      const id = this.config.get<string>('GOOGLE_CLIENT_ID');
      return !!id && id !== 'not-configured';
    }
    const id = this.config.get<string>('LINKEDIN_CLIENT_ID');
    return !!id && id !== 'not-configured';
  }

  private oauthNotConfiguredRedirect(res: Response, provider: string): void {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const url = new URL('/auth/oauth-callback', frontendUrl);
    url.searchParams.set('error', `${provider} OAuth is not configured on this server.`);
    res.redirect(url.toString());
  }

  // ============ GOOGLE OAUTH ============

  @Get('google')
  async googleAuth(@Res() res: Response) {
    if (!this.isConfigured('google')) return this.oauthNotConfiguredRedirect(res, 'Google');
    const { default: passport } = await import('passport');
    return passport.authenticate('google', { scope: ['email', 'profile'] })(res.req, res, () => {});
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    try {
      const profile = req.user as GoogleProfile;
      const { accessToken, refreshToken, user } = await this.oauthService.handleGoogleLogin(profile);

      // Set httpOnly cookies — never expose tokens in URL params
      setAuthCookies(res, accessToken, refreshToken);

      const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
      const redirectUrl = new URL('/auth/oauth-callback', frontendUrl);
      redirectUrl.searchParams.set('provider', 'google');
      if (user?.id) redirectUrl.searchParams.set('uid', user.id);

      return res.redirect(redirectUrl.toString());
    } catch (error) {
      const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
      const errorUrl = new URL('/auth/oauth-callback', frontendUrl);
      errorUrl.searchParams.set('error', error instanceof Error ? error.message : 'OAuth failed');
      return res.redirect(errorUrl.toString());
    }
  }

  @Post('google/link')
  @UseGuards(JwtAuthGuard, AuthGuard('google'))
  async linkGoogle(@CurrentUser() user: { id: string }, @Req() req: Request) {
    const profile = req.user as GoogleProfile;
    await this.oauthService.linkGoogleAccount(user.id, profile);
    return { message: 'Google account linked successfully' };
  }

  @Delete('google/unlink')
  @UseGuards(JwtAuthGuard)
  async unlinkGoogle(@CurrentUser() user: { id: string }) {
    await this.oauthService.unlinkGoogleAccount(user.id);
    return { message: 'Google account unlinked successfully' };
  }

  // ============ LINKEDIN OAUTH ============

  @Get('linkedin')
  async linkedinAuth(@Res() res: Response) {
    if (!this.isConfigured('linkedin')) return this.oauthNotConfiguredRedirect(res, 'LinkedIn');
    const { default: passport } = await import('passport');
    return passport.authenticate('linkedin', { scope: [...LINKEDIN_SCOPES] })(res.req, res, () => {});
  }

  @Get('linkedin/callback')
  @UseGuards(AuthGuard('linkedin'))
  async linkedinCallback(@Req() req: Request, @Res() res: Response) {
    try {
      const profile = req.user as LinkedInProfile;
      const { accessToken, refreshToken, user } = await this.oauthService.handleLinkedInLogin(profile);

      // Set httpOnly cookies — never expose tokens in URL params
      setAuthCookies(res, accessToken, refreshToken);

      const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
      const redirectUrl = new URL('/auth/oauth-callback', frontendUrl);
      redirectUrl.searchParams.set('provider', 'linkedin');
      if (user?.id) redirectUrl.searchParams.set('uid', user.id);

      return res.redirect(redirectUrl.toString());
    } catch (error) {
      const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
      const errorUrl = new URL('/auth/oauth-callback', frontendUrl);
      errorUrl.searchParams.set('error', error instanceof Error ? error.message : 'OAuth failed');
      return res.redirect(errorUrl.toString());
    }
  }

  @Post('linkedin/link')
  @UseGuards(JwtAuthGuard, AuthGuard('linkedin'))
  async linkLinkedIn(@CurrentUser() user: { id: string }, @Req() req: Request) {
    const profile = req.user as LinkedInProfile;
    await this.oauthService.linkLinkedInAccount(user.id, profile);
    return { message: 'LinkedIn account linked successfully' };
  }

  @Delete('linkedin/unlink')
  @UseGuards(JwtAuthGuard)
  async unlinkLinkedIn(@CurrentUser() user: { id: string }) {
    await this.oauthService.unlinkLinkedInAccount(user.id);
    return { message: 'LinkedIn account unlinked successfully' };
  }

  // ============ LINKED ACCOUNTS ============

  @Get('linked-accounts')
  @UseGuards(JwtAuthGuard)
  async getLinkedAccounts(@CurrentUser() user: { id: string }) {
    return this.oauthService.getLinkedAccounts(user.id);
  }
}
