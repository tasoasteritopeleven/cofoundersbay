import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { FeedPostType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * The `/feed` page's server.
 *
 * Until this module the web client called `/api/feed/personalized`,
 * `/preferences`, `/trending` and `/interaction` and nothing answered; posts
 * were kept only in the browser for the session. Posts live in `FeedPost`
 * (with `FeedLike`/`FeedBookmark`), settings in `FeedPreference`, hides in
 * `FeedHiddenPost`.
 *
 * Ranking is deliberately legible rather than engagement-maximising: recency
 * decays over the reader's own horizon, engagement is log-damped so one viral
 * post cannot bury everyone else, the reader's topics and network add a
 * bounded lift, and repeated authors are damped. Every post says why it is
 * there (`relevanceReasons`).
 */

export const CLIENT_POST_TYPES = ['update', 'milestone', 'question', 'announcement', 'achievement'] as const;
export type ClientPostType = (typeof CLIENT_POST_TYPES)[number];
const INTERACTIONS = ['view', 'like', 'comment', 'share', 'bookmark', 'hide'] as const;
type Interaction = (typeof INTERACTIONS)[number];
const PREFERENCE_ROLES = ['founder', 'cofounder', 'existing_founder', 'mentor', 'investor', 'angel_investor', 'service_provider', 'incubator_admin'] as const;

export const FEED_LIMITS = { content: 3000, window: 300, page: 50, topics: 20, topic: 40, trendingDays: 7 } as const;

export interface FeedPreferences {
  topics: string[];
  roles: string[];
  contentTypes: ClientPostType[];
  interactionWeights: { likes: number; comments: number; shares: number; bookmarks: number };
  timeDecayHours: number;
  diversityBoost: number;
}

export const DEFAULT_FEED_PREFERENCES: FeedPreferences = {
  topics: [],
  roles: [],
  contentTypes: [...CLIENT_POST_TYPES],
  interactionWeights: { likes: 1, comments: 1, shares: 1, bookmarks: 1 },
  timeDecayHours: 72,
  diversityBoost: 0.2,
};

const TO_CLIENT_TYPE: Record<FeedPostType, ClientPostType> = {
  text: 'update',
  announcement: 'announcement',
  milestone_share: 'milestone',
  workspace_update: 'update',
  question: 'question',
  poll: 'update',
  event_share: 'announcement',
  resource_share: 'update',
};
const FROM_CLIENT_TYPE: Record<ClientPostType, FeedPostType> = {
  update: 'text',
  milestone: 'milestone_share',
  question: 'question',
  announcement: 'announcement',
  achievement: 'milestone_share',
};

/** Hashtags in a post, lower-cased, in Greek or Latin script. */
export function hashtags(content: string): string[] {
  // Not after a letter, digit, slash or ampersand: `C#`, `x.co/#anchor` and `&#39;` are not tags.
  return [...new Set([...content.matchAll(/(?:^|[^\p{L}\p{N}_/&#])#([\p{L}\p{N}_-]{2,40})/gu)].map((m) => m[1].toLowerCase()))];
}

function clamp(n: unknown, lo: number, hi: number, fallback: number): number {
  return typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
}

/** Merges a stored or submitted object over the defaults, keeping only valid values. */
export function readPreferences(raw: unknown, base: FeedPreferences = DEFAULT_FEED_PREFERENCES): FeedPreferences {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const list = (v: unknown, ok: (s: string) => boolean, max: number) =>
    Array.isArray(v) ? [...new Set(v.filter((s): s is string => typeof s === 'string').map((s) => s.trim().toLowerCase().replace(/^#/, '')).filter(ok))].slice(0, max) : undefined;
  const w = (r.interactionWeights && typeof r.interactionWeights === 'object' ? r.interactionWeights : {}) as Record<string, unknown>;
  const contentTypes = list(r.contentTypes, (s) => (CLIENT_POST_TYPES as readonly string[]).includes(s), CLIENT_POST_TYPES.length) as ClientPostType[] | undefined;
  return {
    topics: list(r.topics, (s) => s.length > 0 && s.length <= FEED_LIMITS.topic, FEED_LIMITS.topics) ?? base.topics,
    roles: list(r.roles, (s) => (PREFERENCE_ROLES as readonly string[]).includes(s), PREFERENCE_ROLES.length) ?? base.roles,
    contentTypes: contentTypes && contentTypes.length ? contentTypes : base.contentTypes,
    interactionWeights: {
      likes: clamp(w.likes, 0, 5, base.interactionWeights.likes),
      comments: clamp(w.comments, 0, 5, base.interactionWeights.comments),
      shares: clamp(w.shares, 0, 5, base.interactionWeights.shares),
      bookmarks: clamp(w.bookmarks, 0, 5, base.interactionWeights.bookmarks),
    },
    timeDecayHours: clamp(r.timeDecayHours, 6, 720, base.timeDecayHours),
    diversityBoost: clamp(r.diversityBoost, 0, 1, base.diversityBoost),
  };
}

export interface RankInput {
  id: string;
  authorId: string;
  authorRole: string;
  createdAt: Date;
  likes: number;
  comments: number;
  shares: number;
  tags: string[];
  inNetwork: boolean;
  isPinned: boolean;
}

export interface Ranked {
  id: string;
  score: number;
  reasons: string[];
}

/**
 * Scores posts for one reader. Pure, so the ordering can be tested and
 * explained. `trending` ranks by recent engagement alone (the "Trending" tab).
 */
export function rankPosts(posts: RankInput[], prefs: FeedPreferences, now: number, mode: 'personal' | 'trending' = 'personal'): Ranked[] {
  const w = prefs.interactionWeights;
  const scored = posts.map((p) => {
    const ageHours = Math.max(0, (now - p.createdAt.getTime()) / 3_600_000);
    const engagement = Math.log1p(p.likes * w.likes + p.comments * w.comments * 2 + p.shares * w.shares * 3) / 5;
    const reasons: string[] = [];
    if (mode === 'trending') {
      const recentWindow = Math.exp(-ageHours / 72);
      if (engagement > 0.4) reasons.push('Popular this week');
      return { id: p.id, authorId: p.authorId, score: engagement * recentWindow, reasons };
    }
    const recency = Math.exp(-ageHours / prefs.timeDecayHours);
    const topicHits = p.tags.filter((t) => prefs.topics.includes(t));
    const topic = topicHits.length ? 0.15 : 0;
    const role = prefs.roles.includes(p.authorRole) ? 0.05 : 0;
    const network = p.inNetwork ? 0.1 : 0;
    const pinned = p.isPinned ? 0.2 : 0;
    if (p.isPinned) reasons.push('Pinned');
    if (p.inNetwork) reasons.push('From your network');
    if (topicHits.length) reasons.push(`Matches #${topicHits[0]}`);
    if (role) reasons.push(`From a ${p.authorRole.replace(/_/g, ' ')}`);
    if (engagement > 0.4) reasons.push('Popular this week');
    if (!reasons.length) reasons.push('Recent');
    return { id: p.id, authorId: p.authorId, score: recency * 0.5 + Math.min(engagement, 1) * 0.25 + topic + role + network + pinned, reasons };
  });
  scored.sort((a, b) => b.score - a.score);
  // Diversity: each further post by an author already shown is damped.
  const seenAuthors = new Map<string, number>();
  const damped = scored.map((s) => {
    const n = seenAuthors.get(s.authorId) ?? 0;
    seenAuthors.set(s.authorId, n + 1);
    return { id: s.id, score: s.score * Math.pow(1 - prefs.diversityBoost, n), reasons: s.reasons };
  });
  return damped.sort((a, b) => b.score - a.score);
}

type PostRow = Prisma.FeedPostGetPayload<{
  include: {
    author: { select: { id: true; role: true; profile: { select: { displayName: true; avatarUrl: true; headline: true } } } };
    likes: { select: { id: true } };
    bookmarks: { select: { id: true } };
  };
}>;

function toClientPost(row: PostRow, ranked?: Ranked) {
  const link = row.linkPreview && typeof row.linkPreview === 'object' ? (row.linkPreview as { url?: string; title?: string; image?: string }) : null;
  return {
    id: row.id,
    author: {
      id: row.author.id,
      displayName: row.author.profile?.displayName ?? 'Member',
      avatarUrl: row.author.profile?.avatarUrl ?? undefined,
      headline: row.author.profile?.headline ?? undefined,
      role: row.author.role,
    },
    type: TO_CLIENT_TYPE[row.postType] ?? 'update',
    content: row.content,
    images: row.mediaUrls.length ? row.mediaUrls : undefined,
    link: link?.url ? { url: link.url, title: link.title ?? link.url, thumbnail: link.image } : undefined,
    likes: row.likeCount,
    comments: row.commentCount,
    shares: row.shareCount,
    isLiked: row.likes.length > 0,
    isBookmarked: row.bookmarks.length > 0,
    createdAt: row.createdAt.toISOString(),
    tags: hashtags(row.content),
    personalizationScore: ranked ? Math.round(ranked.score * 100) / 100 : undefined,
    relevanceReasons: ranked?.reasons,
  };
}

@Injectable()
export class FeedService {
  constructor(private readonly prisma: PrismaService) {}

  private include(viewerId: string) {
    return {
      author: { select: { id: true, role: true, profile: { select: { displayName: true, avatarUrl: true, headline: true } } } },
      likes: { where: { userId: viewerId }, select: { id: true } },
      bookmarks: { where: { userId: viewerId }, select: { id: true } },
    } as const;
  }

  private async networkIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.connectionRequest.findMany({
      where: { status: 'accepted', OR: [{ requesterId: userId }, { receiverId: userId }] },
      select: { requesterId: true, receiverId: true },
    });
    return rows.map((r) => (r.requesterId === userId ? r.receiverId : r.requesterId));
  }

  /** What one reader may see: public posts, their network's connection posts, their own. */
  private visibleWhere(viewerId: string, network: string[]): Prisma.FeedPostWhereInput {
    return {
      isHidden: false,
      OR: [{ visibility: 'public' }, { visibility: 'connections_only', authorId: { in: network } }, { authorId: viewerId }],
    };
  }

  async getPreferences(userId: string): Promise<FeedPreferences> {
    const row = await this.prisma.feedPreference.findUnique({ where: { userId } });
    return readPreferences(row?.prefs);
  }

  async updatePreferences(userId: string, body: unknown): Promise<FeedPreferences> {
    const current = await this.getPreferences(userId);
    const next = readPreferences(body, current);
    await this.prisma.feedPreference.upsert({
      where: { userId },
      create: { userId, prefs: next as unknown as Prisma.InputJsonValue },
      update: { prefs: next as unknown as Prisma.InputJsonValue },
    });
    return next;
  }

  async personalized(viewerId: string, query: { limit?: number; offset?: number; contentTypes?: string[]; topics?: string[]; refresh?: boolean }, now = Date.now()) {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), FEED_LIMITS.page);
    const offset = Math.max(query.offset ?? 0, 0);
    const [prefs, network, hidden] = await Promise.all([
      this.getPreferences(viewerId),
      this.networkIds(viewerId),
      this.prisma.feedHiddenPost.findMany({ where: { userId: viewerId }, select: { postId: true } }),
    ]);
    const types = (query.contentTypes?.length ? query.contentTypes : prefs.contentTypes).filter((t): t is ClientPostType => (CLIENT_POST_TYPES as readonly string[]).includes(t));
    const postTypes = [...new Set(types.map((t) => FROM_CLIENT_TYPE[t]))];
    // Every stored type that reads as one of the requested client types.
    const storedTypes = (Object.keys(TO_CLIENT_TYPE) as FeedPostType[]).filter((t) => types.includes(TO_CLIENT_TYPE[t]) || postTypes.includes(t));
    const rows = await this.prisma.feedPost.findMany({
      where: {
        AND: [this.visibleWhere(viewerId, network), { postType: { in: storedTypes } }, { id: { notIn: hidden.map((h) => h.postId) } }],
      },
      include: this.include(viewerId),
      orderBy: { createdAt: 'desc' },
      take: FEED_LIMITS.window,
    });
    const topicFilter = (query.topics ?? []).map((t) => t.toLowerCase().replace(/^#/, ''));
    const candidates = topicFilter.length ? rows.filter((r) => hashtags(r.content).some((t) => topicFilter.includes(t))) : rows;
    const networkSet = new Set(network);
    const ranked = rankPosts(
      candidates.map((r) => ({
        id: r.id,
        authorId: r.authorId,
        authorRole: r.author.role,
        createdAt: r.createdAt,
        likes: r.likeCount,
        comments: r.commentCount,
        shares: r.shareCount,
        tags: hashtags(r.content),
        inNetwork: networkSet.has(r.authorId),
        isPinned: r.isPinned,
      })),
      prefs,
      now,
      query.refresh ? 'trending' : 'personal',
    );
    const byId = new Map(candidates.map((r) => [r.id, r]));
    const page = ranked.slice(offset, offset + limit);
    return {
      posts: page.map((r) => toClientPost(byId.get(r.id)!, r)),
      hasMore: offset + limit < ranked.length,
    };
  }

  async trending(limit = 10, now = Date.now()) {
    const take = Math.min(Math.max(limit, 1), 30);
    const day = 86_400_000;
    const since = new Date(now - 2 * FEED_LIMITS.trendingDays * day);
    const rows = await this.prisma.feedPost.findMany({
      where: { isHidden: false, visibility: 'public', createdAt: { gte: since } },
      select: { content: true, createdAt: true, likeCount: true, commentCount: true, shareCount: true },
      take: 2000,
    });
    const cut = now - FEED_LIMITS.trendingDays * day;
    const stats = new Map<string, { posts: number; engagement: number; previous: number }>();
    for (const r of rows) {
      for (const tag of hashtags(r.content)) {
        const s = stats.get(tag) ?? { posts: 0, engagement: 0, previous: 0 };
        if (r.createdAt.getTime() >= cut) {
          s.posts += 1;
          s.engagement += r.likeCount + r.commentCount + r.shareCount;
        } else {
          s.previous += 1;
        }
        stats.set(tag, s);
      }
    }
    const topics = [...stats.entries()]
      .filter(([, s]) => s.posts > 0)
      .map(([tag, s]) => ({ tag, posts: s.posts, engagement: s.engagement, growth: Math.round(((s.posts - s.previous) / Math.max(s.previous, 1)) * 100) }))
      .sort((a, b) => b.posts + b.engagement / 10 - (a.posts + a.engagement / 10))
      .slice(0, take);
    return { topics };
  }

  async createPost(authorId: string, body: unknown) {
    const b = (body ?? {}) as Record<string, unknown>;
    const content = typeof b.content === 'string' ? b.content.trim() : '';
    if (!content) throw new BadRequestException('A post needs some text');
    if (content.length > FEED_LIMITS.content) throw new BadRequestException(`A post is at most ${FEED_LIMITS.content} characters`);
    const type = (CLIENT_POST_TYPES as readonly unknown[]).includes(b.type) ? (b.type as ClientPostType) : 'update';
    const row = await this.prisma.feedPost.create({
      data: { authorId, content, postType: FROM_CLIENT_TYPE[type], visibility: 'public' },
      include: this.include(authorId),
    });
    return { post: { ...toClientPost(row), type }, stored: true };
  }

  async interact(userId: string, body: unknown) {
    const b = (body ?? {}) as Record<string, unknown>;
    const postId = typeof b.postId === 'string' ? b.postId : '';
    const interaction = (INTERACTIONS as readonly unknown[]).includes(b.interaction) ? (b.interaction as Interaction) : null;
    if (!postId || !interaction) throw new BadRequestException('postId and a known interaction are required');
    const network = await this.networkIds(userId);
    const post = await this.prisma.feedPost.findFirst({ where: { AND: [{ id: postId }, this.visibleWhere(userId, network)] }, select: { id: true } });
    if (!post) throw new NotFoundException('Post not found');

    if (interaction === 'like') {
      const existing = await this.prisma.feedLike.findUnique({ where: { postId_userId: { postId, userId } } });
      if (existing) {
        await this.prisma.$transaction([
          this.prisma.feedLike.delete({ where: { id: existing.id } }),
          this.prisma.feedPost.update({ where: { id: postId }, data: { likeCount: { decrement: 1 } } }),
        ]);
        return { ok: true, liked: false };
      }
      await this.prisma.$transaction([
        this.prisma.feedLike.create({ data: { postId, userId } }),
        this.prisma.feedPost.update({ where: { id: postId }, data: { likeCount: { increment: 1 } } }),
      ]);
      return { ok: true, liked: true };
    }
    if (interaction === 'bookmark') {
      const existing = await this.prisma.feedBookmark.findUnique({ where: { postId_userId: { postId, userId } } });
      if (existing) {
        await this.prisma.feedBookmark.delete({ where: { id: existing.id } });
        return { ok: true, bookmarked: false };
      }
      await this.prisma.feedBookmark.create({ data: { postId, userId } });
      return { ok: true, bookmarked: true };
    }
    if (interaction === 'share') {
      await this.prisma.feedPost.update({ where: { id: postId }, data: { shareCount: { increment: 1 } } });
      return { ok: true };
    }
    if (interaction === 'view') {
      await this.prisma.feedPost.update({ where: { id: postId }, data: { viewCount: { increment: 1 } } });
      return { ok: true };
    }
    if (interaction === 'hide') {
      await this.prisma.feedHiddenPost.upsert({ where: { userId_postId: { userId, postId } }, create: { userId, postId }, update: {} });
      return { ok: true, hidden: true };
    }
    // 'comment' is counted where comments are written; recording it here changes nothing.
    return { ok: true };
  }
}
