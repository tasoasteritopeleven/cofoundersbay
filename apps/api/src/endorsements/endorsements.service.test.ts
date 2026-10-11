import { describe, expect, it, vi } from 'vitest';
import { EndorsementsService } from './endorsements.service';

const person = (id: string, displayName: string, headline: string | null = null) => ({
  id,
  profile: { displayName, avatarUrl: null, headline },
});

describe('EndorsementsService.getGivenEndorsements', () => {
  it("lists what the reader wrote, with each recipient, pending ones included", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'end-1',
        fromUserId: 'user-me',
        fromUser: person('user-me', 'Alex Demo'),
        toUserId: 'user-elena',
        toUser: person('user-elena', 'Elena Papadopoulos', 'Founder & CEO at Harbor'),
        skill: 'Growth',
        content: 'Ran the sharpest customer-discovery sprint I have seen.',
        relationship: 'Peer founder',
        isPublic: true,
        isApproved: false,
        createdAt: new Date('2026-09-01T10:00:00.000Z'),
      },
    ]);
    const service = new EndorsementsService({ endorsement: { findMany } } as never, {} as never);

    await expect(service.getGivenEndorsements('user-me')).resolves.toEqual([
      {
        id: 'end-1',
        fromUserId: 'user-me',
        fromUser: { id: 'user-me', displayName: 'Alex Demo', avatarUrl: null, headline: null },
        toUserId: 'user-elena',
        toUser: { id: 'user-elena', displayName: 'Elena Papadopoulos', avatarUrl: null, headline: 'Founder & CEO at Harbor' },
        skill: 'Growth',
        content: 'Ran the sharpest customer-discovery sprint I have seen.',
        relationship: 'Peer founder',
        isPublic: true,
        isApproved: false,
        basis: [],
        createdAt: '2026-09-01T10:00:00.000Z',
      },
    ]);
    // Scoped to the giver, with no approval filter: the giver sees their own
    // unapproved endorsements, which nobody else can.
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { fromUserId: 'user-me' },
      orderBy: { createdAt: 'desc' },
    }));
  });

  it('names a recipient without a profile as Unknown rather than failing', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'end-2',
        fromUserId: 'user-me',
        fromUser: person('user-me', 'Alex Demo'),
        toUserId: 'user-gone',
        toUser: { id: 'user-gone', profile: null },
        skill: null,
        content: 'A steady hand in a hard quarter.',
        relationship: null,
        isPublic: true,
        isApproved: true,
        createdAt: new Date('2026-08-01T10:00:00.000Z'),
      },
    ]);
    const service = new EndorsementsService({ endorsement: { findMany } } as never, {} as never);
    const [row] = await service.getGivenEndorsements('user-me');
    expect(row.toUser).toEqual({ id: 'user-gone', displayName: 'Unknown', avatarUrl: null, headline: null });
  });
});
