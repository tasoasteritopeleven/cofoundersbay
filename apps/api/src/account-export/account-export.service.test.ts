import { describe, expect, it, vi } from 'vitest';
import { AccountExportService, normaliseSections } from './account-export.service';

/** Like Prisma, return only the columns a query selects. */
function selecting(row: Record<string, unknown>) {
  return vi.fn(async ({ select }: { select?: Record<string, unknown> }) =>
    select ? Object.fromEntries(Object.keys(select).filter((k) => k in row).map((k) => [k, row[k]])) : row,
  );
}

function prismaStub(overrides: Record<string, Record<string, unknown>> = {}) {
  const empty = () => vi.fn().mockResolvedValue([]);
  const base: Record<string, Record<string, unknown>> = {
    user: {
      findUnique: selecting({ id: 'u1', email: 'alex@example.test', role: 'founder', passwordHash: 'hash', twoFactorSecret: 'secret', twoFactorEnabled: false, emailVerified: true, googleId: 'g-123', linkedinId: null }),
    },
    profile: {
      findUnique: selecting({ displayName: 'Alex Demo', headline: 'Founder', visibilityRules: { email: 'connections' }, skills: [{ skill: { name: 'Product' } }, { skill: null }] }),
    },
    message: { findMany: empty() },
    connectionRequest: { findMany: empty() },
    eventRsvp: { findMany: empty() },
    groupMember: { findMany: empty() },
    mentorBooking: { findMany: empty() },
    endorsement: { findMany: empty() },
    savedProfile: { findMany: empty() },
    notification: { findMany: empty() },
    milestone: { findMany: empty() },
    commitmentCard: { findMany: empty() },
    commitmentThread: { findMany: empty() },
    commitmentMessage: { findMany: empty() },
    commitmentTerms: { findMany: empty() },
  };
  for (const [model, methods] of Object.entries(overrides)) base[model] = { ...base[model], ...methods };
  return base;
}

describe('normaliseSections', () => {
  it('keeps known names in a fixed order and treats none as all', () => {
    expect(normaliseSections(['milestones', 'profile', 'bogus'])).toEqual(['profile', 'milestones']);
    expect(normaliseSections(undefined)).toHaveLength(6);
    expect(normaliseSections(['bogus'])).toHaveLength(6);
  });
});

describe('AccountExportService.build', () => {
  it('never selects credentials from the user row', async () => {
    const prisma = prismaStub();
    await new AccountExportService(prisma as never).build('u1', ['profile', 'settings']);
    for (const call of (prisma.user.findUnique as ReturnType<typeof vi.fn>).mock.calls) {
      const select = call[0].select as Record<string, unknown>;
      for (const secret of ['passwordHash', 'twoFactorSecret', 'twoFactorBackupCodes', 'passwordResetToken', 'emailVerificationToken', 'refreshTokens']) {
        expect(select[secret]).toBeUndefined();
      }
    }
  });

  it('flattens skills and says whether a provider is linked, not its id', async () => {
    const out = await new AccountExportService(prismaStub() as never).build('u1', ['profile', 'settings']);
    expect(out.sections).toEqual(['profile', 'settings']);
    expect((out.data.profile as { skills: string[] }).skills).toEqual(['Product']);
    expect((out.data.settings as { linkedAccounts: unknown }).linkedAccounts).toEqual({ google: true, linkedin: false });
    const json = JSON.stringify(out);
    for (const leaked of ['g-123', 'hash', 'secret']) expect(json).not.toContain(`"${leaked}"`);
    expect(out.data.messages).toBeUndefined();
  });

  it('exports only the messages the reader sent', async () => {
    const prisma = prismaStub();
    await new AccountExportService(prisma as never).build('u1', ['messages']);
    expect((prisma.message.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where).toEqual({ senderId: 'u1', deletedAt: null });
  });

  it('labels each connection from the reader side', async () => {
    const prisma = prismaStub({
      connectionRequest: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'c1', requesterId: 'u1', receiverId: 'u2', status: 'accepted', message: null, createdAt: new Date(0), respondedAt: null, requester: { profile: { displayName: 'Alex' } }, receiver: { profile: { displayName: 'Elena' } } },
          { id: 'c2', requesterId: 'u3', receiverId: 'u1', status: 'pending', message: 'hi', createdAt: new Date(0), respondedAt: null, requester: { profile: { displayName: 'Marcus' } }, receiver: { profile: { displayName: 'Alex' } } },
        ]),
      },
    });
    const out = await new AccountExportService(prisma as never).build('u1', ['connections']);
    const items = (out.data.connections as { items: Array<{ direction: string; otherDisplayName: string }> }).items;
    expect(items.map((c) => [c.direction, c.otherDisplayName])).toEqual([['sent', 'Elena'], ['received', 'Marcus']]);
  });

  it('reports a table it cannot read instead of failing the export', async () => {
    const prisma = prismaStub({ savedProfile: { findMany: vi.fn().mockRejectedValue(new Error('The table `public.SavedProfile` does not exist')) } });
    const out = await new AccountExportService(prisma as never).build('u1', ['activity']);
    expect(out.unavailable).toEqual([{ section: 'activity', part: 'savedProfiles', reason: 'The table `public.SavedProfile` does not exist' }]);
    expect((out.data.activity as { savedProfiles: unknown }).savedProfiles).toBeNull();
    expect((out.data.activity as { notifications: unknown }).notifications).toEqual({ items: [], truncated: false });
  });

  it('exports the commitments the reader took part in, never a share token or another person’s words', async () => {
    const prisma = prismaStub();
    await new AccountExportService(prisma as never).build('u1', ['activity']);
    const cardQuery = (prisma.commitmentCard.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(cardQuery.where).toEqual({ ownerId: 'u1' });
    expect(cardQuery.select.shareToken).toBeUndefined();
    expect((prisma.commitmentThread.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where).toEqual({ OR: [{ candidateId: 'u1' }, { card: { ownerId: 'u1' } }] });
    expect((prisma.commitmentMessage.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where).toEqual({ authorId: 'u1' });
    expect((prisma.commitmentTerms.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where).toEqual({ proposedById: 'u1' });
  });
});
