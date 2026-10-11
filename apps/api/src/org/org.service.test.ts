import { describe, expect, it, vi } from 'vitest';
import { OrgService } from './org.service';

describe('OrgService.getUserMemberships', () => {
  it('returns only active memberships in the stable web contract', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'membership-1',
        organizationId: 'org-1',
        role: 'admin',
        organization: {
          id: 'org-1',
          name: 'Athens Founders',
          slug: 'athens-founders',
          logoUrl: 'https://cdn.example.test/org.png',
        },
      },
    ]);
    const service = new OrgService({ organizationMembership: { findMany } } as never);

    await expect(service.getUserMemberships('user-1')).resolves.toEqual({
      memberships: [
        {
          id: 'membership-1',
          organizationId: 'org-1',
          role: 'admin',
          organization: {
            id: 'org-1',
            name: 'Athens Founders',
            slug: 'athens-founders',
            avatarUrl: 'https://cdn.example.test/org.png',
          },
        },
      ],
    });
    expect(findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', isActive: true },
      select: {
        id: true,
        organizationId: true,
        role: true,
        organization: {
          select: { id: true, name: true, slug: true, logoUrl: true },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
  });
});
