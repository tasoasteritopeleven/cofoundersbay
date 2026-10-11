import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Query,
  Body,
  Param,
  UseGuards,
  Req,
  Res,
  HttpStatus,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { SSOService } from './sso.service';
import { AuthService } from '../auth/auth.service';
import { setAuthCookies } from '../auth/cookie.utils';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('sso')
export class SSOController {
  constructor(
    private readonly ssoService: SSOService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Discover SSO configuration by email domain
   * Public endpoint for login flow
   */
  @Get('discover')
  async discoverByEmail(@Query('email') email: string) {
    if (!email || !email.includes('@')) {
      throw new BadRequestException('Valid email is required');
    }

    const discovery = await this.ssoService.discoverByEmail(email);
    
    if (!discovery) {
      return {
        ssoAvailable: false,
        allowPasswordLogin: true,
      };
    }

    return {
      ssoAvailable: discovery.ssoMode !== 'disabled',
      ssoRequired: discovery.ssoMode === 'required',
      allowPasswordLogin: discovery.ssoMode !== 'required' || discovery.allowPasswordFallback,
      tenant: {
        id: discovery.tenantId,
        slug: discovery.tenantSlug,
        name: discovery.tenantName,
      },
      provider: discovery.providerId ? {
        id: discovery.providerId,
        name: discovery.providerName,
        type: discovery.providerType,
        loginButtonText: discovery.loginButtonText,
        loginButtonColor: discovery.loginButtonColor,
        logoUrl: discovery.logoUrl,
      } : null,
    };
  }

  /**
   * Discover SSO configuration by tenant slug
   * Public endpoint for tenant-specific login pages
   */
  @Get('discover/tenant/:slug')
  async discoverByTenant(@Param('slug') slug: string) {
    const discovery = await this.ssoService.discoverByTenantSlug(slug);
    
    if (!discovery) {
      return {
        ssoAvailable: false,
        allowPasswordLogin: true,
      };
    }

    return {
      ssoAvailable: discovery.ssoMode !== 'disabled',
      ssoRequired: discovery.ssoMode === 'required',
      allowPasswordLogin: discovery.ssoMode !== 'required' || discovery.allowPasswordFallback,
      tenant: {
        id: discovery.tenantId,
        slug: discovery.tenantSlug,
        name: discovery.tenantName,
      },
      provider: discovery.providerId ? {
        id: discovery.providerId,
        name: discovery.providerName,
        type: discovery.providerType,
        loginButtonText: discovery.loginButtonText,
        loginButtonColor: discovery.loginButtonColor,
        logoUrl: discovery.logoUrl,
      } : null,
    };
  }

  /**
   * Initiate SSO login flow
   * Redirects to identity provider
   */
  @Get('login/:providerId')
  async initiateSSO(
    @Param('providerId') providerId: string,
    @Query('returnUrl') returnUrl: string,
    @Res() res: Response,
  ) {
    const provider = await this.ssoService.getProviderConfig(providerId);

    // Store return URL in session/cookie for callback
    res.cookie('sso_return_url', returnUrl || '/dashboard', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 10 * 60 * 1000, // 10 minutes
      sameSite: 'lax',
    });

    // Build authorization URL based on provider type
    let authUrl: string;

    if (provider.providerType === 'oidc' || provider.providerType === 'oauth2') {
      const params = new URLSearchParams({
        client_id: provider.oidcClientId!,
        redirect_uri: `${process.env.API_URL}/sso/callback/${providerId}`,
        response_type: 'code',
        scope: provider.oidcScopes || 'openid profile email',
        state: providerId, // Simple state, should be more secure in production
      });

      authUrl = provider.oidcAuthorizationUrl
        ? `${provider.oidcAuthorizationUrl}?${params}`
        : `${provider.oidcIssuerUrl}/authorize?${params}`;
    } else if (provider.providerType === 'saml') {
      // SAML flow would require additional library like passport-saml
      // For now, return error
      throw new BadRequestException('SAML SSO requires additional configuration');
    } else {
      throw new BadRequestException('Unknown provider type');
    }

    return res.redirect(authUrl);
  }

