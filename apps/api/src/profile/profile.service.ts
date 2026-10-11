import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileIndexService } from '../jobs/profile-index.service';
import { CacheService } from '../common/cache/cache.service';
import { AutomationService } from '../automation/automation.service';
import { Prisma } from '@prisma/client';
import type { CreateProfileInput, UpdateProfileInput } from '@cofounderbay/shared';
import { isMembersOnlyProfile } from '@cofounderbay/shared';

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profileIndex: ProfileIndexService,
    private readonly cache: CacheService,
    @Optional() private readonly automation?: AutomationService,
  ) {}

  private profileSelect = {
    id: true,
    userId: true,
    displayName: true,
    headline: true,
    bio: true,
    location: true,
    timezone: true,
    languages: true,
    avatarUrl: true,
    rolePayload: true,
    visibilityRules: true,
    createdAt: true,
    updatedAt: true,
    skills: {
      select: {
        skillId: true,
        level: true,
        skill: { select: { id: true, name: true, slug: true } },
      },
    },
  } as const;

  async getOwnProfile(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: {
        ...this.profileSelect,
        user: { select: { role: true, email: true } },
      },
    });
    if (!profile || !profile.user) return null;
    return {
      id: profile.id,
      userId: profile.userId,
      displayName: profile.displayName,
      headline: profile.headline,
      bio: profile.bio,
      location: profile.location,
      timezone: profile.timezone,
      avatarUrl: profile.avatarUrl,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      role: profile.user.role,
      email: profile.user.email,
      languages: (profile.languages as string[] | null) ?? null,
      rolePayload: profile.rolePayload as Record<string, unknown> | null,
      visibilityRules: profile.visibilityRules as Record<string, string> | null,
      skills: profile.skills.map((s) => ({
        skillId: s.skill.id,
        skillName: s.skill.name,
        slug: s.skill.slug,
        level: s.level,
      })),
    };
  }

  async getPublicProfile(profileUserId: string, viewerUserId?: string) {
    const cacheKey = `public-profile:${profileUserId}:${viewerUserId || 'anonymous'}`;
    
    // Try to get from cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const [profile, user] = await Promise.all([
      this.prisma.profile.findUnique({
        where: { userId: profileUserId },
        select: this.profileSelect,
      }),
      this.prisma.user.findUnique({
        where: { id: profileUserId },
        select: { role: true, email: true },
      }),
    ]);
    if (!profile || !user) throw new NotFoundException('Profile not found');

    const visibility = (profile.visibilityRules as Record<string, string> | null) ?? {};
    const isOwner = viewerUserId === profileUserId;
    // "Public profile: off": not readable without signing in (the /p/ page
    // and its link preview). Answered as not found, so a link reveals nothing.
    if (!viewerUserId && isMembersOnlyProfile(profile.visibilityRules)) {
      throw new NotFoundException('Profile not found');
    }
    const showEmail = isOwner || visibility.email === 'public';

    const result = {
      id: profile.id,
      userId: profile.userId,
      displayName: profile.displayName,
      headline: profile.headline,
      bio: profile.bio,
      location: visibility.location !== 'private' ? profile.location : null,
      timezone: profile.timezone,
      languages: (profile.languages as string[] | null) ?? null,
      avatarUrl: profile.avatarUrl,
      role: user.role,
      rolePayload: profile.rolePayload as Record<string, unknown> | null,
      skills: profile.skills.map((s) => ({
        skillId: s.skill.id,
        skillName: s.skill.name,
        level: s.level,
      })),
      ...(showEmail && { email: user.email }),
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };

    // Cache the result for 5 minutes
    await this.cache.set(cacheKey, result, 300);
    return result;
  }

  async upsertProfile(userId: string, input: CreateProfileInput | UpdateProfileInput, isFullCreate: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user) throw new ForbiddenException('User not found');

    const displayName = 'displayName' in input && input.displayName != null
      ? input.displayName.trim()
      : undefined;
    const headline = input.headline !== undefined ? (input.headline ?? null) : undefined;
    const bio = input.bio !== undefined ? (input.bio ?? null) : undefined;
    const location = input.location !== undefined ? (input.location ?? null) : undefined;
    const timezone = input.timezone !== undefined ? (input.timezone ?? null) : undefined;
    const languages = input.languages !== undefined ? input.languages : undefined;
    const avatarUrl = input.avatarUrl !== undefined
      ? (input.avatarUrl === '' ? null : input.avatarUrl)
      : undefined;
    const rolePayload = input.rolePayload !== undefined ? (input.rolePayload as object) : undefined;
    const visibilityRules = input.visibilityRules !== undefined ? (input.visibilityRules as object) : undefined;

    const existing = await this.prisma.profile.findUnique({ where: { userId } });
    if (!existing && isFullCreate && !displayName?.trim()) {
      throw new BadRequestException('Display name is required');
    }
    if (existing && isFullCreate && displayName == null) {
      return this.getOwnProfile(userId);
    }

    const skillIds = input.skillIds ?? (existing ? undefined : []);
    const skillLevels = input.skillLevels ?? {};
    const validSkillIds = skillIds && skillIds.length > 0
      ? await this.prisma.skill.findMany({ where: { id: { in: skillIds } }, select: { id: true } }).then((s) => s.map((x) => x.id))
      : [];

    const profileData = {
      displayName: displayName ?? (existing?.displayName ?? ''),
      headline: headline !== undefined ? headline : existing?.headline ?? null,
      bio: bio !== undefined ? bio : existing?.bio ?? null,
      location: location !== undefined ? location : existing?.location ?? null,
      timezone: timezone !== undefined ? timezone : existing?.timezone ?? null,
      languages: languages !== undefined ? languages : (existing?.languages as string[] | null) ?? null,
      avatarUrl: avatarUrl !== undefined ? avatarUrl : existing?.avatarUrl ?? null,
      rolePayload: rolePayload !== undefined ? rolePayload : existing?.rolePayload,
      visibilityRules: visibilityRules !== undefined ? visibilityRules : existing?.visibilityRules,
    };

    const profile = await this.prisma.$transaction(async (tx) => {
      const createdOrUpdated = await tx.profile.upsert({
        where: { userId },
        create: {
          userId,
          displayName: profileData.displayName,
          headline: profileData.headline,
          bio: profileData.bio,
          location: profileData.location,
          timezone: profileData.timezone,
          languages: profileData.languages ?? Prisma.JsonNull,
          avatarUrl: profileData.avatarUrl,
          rolePayload: profileData.rolePayload ?? Prisma.JsonNull,
          visibilityRules: profileData.visibilityRules ?? Prisma.JsonNull,
        },
        update: {
          displayName: profileData.displayName,
          headline: profileData.headline,
          bio: profileData.bio,
          location: profileData.location,
          timezone: profileData.timezone,
          languages: profileData.languages ?? Prisma.JsonNull,
          avatarUrl: profileData.avatarUrl,
          rolePayload: profileData.rolePayload ?? Prisma.JsonNull,
          visibilityRules: profileData.visibilityRules ?? Prisma.JsonNull,
        },
      });

      if (validSkillIds.length >= 0) {
        await tx.profileSkill.deleteMany({ where: { profileId: createdOrUpdated.id } });
        if (validSkillIds.length > 0) {
          await tx.profileSkill.createMany({
            data: validSkillIds.map((skillId) => ({
              profileId: createdOrUpdated.id,
              skillId,
              level: (skillLevels as Record<string, string>)[skillId] ?? null,
            })),
          });
        }
      }

      await tx.user.update({
        where: { id: userId },
        data: { hasCompletedOnboarding: true },
      });

      return createdOrUpdated;
    });

    void this.profileIndex.schedule(profile.id, userId).catch(() => {});

    const completionScore = [
      profileData.displayName,
      profileData.headline,
      profileData.bio,
      profileData.avatarUrl,
      profileData.location,
    ].filter(Boolean).length;
    const isComplete = completionScore >= 4;
    this.automation?.fire({
      triggerType: isComplete ? 'profile_complete' : 'profile_incomplete',
      targetUserId: userId,
      payload: { completionScore, isFirstTime: !existing },
    }).catch(() => {});

    // Invalidate cache for this profile
    await this.invalidateProfileCache(userId);

    return this.getOwnProfile(userId);
  }

  async listSkills(category?: string) {
    const list = await this.prisma.skill.findMany({
      where: category ? { category } : undefined,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, category: true },
    });
    return list;
  }

  private async invalidateProfileCache(userId: string) {
    // Invalidate all public profile cache entries for this user
    // Use a simple approach - invalidate common patterns
    const patterns = [
      `public-profile:${userId}:anonymous`,
      `public-profile:${userId}:`,
    ];
    
    for (const key of patterns) {
      await this.cache.del(key);
    }
  }
}
