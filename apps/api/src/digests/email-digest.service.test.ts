import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  digestPeriodStart,
  EmailDigestService,
  isDigestDue,
  nextDigestDueAt,
} from './email-digest.service';

const digestData = {
  userId: 'user-1',
  type: 'monthly' as const,
  frequency: 'monthly' as const,
  content: {
    connections: {
      type: 'connections' as const,
      count: 1,
      items: [
        {
          id: 'connection-1',
          title: 'New connection',
          createdAt: new Date('2026-02-20T12:00:00Z'),
        },
      ],
    },
    messages: undefined,
    opportunities: undefined,
    events: undefined,
    updates: undefined,
  },
  preferences: {
    connections: true,
    messages: true,
    opportunities: true,
    events: true,
    updates: false,
  },
};

function makePrisma() {
  return {
    activityDigestPreference: {
      findMany: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    user: { findUnique: vi.fn() },
    connectionRequest: { findMany: vi.fn().mockResolvedValue([]) },
    conversation: { findMany: vi.fn().mockResolvedValue([]) },
    opportunity: { findMany: vi.fn().mockResolvedValue([]) },
    event: { findMany: vi.fn().mockResolvedValue([]) },
  };
}

function makeService(prisma = makePrisma()) {
  const emailQueue = { enqueueSendEmail: vi.fn().mockResolvedValue('queued') };
  const config = {
    get: vi.fn((key: string) =>
      key === 'WEB_BASE_URL' ? 'https://cofounderbay.example' : undefined,
    ),
  };
  return {
    service: new EmailDigestService(
      config as never,
      emailQueue as never,
      prisma as never,
    ),
    emailQueue,
    prisma,
  };
}

function eligibleRecipient(frequency = 'monthly') {
  return {
    email: 'current@example.com',
    emailVerified: true,
    moderationStatus: 'active',
    digestPreference: { frequency },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('digest calendar cadence', () => {
  it('preserves month-end cadence in leap and non-leap years', () => {
    expect(
      nextDigestDueAt(
        'monthly',
        new Date('2026-01-31T09:30:00Z'),
      ).toISOString(),
    ).toBe('2026-02-28T09:30:00.000Z');
    expect(
      nextDigestDueAt(
        'monthly',
        new Date('2028-01-31T09:30:00Z'),
      ).toISOString(),
    ).toBe('2028-02-29T09:30:00.000Z');
    expect(
      nextDigestDueAt(
        'monthly',
        new Date('2028-02-29T09:30:00Z'),
      ).toISOString(),
    ).toBe('2028-03-31T09:30:00.000Z');
    expect(
      digestPeriodStart(
        'monthly',
        new Date('2026-03-31T09:30:00Z'),
      ).toISOString(),
    ).toBe('2026-02-28T09:30:00.000Z');
  });

  it('becomes due exactly at the next calendar instant', () => {
    const lastSent = new Date('2026-01-31T09:30:00Z');
    expect(
      isDigestDue('monthly', lastSent, new Date('2026-02-28T09:29:59Z')),
    ).toBe(false);
    expect(
      isDigestDue('monthly', lastSent, new Date('2026-02-28T09:30:00Z')),
    ).toBe(true);
  });
});

describe('digest delivery state', () => {
  it('marks lastSentAt only after queue acceptance and reports queued separately', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-28T10:00:00Z'));
    const { service, prisma, emailQueue } = makeService();
    const order: string[] = [];
    const previous = new Date('2026-01-31T09:00:00Z');
    prisma.activityDigestPreference.findMany.mockResolvedValue([
      { id: 'preference-1', userId: 'user-1', lastSentAt: previous },
    ]);
    prisma.user.findUnique.mockResolvedValue(eligibleRecipient());
    emailQueue.enqueueSendEmail.mockImplementation(async () => {
      order.push('enqueue');
      return 'queued';
    });
    prisma.activityDigestPreference.updateMany.mockImplementation(async () => {
      order.push('mark');
      return { count: 1 };
    });
    vi.spyOn(service, 'generateUserDigest').mockResolvedValue(digestData);

    const summary = await service.generateDigests('monthly');

    expect(order).toEqual(['enqueue', 'mark']);
    expect(summary).toMatchObject({
      queued: 1,
      sent: 0,
      disabled: 0,
      failed: 0,
    });
    expect(prisma.activityDigestPreference.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ lastSentAt: previous }),
      }),
    );
    expect(emailQueue.enqueueSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'current@example.com',
      }),
      {
        idempotencyKey: 'digest:monthly:user-1:2026-01-31T09:00:00.000Z',
      },
    );
  });

  it('releases its reservation after failure so a retry can enqueue', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-15T10:00:00Z'));
    const { service, prisma, emailQueue } = makeService();
    prisma.activityDigestPreference.findMany.mockResolvedValue([
      { id: 'preference-1', userId: 'user-1', lastSentAt: null },
    ]);
    prisma.user.findUnique.mockResolvedValue(eligibleRecipient());
    emailQueue.enqueueSendEmail
      .mockRejectedValueOnce(new Error('Redis unavailable'))
      .mockResolvedValueOnce('queued');
    vi.spyOn(service, 'generateUserDigest').mockResolvedValue(digestData);

    await expect(service.generateDigests('monthly')).resolves.toMatchObject({
      failed: 1,
      queued: 0,
    });
    await expect(service.generateDigests('monthly')).resolves.toMatchObject({
      failed: 0,
      queued: 1,
    });
    expect(emailQueue.enqueueSendEmail).toHaveBeenCalledTimes(2);
    expect(prisma.activityDigestPreference.updateMany).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['missing current email', { ...eligibleRecipient(), email: '' }],
    ['unverified email', { ...eligibleRecipient(), emailVerified: false }],
    [
      'inactive account',
      { ...eligibleRecipient(), moderationStatus: 'suspended' },
    ],
    ['digest opt-out', eligibleRecipient('never')],
  ])('rechecks %s before enqueueing', async (_case, recipient) => {
    const { service, prisma, emailQueue } = makeService();
    prisma.activityDigestPreference.findMany.mockResolvedValue([
      { id: 'preference-1', userId: 'user-1', lastSentAt: null },
    ]);
    prisma.user.findUnique.mockResolvedValue(recipient);
    vi.spyOn(service, 'generateUserDigest').mockResolvedValue(digestData);

    await expect(service.generateDigests('monthly')).resolves.toMatchObject({
      skipped: 1,
    });
    expect(emailQueue.enqueueSendEmail).not.toHaveBeenCalled();
    expect(prisma.activityDigestPreference.updateMany).not.toHaveBeenCalled();
  });

  it('does not mark an empty digest as sent', async () => {
    const { service, prisma, emailQueue } = makeService();
    prisma.activityDigestPreference.findMany.mockResolvedValue([
      { id: 'preference-1', userId: 'user-1', lastSentAt: null },
    ]);
    vi.spyOn(service, 'generateUserDigest').mockResolvedValue(null);

    await expect(service.generateDigests('monthly')).resolves.toMatchObject({
      empty: 1,
      sent: 0,
      queued: 0,
    });
    expect(emailQueue.enqueueSendEmail).not.toHaveBeenCalled();
    expect(prisma.activityDigestPreference.updateMany).not.toHaveBeenCalled();
  });

  it('does not mark disabled delivery as sent', async () => {
    const { service, prisma, emailQueue } = makeService();
    prisma.activityDigestPreference.findMany.mockResolvedValue([
      { id: 'preference-1', userId: 'user-1', lastSentAt: null },
    ]);
    prisma.user.findUnique.mockResolvedValue(eligibleRecipient());
    emailQueue.enqueueSendEmail.mockResolvedValue('disabled');
    vi.spyOn(service, 'generateUserDigest').mockResolvedValue(digestData);

    await expect(service.generateDigests('monthly')).resolves.toMatchObject({
      disabled: 1,
      sent: 0,
      queued: 0,
    });
    expect(prisma.activityDigestPreference.updateMany).not.toHaveBeenCalled();
  });
});

