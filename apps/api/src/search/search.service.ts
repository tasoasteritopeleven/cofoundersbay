import { Injectable } from '@nestjs/common';
import type { Role } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { computeMatchScore, isHiddenFromSearch, placeVariants, planPromotes, PROMOTED_SLOTS, type ProfileSnapshot } from '@cofounderbay/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MeilisearchService } from './meilisearch.service';

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly meili: MeilisearchService,
  ) {}

  async searchProfiles(params: {
    q?: string;
    roles?: string[];
    location?: string;
    skills?: string[];
    industries?: string[];
    stage?: string[];
    languages?: string[];
    commitment?: string[];
    investmentStages?: string[];
    sortBy?: 'relevance' | 'recent' | 'active';
    limit?: number;
    offset?: number;
  }) {
    let result: { hits: unknown[]; total: number; stats?: unknown } | null = null;
    if (this.meili.isEnabled()) {
      try {
        result = await this.meili.searchProfiles(params);
      } catch {
        // Meilisearch unreachable — fall through to Prisma
      }
    }
    if (!result) result = await this.searchProfilesFallback(params);
    result = await this.withoutHiddenFromSearch(result);
    // The labelled "Promoted" slot is offered on the first page only, from
    // people already in it; the hits themselves are returned untouched.
    const promotedUserIds = params.offset ? [] : await this.promotedAmong((result?.hits ?? []) as Array<{ userId?: string }>);
    return { ...result, promotedUserIds };
  }

  /**
   * Drops members who chose "Appear in search: off" (`visibilityRules.search
   * = 'hidden'`, shared/visibility). One read for both paths, the search
   * index and the database fallback, so neither can show them. The total
   * goes down by the members dropped from this page; a hidden member on a
   * later page is dropped there.
   */
  private async withoutHiddenFromSearch<R extends { hits: unknown[]; total: number }>(result: R): Promise<R> {
    const ids = (result.hits as Array<{ userId?: unknown }>).map((h) => h?.userId).filter((id): id is string => typeof id === 'string' && !!id);
    if (!ids.length) return result;
    const rows = await this.prisma.profile.findMany({ where: { userId: { in: ids } }, select: { userId: true, visibilityRules: true } });
    const hidden = new Set(rows.filter((r) => isHiddenFromSearch(r.visibilityRules)).map((r) => r.userId));
    if (!hidden.size) return result;
    const hits = (result.hits as Array<{ userId?: unknown }>).filter((h) => !(typeof h?.userId === 'string' && hidden.has(h.userId)));
    return { ...result, hits, total: Math.max(0, result.total - (result.hits.length - hits.length)) };
  }

  /**
   * Which of these people hold a plan that buys the promoted slot
   * (`planPromotes`), at most `PROMOTED_SLOTS`, in result order. A lookup
   * that fails promotes nobody: the slot is never worth an error.
   */
  async promotedAmong(hits: ReadonlyArray<{ userId?: string }>): Promise<string[]> {
    const ids = hits.map((h) => h.userId).filter((id): id is string => typeof id === 'string' && !!id);
    if (!ids.length) return [];
    try {
      const subs = await this.prisma.subscription.findMany({
        where: { userId: { in: ids }, status: { in: ['active', 'trialing'] } },
        select: { userId: true, plan: { select: { name: true, features: true } } },
      });
      const paying = new Set(subs.filter((s) => planPromotes(s.plan)).map((s) => s.userId));
      return ids.filter((id) => paying.has(id)).slice(0, PROMOTED_SLOTS);
    } catch {
      return [];
    }
  }

  private async searchProfilesFallback(params: {
    q?: string;
    roles?: string[];
    location?: string;
    skills?: string[];
    industries?: string[];
    stage?: string[];
    languages?: string[];
    commitment?: string[];
    investmentStages?: string[];
    sortBy?: 'relevance' | 'recent' | 'active';
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(params.limit ?? 20, 50);
    const offset = params.offset ?? 0;
    const where: Prisma.ProfileWhereInput = {};
    if (params.roles?.length) {
      where.user = { role: { in: params.roles as Role[] } };
    }
    const and: Prisma.ProfileWhereInput[] = [];

    if (params.location) {
      // «Θεσσαλονίκη» and "Thessaloniki" are one place: any spelling matches.
      const variants = placeVariants(params.location);
      and.push({ OR: variants.map((v) => ({ location: { contains: v, mode: 'insensitive' as const } })) });
    }
    if (params.q) {
      // Every word must match somewhere, in any order. A phrase used to be
      // one substring, so "technical cofounder Athens" found nobody; every
      // profile it did find still matches each of its words.
      const words = params.q.trim().split(/\s+/).filter(Boolean).slice(0, 8);
      for (const word of words) {
        and.push({
          OR: [
            { displayName: { contains: word, mode: 'insensitive' } },
            { headline: { contains: word, mode: 'insensitive' } },
            { bio: { contains: word, mode: 'insensitive' } },
            { location: { contains: word, mode: 'insensitive' } },
            { skills: { some: { skill: { name: { contains: word, mode: 'insensitive' } } } } },
          ],
        });
      }
    }
    if (params.skills?.length) {
      where.skills = {
        some: {
          skill: { name: { in: params.skills } },
        },
      };
    }

    if (params.languages?.length) {
      and.push({
        OR: params.languages.map((lang) => ({
          languages: { array_contains: [lang] } as any,
        })),
      });
    }
    if (params.industries?.length) {
      and.push({
        OR: params.industries.map((ind) => ({
          rolePayload: { path: ['industry'], equals: ind } as any,
        })),
      });
    }
    if (params.stage?.length) {
      and.push({
        OR: params.stage.map((st) => ({
          rolePayload: { path: ['stage'], equals: st } as any,
        })),
      });
    }
    if (params.commitment?.length) {
      and.push({
        OR: params.commitment.map((c) => ({
          rolePayload: { path: ['commitment'], equals: c } as any,
        })),
      });
    }
    if (params.investmentStages?.length) {
      and.push({
        OR: params.investmentStages.map((st) => ({
          rolePayload: { path: ['stages'], array_contains: [st] } as any,
        })),
      });
    }

    if (and.length) where.AND = and;

    const orderBy =
      params.sortBy === 'recent'
        ? ({ createdAt: 'desc' } as const)
        : params.sortBy === 'active'
          ? ({ updatedAt: 'desc' } as const)
          : ({ updatedAt: 'desc' } as const);

    /*
     * The directory header shows "online now" and "new this week" next to the
     * total. Those have to be counted over the same `where` as the results,
     * not over the page of hits that happens to be loaded: a figure scoped to
     * 20 rows sitting beside a figure scoped to the whole directory reads as
     * one claim and is two.
     *
     * "Online" is a five-minute window on `lastSeenAt`, which is the same
     * signal the admin dashboard counts and the only presence the schema
     * records.
     */
    const onlineSince = new Date(Date.now() - 5 * 60 * 1000);
    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [profiles, total, onlineNow, newThisWeek, roleGroups] = await Promise.all([
      this.prisma.profile.findMany({
        where,
        include: {
          user: { select: { id: true, role: true, lastSeenAt: true } },
          skills: { include: { skill: true } },
        },
        orderBy,
        take: limit,
        skip: offset,
      }),
      this.prisma.profile.count({ where }),
      this.prisma.profile.count({
        where: { AND: [where, { user: { lastSeenAt: { gte: onlineSince } } }] },
      }),
      this.prisma.profile.count({
        where: { AND: [where, { createdAt: { gte: weekStart } }] },
      }),
      this.prisma.profile.groupBy({
        by: ['userId'],
        where: { AND: [where, { user: { role: 'mentor' } }] },
        _count: { userId: true },
      }),
    ]);

    const hits = profiles.map((p) => ({
      id: p.id,
      userId: p.userId,
      displayName: p.displayName,
      headline: p.headline,
      bio: p.bio,
      avatarUrl: p.avatarUrl ?? null,
      location: p.location,
      timezone: p.timezone,
      languages: (p.languages as string[] | null) ?? [],
      role: p.user.role,
      skillNames: p.skills.map((s: { skill: { name: string } }) => s.skill.name),
      skillSlugs: p.skills.map((s: { skill: { slug: string } }) => s.skill.slug),
      createdAt: Math.floor(p.createdAt.getTime() / 1000),
      updatedAt: Math.floor(p.updatedAt.getTime() / 1000),
      lastSeenAt: p.user.lastSeenAt ? Math.floor(p.user.lastSeenAt.getTime() / 1000) : null,
    }));

    return {
      hits,
      total,
      stats: { onlineNow, newThisWeek, mentors: roleGroups.length },
    };
  }

  /**
   * Unified search the `/search` page calls: people, jobs, events, groups,
   * opportunities — one payload with `href` on every hit so the client can
   * render ResultCards instead of dropping rows that look like profile hits.
   */
  async searchGlobal(params: {
    q: string;
    category?: string;
    page?: number;
    limit?: number;
  }) {
    const q = params.q.trim();
    const category = params.category ?? 'all';
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 50);
    const empty = {
      results: [] as Array<Record<string, unknown>>,
      total: 0,
      categories: {
        people: 0,
        jobs: 0,
        events: 0,
        groups: 0,
        mentors: 0,
        opportunities: 0,
      },
    };
    if (q.length < 2) return empty;

    const contains = { contains: q, mode: 'insensitive' as const };
    const wantPeople = category === 'all' || category === 'people';
    const wantMentors = category === 'all' || category === 'mentors';
    const wantJobs = category === 'all' || category === 'jobs';
    const wantEvents = category === 'all' || category === 'events';
    const wantGroups = category === 'all' || category === 'groups';
    const wantOpps = category === 'all' || category === 'opportunities';

    const [people, mentors, jobs, events, groups, opportunities] = await Promise.all([
      wantPeople
        ? this.prisma.profile.findMany({
            where: {
              OR: [
                { displayName: contains },
                { headline: contains },
                { bio: contains },
                { location: contains },
              ],
            },
            include: { user: { select: { id: true, role: true } } },
            take: limit,
          })
        : Promise.resolve([]),
      wantMentors
        ? this.prisma.profile.findMany({
            where: {
              user: { role: 'mentor' },
              OR: [
                { displayName: contains },
                { headline: contains },
                { bio: contains },
                { location: contains },
              ],
            },
            include: { user: { select: { id: true, role: true } } },
            take: limit,
          })
        : Promise.resolve([]),
      wantJobs
        ? this.prisma.jobPosting.findMany({
            where: {
              isActive: true,
              OR: [{ title: contains }, { description: contains }, { location: contains }, { role: contains }],
            },
            take: limit,
          })
        : Promise.resolve([]),
      wantEvents
        ? this.prisma.event.findMany({
            where: {
              OR: [{ title: contains }, { description: contains }, { location: contains }],
            },
            take: limit,
            orderBy: { startAt: 'desc' },
          })
        : Promise.resolve([]),
      wantGroups
        ? this.prisma.group.findMany({
            where: {
              privacy: 'public',
              OR: [{ name: contains }, { description: contains }, { category: contains }],
            },
            take: limit,
          })
        : Promise.resolve([]),
      wantOpps
        ? this.prisma.opportunity.findMany({
            where: {
              isActive: true,
              OR: [{ title: contains }, { description: contains }, { company: contains }, { location: contains }],
            },
            take: limit,
          })
        : Promise.resolve([]),
    ]);

    // "Appear in search: off" holds here too (shared/visibility).
    const peopleHits = people.filter((p) => !isHiddenFromSearch(p.visibilityRules)).map((p) => ({
      id: p.userId,
      type: 'user' as const,
      title: p.displayName,
      subtitle: p.headline ?? undefined,
      description: p.bio ?? undefined,
      imageUrl: p.avatarUrl ?? undefined,
      href: `/profiles/${p.userId}`,
      meta: p.location ? { location: p.location } : undefined,
    }));
    const mentorHits = mentors.filter((p) => !isHiddenFromSearch(p.visibilityRules)).map((p) => ({
      id: p.userId,
      type: 'user' as const,
      title: p.displayName,
      subtitle: p.headline ?? undefined,
      description: p.bio ?? undefined,
      imageUrl: p.avatarUrl ?? undefined,
      href: `/profiles/${p.userId}`,
      meta: p.location ? { location: p.location } : undefined,
    }));
    const jobHits = jobs.map((j) => ({
      id: j.id,
      type: 'job' as const,
      title: j.title,
      subtitle: j.role ?? undefined,
      description: j.description ?? undefined,
      href: `/jobs`,
      meta: {
        ...(j.location ? { location: j.location } : {}),
      },
    }));
    const eventHits = events.map((e) => ({
      id: e.id,
      type: 'event' as const,
      title: e.title,
      subtitle: e.location ?? undefined,
      description: e.description ?? undefined,
      imageUrl: e.coverImageUrl ?? undefined,
      href: `/events/${e.id}`,
      meta: {
        ...(e.location ? { location: e.location } : {}),
        date: e.startAt.toISOString(),
      },
    }));
    const groupHits = groups.map((g) => ({
      id: g.id,
      type: 'group' as const,
      title: g.name,
      subtitle: g.category ?? undefined,
      description: g.description ?? undefined,
      imageUrl: g.avatarUrl ?? undefined,
      href: `/groups/${g.id}`,
    }));
    const oppHits = opportunities.map((o) => ({
      id: o.id,
      type: 'opportunity' as const,
      title: o.title,
      subtitle: o.company ?? undefined,
      description: o.description ?? undefined,
      href: `/opportunities`,
      meta: o.location ? { location: o.location } : undefined,
    }));

    const byCategory = {
      people: peopleHits,
      mentors: mentorHits,
      jobs: jobHits,
      events: eventHits,
      groups: groupHits,
      opportunities: oppHits,
    };

    const results =
      category === 'all'
        ? [...peopleHits, ...jobHits, ...eventHits, ...groupHits, ...oppHits]
        : byCategory[category as keyof typeof byCategory] ?? [];

    return {
      results: results.slice(0, limit),
      total: results.length,
      categories: {
        people: peopleHits.length,
        jobs: jobHits.length,
        events: eventHits.length,
        groups: groupHits.length,
        mentors: mentorHits.length,
        opportunities: oppHits.length,
      },
    };
  }

  /**
   * Rules-based recommendations with score 0-100 per candidate.
   * Excludes users that already have a pending or accepted connection with the viewer.
   * Uses shared computeMatchScore for consistent scoring (role, skills, stage, commitment, location, recency).
   */
  async getRecommendations(userId: string, options?: { role?: string; limit?: number }) {
    const fetchLimit = 50;
    const returnLimit = Math.min(options?.limit ?? 10, 20);

    const viewer = await this.prisma.profile.findUnique({
      where: { userId },
      include: {
        user: { select: { role: true } },
        skills: { include: { skill: true } },
      },
    });
    if (!viewer) return { suggestions: [] };

    const excludedUserIds = await this.getConnectedOrPendingUserIds(userId);

    const targetRoles = options?.role
      ? [options.role as Role]
      : this.complementaryRoles(viewer.user.role as string);

    const candidates = await this.prisma.profile.findMany({
      where: {
        userId: { not: userId, notIn: excludedUserIds },
        user: { role: { in: targetRoles } },
      },
      include: {
        user: { select: { id: true, role: true } },
        skills: { include: { skill: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: fetchLimit,
    });

    const viewerSnapshot = this.toProfileSnapshot(viewer);
    const scored = candidates.filter((p) => !isHiddenFromSearch(p.visibilityRules)).map((p) => {
      const candidateSnapshot = this.toProfileSnapshot(p);
      const { score, breakdown } = computeMatchScore(viewerSnapshot, candidateSnapshot);
      const rp = p.rolePayload as Record<string, unknown> | null;
      return {
        id: p.id,
        userId: p.userId,
        displayName: p.displayName,
        headline: p.headline,
        bio: p.bio,
        avatarUrl: p.avatarUrl ?? null,
        location: p.location,
        role: p.user.role,
        skillNames: p.skills.map((s: { skill: { name: string } }) => s.skill.name),
        matchScore: score,
        matchReasons: breakdown.reasons,
        lookingFor: (rp?.lookingFor as string | undefined) ?? null,
        availability: (rp?.availability as string | undefined) ?? (rp?.commitment as string | undefined) ?? null,
      };
    });

    scored.sort((a, b) => b.matchScore - a.matchScore);
    return { suggestions: scored.slice(0, returnLimit) };
  }

  /** User IDs that have pending or accepted connection with the given user (either direction). */
  private async getConnectedOrPendingUserIds(userId: string): Promise<string[]> {
    const requests = await this.prisma.connectionRequest.findMany({
      where: {
        OR: [{ requesterId: userId }, { receiverId: userId }],
        status: { in: ['pending', 'accepted'] },
      },
      select: { requesterId: true, receiverId: true },
    });
    const ids = new Set<string>();
    for (const r of requests) {
      if (r.requesterId !== userId) ids.add(r.requesterId);
      if (r.receiverId !== userId) ids.add(r.receiverId);
    }
    return Array.from(ids);
  }

  private toProfileSnapshot(p: {
    id: string;
    userId: string;
    displayName: string;
    headline: string | null;
    bio: string | null;
    location: string | null;
    timezone: string | null;
    rolePayload: unknown;
    updatedAt: Date;
    user: { role: string };
    skills: { skill: { name: string } }[];
  }): ProfileSnapshot {
    return {
      profileId: p.id,
      userId: p.userId,
      role: p.user.role as ProfileSnapshot['role'],
      displayName: p.displayName,
      headline: p.headline,
      bio: p.bio,
      location: p.location,
      timezone: p.timezone,
      skillNames: p.skills.map((s) => s.skill.name),
      rolePayload: (p.rolePayload as Record<string, unknown>) ?? null,
      updatedAtMs: p.updatedAt.getTime(),
    };
  }

  /** Returns complementary roles for a given viewer role (includes cofounder match for founders). */
  private complementaryRoles(viewerRole: string): Role[] {
    switch (viewerRole) {
      case 'founder':
        return ['mentor', 'investor', 'founder'] as Role[];
      case 'mentor':
        return ['founder'] as Role[];
      case 'investor':
        return ['founder'] as Role[];
      case 'org':
        return ['founder', 'mentor'] as Role[];
      default:
        return ['founder', 'mentor', 'investor'] as Role[];
    }
  }
}
