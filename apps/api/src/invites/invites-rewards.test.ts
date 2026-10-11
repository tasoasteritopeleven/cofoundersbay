import { describe, expect, it, vi } from 'vitest';
import { isActiveReferral, referralPoints } from '@cofounderbay/shared';
import { InvitesService } from './invites.service';

/**
 * Referral rewards follow confirmed activity, never a sign-up alone (the
 * StreetUpper comparison's advice): an accepted invitation counts once the
 * person verified their email and took one real step.
 */

describe('the shared rule', () => {
  it('needs a verified email and one real step', () => {
    expect(isActiveReferral({ emailVerified: true, activity: ['connection'] })).toBe(true);
    expect(isActiveReferral({ emailVerified: true, activity: [] })).toBe(false);
    expect(isActiveReferral({ emailVerified: false, activity: ['need_card'] })).toBe(false);
    expect(referralPoints(3)).toBe(30);
    expect(referralPoints(-1)).toBe(0);
  });
});

describe('InvitesService rewards', () => {
  function service() {
    const prisma = {
      invite: {
        count: vi.fn(async ({ where }: { where: Record<string, unknown> }) => (where.status === 'accepted' ? 4 : where.status === 'pending' ? 1 : 5)),
        findMany: vi.fn(async () => [
          { acceptedBy: { id: 'a', emailVerified: true } }, // a connection
          { acceptedBy: { id: 'b', emailVerified: true } }, // nothing yet
          { acceptedBy: { id: 'c', emailVerified: false } }, // a need card, but unverified
          { acceptedBy: { id: 'd', emailVerified: true } }, // a completed milestone
        ]),
      },
      connectionRequest: { findMany: vi.fn(async () => [{ requesterId: 'a', receiverId: 'zz' }]) },
      commitmentCard: { findMany: vi.fn(async () => []) },
      milestone: { findMany: vi.fn(async () => [{ ownerId: 'd' }]) },
      // A database without the commitments tables: no activity from there, no error.
      commitmentThread: { findMany: vi.fn(async () => { throw new Error('relation does not exist'); }) },
    };
    return { svc: new InvitesService(prisma as never, {} as never, { get: () => undefined } as never), prisma };
  }

  it('counts only invitees who are verified and active, and pays points for those alone', async () => {
    const { svc, prisma } = service();
    const stats = await svc.getInviteStats('me');
    expect(stats.stats).toMatchObject({ accepted: 4, active: 2 });
    expect(stats.rewards).toBe(20);
    // Unverified invitees are not even looked up for activity.
    expect(prisma.milestone.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: { in: ['a', 'b', 'd'] }, status: 'completed' } }));
  });
});
