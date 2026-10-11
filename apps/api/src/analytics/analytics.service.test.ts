import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsService } from './analytics.service';

const NOW = new Date('2026-06-15T12:00:00.000Z');
const START = new Date('2026-06-08T12:00:00.000Z');
const PREVIOUS = new Date('2026-06-01T12:00:00.000Z');

type Row = Record<string, any>;
function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return value.some((condition: Row) => matches(row, condition));
    if (value && typeof value === 'object') {
      if ('gte' in value || 'lt' in value) {
        return row[key] != null && (!value.gte || row[key] >= value.gte) && (!value.lt || row[key] < value.lt);
      }
      return matches(row[key] ?? {}, value);
    }
    return row[key] === value;
  });
}

function setup() {
  const views: Row[] = [
    { profile: { userId: 'owner' }, viewerId: 'visitor', createdAt: START },
    { profile: { userId: 'owner' }, viewerId: 'visitor', createdAt: new Date('2026-06-08T13:00:00Z') },
    { profile: { userId: 'owner' }, viewerId: null, createdAt: new Date('2026-06-09T01:00:00Z') },
    { profile: { userId: 'owner' }, viewerId: 'old', createdAt: PREVIOUS },
    { profile: { userId: 'other-tenant-user' }, viewerId: 'owner', createdAt: START },
    { profile: { userId: 'owner' }, viewerId: 'future', createdAt: NOW },
  ];
  const connections: Row[] = [
    { requesterId: 'owner', receiverId: 'a', status: 'accepted', respondedAt: START, createdAt: PREVIOUS },
    { requesterId: 'b', receiverId: 'owner', status: 'accepted', respondedAt: START, createdAt: PREVIOUS },
    { requesterId: 'owner', receiverId: 'c', status: 'accepted', respondedAt: PREVIOUS, createdAt: PREVIOUS },
    { requesterId: 'owner', receiverId: 'd', status: 'pending', respondedAt: START, createdAt: START },
    { requesterId: 'owner', receiverId: 'e', status: 'declined', respondedAt: START, createdAt: START },
    { requesterId: 'owner', receiverId: 'f', status: 'accepted', respondedAt: null, createdAt: START },
    { requesterId: 'other-tenant-user', receiverId: 'g', status: 'accepted', respondedAt: START, createdAt: START },
    { requesterId: 'owner', receiverId: 'h', status: 'accepted', respondedAt: NOW, createdAt: START },
  ];
  const messages: Row[] = [
    { senderId: 'owner', createdAt: START },
    { senderId: 'owner', createdAt: PREVIOUS },
    { senderId: 'other-tenant-user', createdAt: START },
    { senderId: 'owner', createdAt: NOW },
  ];
  const delegate = (rows: Row[]) => ({
    count: vi.fn(async ({ where }: { where: Row }) => rows.filter((row) => matches(row, where)).length),
    findMany: vi.fn(async ({ where }: { where: Row }) => rows.filter((row) => matches(row, where))),
  });
  const prisma = {
    profileView: delegate(views),
    connectionRequest: delegate(connections),
    message: delegate(messages),
    profile: { findUnique: vi.fn().mockResolvedValue({ createdAt: PREVIOUS }) },
  };
  return { service: new AnalyticsService(prisma as never), prisma };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('personal analytics truthfulness', () => {
  it('counts only the owner, both accepted-connection directions, and disjoint bounded windows', async () => {
    const { service, prisma } = setup();
    const result = await service.getUserMetrics('owner', '7d');
    expect(result).toMatchObject({ profileViews: 3, profileViewsChange: 200, newConnections: 2, newConnectionsChange: 100, messagesSent: 1, messagesSentChange: 0 });
    expect(prisma.profileView.count).toHaveBeenCalledWith({ where: { profile: { userId: 'owner' }, createdAt: { gte: START, lt: NOW } } });
    expect(prisma.message.count).toHaveBeenCalledWith({ where: { senderId: 'owner', createdAt: { gte: PREVIOUS, lt: START } } });
    expect(prisma.connectionRequest.count).toHaveBeenCalledWith({ where: { status: 'accepted', OR: [{ requesterId: 'owner' }, { receiverId: 'owner' }], respondedAt: { gte: START, lt: NOW } } });
  });

  it('keeps measured zeros, unavailable metrics, and undefined percentage growth distinct', async () => {
    const { service } = setup();
    const zero = await service.getUserMetrics('no-records', '7d');
    expect(zero).toMatchObject({ profileViews: 0, newConnections: 0, messagesSent: 0, profileViewsChange: 0, engagementRate: null, engagementRateChange: null, searchAppearances: null, searchAppearancesChange: null, activityScore: 0, activityScoreChange: 0 });
    const { prisma, service: firstActivity } = setup();
    prisma.message.count.mockResolvedValueOnce(2).mockResolvedValueOnce(0);
    expect((await firstActivity.getUserMetrics('owner', '7d')).messagesSentChange).toBeNull();
  });

  it('preserves the existing bounded activity index using recorded counts instead of placeholders', async () => {
    const { service } = setup();
    const metrics = await service.getUserMetrics('owner', '7d');
    expect(metrics.activityScore).toBe(2);
    expect(metrics.activityScoreChange).toBe(100);
  });

  it('buckets actual UTC views, deduplicates known visitors, and does not guess anonymous uniques', async () => {
    const { service, prisma } = setup();
    const series = await service.getProfileViews('owner', '7d');
    expect(series.find((day) => day.date === '2026-06-08')).toEqual({ date: '2026-06-08', views: 2, uniqueVisitors: 1 });
    expect(series.find((day) => day.date === '2026-06-09')).toEqual({ date: '2026-06-09', views: 1, uniqueVisitors: null });
    expect(series.find((day) => day.date === '2026-06-10')).toEqual({ date: '2026-06-10', views: 0, uniqueVisitors: 0 });
    expect(series.reduce((sum, day) => sum + day.views, 0)).toBe(3);
    expect(prisma.profileView.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { profile: { userId: 'owner' }, createdAt: { gte: START, lt: NOW } } }));
  });

  it('returns measured engagement without inventing platform-wide reactions or content rankings', async () => {
    const { service } = setup();
    expect(await service.getEngagementData('owner', '7d')).toEqual({ connections: 2, messages: 1, likes: null, comments: null, shares: null });
    expect(await service.getTopContent('owner', 5)).toBeNull();
    expect(await service.getWeeklySummary('owner')).toEqual({ mostActiveDay: null, peakHour: null, avgResponseTime: null, totalInteractions: null });
  });

  it('does not claim unverified achievement eligibility or invent unlock dates', async () => {
    const { service, prisma } = setup();
    prisma.connectionRequest.count.mockResolvedValue(50);
    prisma.profileView.count.mockResolvedValue(1000);
    const achievements = await service.getUserAchievements('owner');
    expect(achievements.find((a) => a.id === 'early-adopter')?.unlocked).toBeNull();
    expect(achievements.find((a) => a.id === 'active-contributor')?.unlocked).toBeNull();
    expect(achievements.find((a) => a.id === 'networker')?.unlocked).toBe(true);
    expect(achievements.find((a) => a.id === 'influencer')?.unlocked).toBe(true);
    expect(achievements.every((a) => a.unlockedAt == null)).toBe(true);
    expect(prisma.connectionRequest.count).toHaveBeenCalledWith({ where: { status: 'accepted', OR: [{ requesterId: 'owner' }, { receiverId: 'owner' }] } });
  });

  it('derives growth from the same scoped views and accepted timestamps', async () => {
    const { service } = setup();
    const trends = await service.getGrowthTrends('owner', '7d');
    expect(trends.reduce((sum, day) => sum + day.profileViews, 0)).toBe(3);
    expect(trends.reduce((sum, day) => sum + day.connections, 0)).toBe(2);
    expect(trends.every((day) => day.engagement === null)).toBe(true);
  });

  it.each(['0d', '366d', '999999999999999y', '-1d', '7d-junk', '', 'NaN'])('rejects invalid or unbounded period %s before querying', async (period) => {
    const { service, prisma } = setup();
    await expect(service.getOverview('owner', period)).rejects.toThrow();
    expect(prisma.message.count).not.toHaveBeenCalled();
  });

  it.each([0, -1, 51, NaN, Infinity, 1.5])('rejects invalid content limit %s before querying', async (limit) => {
    const { service, prisma } = setup();
    await expect(service.getOverview('owner', '7d', limit)).rejects.toThrow();
    expect(prisma.message.count).not.toHaveBeenCalled();
    await expect(service.getTopContent('owner', limit)).rejects.toThrow();
  });

  it('contains no production random data generators', () => {
    const source = readFileSync('src/analytics/analytics.service.ts', 'utf8');
    expect(source).not.toMatch(/Math\.random\s*\(/);
  });
});
