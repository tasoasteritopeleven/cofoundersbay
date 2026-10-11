/**
 * An in-memory stand-in for the four commitment tables, for tests.
 *
 * It implements only the calls `CommitmentsService` makes, with the subset of
 * Prisma's `where` it uses (equality, `in`, `lt`, `gte`, `equals`/`contains`
 * with `mode`, `OR`, `AND`, and a relation filter on a thread's card), so a test can
 * walk the whole ladder - interest to agreed terms - and read back what was
 * stored. It proves the service's rules, not Postgres.
 */

type Row = Record<string, any>;

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${++seq}`;

function matchValue(actual: any, cond: any): boolean {
  if (cond === undefined) return true;
  if (cond === null || typeof cond !== 'object' || cond instanceof Date) {
    if (cond instanceof Date) return actual instanceof Date && actual.getTime() === cond.getTime();
    return actual === cond;
  }
  if ('in' in cond) return cond.in.includes(actual);
  if ('lt' in cond) return actual instanceof Date && actual.getTime() < cond.lt.getTime();
  if ('gte' in cond) return typeof actual === 'number' && actual >= cond.gte;
  const insensitive = cond.mode === 'insensitive';
  const norm = (v: any) => (insensitive && typeof v === 'string' ? v.toLowerCase() : v);
  if ('equals' in cond) return norm(actual) === norm(cond.equals);
  if ('contains' in cond) return typeof actual === 'string' && norm(actual).includes(norm(cond.contains));
  return false;
}

export function createFakePrisma() {
  const db = {
    users: new Map<string, Row>(),
    cards: [] as Row[],
    threads: [] as Row[],
    messages: [] as Row[],
    terms: [] as Row[],
    notifications: [] as Row[],
  };

  const userView = (id: string) => {
    const u = db.users.get(id);
    return u ? { id: u.id, role: u.role, profile: { displayName: u.displayName, avatarUrl: null, headline: u.headline ?? null, location: null } } : null;
  };

  const cardOf = (thread: Row) => db.cards.find((c) => c.id === thread.cardId)!;

  function matchCard(card: Row, where: Row = {}): boolean {
    return Object.entries(where).every(([key, cond]) => {
      if (key === 'OR') return (cond as Row[]).some((w) => matchCard(card, w));
      if (key === 'AND') return (cond as Row[]).every((w) => matchCard(card, w));
      return matchValue(card[key], cond);
    });
  }

  function matchThread(thread: Row, where: Row = {}): boolean {
    return Object.entries(where).every(([key, cond]) => {
      if (key === 'OR') return (cond as Row[]).some((w) => matchThread(thread, w));
      if (key === 'card') return matchCard(cardOf(thread), cond as Row);
      if (key === 'cardId_candidateId') return thread.cardId === cond.cardId && thread.candidateId === cond.candidateId;
      return matchValue(thread[key], cond);
    });
  }

  function withCardIncludes(card: Row, include?: Row) {
    if (!include) return { ...card };
    const out: Row = { ...card };
    if (include.owner) out.owner = userView(card.ownerId);
    if (include.threads) out.threads = db.threads.filter((t) => t.cardId === card.id).map((t) => ({ ...t }));
    return out;
  }

  function withThreadIncludes(thread: Row, args: Row = {}) {
    const include = args.include;
    const out: Row = { ...thread };
    if (args.select?.threads) {
      // refreshCardStatus selects threads off a card, handled in card.findUnique
    }
    if (!include) return out;
    if (include.card) {
      const card = cardOf(thread);
      out.card = { ...card };
      if (include.card.select?.owner || include.card.include?.owner) out.card.owner = userView(card.ownerId);
    }
    if (include.candidate) out.candidate = userView(thread.candidateId);
    if (include.messages) out.messages = db.messages.filter((m) => m.threadId === thread.id).sort((a, b) => a.createdAt - b.createdAt);
    if (include.terms) {
      const rows = db.terms.filter((t) => t.threadId === thread.id).sort((a, b) => a.version - b.version);
      out.terms = include.terms.orderBy?.version === 'desc' ? rows.reverse().slice(0, include.terms.take ?? rows.length) : rows;
    }
    return out;
  }

  const prisma = {
    $db: db,
    user: {
      findUnique: async ({ where, select }: Row) => {
        const u = db.users.get(where.id);
        if (!u) return null;
        if (select?.emailVerified) return { emailVerified: Boolean(u.emailVerified) };
        return userView(where.id);
      },
    },
    milestone: { count: async ({ where }: Row) => db.users.get(where.ownerId)?.milestonesCompleted ?? 0 },
    builderDocument: { count: async () => 0 },
    endorsement: { count: async ({ where }: Row) => db.users.get(where.toUserId)?.endorsements ?? 0 },
    commitmentCard: {
      findMany: async ({ where, include, take, select }: Row = {}) => {
        const rows = db.cards.filter((c) => matchCard(c, where)).slice(0, take ?? Infinity);
        return rows.map((c) => (select ? { ...c } : withCardIncludes(c, include)));
      },
      findUnique: async ({ where, include, select }: Row) => {
        const card = db.cards.find((c) => (where.id ? c.id === where.id : c.shareToken === where.shareToken));
        if (!card) return null;
        if (select?.threads) {
          return { ...card, threads: db.threads.filter((t) => t.cardId === card.id).map((t) => ({ step: t.step, agreedAt: t.agreedAt ?? null })) };
        }
        return withCardIncludes(card, include);
      },
      create: async ({ data, include }: Row) => {
        const now = new Date();
        const card = {
          id: nextId('card'),
          version: 1,
          history: null,
          status: 'open',
          closedReason: null,
          settledAt: null,
          shareToken: null,
          createdAt: now,
          updatedAt: now,
          ...data,
        };
        db.cards.push(card);
        return withCardIncludes(card, include);
      },
      update: async ({ where, data, include }: Row) => {
        const card = db.cards.find((c) => c.id === where.id);
        if (!card) throw new Error('not found');
        Object.assign(card, data, { updatedAt: new Date() });
        return withCardIncludes(card, include);
      },
    },
    commitmentThread: {
      findUnique: async (args: Row) => {
        const thread = db.threads.find((t) => matchThread(t, args.where));
        return thread ? withThreadIncludes(thread, args) : null;
      },
      findMany: async (args: Row = {}) => db.threads.filter((t) => matchThread(t, args.where)).map((t) => withThreadIncludes(t, args)),
      count: async ({ where }: Row = {}) => db.threads.filter((t) => matchThread(t, where)).length,
      create: async ({ data }: Row) => {
        const now = new Date();
        const thread = {
          id: nextId('thread'),
          step: 'interest',
          ownerConfirmedAt: null,
          candidateConfirmedAt: null,
          revisions: 0,
          dealRoomActive: false,
          agreedAt: null,
          closedById: null,
          closedReason: null,
          closedAt: null,
          createdAt: now,
          updatedAt: now,
          ...data,
        };
        db.threads.push(thread);
        return { ...thread };
      },
      update: async ({ where, data }: Row) => {
        const thread = db.threads.find((t) => t.id === where.id);
        if (!thread) throw new Error('not found');
        Object.assign(thread, data);
        return { ...thread };
      },
      delete: async ({ where }: Row) => {
        const index = db.threads.findIndex((t) => t.id === where.id);
        const [gone] = db.threads.splice(index, 1);
        return gone;
      },
    },
    commitmentMessage: {
      create: async ({ data }: Row) => {
        const message = { id: nextId('msg'), createdAt: new Date(Date.now() + db.messages.length), ...data };
        db.messages.push(message);
        return { ...message };
      },
    },
    commitmentTerms: {
      findFirst: async ({ where }: Row) => {
        const rows = db.terms.filter((t) => t.threadId === where.threadId).sort((a, b) => b.version - a.version);
        return rows[0] ? { ...rows[0] } : null;
      },
      create: async ({ data }: Row) => {
        const terms = { id: nextId('terms'), createdAt: new Date(), ...data };
        db.terms.push(terms);
        return { ...terms };
      },
      update: async ({ where, data }: Row) => {
        const terms = db.terms.find((t) => t.id === where.id);
        if (!terms) throw new Error('not found');
        Object.assign(terms, data);
        return { ...terms };
      },
    },
  };

  const notifications = {
    createNotification: async (params: Row) => {
      db.notifications.push(params);
      return params;
    },
  };

  const addUser = (id: string, displayName: string, extra: Row = {}) => {
    db.users.set(id, { id, displayName, role: 'founder', ...extra });
  };

  return { prisma, notifications, db, addUser };
}
