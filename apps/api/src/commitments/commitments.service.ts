import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Inject, Optional } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import {
  acceptsInterest,
  assessNeedCard,
  canReviseTerms,
  cardOfferChanges,
  contactKinds,
  CARD_CLOSE_REASONS,
  COMMITMENT_KINDS,
  COMMITMENT_OUTCOMES,
  deriveCardOutcome,
  describeContactKinds,
  hasPromiseClaims,
  INTEREST_BUDGET,
  INTEREST_BUDGET_COPY,
  interestBudgetLeft,
  isCommitmentKind,
  LADDER_TERMS_METHODS,
  NEED_CARD_LIMITS,
  placeVariants,
  termsChanges,
  validateTerms,
  VERIFICATION_REQUIRED_COPY,
  type CommitmentOutcome,
  type CommitmentStep,
  type NeedCardInput,
  type TermsFields,
  ROLE_VERIFICATION_COPY,
  ROLE_VERIFICATION_METHODS,
} from '@cofounderbay/shared';
import { VerificationService } from '../verification/verification.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TransparencyService } from '../transparency/transparency.service';

/**
 * Need cards and the commitment ladder.
 *
 * Everything a person can do to a commitment is checked here rather than in
 * the browser: who may act at each step, that the first conversation carries
 * no contact details, that a card promises no returns, that terms are
 * versioned and capped at three revisions, and that agreed terms stay frozen
 * while the deal room is open. The rules themselves live in
 * `@cofounderbay/shared`, so the posting guide and this service apply the
 * same functions.
 */

const OPEN_CARD_DAYS = 90;
const DAY_MS = 86_400_000;

type Viewer = { id: string };

const ownerSelect = {
  id: true,
  role: true,
  profile: { select: { displayName: true, avatarUrl: true, headline: true, location: true } },
} as const;

type PersonRow = {
  id: string;
  role?: string | null;
  profile?: { displayName?: string | null; avatarUrl?: string | null; headline?: string | null; location?: string | null } | null;
};

function person(row: PersonRow | null | undefined) {
  return {
    id: row?.id ?? '',
    displayName: row?.profile?.displayName ?? 'Member',
    avatarUrl: row?.profile?.avatarUrl ?? null,
    headline: row?.profile?.headline ?? null,
    role: row?.role ?? null,
  };
}

type CardRow = {
  id: string;
  ownerId: string;
  kind: string;
  title: string;
  exists: string;
  goal: string;
  missing: string;
  offerRole: string;
  offerEquity: string | null;
  offerHours: number;
  offerScope: string;
  category: string;
  place: string | null;
  isRemote: boolean;
  stage: string;
  commitment: string;
  projectRef: string | null;
  evidence: unknown;
  version: number;
  history: unknown;
  status: string;
  closedReason: string | null;
  settledAt: Date | null;
  expiresAt: Date | null;
  shareToken: string | null;
  createdAt: Date;
  updatedAt: Date;
  owner?: PersonRow | null;
  threads?: Array<{ id: string; candidateId: string; step: string }>;
};

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

