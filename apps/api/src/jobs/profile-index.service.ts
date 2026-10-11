import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MeilisearchService, type ProfileSearchDocument } from '../search/meilisearch.service';

@Injectable()
export class ProfileIndexService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly meili: MeilisearchService,
  ) {}

  async schedule(profileId: string, userId: string): Promise<void> {
    if (!this.meili.isEnabled()) return;
    try {
      const doc = await this.buildDocument(profileId, userId);
      if (doc) {
        await this.meili.ensureProfilesIndex();
        await this.meili.indexProfile(doc);
      }
    } catch {
      // non-blocking; log in production
    }
  }

  async remove(profileId: string): Promise<void> {
    if (!this.meili.isEnabled()) return;
    try {
      await this.meili.removeProfile(profileId);
    } catch {
      // non-blocking
    }
  }

  private async buildDocument(profileId: string, userId: string): Promise<ProfileSearchDocument | null> {
    const profile = await this.prisma.profile.findUnique({
      where: { id: profileId, userId },
      include: {
        user: { select: { role: true } },
        skills: { include: { skill: true } },
      },
    });
    if (!profile) return null;

    const rolePayload = (profile.rolePayload as Record<string, unknown>) ?? {};
    const skillNames = profile.skills.map((s) => s.skill.name);
    const skillSlugs = profile.skills.map((s) => s.skill.slug);
    const languages: string[] = Array.isArray(profile.languages)
      ? profile.languages.filter((x): x is string => typeof x === 'string')
      : [];

    return {
      id: profile.id,
      userId: profile.userId,
      displayName: profile.displayName,
      headline: profile.headline ?? null,
      bio: profile.bio ?? null,
      location: profile.location ?? null,
      timezone: profile.timezone ?? null,
      languages,
      avatarUrl: profile.avatarUrl ?? null,
      role: profile.user.role,
      skillNames,
      skillSlugs,
      industry: typeof rolePayload.industry === 'string' ? rolePayload.industry : undefined,
      stage: rolePayload.stage as string | undefined,
      commitment: rolePayload.commitment as string | undefined,
      investmentStages: rolePayload.stages as string[] | undefined,
      expertiseAreas: rolePayload.expertiseAreas as string[] | undefined,
      investmentFocus: rolePayload.investmentFocus as string[] | undefined,
      createdAt: Math.floor(profile.createdAt.getTime() / 1000),
      updatedAt: Math.floor(profile.updatedAt.getTime() / 1000),
    };
  }
}
