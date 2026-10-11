import 'reflect-metadata';
import { INestApplication, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { PublicStatsController } from './public-stats.controller';

/**
 * The landing page's counts over HTTP: no guard, real Prisma count shapes,
 * and the ten-minute cache. The database is mocked; what this proves is the
 * route answers without a session and maps the right model counts.
 */

const prisma = {
  user: { count: vi.fn() },
  connectionRequest: { count: vi.fn() },
  event: { count: vi.fn() },
  organization: { count: vi.fn() },
};

@Module({
  controllers: [PublicStatsController],
  providers: [{ provide: PrismaService, useValue: prisma }],
})
class PublicStatsTestModule {}

describe('GET /public/stats', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    app = await NestFactory.create(PublicStatsTestModule, { logger: false });
    await app.listen(0);
    baseUrl = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    // The controller caches for ten minutes; each test measures fresh.
    (app.get(PublicStatsController) as { cached?: unknown }).cached = null;
    prisma.user.count.mockReset();
    prisma.connectionRequest.count.mockReset();
    prisma.event.count.mockReset();
    prisma.organization.count.mockReset();
    prisma.user.count.mockResolvedValueOnce(1200).mockResolvedValue(96);
    prisma.connectionRequest.count.mockResolvedValue(310);
    prisma.event.count.mockResolvedValue(27);
    prisma.organization.count.mockResolvedValue(14);
  });

  const get = () => fetch(`${baseUrl}/public/stats`).then((r) => r.json().then((body) => ({ status: r.status, body })));

  it('answers without a session, with measured integer counts', async () => {
    const { status, body } = await get();
    expect(status).toBe(200);
    expect(body).toMatchObject({ members: 1200, mentors: 96, connections: 310, events: 27, organizations: 14 });
    expect(Number.isNaN(Date.parse(body.measuredAt))).toBe(false);
  });

  it('counts active members, accepted connections and active organizations', async () => {
    await get();
    expect(prisma.user.count).toHaveBeenNthCalledWith(1, { where: { moderationStatus: 'active' } });
    expect(prisma.user.count).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ moderationStatus: 'active' }),
      }),
    );
    expect(prisma.connectionRequest.count).toHaveBeenCalledWith({ where: { status: 'accepted' } });
    expect(prisma.organization.count).toHaveBeenCalledWith({ where: { isActive: true } });
  });

  it('serves the second read from the cache', async () => {
    const first = await get();
    const second = await get();
    expect(second.body).toEqual(first.body);
    // Two user counts (members + mentors), one of each of the others.
    expect(prisma.user.count).toHaveBeenCalledTimes(2);
    expect(prisma.connectionRequest.count).toHaveBeenCalledTimes(1);
    expect(prisma.event.count).toHaveBeenCalledTimes(1);
    expect(prisma.organization.count).toHaveBeenCalledTimes(1);
  });
});