function textField(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** A body as the posting guide sends it, cut to the limits and typed. */
export function readCardInput(body: Record<string, unknown> | null | undefined): NeedCardInput {
  const b = body ?? {};
  const hours = numberOrNull(b.offerHours);
  return {
    kind: isCommitmentKind(b.kind) ? b.kind : 'cofounder',
    title: textField(b.title, NEED_CARD_LIMITS.title),
    exists: textField(b.exists, NEED_CARD_LIMITS.sentence),
    goal: textField(b.goal, NEED_CARD_LIMITS.sentence),
    missing: textField(b.missing, NEED_CARD_LIMITS.sentence),
    offerRole: textField(b.offerRole, NEED_CARD_LIMITS.role),
    offerEquity: textField(b.offerEquity, NEED_CARD_LIMITS.equity),
    offerHours: hours === null ? null : Math.round(hours),
    offerScope: textField(b.offerScope, NEED_CARD_LIMITS.scope),
    category: textField(b.category, 60),
    place: textField(b.place, 80),
    isRemote: b.isRemote === true || b.isRemote === 'true',
    stage: textField(b.stage, 20),
    commitment: textField(b.commitment, 20),
    projectRef: typeof b.projectRef === 'string' && b.projectRef.trim() ? b.projectRef.trim().slice(0, 80) : null,
  };
}

function readTerms(body: Record<string, unknown> | null | undefined): { fields: TermsFields; note: string | null } {
  const b = body ?? {};
  const intOrNull = (v: unknown) => {
    const n = numberOrNull(v);
    return n === null ? null : Math.round(n);
  };
  const note = textField(b.note, NEED_CARD_LIMITS.note);
  return {
    fields: {
      role: textField(b.role, NEED_CARD_LIMITS.role),
      equityPct: numberOrNull(b.equityPct),
      vestingMonths: intOrNull(b.vestingMonths),
      cliffMonths: intOrNull(b.cliffMonths),
      hoursPerWeek: intOrNull(b.hoursPerWeek),
      scope: textField(b.scope, NEED_CARD_LIMITS.scope),
    },
    note: note || null,
  };
}

/**
 * A 400 in the API's standard error shape, so `details` survives the
 * exception filter and the web app can show the Greek half and the kinds.
 */
function refusal(reason: string, message: string, details: Record<string, unknown>) {
  return new BadRequestException({ success: false, error: { code: 'VALIDATION_ERROR', message, details: { reason, ...details } } });
}

/** A refusal that names the kinds of contact detail it found, in both languages. */
function contactRefusal(kinds: ReturnType<typeof contactKinds>) {
  const what = describeContactKinds(kinds);
  return refusal(
    'contact_details',
    `This conversation stays on CoFounderBay until you both confirm. Remove ${what.en} and send again.`,
    {
      kinds,
      messageEl: `Η συζήτηση μένει στο CoFounderBay μέχρι να επιβεβαιώσετε και οι δύο. Αφαιρέστε ${what.el} και στείλτε ξανά.`,
    },
  );
}

function incompleteRefusal(assessment: ReturnType<typeof assessNeedCard>) {
  return refusal('card_incomplete', 'The card is not ready to publish yet.', {
    failing: assessment.checks.filter((c) => c.required && !c.ok).map((c) => c.id),
    kinds: assessment.contact,
    messageEl: 'Η κάρτα δεν είναι ακόμη έτοιμη για δημοσίευση.',
  });
}

/**
 * Proposing or accepting terms is the first step that needs someone to have
 * proved who they are; interest and the protected conversation do not.
 * `COMMITMENT_VERIFICATION=off` lifts the gate (local development, a pilot
 * before any verification method is configured).
 */
/**
 * An investor or organisation account answering an investor-introduction
 * card first verifies its workplace (`meetsRolePolicy`); identity alone
 * proves a person, not the fund.
 */
function roleRefusal() {
  return refusal('role_verification_required', ROLE_VERIFICATION_COPY.en, {
    messageEl: ROLE_VERIFICATION_COPY.el,
    methods: [...ROLE_VERIFICATION_METHODS],
  });
}

function verificationRefusal() {
  return refusal('verification_required', VERIFICATION_REQUIRED_COPY.en, {
    messageEl: VERIFICATION_REQUIRED_COPY.el,
    methods: [...LADDER_TERMS_METHODS],
  });
}

@Injectable()
export class CommitmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    // A Pick type emits no runtime metadata, so the token is named explicitly.
    @Inject(VerificationService) private readonly verification: Pick<VerificationService, 'isVerified' | 'publicMethods' | 'roleCleared'>,
    // Counts refusals for the transparency report; absent in unit tests.
    @Optional() @Inject(TransparencyService) private readonly transparency?: Pick<TransparencyService, 'record'>,
  ) {}

  /** A need card the rules turned away: count what the transparency report counts. */
  private countCardRefusal(assessment: ReturnType<typeof assessNeedCard>) {
    if (assessment.contact.length) this.transparency?.record('contact_refused', 'need_card');
    if (assessment.checks.some((c) => c.id === 'promise_free' && !c.ok)) this.transparency?.record('promise_refused', 'need_card');
  }

  private async requireVerified(viewer: Viewer) {
    if (process.env.COMMITMENT_VERIFICATION === 'off') return;
    if (!(await this.verification.isVerified(viewer.id))) throw verificationRefusal();
  }

  // ── Shapes ────────────────────────────────────────────────────────────────

  private cardShape(card: CardRow, viewerId: string | null) {
    const mine = viewerId !== null && card.ownerId === viewerId;
    const threads = Array.isArray(card.threads) ? card.threads : [];
    const myThread = viewerId ? threads.find((t) => t.candidateId === viewerId) : undefined;
    return {
      id: card.id,
      kind: card.kind,
      title: card.title,
      exists: card.exists,
      goal: card.goal,
      missing: card.missing,
      offer: {
        role: card.offerRole,
        equity: card.offerEquity ?? null,
        hoursPerWeek: card.offerHours,
        scope: card.offerScope,
      },
      category: card.category,
      place: card.place ?? null,
      isRemote: card.isRemote,
      stage: card.stage,
      commitment: card.commitment,
      projectRef: card.projectRef ?? null,
      evidence: Array.isArray(card.evidence) ? card.evidence : [],
      version: card.version,
      // The offer as it stood before each new version, so a candidate who
      // answered an earlier one can see what changed.
      history: Array.isArray(card.history) ? card.history : [],
      outcome: card.status,
      closedReason: card.closedReason ?? null,
      settledAt: iso(card.settledAt),
      expiresAt: iso(card.expiresAt),
      createdAt: iso(card.createdAt),
      updatedAt: iso(card.updatedAt),
      owner: person(card.owner),
      isMine: mine,
      // Only the owner learns the token; anyone else sees whether one exists.
      shareToken: mine ? card.shareToken ?? null : null,
      shared: Boolean(card.shareToken),
      interestCount: mine ? threads.filter((t) => t.step !== 'closed').length : undefined,
      myThreadId: myThread?.id ?? null,
      myThreadStep: myThread?.step ?? null,
    };
  }

  /** Open cards that went quiet close as expired, on read, before anyone sees them. */
  private async expireQuietCards(now = new Date()) {
    try {
      const stale = await this.prisma.commitmentCard.findMany({
        where: { status: 'open', expiresAt: { lt: now } },
        select: { id: true, expiresAt: true },
        take: 200,
      });
      for (const card of stale) {
        await this.prisma.commitmentCard.update({
          where: { id: card.id },
          data: { status: 'closed', closedReason: 'expired', settledAt: card.expiresAt ?? now },
        });
      }
    } catch {
      // A failed sweep must not fail the read; the next one tries again.
    }
  }

  /** Recomputes a card's outcome from its threads, unless it was closed by hand. */
  private async refreshCardStatus(cardId: string) {
    const card = await this.prisma.commitmentCard.findUnique({
      where: { id: cardId },
      select: { id: true, status: true, settledAt: true, threads: { select: { step: true, agreedAt: true } } },
    });
    if (!card || card.status === 'closed') return;
    const steps = card.threads.map((t) => t.step as CommitmentStep);
    const status = deriveCardOutcome(false, steps);
    const agreedAt = card.threads
      .map((t) => t.agreedAt)
      .filter((d): d is Date => d instanceof Date)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    await this.prisma.commitmentCard.update({
      where: { id: cardId },
      data: { status, settledAt: status === 'agreed' ? agreedAt ?? new Date() : null },
    });
  }

  private async notify(userId: string, title: string, body: string, link: string) {
    await this.notifications
      .createNotification({ userId, type: 'commitment_update', title, body, link })
      .catch(() => undefined);
  }

  /** What the owner's own records say, snapshotted when the card is published. */
  private async evidenceFor(ownerId: string) {
    const out: Array<{ id: string; count?: number; value?: boolean }> = [];
    const attempt = async (fn: () => Promise<void>) => {
      try {
        await fn();
      } catch {
        // A table this database does not have is no evidence, not an error.
      }
    };
    await attempt(async () => {
      const count = await this.prisma.milestone.count({ where: { ownerId, status: 'completed' } });
      if (count > 0) out.push({ id: 'milestones_completed', count });
    });
    await attempt(async () => {
      const count = await this.prisma.builderDocument.count({ where: { workspace: { ownerId }, completionPercent: { gte: 80 } } });
      if (count > 0) out.push({ id: 'builder_documents', count });
    });
    await attempt(async () => {
      const count = await this.prisma.endorsement.count({ where: { toUserId: ownerId, isApproved: true } });
      if (count > 0) out.push({ id: 'endorsements', count });
    });
    await attempt(async () => {
      const user = await this.prisma.user.findUnique({ where: { id: ownerId }, select: { emailVerified: true } });
      if (user?.emailVerified) out.push({ id: 'email_verified', value: true });
    });
    return out;
  }

  /**
   * The author's verification methods, read live (a signal can lapse or be
   * removed after the card was written), for the badge beside their name.
   * Methods only: never the work domain or a date. A failed lookup shows no
   * badge rather than failing the read.
   */
  private async withOwnerVerification<T extends { owner: { id: string } }>(cards: T[]): Promise<Array<T & { owner: T['owner'] & { verifiedMethods: string[] } }>> {
    const ids = [...new Set(cards.map((c) => c.owner.id).filter(Boolean))];
    const methods = new Map<string, string[]>();
    await Promise.all(
      ids.map(async (id) => {
        try {
          methods.set(id, await this.verification.publicMethods(id));
        } catch {
          methods.set(id, []);
        }
      }),
    );
    return cards.map((c) => ({ ...c, owner: { ...c.owner, verifiedMethods: methods.get(c.owner.id) ?? [] } }));
  }

  // ── Cards ─────────────────────────────────────────────────────────────────

  async listCards(
    viewer: Viewer,
    filters: {
      mine?: boolean;
      /** One member's cards, for the Activity section of their profile. */
      owner?: string;
      kind?: string;
      stage?: string;
      category?: string;
      commitment?: string;
      place?: string;
      outcome?: string;
      projectRefs?: string[];
      q?: string;
      limit?: number;
    } = {},
  ) {
    await this.expireQuietCards();
    const where: Record<string, unknown> = {};
    if (filters.mine) where.ownerId = viewer.id;
    else if (filters.owner) where.ownerId = filters.owner;
    if (filters.kind && (COMMITMENT_KINDS as readonly string[]).includes(filters.kind)) where.kind = filters.kind;
    if (filters.stage) where.stage = filters.stage;
    if (filters.commitment) where.commitment = filters.commitment;
    if (filters.category) where.category = { equals: filters.category, mode: 'insensitive' };
    // Every spelling of a known place (Αθήνα, Athens), as the saved-search alert reads it.
    const and: Record<string, unknown>[] = [];
    if (filters.place) and.push({ OR: placeVariants(filters.place).map((v) => ({ place: { contains: v, mode: 'insensitive' } })) });
    if (filters.outcome && (COMMITMENT_OUTCOMES as readonly string[]).includes(filters.outcome)) where.status = filters.outcome;
    if (filters.projectRefs?.length) where.projectRef = { in: filters.projectRefs.slice(0, 50) };
    if (filters.q) {
      where.OR = ['title', 'exists', 'goal', 'missing', 'offerRole'].map((field) => ({
        [field]: { contains: filters.q, mode: 'insensitive' },
      }));
    }
    if (and.length) where.AND = and;
    const limit = Math.min(Math.max(filters.limit ?? 30, 1), 100);
    const rows = await this.prisma.commitmentCard.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        owner: { select: ownerSelect },
        threads: { select: { id: true, candidateId: true, step: true } },
      },
    });
    return { cards: await this.withOwnerVerification(rows.map((row) => this.cardShape(row as CardRow, viewer.id))) };
  }

  async getCard(viewer: Viewer, id: string) {
    await this.expireQuietCards();
    const card = await this.prisma.commitmentCard.findUnique({
      where: { id },
      include: {
        owner: { select: ownerSelect },
        threads: { select: { id: true, candidateId: true, step: true } },
      },
    });
    if (!card) throw new NotFoundException('Need card not found');
    const [shaped] = await this.withOwnerVerification([this.cardShape(card as CardRow, viewer.id)]);
    return { card: shaped };
  }

  async createCard(viewer: Viewer, body: Record<string, unknown>) {
    const input = readCardInput(body);
    const assessment = assessNeedCard(input);
    if (!assessment.ready) {
      this.countCardRefusal(assessment);
      throw incompleteRefusal(assessment);
    }
    const evidence = await this.evidenceFor(viewer.id);
    const card = await this.prisma.commitmentCard.create({
      data: {
        ownerId: viewer.id,
        kind: input.kind,
        title: input.title,
        exists: input.exists,
        goal: input.goal,
        missing: input.missing,
        offerRole: input.offerRole,
        offerEquity: input.offerEquity || null,
        offerHours: input.offerHours ?? 0,
        offerScope: input.offerScope,
        category: input.category,
        place: input.place || null,
        isRemote: input.isRemote,
        stage: input.stage,
        commitment: input.commitment,
        projectRef: input.projectRef ?? null,
        evidence,
        expiresAt: new Date(Date.now() + OPEN_CARD_DAYS * DAY_MS),
      },
      include: { owner: { select: ownerSelect }, threads: { select: { id: true, candidateId: true, step: true } } },
    });
    return { card: this.cardShape(card as CardRow, viewer.id) };
  }

  private async ownCard(viewer: Viewer, id: string) {
    const card = await this.prisma.commitmentCard.findUnique({ where: { id } });
    if (!card) throw new NotFoundException('Need card not found');
    if (card.ownerId !== viewer.id) throw new ForbiddenException('Only the author can change this card');
    return card;
  }

  /**
   * Edits a card. Changing the offer (role, equity, hours, scope or
   * commitment) makes a new version and keeps the old offer in its history,
   * so a candidate who answered version 1 can see what changed.
   */
  async updateCard(viewer: Viewer, id: string, body: Record<string, unknown>) {
    const existing = await this.ownCard(viewer, id);
    if (existing.status === 'closed') throw new ConflictException('Reopen the card before editing it');
    const current = readCardInput({
      ...existing,
      offerEquity: existing.offerEquity ?? '',
      place: existing.place ?? '',
    } as unknown as Record<string, unknown>);
    const patch = readCardInput({ ...current, ...body, kind: existing.kind });
    const assessment = assessNeedCard(patch);
    if (!assessment.ready) {
      this.countCardRefusal(assessment);
      throw incompleteRefusal(assessment);
    }
    const changes = cardOfferChanges(current, patch);
    const history = Array.isArray(existing.history) ? (existing.history as unknown[]) : [];
    const card = await this.prisma.commitmentCard.update({
      where: { id },
      data: {
        title: patch.title,
        exists: patch.exists,
        goal: patch.goal,
        missing: patch.missing,
        offerRole: patch.offerRole,
        offerEquity: patch.offerEquity || null,
        offerHours: patch.offerHours ?? existing.offerHours,
        offerScope: patch.offerScope,
        category: patch.category,
        place: patch.place || null,
        isRemote: patch.isRemote,
        stage: patch.stage,
        commitment: patch.commitment,
        ...(changes.length
          ? {
              version: existing.version + 1,
              history: [
                ...history,
                {
                  version: existing.version,
                  at: new Date().toISOString(),
                  changed: changes,
                  offer: {
                    role: existing.offerRole,
                    equity: existing.offerEquity,
                    hoursPerWeek: existing.offerHours,
                    scope: existing.offerScope,
                    commitment: existing.commitment,
                  },
                },
              ] as object[],
            }
          : {}),
      },
      include: { owner: { select: ownerSelect }, threads: { select: { id: true, candidateId: true, step: true } } },
    });
    return { card: this.cardShape(card as CardRow, viewer.id), newVersion: changes.length > 0, changed: changes };
  }

  /**
   * Closes a card as filled or withdrawn. Threads are left exactly as they
   * were and nobody is notified, which is what makes `reopenCard` a full
   * reversal: it recomputes the same outcome from the same threads.
   */
  async closeCard(viewer: Viewer, id: string, reason: string) {
    const card = await this.ownCard(viewer, id);
    if (card.status === 'closed') throw new ConflictException('The card is already closed');
    const why = (CARD_CLOSE_REASONS as readonly string[]).includes(reason) && reason !== 'expired' ? reason : 'withdrawn';
    await this.prisma.commitmentCard.update({
      where: { id },
      data: { status: 'closed', closedReason: why, settledAt: new Date() },
    });
    return { ok: true, outcome: 'closed' as CommitmentOutcome, closedReason: why, previousOutcome: card.status };
  }

  async reopenCard(viewer: Viewer, id: string) {
    const card = await this.ownCard(viewer, id);
    if (card.status !== 'closed') throw new ConflictException('The card is not closed');
    // The expiry is kept unless it has passed, so closing and reopening a
    // card puts back exactly what closing changed: the outcome (recomputed
    // from untouched threads), the reason and the settled date.
    const stillRunning = card.expiresAt && card.expiresAt.getTime() > Date.now();
    await this.prisma.commitmentCard.update({
      where: { id },
      data: {
        status: 'open',
        closedReason: null,
        settledAt: null,
        expiresAt: stillRunning ? card.expiresAt : new Date(Date.now() + OPEN_CARD_DAYS * DAY_MS),
      },
    });
    await this.refreshCardStatus(id);
    return this.getCard(viewer, id);
  }

  /** Returns the card's public token, creating one only when there is none. */
  async shareCard(viewer: Viewer, id: string) {
    const card = await this.ownCard(viewer, id);
    if (card.shareToken) return { token: card.shareToken, created: false };
    const token = randomBytes(12).toString('base64url');
    await this.prisma.commitmentCard.update({ where: { id }, data: { shareToken: token } });
    return { token, created: true };
  }

  /** The public link stops working at once; a new one is a different token. */
  async revokeShare(viewer: Viewer, id: string) {
    await this.ownCard(viewer, id);
    await this.prisma.commitmentCard.update({ where: { id }, data: { shareToken: null } });
    return { ok: true };
  }

  /**
   * The card as anyone with the link may see it: the three sentences, the
   * offer, the filters and the outcome, with the author's name and headline
   * (the product is not anonymous) and nothing that reaches them outside it.
   */
  async getPublicCard(token: string) {
    if (!token || token.length < 8) throw new NotFoundException('This link is not valid');
    const card = await this.prisma.commitmentCard.findUnique({
      where: { shareToken: token },
      include: { owner: { select: ownerSelect } },
    });
    if (!card) throw new NotFoundException('This link is not valid or was turned off');
    const owner = person(card.owner as PersonRow);
    const [{ owner: verifiedOwner }] = await this.withOwnerVerification([{ owner }]);
    return {
      card: {
        id: card.id,
        kind: card.kind,
        title: card.title,
        exists: card.exists,
        goal: card.goal,
        missing: card.missing,
        offer: { role: card.offerRole, equity: card.offerEquity ?? null, hoursPerWeek: card.offerHours, scope: card.offerScope },
        category: card.category,
        place: card.place ?? null,
        isRemote: card.isRemote,
        stage: card.stage,
        commitment: card.commitment,
        evidence: Array.isArray(card.evidence) ? card.evidence : [],
        version: card.version,
        outcome: card.status,
        settledAt: iso(card.settledAt),
        // No id: the public card never names who the author is in the database.
        owner: { displayName: owner.displayName, headline: owner.headline, avatarUrl: owner.avatarUrl, verifiedMethods: verifiedOwner.verifiedMethods },
      },
    };
  }

  // ── The ladder ────────────────────────────────────────────────────────────

  private async participantThread(viewer: Viewer, threadId: string) {
    const thread = await this.prisma.commitmentThread.findUnique({
      where: { id: threadId },
      include: { card: { select: { id: true, ownerId: true, title: true, status: true, kind: true } } },
    });
    if (!thread) throw new NotFoundException('Conversation not found');
    const isOwner = thread.card.ownerId === viewer.id;
    const isCandidate = thread.candidateId === viewer.id;
    if (!isOwner && !isCandidate) throw new ForbiddenException('Only the two people in this commitment can open it');
    const otherId = isOwner ? thread.candidateId : thread.card.ownerId;
    return { thread, isOwner, isCandidate, otherId };
  }

  private threadLink(cardId: string, threadId: string) {
    return `/commitments/${cardId}?thread=${encodeURIComponent(threadId)}`;
  }

  async expressInterest(viewer: Viewer, cardId: string, body: Record<string, unknown>) {
    const card = await this.prisma.commitmentCard.findUnique({
      where: { id: cardId },
      include: { owner: { select: ownerSelect } },
    });
    if (!card) throw new NotFoundException('Need card not found');
    if (card.ownerId === viewer.id) throw new BadRequestException('This is your own card');
    if (!acceptsInterest(card.status as CommitmentOutcome)) throw new ConflictException('This card is not taking interest any more');
    const note = textField(body?.note, NEED_CARD_LIMITS.note);
    const kinds = contactKinds(note);
    if (kinds.length) {
      this.transparency?.record('contact_refused', 'interest');
      throw contactRefusal(kinds);
    }
    if (hasPromiseClaims(note)) {
      this.transparency?.record('promise_refused', 'interest');
      throw refusal('promise', 'Remove promised returns from the note.', { messageEl: 'Αφαιρέστε τις υποσχέσεις αποδόσεων από το σημείωμα.' });
    }
    if (card.kind === 'investor_intro' && process.env.COMMITMENT_VERIFICATION !== 'off' && !(await this.verification.roleCleared(viewer.id))) {
      throw roleRefusal();
    }
    const existing = await this.prisma.commitmentThread.findUnique({
      where: { cardId_candidateId: { cardId, candidateId: viewer.id } },
    });
    if (existing) throw new ConflictException('You have already answered this card');
    const waiting = await this.prisma.commitmentThread.count({ where: { candidateId: viewer.id, step: 'interest' } });
    if (waiting >= INTEREST_BUDGET) {
      throw refusal('interest_budget', INTEREST_BUDGET_COPY.en, { messageEl: INTEREST_BUDGET_COPY.el, budget: INTEREST_BUDGET, waiting });
    }
    const thread = await this.prisma.commitmentThread.create({
      data: { cardId, candidateId: viewer.id, note: note || null, cardVersion: card.version },
    });
    const me = await this.prisma.user.findUnique({ where: { id: viewer.id }, select: ownerSelect });
    await this.notify(
      card.ownerId,
      `${person(me as PersonRow).displayName} is interested in “${card.title}”`,
      note || 'Open the card to accept and start a protected conversation.',
      this.threadLink(cardId, thread.id),
    );
    return { thread: { id: thread.id, cardId, step: thread.step } };
  }

  /** How many of the viewer's answers are waiting on authors, against the budget. */
  async interestBudget(viewer: Viewer) {
    const waiting = await this.prisma.commitmentThread.count({ where: { candidateId: viewer.id, step: 'interest' } });
    return { budget: INTEREST_BUDGET, waiting, left: interestBudgetLeft(waiting) };
  }

  /**
   * Takes interest back while the author has not accepted it. The author was
   * notified when it arrived, so this removes it from their list but cannot
   * unsend that notification; once accepted, the conversation is theirs too.
   */
  async withdrawInterest(viewer: Viewer, threadId: string) {
    const { thread, isCandidate } = await this.participantThread(viewer, threadId);
    if (!isCandidate) throw new ForbiddenException('Only the person who sent the interest can withdraw it');
    if (thread.step !== 'interest') throw new ConflictException('The author has already answered; step back from the conversation instead');
    await this.prisma.commitmentThread.delete({ where: { id: threadId } });
    await this.refreshCardStatus(thread.cardId);
    return { ok: true };
  }

  async acceptInterest(viewer: Viewer, threadId: string) {
    const { thread, isOwner } = await this.participantThread(viewer, threadId);
    if (!isOwner) throw new ForbiddenException('Only the author can accept interest');
    if (thread.step !== 'interest') throw new ConflictException('This interest was already answered');
    await this.prisma.commitmentThread.update({ where: { id: threadId }, data: { step: 'conversation' } });
    await this.refreshCardStatus(thread.cardId);
    await this.notify(
      thread.candidateId,
      `Your interest in “${thread.card.title}” was accepted`,
      'A protected conversation is open. Contact details stay out of it until you both confirm.',
      this.threadLink(thread.cardId, threadId),
    );
    return this.getThread(viewer, threadId);
  }

  async listThreads(viewer: Viewer, as: 'owner' | 'candidate' | 'all' = 'all') {
    const where =
      as === 'owner'
        ? { card: { ownerId: viewer.id } }
        : as === 'candidate'
          ? { candidateId: viewer.id }
          : { OR: [{ candidateId: viewer.id }, { card: { ownerId: viewer.id } }] };
    const rows = await this.prisma.commitmentThread.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: {
        card: { select: { id: true, title: true, kind: true, ownerId: true, status: true, version: true, owner: { select: ownerSelect } } },
        candidate: { select: ownerSelect },
        terms: { orderBy: { version: 'desc' }, take: 1 },
      },
    });
    return {
      threads: rows.map((row) => {
        const isOwner = row.card.ownerId === viewer.id;
        const latest = row.terms[0];
        const myConfirmed = Boolean(isOwner ? row.ownerConfirmedAt : row.candidateConfirmedAt);
        const myAccepted = latest ? Boolean(isOwner ? latest.ownerAcceptedAt : latest.candidateAcceptedAt) : false;
        return {
          id: row.id,
          cardId: row.card.id,
          cardTitle: row.card.title,
          cardKind: row.card.kind,
          cardOutcome: row.card.status,
          cardVersion: row.card.version,
          answeredVersion: row.cardVersion,
          role: isOwner ? 'owner' : 'candidate',
          counterpart: person((isOwner ? row.candidate : row.card.owner) as PersonRow),
          step: row.step,
          myConfirmed,
          latestTermsVersion: latest?.version ?? 0,
          myAcceptedLatest: myAccepted,
          dealRoomActive: row.dealRoomActive,
          revisions: row.revisions,
          closedReason: row.closedReason ?? null,
          agreedAt: iso(row.agreedAt),
          closedAt: iso(row.closedAt),
          updatedAt: iso(row.updatedAt),
        };
      }),
    };
  }

  /**
   * A thread as one participant sees it. Confirmations are blind: until both
   * have confirmed, each side sees only its own, so nobody confirms under the
   * pressure of the other's yes - or learns of a quiet no.
   */
  async getThread(viewer: Viewer, threadId: string) {
    const { isOwner } = await this.participantThread(viewer, threadId);
    const row = await this.prisma.commitmentThread.findUnique({
      where: { id: threadId },
      include: {
        card: { include: { owner: { select: ownerSelect } } },
        candidate: { select: ownerSelect },
        messages: { orderBy: { createdAt: 'asc' }, take: 500 },
        terms: { orderBy: { version: 'asc' } },
      },
    });
    if (!row) throw new NotFoundException('Conversation not found');
    const bothConfirmed = Boolean(row.ownerConfirmedAt && row.candidateConfirmedAt);
    const latest = row.terms[row.terms.length - 1];
    const otherId = isOwner ? row.candidateId : row.card.ownerId;
    const [meVerified, otherMethods] = await Promise.all([
      process.env.COMMITMENT_VERIFICATION === 'off' ? Promise.resolve(true) : this.verification.isVerified(viewer.id),
      this.verification.publicMethods(otherId),
    ]);
    return {
      thread: {
        id: row.id,
        cardId: row.cardId,
        card: this.cardShape({ ...(row.card as unknown as CardRow), threads: [] }, viewer.id),
        role: isOwner ? 'owner' : 'candidate',
        counterpart: person((isOwner ? row.candidate : row.card.owner) as PersonRow),
        // Terms need the reader verified; the other side's methods show as a badge.
        verification: { meVerified, counterpartMethods: otherMethods },
        step: row.step,
        note: row.note ?? null,
        answeredVersion: row.cardVersion,
        myConfirmed: Boolean(isOwner ? row.ownerConfirmedAt : row.candidateConfirmedAt),
        bothConfirmed,
        // The first conversation is read-only from the moment terms open.
        conversationReadOnly: row.step !== 'conversation',
        revisions: row.revisions,
        dealRoomActive: row.dealRoomActive,
        agreedAt: iso(row.agreedAt),
        closedReason: row.closedReason ?? null,
        closedAt: iso(row.closedAt),
        messages: row.messages.map((m) => ({
          id: m.id,
          authorId: m.authorId,
          mine: m.authorId === viewer.id,
          body: m.body,
          createdAt: iso(m.createdAt),
        })),
        terms: row.terms.map((t, index) => {
          const prev = index > 0 ? row.terms[index - 1] : undefined;
          return {
            version: t.version,
            proposedByMe: t.proposedById === viewer.id,
            role: t.role,
            equityPct: t.equityPct,
            vestingMonths: t.vestingMonths,
            cliffMonths: t.cliffMonths,
            hoursPerWeek: t.hoursPerWeek,
            scope: t.scope,
            note: t.note ?? null,
            changed: prev ? termsChanges(prev, t) : [],
            acceptedByMe: Boolean(isOwner ? t.ownerAcceptedAt : t.candidateAcceptedAt),
            acceptedByThem: Boolean(isOwner ? t.candidateAcceptedAt : t.ownerAcceptedAt),
            isLatest: t.version === latest?.version,
            createdAt: iso(t.createdAt),
          };
        }),
      },
    };
  }

  async sendMessage(viewer: Viewer, threadId: string, body: Record<string, unknown>) {
    const { thread, otherId } = await this.participantThread(viewer, threadId);
    if (thread.step !== 'conversation') {
      throw new ConflictException(
        thread.step === 'interest'
          ? 'The author has not accepted this interest yet'
          : 'The first conversation is read-only now; discuss changes in the terms space',
      );
    }
    const text = textField(body?.body, NEED_CARD_LIMITS.message);
    if (!text) throw new BadRequestException('Write a message first');
    const kinds = contactKinds(text);
    if (kinds.length) {
      this.transparency?.record('contact_refused', 'conversation');
      throw contactRefusal(kinds);
    }
    const message = await this.prisma.commitmentMessage.create({
      data: { threadId, authorId: viewer.id, body: text },
    });
    await this.prisma.commitmentThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });
    await this.notify(otherId, `New message about “${thread.card.title}”`, text.slice(0, 140), this.threadLink(thread.cardId, threadId));
    return { message: { id: message.id, authorId: viewer.id, mine: true, body: message.body, createdAt: iso(message.createdAt) } };
  }

  async confirm(viewer: Viewer, threadId: string) {
    const { thread, isOwner, otherId } = await this.participantThread(viewer, threadId);
    if (thread.step !== 'conversation') throw new ConflictException('Confirmation belongs to the conversation step');
    const now = new Date();
    const updated = await this.prisma.commitmentThread.update({
      where: { id: threadId },
      data: isOwner ? { ownerConfirmedAt: thread.ownerConfirmedAt ?? now } : { candidateConfirmedAt: thread.candidateConfirmedAt ?? now },
    });
    const both = Boolean(updated.ownerConfirmedAt && updated.candidateConfirmedAt);
    if (both) {
      await this.prisma.commitmentThread.update({ where: { id: threadId }, data: { step: 'terms' } });
      await this.refreshCardStatus(thread.cardId);
      const link = this.threadLink(thread.cardId, threadId);
      // Only now does either side learn the other said yes.
      await this.notify(otherId, `You both confirmed “${thread.card.title}”`, 'The terms space is open. Each change of substance is a new version.', link);
      await this.notify(viewer.id, `You both confirmed “${thread.card.title}”`, 'The terms space is open. Each change of substance is a new version.', link);
    }
    return { ok: true, bothConfirmed: both, step: both ? 'terms' : 'conversation' };
  }

  /** Takes back one's own confirmation while the other has not confirmed. */
  async retractConfirmation(viewer: Viewer, threadId: string) {
    const { thread, isOwner } = await this.participantThread(viewer, threadId);
    if (thread.step !== 'conversation') throw new ConflictException('You have both confirmed; the terms space is open');
    const mine = isOwner ? thread.ownerConfirmedAt : thread.candidateConfirmedAt;
    if (!mine) throw new ConflictException('You have not confirmed');
    await this.prisma.commitmentThread.update({
      where: { id: threadId },
      data: isOwner ? { ownerConfirmedAt: null } : { candidateConfirmedAt: null },
    });
    return { ok: true };
  }

  /**
   * Proposes terms. The first proposal is version 1. A change to role,
   * equity, vesting, cliff, hours or scope is a new version and uses one of
   * three revisions; a change to the note alone edits the latest version's
   * note in place. Proposing accepts one's own version.
   */
  async proposeTerms(viewer: Viewer, threadId: string, body: Record<string, unknown>) {
    const { thread, isOwner, otherId } = await this.participantThread(viewer, threadId);
    await this.requireVerified(viewer);
    const latest = await this.prisma.commitmentTerms.findFirst({ where: { threadId }, orderBy: { version: 'desc' } });
    const versions = latest?.version ?? 0;
    const gate = canReviseTerms({ revisions: thread.revisions, dealRoomActive: thread.dealRoomActive, step: thread.step as CommitmentStep, versions });
    if (!gate.ok) {
      throw new ConflictException(
        gate.reason === 'frozen'
          ? 'Terms are frozen while the deal room is open; close it to revise'
          : gate.reason === 'limit'
            ? 'All three revisions are used; accept the current terms or step back'
            : 'Terms open once you have both confirmed',
      );
    }
    const { fields, note } = readTerms(body);
    const problems = validateTerms(fields, note);
    if (problems.includes('contact')) this.transparency?.record('contact_refused', 'terms');
    if (problems.includes('promise')) this.transparency?.record('promise_refused', 'terms');
    if (problems.includes('contact')) throw contactRefusal(contactKinds([fields.role, fields.scope, note ?? ''].join('\n')));
    if (problems.length) throw refusal('terms_invalid', 'Check the terms and try again.', { problems, messageEl: 'Ελέγξτε τους όρους και δοκιμάστε ξανά.' });

    const changed = latest ? termsChanges(latest, fields) : [];
    if (latest && changed.length === 0) {
      await this.prisma.commitmentTerms.update({ where: { id: latest.id }, data: { note } });
      return { version: latest.version, substantive: false, revisionsUsed: thread.revisions };
    }
    const now = new Date();
    const created = await this.prisma.commitmentTerms.create({
      data: {
        threadId,
        version: versions + 1,
        proposedById: viewer.id,
        ...fields,
        note,
        ownerAcceptedAt: isOwner ? now : null,
        candidateAcceptedAt: isOwner ? null : now,
      },
    });
    const revisionsUsed = latest ? thread.revisions + 1 : thread.revisions;
    await this.prisma.commitmentThread.update({ where: { id: threadId }, data: { revisions: revisionsUsed } });
    await this.notify(
      otherId,
      `Terms v${created.version} proposed for “${thread.card.title}”`,
      changed.length ? `Changed: ${changed.join(', ')}` : 'First proposal.',
      this.threadLink(thread.cardId, threadId),
    );
    return { version: created.version, substantive: true, revisionsUsed, changed };
  }

  /** Accepts the latest version. When both have, the commitment is agreed and the deal room opens. */
  async acceptTerms(viewer: Viewer, threadId: string, version: number) {
    const { thread, isOwner, otherId } = await this.participantThread(viewer, threadId);
    await this.requireVerified(viewer);
    if (thread.step !== 'terms') throw new ConflictException('There are no open terms to accept');
    const latest = await this.prisma.commitmentTerms.findFirst({ where: { threadId }, orderBy: { version: 'desc' } });
    if (!latest) throw new ConflictException('No terms have been proposed yet');
    if (latest.version !== version) throw new ConflictException(`Version ${version} is not the latest; read v${latest.version} first`);
    const now = new Date();
    const updated = await this.prisma.commitmentTerms.update({
      where: { id: latest.id },
      data: isOwner ? { ownerAcceptedAt: latest.ownerAcceptedAt ?? now } : { candidateAcceptedAt: latest.candidateAcceptedAt ?? now },
    });
    const agreed = Boolean(updated.ownerAcceptedAt && updated.candidateAcceptedAt);
    if (agreed) {
      await this.prisma.commitmentThread.update({
        where: { id: threadId },
        data: { step: 'agreed', dealRoomActive: true, agreedAt: now },
      });
      await this.refreshCardStatus(thread.cardId);
      const link = this.threadLink(thread.cardId, threadId);
      await this.notify(otherId, `Terms agreed for “${thread.card.title}”`, `Version ${version} is agreed. The deal room is open and the terms are frozen.`, link);
      await this.notify(viewer.id, `Terms agreed for “${thread.card.title}”`, `Version ${version} is agreed. The deal room is open and the terms are frozen.`, link);
    }
    return { ok: true, agreed, step: agreed ? 'agreed' : 'terms' };
  }

  /**
   * Closes the deal room and returns to the terms space, unfreezing them.
   * Acceptances of the agreed version are cleared, because a reopened
   * negotiation is not an agreement.
   */
  async closeDealRoom(viewer: Viewer, threadId: string) {
    const { thread, otherId } = await this.participantThread(viewer, threadId);
    if (thread.step !== 'agreed' || !thread.dealRoomActive) throw new ConflictException('The deal room is not open');
    const latest = await this.prisma.commitmentTerms.findFirst({ where: { threadId }, orderBy: { version: 'desc' } });
    if (latest) {
      await this.prisma.commitmentTerms.update({ where: { id: latest.id }, data: { ownerAcceptedAt: null, candidateAcceptedAt: null } });
    }
    await this.prisma.commitmentThread.update({
      where: { id: threadId },
      data: { step: 'terms', dealRoomActive: false, agreedAt: null },
    });
    await this.refreshCardStatus(thread.cardId);
    await this.notify(otherId, `The deal room for “${thread.card.title}” was closed`, 'The terms are open for revision again.', this.threadLink(thread.cardId, threadId));
    return { ok: true, step: 'terms' };
  }

  /** Either side steps back before an agreement. The other is told, without a reason they did not write. */
  async closeThread(viewer: Viewer, threadId: string, body: Record<string, unknown>) {
    const { thread, otherId } = await this.participantThread(viewer, threadId);
    if (thread.step === 'closed') throw new ConflictException('Already closed');
    if (thread.step === 'agreed') throw new ConflictException('Close the deal room before stepping back');
    const reason = textField(body?.reason, 200) || null;
    if (reason && contactKinds(reason).length) {
      this.transparency?.record('contact_refused', 'conversation');
      throw contactRefusal(contactKinds(reason));
    }
    await this.prisma.commitmentThread.update({
      where: { id: threadId },
      data: { step: 'closed', closedById: viewer.id, closedReason: reason, closedAt: new Date() },
    });
    await this.refreshCardStatus(thread.cardId);
    await this.notify(otherId, `“${thread.card.title}” was closed`, reason ?? 'The other person stepped back.', this.threadLink(thread.cardId, threadId));
    return { ok: true, step: 'closed' };
  }
}
