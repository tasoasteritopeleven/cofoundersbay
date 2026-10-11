import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_FEED_PREFERENCES, FeedService, hashtags, rankPosts, readPreferences, type RankInput } from './feed.service';

const NOW = Date.parse('2026-10-07T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000);
const post = (over: Partial<RankInput> & { id: string }): RankInput => ({
  authorId: `a-${over.id}`,
  authorRole: 'founder',
  createdAt: hoursAgo(1),
  likes: 0,
  comments: 0,
  shares: 0,
  tags: [],
  inNetwork: false,
  isPinned: false,
  ...over,
});

describe('hashtags', () => {
  it('reads Greek and Latin tags, lower-cased, once each, not inside words or URLs', () => {
    expect(hashtags('Raised our pre-seed! #Fundraising #χρηματοδότηση #fundraising')).toEqual(['fundraising', 'χρηματοδότηση']);
    expect(hashtags('see https://x.co/#anchor and C#')).toEqual([]);
  });
});

describe('preferences', () => {
  it('keeps only valid values and clamps numbers', () => {
    expect(
      readPreferences({ topics: ['#AI', 'ai', ''], roles: ['mentor', 'emperor'], contentTypes: ['question', 'spam'], interactionWeights: { likes: 9 }, timeDecayHours: 1, diversityBoost: 2 }),
    ).toEqual({
      topics: ['ai'],
      roles: ['mentor'],
      contentTypes: ['question'],
      interactionWeights: { likes: 5, comments: 1, shares: 1, bookmarks: 1 },
      timeDecayHours: 6,
      diversityBoost: 1,
    });
  });

  it('falls back to the defaults for nothing, and to the current value for a partial update', () => {
    expect(readPreferences(undefined)).toEqual(DEFAULT_FEED_PREFERENCES);
    const current = readPreferences({ topics: ['climate'] });
    expect(readPreferences({ timeDecayHours: 24 }, current)).toMatchObject({ topics: ['climate'], timeDecayHours: 24 });
  });
});

describe('ranking', () => {
  it('decays with age, lifts the reader’s topics and network above a few hours’ recency, and says why', () => {
    const prefs = readPreferences({ topics: ['fundraising'] });
    const ranked = rankPosts(
      [post({ id: 'old', createdAt: hoursAgo(200) }), post({ id: 'fresh' }), post({ id: 'topic', createdAt: hoursAgo(5), tags: ['fundraising'] }), post({ id: 'friend', createdAt: hoursAgo(5), inNetwork: true })],
      prefs,
      NOW,
    );
    expect(ranked.map((r) => r.id)).toEqual(['topic', 'friend', 'fresh', 'old']);
    expect(ranked.find((r) => r.id === 'topic')?.reasons).toContain('Matches #fundraising');
    expect(ranked.find((r) => r.id === 'friend')?.reasons).toContain('From your network');
    expect(ranked.find((r) => r.id === 'old')?.reasons).toEqual(['Recent']);
  });

  it('damps engagement so one viral post cannot bury a fresh one, and damps repeated authors', () => {
    const viral = rankPosts([post({ id: 'viral', createdAt: hoursAgo(96), likes: 10_000 }), post({ id: 'new' })], DEFAULT_FEED_PREFERENCES, NOW);
    expect(viral[0].id).toBe('new');
    // Engagement adds at most a quarter, however large it gets.
    const [huge] = rankPosts([post({ id: 'h', likes: 1_000_000 })], DEFAULT_FEED_PREFERENCES, NOW);
    const [none] = rankPosts([post({ id: 'n' })], DEFAULT_FEED_PREFERENCES, NOW);
    expect(huge.score - none.score).toBeLessThanOrEqual(0.25 + 1e-9);
    const same = rankPosts([post({ id: 'a1', authorId: 'x' }), post({ id: 'a2', authorId: 'x' }), post({ id: 'b', authorId: 'y', createdAt: hoursAgo(3) })], readPreferences({ diversityBoost: 0.8 }), NOW);
    expect(same.map((r) => r.id)).toEqual(['a1', 'b', 'a2']);
  });

  it('ranks the trending tab by recent engagement', () => {
    const ranked = rankPosts([post({ id: 'quiet' }), post({ id: 'loud', createdAt: hoursAgo(10), likes: 40, comments: 10 })], DEFAULT_FEED_PREFERENCES, NOW, 'trending');
    expect(ranked[0].id).toBe('loud');
    expect(ranked[0].reasons).toContain('Popular this week');
  });
});

function row(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    authorId: 'u-b',
    author: { id: 'u-b', role: 'mentor', profile: { displayName: 'Sofia', avatarUrl: null, headline: 'Mentor' } },
    postType: 'question',
    visibility: 'public',
    content: 'How do you price a pilot? #pricing',
    mediaUrls: [],
    linkPreview: null,
    likeCount: 2,
    commentCount: 1,
    shareCount: 0,
    isPinned: false,
    createdAt: hoursAgo(2),
    likes: [],
    bookmarks: [{ id: 'bm' }],
    ...over,
  };
}

