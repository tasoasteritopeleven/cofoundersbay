import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRoleType, RoleFacetScope, Prisma } from '@prisma/client';

// Dashboard configuration per role type
export const ROLE_DASHBOARD_CONFIG: Record<UserRoleType, {
  defaultRoute: string;
  dashboardWidgets: string[];
  sidebarItems: string[];
  features: string[];
}> = {
  aspiring_founder: {
    defaultRoute: '/dashboard/founder',
    dashboardWidgets: ['idea-validation', 'cofounder-matches', 'learning-resources', 'mentor-suggestions'],
    sidebarItems: ['dashboard', 'builder', 'matches', 'mentors', 'learning', 'community'],
    features: ['builder', 'matching', 'mentorship', 'learning'],
  },
  existing_founder: {
    defaultRoute: '/dashboard/founder',
    dashboardWidgets: ['startup-progress', 'team-activity', 'investor-pipeline', 'mentor-sessions', 'milestones'],
    sidebarItems: ['dashboard', 'builder', 'team', 'investors', 'mentors', 'analytics', 'community'],
    features: ['builder', 'team-management', 'investor-relations', 'mentorship', 'analytics'],
  },
  cofounder_candidate: {
    defaultRoute: '/dashboard/candidate',
    dashboardWidgets: ['opportunity-matches', 'skill-assessment', 'startup-invites', 'learning-path'],
    sidebarItems: ['dashboard', 'opportunities', 'matches', 'profile', 'learning'],
    features: ['matching', 'applications', 'learning'],
  },
  technical_talent: {
    defaultRoute: '/dashboard/talent',
    dashboardWidgets: ['job-matches', 'startup-opportunities', 'skill-endorsements', 'project-invites'],
    sidebarItems: ['dashboard', 'opportunities', 'projects', 'profile', 'learning'],
    features: ['job-matching', 'project-collaboration', 'skill-showcase'],
  },
  business_operator: {
    defaultRoute: '/dashboard/operator',
    dashboardWidgets: ['operational-tasks', 'team-metrics', 'process-automation', 'vendor-management'],
    sidebarItems: ['dashboard', 'operations', 'team', 'vendors', 'analytics'],
    features: ['operations', 'team-management', 'vendor-relations'],
  },
  mentor: {
    defaultRoute: '/dashboard/mentor',
    dashboardWidgets: ['mentee-overview', 'upcoming-sessions', 'session-requests', 'impact-metrics'],
    sidebarItems: ['dashboard', 'mentees', 'sessions', 'availability', 'resources', 'analytics'],
    features: ['mentorship', 'session-management', 'resource-sharing', 'impact-tracking'],
  },
  advisor: {
    defaultRoute: '/dashboard/advisor',
    dashboardWidgets: ['portfolio-companies', 'advisory-sessions', 'equity-tracker', 'board-meetings'],
    sidebarItems: ['dashboard', 'portfolio', 'sessions', 'documents', 'analytics'],
    features: ['advisory', 'portfolio-management', 'document-access'],
  },
  coach: {
    defaultRoute: '/dashboard/coach',
    dashboardWidgets: ['client-progress', 'coaching-sessions', 'program-curriculum', 'outcomes'],
    sidebarItems: ['dashboard', 'clients', 'sessions', 'programs', 'resources'],
    features: ['coaching', 'program-management', 'progress-tracking'],
  },
  course_creator: {
    defaultRoute: '/dashboard/creator',
    dashboardWidgets: ['course-analytics', 'student-progress', 'revenue-metrics', 'content-calendar'],
    sidebarItems: ['dashboard', 'courses', 'students', 'content', 'analytics', 'earnings'],
    features: ['course-creation', 'student-management', 'content-management', 'monetization'],
  },
  incubator_admin: {
    defaultRoute: '/dashboard/incubator',
    dashboardWidgets: ['cohort-overview', 'startup-pipeline', 'mentor-network', 'program-metrics', 'events'],
    sidebarItems: ['dashboard', 'cohorts', 'startups', 'mentors', 'programs', 'events', 'analytics', 'settings'],
    features: ['cohort-management', 'startup-tracking', 'mentor-matching', 'program-management', 'analytics'],
  },
  accelerator_admin: {
    defaultRoute: '/dashboard/accelerator',
    dashboardWidgets: ['batch-progress', 'demo-day-prep', 'investor-network', 'portfolio-metrics'],
    sidebarItems: ['dashboard', 'batches', 'portfolio', 'investors', 'demo-day', 'analytics', 'settings'],
    features: ['batch-management', 'investor-relations', 'demo-day', 'portfolio-tracking'],
  },
  university_admin: {
    defaultRoute: '/dashboard/university',
    dashboardWidgets: ['student-ventures', 'faculty-mentors', 'competitions', 'research-spinoffs'],
    sidebarItems: ['dashboard', 'ventures', 'faculty', 'competitions', 'research', 'analytics'],
    features: ['venture-tracking', 'faculty-engagement', 'competition-management'],
  },
  venture_studio_admin: {
    defaultRoute: '/dashboard/studio',
    dashboardWidgets: ['venture-pipeline', 'resource-allocation', 'portfolio-health', 'exit-tracking'],
    sidebarItems: ['dashboard', 'ventures', 'resources', 'portfolio', 'exits', 'analytics'],
    features: ['venture-building', 'resource-management', 'portfolio-management'],
  },
  angel_investor: {
    defaultRoute: '/dashboard/investor',
    dashboardWidgets: ['deal-flow', 'portfolio-overview', 'due-diligence', 'syndicate-activity'],
    sidebarItems: ['dashboard', 'deals', 'portfolio', 'syndicates', 'analytics'],
    features: ['deal-sourcing', 'portfolio-tracking', 'syndicate-participation'],
  },
  vc_scout: {
    defaultRoute: '/dashboard/scout',
    dashboardWidgets: ['sourcing-pipeline', 'referral-tracking', 'scout-metrics', 'fund-updates'],
    sidebarItems: ['dashboard', 'pipeline', 'referrals', 'network', 'analytics'],
    features: ['deal-sourcing', 'referral-management', 'network-building'],
  },
  vc_analyst: {
    defaultRoute: '/dashboard/analyst',
    dashboardWidgets: ['deal-analysis', 'market-research', 'portfolio-monitoring', 'report-queue'],
    sidebarItems: ['dashboard', 'deals', 'research', 'portfolio', 'reports'],
    features: ['deal-analysis', 'research', 'portfolio-monitoring', 'reporting'],
  },
  syndicate_manager: {
    defaultRoute: '/dashboard/syndicate',
    dashboardWidgets: ['syndicate-deals', 'member-activity', 'capital-deployed', 'returns'],
    sidebarItems: ['dashboard', 'deals', 'members', 'capital', 'analytics'],
    features: ['syndicate-management', 'deal-coordination', 'member-management'],
  },
  service_provider: {
    defaultRoute: '/dashboard/provider',
    dashboardWidgets: ['client-pipeline', 'active-projects', 'revenue-metrics', 'referrals'],
    sidebarItems: ['dashboard', 'clients', 'projects', 'services', 'analytics'],
    features: ['client-management', 'project-tracking', 'service-catalog'],
  },
  legal_partner: {
    defaultRoute: '/dashboard/legal',
    dashboardWidgets: ['active-matters', 'document-queue', 'client-startups', 'billing'],
    sidebarItems: ['dashboard', 'matters', 'documents', 'clients', 'billing'],
    features: ['matter-management', 'document-generation', 'client-portal'],
  },
  finance_advisor: {
    defaultRoute: '/dashboard/finance',
    dashboardWidgets: ['client-financials', 'fundraising-support', 'compliance-tasks', 'reports'],
    sidebarItems: ['dashboard', 'clients', 'fundraising', 'compliance', 'reports'],
    features: ['financial-advisory', 'fundraising-support', 'compliance'],
  },
  recruiter: {
    defaultRoute: '/dashboard/recruiter',
    dashboardWidgets: ['talent-pipeline', 'active-searches', 'placement-metrics', 'startup-clients'],
    sidebarItems: ['dashboard', 'candidates', 'searches', 'clients', 'analytics'],
    features: ['talent-sourcing', 'placement-tracking', 'client-management'],
  },
  platform_admin: {
    defaultRoute: '/admin',
    dashboardWidgets: ['platform-health', 'user-metrics', 'moderation-queue', 'system-alerts'],
    sidebarItems: ['dashboard', 'users', 'tenants', 'moderation', 'analytics', 'settings', 'system'],
    features: ['user-management', 'tenant-management', 'moderation', 'system-config'],
  },
};