  /**
   * SSO callback handler
   * Processes response from identity provider
   */
  @Get('callback/:providerId')
  async handleCallback(
    @Param('providerId') providerId: string,
    @Query('code') code: string,
    @Query('error') error: string,
    @Query('error_description') errorDescription: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const returnUrl = req.cookies?.sso_return_url || '/dashboard';

    if (error) {
      return res.redirect(
        `/login?error=sso_failed&message=${encodeURIComponent(errorDescription || error)}`,
      );
    }

    if (!code) {
      return res.redirect('/login?error=sso_failed&message=No+authorization+code+received');
    }

    try {
      const provider = await this.ssoService.getProviderConfig(providerId);

      // Exchange code for tokens (simplified - production would use proper OAuth library)
      const tokenResponse = await fetch(
        provider.oidcTokenUrl || `${provider.oidcIssuerUrl}/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: `${process.env.API_URL}/sso/callback/${providerId}`,
            client_id: provider.oidcClientId!,
            client_secret: provider.oidcClientSecret!,
          }),
        },
      );

      if (!tokenResponse.ok) {
        throw new Error('Failed to exchange authorization code');
      }

      const oauthTokens = await tokenResponse.json();

      // Get user info
      const userInfoResponse = await fetch(
        provider.oidcUserInfoUrl || `${provider.oidcIssuerUrl}/userinfo`,
        {
          headers: { Authorization: `Bearer ${oauthTokens.access_token}` },
        },
      );

      if (!userInfoResponse.ok) {
        throw new Error('Failed to get user info');
      }

      const userInfo = await userInfoResponse.json();

      // Process SSO login
      const result = await this.ssoService.handleSSOCallback({
        providerId,
        externalId: userInfo.sub,
        email: userInfo.email,
        displayName: userInfo.name || userInfo.preferred_username,
        rawClaims: userInfo,
      });

      // Clear SSO cookie
      res.clearCookie('sso_return_url');

      // Issue JWT session for the SSO-authenticated user
      const { tokens } = await this.authService.createSessionForUser(result.userId);
      setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

      const redirectUrl = result.redirectUrl || returnUrl;
      return res.redirect(
        `/auth/sso-complete?redirect=${encodeURIComponent(redirectUrl)}&newUser=${result.isNewUser ? '1' : '0'}`,
      );
    } catch (err: any) {
      console.error('SSO callback error:', err);
      return res.redirect(
        `/login?error=sso_failed&message=${encodeURIComponent(err.message || 'SSO login failed')}`,
      );
    }
  }

  /**
   * Check if password login is allowed for an email
   */
  @Get('can-use-password')
  async canUsePassword(@Query('email') email: string) {
    if (!email) {
      return { allowed: true };
    }

    const allowed = await this.ssoService.canUsePasswordLogin(email);
    return { allowed };
  }

  /**
   * Get current user's tenant memberships
   */
  @Get('memberships')
  @UseGuards(JwtAuthGuard)
  async getUserMemberships(@CurrentUser() user: any) {
    const memberships = await this.ssoService.getUserTenantMemberships(user.id);
    return { memberships };
  }

  // ── Admin: SSO Stats ────────────────────────────────────────────────────────

  /**
   * Get SSO platform statistics
   */
  @Get('admin/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  async getStats() {
    return this.ssoService.getStats();
  }

  // ── Admin: Auth Events ──────────────────────────────────────────────────────

  /**
   * Get recent SSO auth events for admin audit
   */
  @Get('admin/events')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  async getAuthEvents(
    @Query('tenantId') tenantId?: string,
    @Query('eventType') eventType?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.ssoService.getAuthEvents({
      tenantId,
      eventType,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  // ── Admin: Identity Provider CRUD ──────────────────────────────────────────

  /**
   * List providers for a tenant
   */
  @Get('tenants/:tenantId/providers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  async listProviders(@Param('tenantId') tenantId: string) {
    return this.ssoService.listProviders(tenantId);
  }

  /**
   * Create identity provider for a tenant
   */
  @Post('tenants/:tenantId/providers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  async createProvider(
    @Param('tenantId') tenantId: string,
    @Body() body: Parameters<typeof this.ssoService.createProvider>[1],
  ) {
    return this.ssoService.createProvider(tenantId, body);
  }

  /**
   * Update identity provider
   */
  @Patch('providers/:providerId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  async updateProvider(
    @Param('providerId') providerId: string,
    @Body() body: Parameters<typeof this.ssoService.updateProvider>[1],
  ) {
    return this.ssoService.updateProvider(providerId, body);
  }

  /**
   * Delete identity provider
   */
  @Delete('providers/:providerId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  async deleteProvider(@Param('providerId') providerId: string) {
    return this.ssoService.deleteProvider(providerId);
  }

  // ── Admin: Domain Mappings ──────────────────────────────────────────────────

  @Get('tenants/:tenantId/domains')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  async listDomainMappings(@Param('tenantId') tenantId: string) {
    return this.ssoService.listDomainMappings(tenantId);
  }

  @Post('tenants/:tenantId/domains')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  async createDomainMapping(
    @Param('tenantId') tenantId: string,
    @Body() body: { domain: string; autoRedirectToSSO?: boolean },
  ) {
    return this.ssoService.createDomainMapping(tenantId, body.domain, body.autoRedirectToSSO);
  }

  @Delete('domains/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDomainMapping(@Param('id') id: string) {
    await this.ssoService.deleteDomainMapping(id);
  }

  @Post('domains/:id/verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  async verifyDomainMapping(@Param('id') id: string) {
    return this.ssoService.verifyDomainMapping(id);
  }

  // ── Admin: SSO Config ───────────────────────────────────────────────────────

  /**
   * Get SSO config for a tenant
   */
  @Get('tenants/:tenantId/config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  async getSSOConfig(@Param('tenantId') tenantId: string) {
    return this.ssoService.getSSOConfig(tenantId);
  }

  /**
   * Upsert SSO config for a tenant
   */
  @Post('tenants/:tenantId/config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  async upsertSSOConfig(
    @Param('tenantId') tenantId: string,
    @Body() body: { providerId?: string } & Parameters<typeof this.ssoService.upsertSSOConfig>[2],
  ) {
    const { providerId, ...config } = body;
    return this.ssoService.upsertSSOConfig(tenantId, providerId ?? null, config);
  }
}
