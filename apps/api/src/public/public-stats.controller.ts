import { Controller, Get } from '@nestjs/common';
import type { UserRoleType } from '@prisma/client';
import type { PublicStats } from '@cofounderbay/shared';
import { PrismaService } from '../prisma/prisma.service';

/** Mentor-kind facets that make a member a mentor for the public count. */
const MENTOR_ROLE_TYPES: UserRoleType[] = ['mentor', 'advisor', 'coach', 'course_creator'];

const CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Measured counts for the public landing page — unauthenticated like
 * /health and the public profile, so the numbers a visitor reads are the
 * same ones a member sees counted inside. Held in memory for ten minutes;
 * five counts are cheap but the page is the busiest we serve.
 */
@Controller('public')
export class PublicStatsController {
  private cached: { at: number; stats: PublicStats } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  @Get('stats')
  async stats(): Promise<PublicStats> {
    const now = Date.now();
    if (this.cached && now - this.cached.at < CACHE_TTL_MS) {
      return this.cached.stats;
    }

    const [members, mentors, connections, events, organizations] = await Promise.all([
      this.prisma.user.count({ where: { moderationStatus: 'active' } }),
      this.prisma.user.count({
        where: {
          moderationStatus: 'active',
          OR: [
            { role: 'mentor' },
            { roleFacets: { some: { isActive: true, roleType: { in: MENTOR_ROLE_TYPES } } } },
          ],
        },
      }),
      this.prisma.connectionRequest.count({ where: { status: 'accepted' } }),
      this.prisma.event.count(),
      this.prisma.organization.count({ where: { isActive: true } }),
    ]);

    const stats: PublicStats = {
      members,
      mentors,
      connections,
      events,
      organizations,
      measuredAt: new Date(now).toISOString(),
    };
    this.cached = { at: now, stats };
    return stats;
  }
}