function prismaMock() {
  return {
    connectionRequest: { findMany: vi.fn(async () => [{ requesterId: 'me', receiverId: 'u-b' }]) },
    feedPreference: { findUnique: vi.fn(async () => null), upsert: vi.fn(async () => ({})) },
    feedHiddenPost: { findMany: vi.fn(async () => [{ postId: 'p-hidden' }]), upsert: vi.fn(async () => ({})) },
    feedPost: {
      findMany: vi.fn(async (_args?: { where?: unknown }) => [row('p1')] as unknown[]),
      findFirst: vi.fn(async () => ({ id: 'p1' })),
      create: vi.fn(async ({ data }: { data: { content: string; postType: string } }) => row('p-new', { content: data.content, postType: data.postType, author: { id: 'me', role: 'founder', profile: { displayName: 'Alex', avatarUrl: null, headline: null } }, bookmarks: [], likeCount: 0, commentCount: 0 })),
      update: vi.fn(async () => ({})),
    },
    feedLike: { findUnique: vi.fn(async () => null), create: vi.fn(async () => ({})), delete: vi.fn(async () => ({})) },
    feedBookmark: { findUnique: vi.fn(async () => ({ id: 'bm' })), create: vi.fn(async () => ({})), delete: vi.fn(async () => ({})) },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  };
}

describe('FeedService', () => {
  it('serves the client’s FeedPost shape, excluding hidden posts and limited to what the reader may see', async () => {
    const prisma = prismaMock();
    const feed = new FeedService(prisma as never);
    const result = await feed.personalized('me', { limit: 10 }, NOW);
    expect(result.hasMore).toBe(false);
    expect(result.posts[0]).toMatchObject({
      id: 'p1',
      type: 'question',
      author: { id: 'u-b', displayName: 'Sofia', role: 'mentor' },
      likes: 2,
      isLiked: false,
      isBookmarked: true,
      tags: ['pricing'],
      relevanceReasons: expect.arrayContaining(['From your network']),
    });
    const where = prisma.feedPost.findMany.mock.calls[0]?.[0]?.where;
    expect(JSON.stringify(where)).toContain('"notIn":["p-hidden"]');
    expect(JSON.stringify(where)).toContain('"connections_only"');
    expect(JSON.stringify(where)).toContain('"authorId":{"in":["u-b"]}');
  });

  it('toggles a like with its count, toggles a bookmark, and hides for the reader only', async () => {
    const prisma = prismaMock();
    const feed = new FeedService(prisma as never);
    expect(await feed.interact('me', { postId: 'p1', interaction: 'like' })).toEqual({ ok: true, liked: true });
    expect(prisma.feedLike.create).toHaveBeenCalledWith({ data: { postId: 'p1', userId: 'me' } });
    expect(await feed.interact('me', { postId: 'p1', interaction: 'bookmark' })).toEqual({ ok: true, bookmarked: false });
    expect(await feed.interact('me', { postId: 'p1', interaction: 'hide' })).toEqual({ ok: true, hidden: true });
    expect(prisma.feedHiddenPost.upsert).toHaveBeenCalled();
  });

  it('refuses unknown interactions and posts the reader cannot see', async () => {
    const prisma = prismaMock();
    const feed = new FeedService(prisma as never);
    await expect(feed.interact('me', { postId: 'p1', interaction: 'boost' })).rejects.toBeInstanceOf(BadRequestException);
    prisma.feedPost.findFirst.mockResolvedValueOnce(null as never);
    await expect(feed.interact('me', { postId: 'p-private', interaction: 'like' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('stores a post and answers with it, refusing empty or oversized text', async () => {
    const prisma = prismaMock();
    const feed = new FeedService(prisma as never);
    const { post: created, stored } = await feed.createPost('me', { content: '  Shipped the pilot #launch ', type: 'milestone' });
    expect(stored).toBe(true);
    expect(created).toMatchObject({ id: 'p-new', type: 'milestone', content: 'Shipped the pilot #launch', author: { id: 'me' } });
    expect(prisma.feedPost.create.mock.calls[0][0].data).toMatchObject({ authorId: 'me', postType: 'milestone_share', visibility: 'public' });
    await expect(feed.createPost('me', { content: '   ' })).rejects.toThrow(/needs some text/);
    await expect(feed.createPost('me', { content: 'x'.repeat(3001) })).rejects.toThrow(/at most 3000/);
  });

  it('counts trending tags over the last week with growth against the week before', async () => {
    const prisma = prismaMock();
    prisma.feedPost.findMany.mockResolvedValueOnce([
      { content: '#ai tools', createdAt: hoursAgo(10), likeCount: 3, commentCount: 1, shareCount: 0 },
      { content: 'more #ai', createdAt: hoursAgo(20), likeCount: 0, commentCount: 0, shareCount: 1 },
      { content: 'old #ai', createdAt: hoursAgo(24 * 10), likeCount: 0, commentCount: 0, shareCount: 0 },
    ] as never);
    const feed = new FeedService(prisma as never);
    expect(await feed.trending(5, NOW)).toEqual({ topics: [{ tag: 'ai', posts: 2, engagement: 5, growth: 100 }] });
  });
});