// Permission definitions per role
export const ROLE_PERMISSIONS: Record<UserRoleType, string[]> = {
  aspiring_founder: ['profile:read', 'profile:write', 'builder:read', 'builder:write', 'matches:read', 'mentors:read', 'community:read', 'community:write'],
  existing_founder: ['profile:read', 'profile:write', 'builder:read', 'builder:write', 'builder:admin', 'team:read', 'team:write', 'investors:read', 'mentors:read', 'mentors:book', 'analytics:read', 'community:read', 'community:write'],
  cofounder_candidate: ['profile:read', 'profile:write', 'matches:read', 'applications:read', 'applications:write', 'learning:read'],
  technical_talent: ['profile:read', 'profile:write', 'jobs:read', 'jobs:apply', 'projects:read', 'projects:join'],
  business_operator: ['profile:read', 'profile:write', 'operations:read', 'operations:write', 'team:read', 'vendors:read'],
  mentor: ['profile:read', 'profile:write', 'mentees:read', 'mentees:write', 'sessions:read', 'sessions:write', 'availability:write', 'resources:read', 'resources:write'],
  advisor: ['profile:read', 'profile:write', 'portfolio:read', 'sessions:read', 'sessions:write', 'documents:read'],
  coach: ['profile:read', 'profile:write', 'clients:read', 'clients:write', 'sessions:read', 'sessions:write', 'programs:read', 'programs:write'],
  course_creator: ['profile:read', 'profile:write', 'courses:read', 'courses:write', 'courses:admin', 'students:read', 'content:read', 'content:write', 'earnings:read'],
  incubator_admin: ['profile:read', 'profile:write', 'org:read', 'org:write', 'org:admin', 'cohorts:read', 'cohorts:write', 'startups:read', 'startups:write', 'mentors:read', 'mentors:assign', 'programs:read', 'programs:write', 'events:read', 'events:write', 'analytics:read'],
  accelerator_admin: ['profile:read', 'profile:write', 'org:read', 'org:write', 'org:admin', 'batches:read', 'batches:write', 'portfolio:read', 'portfolio:write', 'investors:read', 'investors:invite', 'demo-day:read', 'demo-day:write', 'analytics:read'],
  university_admin: ['profile:read', 'profile:write', 'org:read', 'org:write', 'ventures:read', 'ventures:write', 'faculty:read', 'faculty:write', 'competitions:read', 'competitions:write', 'research:read'],
  venture_studio_admin: ['profile:read', 'profile:write', 'org:read', 'org:write', 'org:admin', 'ventures:read', 'ventures:write', 'ventures:create', 'resources:read', 'resources:allocate', 'portfolio:read', 'exits:read'],
  angel_investor: ['profile:read', 'profile:write', 'deals:read', 'deals:invest', 'portfolio:read', 'syndicates:read', 'syndicates:join'],
  vc_scout: ['profile:read', 'profile:write', 'pipeline:read', 'pipeline:write', 'referrals:read', 'referrals:write', 'network:read'],
  vc_analyst: ['profile:read', 'profile:write', 'deals:read', 'deals:analyze', 'research:read', 'research:write', 'portfolio:read', 'reports:read', 'reports:write'],
  syndicate_manager: ['profile:read', 'profile:write', 'syndicate:read', 'syndicate:write', 'syndicate:admin', 'deals:read', 'deals:create', 'members:read', 'members:invite', 'capital:read'],
  service_provider: ['profile:read', 'profile:write', 'clients:read', 'clients:write', 'projects:read', 'projects:write', 'services:read', 'services:write'],
  legal_partner: ['profile:read', 'profile:write', 'matters:read', 'matters:write', 'documents:read', 'documents:write', 'documents:generate', 'clients:read', 'billing:read', 'billing:write'],
  finance_advisor: ['profile:read', 'profile:write', 'clients:read', 'clients:write', 'financials:read', 'fundraising:read', 'fundraising:support', 'compliance:read', 'compliance:write', 'reports:read', 'reports:write'],
  recruiter: ['profile:read', 'profile:write', 'candidates:read', 'candidates:write', 'searches:read', 'searches:write', 'clients:read', 'placements:read', 'placements:write'],
  platform_admin: ['*'], // Full access
};

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserRoleFacets(userId: string) {
    return this.prisma.userRoleFacet.findMany({
      where: { userId, isActive: true },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async getPrimaryRole(userId: string) {
    const primaryRole = await this.prisma.userRoleFacet.findFirst({
      where: { userId, isActive: true, isPrimary: true },
    });

    if (primaryRole) return primaryRole;

    // Fallback to first active role
    return this.prisma.userRoleFacet.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addRoleFacet(
    userId: string,
    roleType: UserRoleType,
    scope: RoleFacetScope = RoleFacetScope.global,
    scopeId?: string | null,
    metadata?: Prisma.InputJsonValue,
  ) {
    // Check if role already exists
    const existing = await this.prisma.userRoleFacet.findUnique({
      where: {
        userId_roleType_scope_scopeId: {
          userId,
          roleType,
          scope,
          scopeId: (scopeId ?? null) as string,
        },
      },
    });

    if (existing) {
      if (!existing.isActive) {
        // Reactivate
        return this.prisma.userRoleFacet.update({
          where: { id: existing.id },
          data: { isActive: true, metadata },
        });
      }
      throw new BadRequestException('User already has this role');
    }

    // Check if this is the first role (make it primary)
    const existingRoles = await this.prisma.userRoleFacet.count({
      where: { userId, isActive: true },
    });

    return this.prisma.userRoleFacet.create({
      data: {
        userId,
        roleType,
        scope,
        scopeId,
        metadata,
        isPrimary: existingRoles === 0,
      },
    });
  }

  async removeRoleFacet(userId: string, roleId: string) {
    const role = await this.prisma.userRoleFacet.findFirst({
      where: { id: roleId, userId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Soft delete
    await this.prisma.userRoleFacet.update({
      where: { id: roleId },
      data: { isActive: false, isPrimary: false },
    });

    // If this was primary, assign new primary
    if (role.isPrimary) {
      const nextRole = await this.prisma.userRoleFacet.findFirst({
        where: { userId, isActive: true },
        orderBy: { createdAt: 'asc' },
      });

      if (nextRole) {
        await this.prisma.userRoleFacet.update({
          where: { id: nextRole.id },
          data: { isPrimary: true },
        });
      }
    }

    return { success: true };
  }

  async setPrimaryRole(userId: string, roleId: string) {
    const role = await this.prisma.userRoleFacet.findFirst({
      where: { id: roleId, userId, isActive: true },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Remove primary from all other roles
    await this.prisma.userRoleFacet.updateMany({
      where: { userId, isPrimary: true },
      data: { isPrimary: false },
    });

    // Set new primary
    return this.prisma.userRoleFacet.update({
      where: { id: roleId },
      data: { isPrimary: true },
    });
  }

  async verifyRole(userId: string, roleId: string, verifiedBy: string) {
    return this.prisma.userRoleFacet.update({
      where: { id: roleId },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
        verifiedBy,
      },
    });
  }

  getDashboardConfig(roleType: UserRoleType) {
    return ROLE_DASHBOARD_CONFIG[roleType] || ROLE_DASHBOARD_CONFIG.aspiring_founder;
  }

  getPermissions(roleType: UserRoleType): string[] {
    return ROLE_PERMISSIONS[roleType] || [];
  }

  hasPermission(roleType: UserRoleType, permission: string): boolean {
    const permissions = this.getPermissions(roleType);
    if (permissions.includes('*')) return true;
    return permissions.includes(permission);
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const roles = await this.getUserRoleFacets(userId);
    const allPermissions = new Set<string>();

    for (const role of roles) {
      const permissions = this.getPermissions(role.roleType);
      permissions.forEach((p) => allPermissions.add(p));
    }

    return Array.from(allPermissions);
  }

  async checkUserPermission(userId: string, permission: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    if (permissions.includes('*')) return true;
    return permissions.includes(permission);
  }

  async getUserDashboardContext(userId: string) {
    const primaryRole = await this.getPrimaryRole(userId);
    const allRoles = await this.getUserRoleFacets(userId);
    const permissions = await this.getUserPermissions(userId);

    const dashboardConfig = primaryRole
      ? this.getDashboardConfig(primaryRole.roleType)
      : ROLE_DASHBOARD_CONFIG.aspiring_founder;

    // Get organization memberships
    const orgMemberships = await this.prisma.organizationMembership.findMany({
      where: { userId, isActive: true },
      include: { organization: true },
    });

    // Get tenant memberships
    const tenantMemberships = await this.prisma.tenantMembership.findMany({
      where: { userId },
      include: { tenant: true },
    });

    return {
      primaryRole: primaryRole?.roleType || 'aspiring_founder',
      allRoles: allRoles.map((r) => ({
        id: r.id,
        roleType: r.roleType,
        scope: r.scope,
        scopeId: r.scopeId,
        isPrimary: r.isPrimary,
        isVerified: r.isVerified,
      })),
      permissions,
      dashboard: dashboardConfig,
      organizations: orgMemberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        type: m.organization.type,
        role: m.role,
      })),
      tenants: tenantMemberships.map((m) => ({
        id: m.tenant.id,
        name: m.tenant.name,
        slug: m.tenant.slug,
        role: m.role,
      })),
    };
  }

  // Stakeholder profile management
  async getMentorProfile(userId: string) {
    return this.prisma.mentorProfile.findUnique({
      where: { userId },
    });
  }

  async createOrUpdateMentorProfile(userId: string, data: Prisma.MentorProfileUpdateInput) {
    return this.prisma.mentorProfile.upsert({
      where: { userId },
      create: { userId, ...data } as Prisma.MentorProfileCreateInput,
      update: data,
    });
  }

  async getInvestorProfile(userId: string) {
    return this.prisma.investorProfile.findUnique({
      where: { userId },
    });
  }

  async createOrUpdateInvestorProfile(userId: string, data: Prisma.InvestorProfileUpdateInput) {
    return this.prisma.investorProfile.upsert({
      where: { userId },
      create: { userId, ...data } as Prisma.InvestorProfileCreateInput,
      update: data,
    });
  }

  async getServiceProviderProfile(userId: string) {
    return this.prisma.serviceProviderProfile.findUnique({
      where: { userId },
    });
  }

  async createOrUpdateServiceProviderProfile(userId: string, data: Prisma.ServiceProviderProfileUpdateInput) {
    return this.prisma.serviceProviderProfile.upsert({
      where: { userId },
      create: { userId, ...data } as Prisma.ServiceProviderProfileCreateInput,
      update: data,
    });
  }
}
