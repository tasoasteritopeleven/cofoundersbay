import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantMemberRole, Prisma } from '@prisma/client';
import type { TenantAdminAccess } from './tenant-admin.guard';

export type TenantCreateInput = {
  slug: string;
  name: string;
  displayName?: string;
  shortDescription?: string;
  description?: string;
  aboutText?: string;
  website?: string;
  logoUrl?: string;
  faviconUrl?: string;
};

export type TenantUpdateInput = Partial<TenantCreateInput & {
  status: 'draft' | 'active' | 'suspended';
}>;

export type TenantBrandingInput = Partial<{
  // Colors
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundStyle: string;
  // Typography
  headingFont: string;
  bodyFont: string;
  // Media
  heroImageUrl: string;
  websiteUrl: string;
  // Content
  heroTitle: string;
  heroSubtitle: string;
  aboutText: string;
  ctaLabel: string;
  ctaUrl: string;
  onboardingIntroText: string;
  dashboardWelcomeText: string;
  // Custom labels
  communityNaming: string;
  roleLabels: Record<string, string>;
  // Contact & legal
  supportEmail: string;
  privacyPolicyUrl: string;
  termsUrl: string;
  cookiePolicyUrl: string;
  // Social
  linkedinUrl: string;
  twitterUrl: string;
  instagramUrl: string;
  websiteFooterUrl: string;
  // Email
  emailSignature: string;
  emailLogoUrl: string;
  emailFooterText: string;
  emailFromName: string;
  // Status
  isBrandingActive: boolean;
}>;

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async findBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      include: { branding: true },
    });
    if (!tenant) throw new NotFoundException(`Tenant "${slug}" not found`);
    return tenant;
  }

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      // This method backs a public route and must return only public tenant
      // presentation data. IdentityProvider contains oidcClientSecret and
      // certificate material; SSO configuration is exposed only by the
      // authenticated SSO administration controller.
      include: { branding: true },
    });
    if (!tenant) throw new NotFoundException(`Tenant "${id}" not found`);
    return tenant;
  }

  async list(params?: { status?: string; limit?: number }) {
    const where: Record<string, unknown> = {};
    if (params?.status) where['status'] = params.status;
    return this.prisma.tenant.findMany({
      where,
      include: { branding: true },
      take: params?.limit ?? 50,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: TenantCreateInput) {
    const existing = await this.prisma.tenant.findUnique({ where: { slug: data.slug } });
    if (existing) throw new ConflictException(`Slug "${data.slug}" is already taken`);
    return this.prisma.tenant.create({
      data: { ...data, status: 'draft' },
      include: { branding: true },
    });
  }

  /**
   * `settings` is a free-form preferences object the settings screen owns:
   * timezone, language, currency and the membership and notification toggles.
   * Typed as Prisma's own JSON input so it reaches the column without a cast
   * at the call site.
   */
  async update(
    id: string,
    data: TenantUpdateInput & { settings?: Prisma.InputJsonValue },
  ) {
    await this.prisma.tenant.findUniqueOrThrow({ where: { id } });
    if (data.slug) {
      const existing = await this.prisma.tenant.findUnique({ where: { slug: data.slug } });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Slug "${data.slug}" is already taken`);
      }
    }
    return this.prisma.tenant.update({
      where: { id },
      data,
      include: { branding: true },
    });
  }

  async upsertBranding(tenantId: string, data: TenantBrandingInput) {
    await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });

    const { roleLabels, isBrandingActive, ...rest } = data;
    const payload: Record<string, unknown> = { ...rest };
    if (roleLabels !== undefined) payload['roleLabels'] = roleLabels;
    if (isBrandingActive !== undefined) {
      payload['isBrandingActive'] = isBrandingActive;
      if (isBrandingActive) payload['publishedAt'] = new Date();
    }

    const existing = await this.prisma.tenantBranding.findUnique({ where: { tenantId } });
    if (existing) {
      return this.prisma.tenantBranding.update({ where: { tenantId }, data: payload });
    }
    return this.prisma.tenantBranding.create({ data: { tenantId, ...payload } });
  }

  async getBranding(tenantId: string) {
    return this.prisma.tenantBranding.findUnique({ where: { tenantId } });
  }

  async publishBranding(tenantId: string) {
    await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    return this.prisma.tenantBranding.update({
      where: { tenantId },
      data: { isBrandingActive: true, publishedAt: new Date() },
    });
  }

  async unpublishBranding(tenantId: string) {
    await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    return this.prisma.tenantBranding.update({
      where: { tenantId },
      data: { isBrandingActive: false },
    });
  }

  // ── Member management ──────────────────────────────────────────────────────

  async getMembers(tenantId: string, params?: { limit?: number; offset?: number }) {
    await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    return this.prisma.tenantMembership.findMany({
      where: { tenantId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            profile: { select: { displayName: true, avatarUrl: true, headline: true } },
          },
        },
      },
      take: params?.limit ?? 50,
      skip: params?.offset ?? 0,
      orderBy: { joinedAt: 'desc' },
    });
  }

  async addMember(
    tenantId: string,
    userId: string,
    actor: TenantAdminAccess,
    role: TenantMemberRole = TenantMemberRole.member,
  ) {
    this.assertAssignableRole(actor, role);
    await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const existing = await this.prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });
    if (existing) {
      if (!existing.isActive) {
        return this.prisma.tenantMembership.update({
          where: { id: existing.id },
          data: { isActive: true, role },
        });
      }
      throw new ConflictException('User is already a member of this tenant');
    }

    return this.prisma.tenantMembership.create({
      data: { tenantId, userId, role, invitedBy: actor.userId },
    });
  }

  async updateMember(
    tenantId: string,
    userId: string,
    data: { role?: TenantMemberRole; isActive?: boolean },
    actor: TenantAdminAccess,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const membership = await tx.tenantMembership.findUnique({
        where: { tenantId_userId: { tenantId, userId } },
      });
      if (!membership) throw new NotFoundException('Membership not found');

      this.assertTargetManageable(actor, membership.userId, membership.role);
      if (data.role !== undefined) this.assertAssignableRole(actor, data.role);
      await this.assertLastOwnerPreserved(tx, tenantId, membership, data);

      return tx.tenantMembership.update({
        where: { id: membership.id },
        data,
      });
    });
  }

  async removeMember(tenantId: string, userId: string, actor: TenantAdminAccess) {
    return this.prisma.$transaction(async (tx) => {
      const membership = await tx.tenantMembership.findUnique({
        where: { tenantId_userId: { tenantId, userId } },
      });
      if (!membership) throw new NotFoundException('Membership not found');

      this.assertTargetManageable(actor, membership.userId, membership.role);
      await this.assertLastOwnerPreserved(tx, tenantId, membership, { isActive: false });

      return tx.tenantMembership.update({
        where: { id: membership.id },
        data: { isActive: false },
      });
    });
  }

  private assertAssignableRole(actor: TenantAdminAccess, role: TenantMemberRole) {
    if (!Object.values(TenantMemberRole).includes(role)) {
      throw new BadRequestException('Invalid tenant member role');
    }
    if (actor.isPlatformAdmin) return;

    // Ownership transfer is intentionally not an implicit member edit. A
    // tenant owner may delegate admin, while an admin may delegate only
    // non-administrative roles.
    if (role === TenantMemberRole.owner) {
      throw new ForbiddenException('Tenant ownership must be transferred explicitly');
    }
    if (actor.tenantRole === TenantMemberRole.admin && role === TenantMemberRole.admin) {
      throw new ForbiddenException('Only a tenant owner can grant administrator access');
    }
  }

  private assertTargetManageable(
    actor: TenantAdminAccess,
    targetUserId: string,
    targetRole: TenantMemberRole,
  ) {
    if (actor.userId === targetUserId) {
      throw new ForbiddenException('Use the dedicated account or ownership flow for your own membership');
    }
    if (actor.isPlatformAdmin) return;

    if (
      actor.tenantRole === TenantMemberRole.admin
      && (targetRole === TenantMemberRole.owner || targetRole === TenantMemberRole.admin)
    ) {
      throw new ForbiddenException('Tenant administrators cannot modify owners or other administrators');
    }
  }

  private async assertLastOwnerPreserved(
    tx: Prisma.TransactionClient,
    tenantId: string,
    membership: { role: TenantMemberRole; isActive: boolean },
    data: { role?: TenantMemberRole; isActive?: boolean },
  ) {
    const removesActiveOwner = membership.isActive
      && membership.role === TenantMemberRole.owner
      && (data.isActive === false || (data.role !== undefined && data.role !== TenantMemberRole.owner));

    if (!removesActiveOwner) return;

    const activeOwnerCount = await tx.tenantMembership.count({
      where: { tenantId, role: TenantMemberRole.owner, isActive: true },
    });
    if (activeOwnerCount <= 1) {
      throw new ConflictException('The tenant must retain at least one active owner');
    }
  }

  async delete(id: string) {
    await this.prisma.tenant.findUniqueOrThrow({ where: { id } });
    return this.prisma.tenant.delete({ where: { id } });
  }
}