describe('message digest attribution', () => {
  it('uses the latest message sender for group conversations', async () => {
    const { service, prisma } = makeService();
    prisma.conversation.findMany.mockResolvedValue([
      {
        id: 'conversation-1',
        updatedAt: new Date('2026-02-20T10:00:00Z'),
        messages: [
          {
            body: 'Latest group update',
            createdAt: new Date('2026-02-20T10:00:00Z'),
            sender: { profile: { displayName: 'Ada Sender' } },
          },
        ],
      },
    ]);

    const digest = await (service as any).getMessagesDigest(
      'user-1',
      new Date('2026-02-01T00:00:00Z'),
    );
    expect(digest.items[0].title).toBe('Messages from Ada Sender');
    expect(
      prisma.conversation.findMany.mock.calls[0][0].include,
    ).not.toHaveProperty('participants');
  });
});

describe('digest sections fed by follows and saved searches', () => {
  function readerPrisma() {
    const prisma = {
      ...makePrisma(),
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'reader',
          emailVerified: true,
          moderationStatus: 'active',
          digestPreference: { frequency: 'weekly' },
          notificationChannels: [],
        }),
      },
      userFollow: { findMany: vi.fn().mockResolvedValue([{ followingId: 'elena' }]) },
      founderUpdate: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'up-1', title: 'September: twelve interviews', body: 'What we learned.', createdAt: new Date('2026-10-05T09:00:00Z'), author: { profile: { displayName: 'Elena Papadopoulos' } } },
        ]),
      },
      savedSearch: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'ss-1', name: 'Co-founder cards', searchType: 'opportunity', pendingNewCount: 2, updatedAt: new Date('2026-10-06T09:00:00Z') },
          { id: 'ss-2', name: 'Fintech CTOs', searchType: 'cofounder', pendingNewCount: 1, updatedAt: new Date('2026-10-06T09:00:00Z') },
        ]),
      },
    };
    return prisma;
  }

  it('lists updates from people the reader follows, and saved searches with unseen results', async () => {
    const prisma = readerPrisma();
    const { service } = makeService(prisma as never);
    const digest = await service.generateUserDigest('reader', 'weekly');
    expect(digest?.content.updates?.items[0]).toMatchObject({ title: 'Elena Papadopoulos: September: twelve interviews', url: '/updates?update=up-1' });
    expect(prisma.founderUpdate.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ authorId: { in: ['elena'] } }) }));
    expect(digest?.content.searches?.items.map((i) => i.description)).toEqual(['2 new need cards', '1 new profile']);
    expect(prisma.savedSearch.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'reader', pendingNewCount: { gt: 0 } } }));
  });

  it('leaves both sections out when the reader turned the categories off, or the tables are missing', async () => {
    const prisma = readerPrisma();
    prisma.user.findUnique.mockResolvedValue({
      id: 'reader', emailVerified: true, moderationStatus: 'active', digestPreference: { frequency: 'weekly' },
      notificationChannels: [{ category: 'updates', isEnabled: false }, { category: 'opportunities', isEnabled: false }],
    });
    const { service } = makeService(prisma as never);
    expect(await service.generateUserDigest('reader', 'weekly')).toBeNull();

    const bare = { ...makePrisma(), user: readerPrisma().user };
    const { service: older } = makeService(bare as never);
    // No follow or saved-search tables in this database: no section, no error.
    expect(await older.generateUserDigest('reader', 'weekly')).toBeNull();
  });
});
