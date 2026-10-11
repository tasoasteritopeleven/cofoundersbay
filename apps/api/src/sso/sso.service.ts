import { Injectable, Logger, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SSOMode, SSOProviderType, TenantMemberRole } from '@prisma/client';

export interface SSODiscoveryResult {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  ssoMode: SSOMode;
  providerId?: string;
  providerName?: string;
  providerType?: SSOProviderType;
  loginButtonText?: string;
  loginButtonColor?: string;
  logoUrl?: string;
  allowPasswordFallback: boolean;
}

export interface SSOCallbackPayload {
  providerId: string;
  externalId: string;
  email: string;
  displayName?: string;
  rawClaims?: Record<string, unknown>;
}

export interface SSOLoginResult {
  userId: string;
  email: string;
  isNewUser: boolean;
  isNewMembership: boolean;
  tenantId: string;
  redirectUrl?: string;
}

@Injectable()
export class SSOService {
  private readonly logger = new Logger(SSOService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Discover SSO configuration for a given email domain
   */
  async discoverByEmail(email: string): Promise<SSODiscoveryResult | null> {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return null;

    // Find domain mapping
    const domainMapping = await this.prisma.domainMapping.findUnique({
      where: { domain },
      include: {
        tenant: {
          include: {
            ssoConfig: {
              include: { identityProvider: true },
            },
          },
        },
      },
    });

    if (!domainMapping?.tenant?.ssoConfig) return null;

    const { tenant } = domainMapping;
    const ssoConfig = tenant.ssoConfig!;
    const provider = ssoConfig.identityProvider;

    return {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantName: tenant.displayName || tenant.name,
      ssoMode: ssoConfig.ssoMode,
      providerId: provider?.id,
      providerName: provider?.providerName,
      providerType: provider?.providerType,
      loginButtonText: provider?.loginButtonText || 'Continue with SSO',
      loginButtonColor: provider?.loginButtonColor ?? undefined,
      logoUrl: provider?.logoUrl ?? undefined,
      allowPasswordFallback: ssoConfig.allowPasswordFallback,
    };
  }

  /**
   * Discover SSO configuration for a tenant by slug
   */
  async discoverByTenantSlug(slug: string): Promise<SSODiscoveryResult | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      include: {
        ssoConfig: {
          include: { identityProvider: true },
        },
      },
    });

    if (!tenant?.ssoConfig) return null;

    const ssoConfig = tenant.ssoConfig!;
    const provider = ssoConfig.identityProvider;

    return {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantName: tenant.displayName || tenant.name,
      ssoMode: ssoConfig.ssoMode,
      providerId: provider?.id,
      providerName: provider?.providerName,
      providerType: provider?.providerType,
      loginButtonText: provider?.loginButtonText || 'Continue with SSO',
      loginButtonColor: provider?.loginButtonColor ?? undefined,
      logoUrl: provider?.logoUrl ?? undefined,
      allowPasswordFallback: ssoConfig.allowPasswordFallback,
    };
  }

  /**
   * Get identity provider configuration for SSO initiation
   */
  async getProviderConfig(providerId: string) {
    const provider = await this.prisma.identityProvider.findUnique({
      where: { id: providerId },
      include: {
        tenant: true,
        ssoConfig: true,
      },
    });

    if (!provider) {
      throw new NotFoundException('Identity provider not found');
    }

    if (!provider.isActive) {
      throw new BadRequestException('Identity provider is not active');
    }

    return provider;
  }

  /**
   * Handle SSO callback - find or create user, link identity, assign membership
   */
  async handleSSOCallback(payload: SSOCallbackPayload): Promise<SSOLoginResult> {
    const { providerId, externalId, email, displayName, rawClaims } = payload;

    // Get provider and config
    const provider = await this.prisma.identityProvider.findUnique({
      where: { id: providerId },
      include: {
        tenant: true,
        ssoConfig: true,
      },
    });

    if (!provider) {
      throw new NotFoundException('Identity provider not found');
    }

    const tenantId = provider.tenantId;
    const ssoConfig = provider.ssoConfig;

    // Validate email domain if enforced
    if (ssoConfig?.enforceEmailDomain && ssoConfig.allowedDomains.length > 0) {
      const emailDomain = email.split('@')[1]?.toLowerCase();
      const isAllowed = ssoConfig.allowedDomains.some(
        (d) => d.toLowerCase() === emailDomain,
      );
      if (!isAllowed) {
        await this.logAuthEvent(providerId, null, 'login_failure', email, externalId, {
          errorCode: 'DOMAIN_NOT_ALLOWED',
          errorMessage: `Email domain ${emailDomain} is not allowed`,
        });
        throw new UnauthorizedException('Email domain is not allowed for this organization');
      }
    }

    // Check if identity already exists
    const existingIdentity = await this.prisma.userIdentity.findUnique({
      where: {
        identityProviderId_externalId: {
          identityProviderId: providerId,
          externalId,
        },
      },
      include: { user: true },
    });

    let user = existingIdentity?.user ?? null;
    let userIdentityId = existingIdentity?.id;
    let isNewUser = false;
    let isNewMembership = false;

    if (!user) {
      // Try to find existing user by email
      const existingUser = await this.prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (existingUser) {
        user = existingUser;
        // Link existing user to this identity
        const newIdentity = await this.prisma.userIdentity.create({
          data: {
            userId: user.id,
            identityProviderId: providerId,
            externalId,
            email,
            displayName,
            rawClaims: rawClaims as any,
          },
        });
        userIdentityId = newIdentity.id;

        await this.logAuthEvent(providerId, user.id, 'link', email, externalId);
      } else if (ssoConfig?.autoProvisionEnabled) {
        // JIT provisioning - create new user
        const userSlug = await this.generateUniqueSlug(displayName || email.split('@')[0]);
        
        const newUser = await this.prisma.user.create({
          data: {
            email: email.toLowerCase(),
            slug: userSlug,
            role: (ssoConfig.defaultRole as any) || 'founder',
            emailVerified: true, // SSO users are pre-verified
            profile: {
              create: {
                displayName: displayName || email.split('@')[0],
              },
            },
          },
        });
        user = newUser;

        const newIdentity = await this.prisma.userIdentity.create({
          data: {
            userId: user.id,
            identityProviderId: providerId,
            externalId,
            email,
            displayName,
            rawClaims: rawClaims as any,
          },
        });
        userIdentityId = newIdentity.id;

        isNewUser = true;
        await this.logAuthEvent(providerId, user.id, 'provision', email, externalId);
      } else {
        await this.logAuthEvent(providerId, null, 'login_failure', email, externalId, {
          errorCode: 'USER_NOT_FOUND',
          errorMessage: 'No account found and auto-provisioning is disabled',
        });
        throw new UnauthorizedException(
          'No account found. Please contact your organization administrator.',
        );
      }
    }

    // Update last login
    if (userIdentityId) {
      await this.prisma.userIdentity.update({
        where: { id: userIdentityId },
        data: { lastLoginAt: new Date() },
      });
    }

    // Ensure tenant membership
    if (ssoConfig?.autoAssignToTenant) {
      const existingMembership = await this.prisma.tenantMembership.findUnique({
        where: {
          tenantId_userId: {
            tenantId,
            userId: user.id,
          },
        },
      });

      if (!existingMembership) {
        // Apply role mapping rules
        let role: TenantMemberRole = TenantMemberRole.member;
        if (ssoConfig.roleMappingRules && rawClaims) {
          role = this.applyRoleMappingRules(ssoConfig.roleMappingRules as any[], rawClaims) as TenantMemberRole;
        }

        await this.prisma.tenantMembership.create({
          data: {
            tenantId,
            userId: user.id,
            role,
            provisionedViaSSO: true,
            lastSSOLoginAt: new Date(),
          },
        });
        isNewMembership = true;
      } else {
        await this.prisma.tenantMembership.update({
          where: { id: existingMembership.id },
          data: { lastSSOLoginAt: new Date() },
        });
      }
    }

    await this.logAuthEvent(providerId, user.id, 'login_success', email, externalId);

    return {
      userId: user.id,
      email: user.email,
      isNewUser,
      isNewMembership,
      tenantId,
      redirectUrl: isNewUser && ssoConfig?.requireProfileCompletion
        ? '/onboarding'
        : ssoConfig?.postLoginRedirect || '/dashboard',
    };
  }

  /**
   * Apply role mapping rules from SSO claims
   */
  private applyRoleMappingRules(
    rules: Array<{ claim: string; value: string; role: string }>,
    claims: Record<string, unknown>,
  ): string {
    for (const rule of rules) {
      const claimValue = claims[rule.claim];
      if (Array.isArray(claimValue) && claimValue.includes(rule.value)) {
        return rule.role;
      }
      if (claimValue === rule.value) {
        return rule.role;
      }
    }
    return 'member';
  }

  /**
   * Generate unique user slug
   */
  private async generateUniqueSlug(baseName: string): Promise<string> {
    const base = baseName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30);

    let slug = base;
    let counter = 1;

    while (await this.prisma.user.findUnique({ where: { slug } })) {
      slug = `${base}-${counter}`;
      counter++;
    }

    return slug;
  }

  /**
   * Log SSO authentication event
   */
  private async logAuthEvent(
    identityProviderId: string,
    userId: string | null,
    eventType: string,
    email?: string,
    externalId?: string,
    error?: { errorCode?: string; errorMessage?: string },
  ) {
    try {
      await this.prisma.sSOAuthEvent.create({
        data: {
          identityProviderId,
          userId,
          eventType,
          email,
          externalId,
          errorCode: error?.errorCode,
          errorMessage: error?.errorMessage,
        },
      });
    } catch (e) {
      this.logger.error('Failed to log SSO auth event', e);
    }
  }

  /**
   * Get user's tenant memberships
   */
  async getUserTenantMemberships(userId: string) {
    return this.prisma.tenantMembership.findMany({
      where: { userId, isActive: true },
      include: {
        tenant: {
          select: {
            id: true,
            slug: true,
            name: true,
            displayName: true,
            logoUrl: true,
          },
        },
      },
    });
  }

  /**
   * Check if user can use password login for a tenant
   */
  async canUsePasswordLogin(email: string): Promise<boolean> {
    const discovery = await this.discoverByEmail(email);
    
    if (!discovery) return true;
    if (discovery.ssoMode === 'disabled') return true;
    if (discovery.ssoMode === 'optional') return true;
    if (discovery.ssoMode === 'required' && discovery.allowPasswordFallback) return true;
    
    return false;
  }

  /**
   * Create an identity provider for a tenant
   */
  async createProvider(tenantId: string, data: {
    providerType: 'saml' | 'oidc' | 'oauth2';
    providerName: string;
    isActive?: boolean;
    samlEntryPoint?: string;
    samlIssuer?: string;
    samlCert?: string;
    samlMetadataUrl?: string;
    oidcIssuerUrl?: string;
    oidcClientId?: string;
    oidcClientSecret?: string;
    oidcScopes?: string;
    oidcAuthorizationUrl?: string;
    oidcTokenUrl?: string;
    oidcUserInfoUrl?: string;
    loginButtonText?: string;
    loginButtonColor?: string;
    logoUrl?: string;
  }) {
    await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    return this.prisma.identityProvider.create({
      data: { tenantId, ...data },
    });
  }

  /**
   * Update an existing identity provider
   */
  async updateProvider(providerId: string, data: Partial<{
    providerName: string;
    isActive: boolean;
    samlEntryPoint: string;
    samlIssuer: string;
    samlCert: string;
    samlMetadataUrl: string;
    oidcIssuerUrl: string;
    oidcClientId: string;
    oidcClientSecret: string;
    oidcScopes: string;
    oidcAuthorizationUrl: string;
    oidcTokenUrl: string;
    oidcUserInfoUrl: string;
    loginButtonText: string;
    loginButtonColor: string;
    logoUrl: string;
  }>) {
    const provider = await this.prisma.identityProvider.findUnique({ where: { id: providerId } });
    if (!provider) throw new Error('Identity provider not found');
    return this.prisma.identityProvider.update({ where: { id: providerId }, data });
  }

  /**
   * Delete an identity provider
   */
  async deleteProvider(providerId: string) {
    const provider = await this.prisma.identityProvider.findUnique({ where: { id: providerId } });
    if (!provider) throw new Error('Identity provider not found');
    return this.prisma.identityProvider.delete({ where: { id: providerId } });
  }

  /**
   * Create or update SSO config for a tenant
   */
  async upsertSSOConfig(tenantId: string, providerId: string | null, data: {
    ssoMode: 'disabled' | 'optional' | 'required';
    allowedDomains?: string[];
    enforceEmailDomain?: boolean;
    autoProvisionEnabled?: boolean;
    defaultRole?: string;
    autoAssignToTenant?: boolean;
    roleMappingRules?: Array<{ claim: string; value: string; role: string }>;
    postLoginRedirect?: string;
    requireProfileCompletion?: boolean;
    sessionDurationHours?: number;
    allowPasswordFallback?: boolean;
  }) {
    await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });

    const payload: Record<string, unknown> = {
      ssoMode: data.ssoMode,
      allowedDomains: data.allowedDomains ?? [],
      enforceEmailDomain: data.enforceEmailDomain ?? true,
      autoProvisionEnabled: data.autoProvisionEnabled ?? false,
      defaultRole: data.defaultRole ?? 'founder',
      autoAssignToTenant: data.autoAssignToTenant ?? true,
      requireProfileCompletion: data.requireProfileCompletion ?? true,
      sessionDurationHours: data.sessionDurationHours ?? 24,
      allowPasswordFallback: data.allowPasswordFallback ?? false,
    };
    if (data.roleMappingRules !== undefined) payload['roleMappingRules'] = data.roleMappingRules;
    if (data.postLoginRedirect !== undefined) payload['postLoginRedirect'] = data.postLoginRedirect;
    if (providerId !== null) payload['identityProviderId'] = providerId;

    const existing = await this.prisma.tenantSSOConfig.findUnique({ where: { tenantId } });
    if (existing) {
      return this.prisma.tenantSSOConfig.update({ where: { tenantId }, data: payload });
    }
    return this.prisma.tenantSSOConfig.create({ data: { tenantId, ...payload } });
  }

  /**
   * Get SSO config for a tenant (admin)
   */
  async getSSOConfig(tenantId: string) {
    return this.prisma.tenantSSOConfig.findUnique({
      where: { tenantId },
      include: { identityProvider: true },
    });
  }

  /**
   * List identity providers for a tenant
   */
  async listProviders(tenantId: string) {
    return this.prisma.identityProvider.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get recent SSO auth events (admin audit view)
   */
  async getAuthEvents(params?: {
    tenantId?: string;
    limit?: number;
    offset?: number;
    eventType?: string;
  }) {
    const where: Record<string, unknown> = {};

    if (params?.tenantId) {
      where['identityProvider'] = { tenantId: params.tenantId };
    }
    if (params?.eventType) {
      where['eventType'] = params.eventType;
    }

    return this.prisma.sSOAuthEvent.findMany({
      where,
      include: {
        identityProvider: {
          select: { id: true, providerName: true, tenantId: true, tenant: { select: { name: true, slug: true } } },
        },
        user: { select: { id: true, email: true, profile: { select: { displayName: true } } } },
      },
      take: params?.limit ?? 50,
      skip: params?.offset ?? 0,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * List domain mappings for a tenant
   */
  async listDomainMappings(tenantId: string) {
    return this.prisma.domainMapping.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create a domain mapping for SSO discovery
   */
  async createDomainMapping(tenantId: string, domain: string, autoRedirectToSSO = false) {
    await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const clean = domain.toLowerCase().replace(/^@/, '').trim();
    return this.prisma.domainMapping.create({
      data: { domain: clean, tenantId, autoRedirectToSSO },
    });
  }

  /**
   * Delete a domain mapping
   */
  async deleteDomainMapping(id: string) {
    return this.prisma.domainMapping.delete({ where: { id } });
  }

  /**
   * Mark a domain mapping as verified
   */
  async verifyDomainMapping(id: string) {
    return this.prisma.domainMapping.update({
      where: { id },
      data: { isVerified: true, verifiedAt: new Date() },
    });
  }

  /**
   * Get SSO stats for admin dashboard
   */
  async getStats() {
    const [totalProviders, activeProviders, recentEvents, successEvents] = await Promise.all([
      this.prisma.identityProvider.count(),
      this.prisma.identityProvider.count({ where: { isActive: true } }),
      this.prisma.sSOAuthEvent.count({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      }),
      this.prisma.sSOAuthEvent.count({
        where: {
          eventType: 'login_success',
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);
    return { totalProviders, activeProviders, recentEvents, successEvents };
  }
}
