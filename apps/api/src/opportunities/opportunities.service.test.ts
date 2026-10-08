import { describe, expect, it, vi } from 'vitest';
import { OpportunitiesService } from './opportunities.service';

function setup(followers: string[], failFor?: string) {
  const prisma = {
    opportunity: {
      create: vi.fn(async ({ data }: any) => ({ id: 'opp-1', ...data, createdBy: { profile: { displayName: 'Aegean Venture Lab', avatarUrl: null } } })),
    },
    userFollow: { findMany: vi.fn(async () => followers.map((followerId) => ({ followerId }))) },
  };
  const notifications = {
    createNotification: vi.fn(async ({ userId }: any) => {
      if (userId === failFor) throw new Error('down');
      return { id: `n-${userId}` };
    }),
  };
  return { service: new OpportunitiesService(prisma as never, notifications as never), prisma, notifications };
}

describe('a new opportunity reaches the poster’s followers', () => {
  it('tells each follower once, with the listing as the link', async () => {
    const { service, notifications, prisma } = setup(['f1', 'f2']);
    const created = await service.create('org-1', { title: 'Mentors wanted', type: 'mentorship' });
    expect(created.id).toBe('opp-1');
    expect(prisma.userFollow.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { followingId: 'org-1' }, take: 500 }));
    expect(notifications.createNotification).toHaveBeenCalledTimes(2);
    expect(notifications.createNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'f1',
      title: 'Aegean Venture Lab: new opportunity — Mentors wanted',
      link: '/opportunities#opportunity-opp-1',
    }));
  });

  it('never fails the post because a notification failed', async () => {
    const { service } = setup(['f1', 'f2'], 'f1');
    await expect(service.create('org-1', { title: 'Mentors wanted' })).resolves.toMatchObject({ id: 'opp-1' });
  });

  it('works without the notifications service (unit tests, scripts)', async () => {
    const prisma = { opportunity: { create: vi.fn(async () => ({ id: 'opp-2', createdBy: null })) }, userFollow: { findMany: vi.fn() } };
    const service = new OpportunitiesService(prisma as never);
    await expect(service.create('u1', { title: 'x' })).resolves.toMatchObject({ id: 'opp-2' });
    expect(prisma.userFollow.findMany).not.toHaveBeenCalled();
  });
});
