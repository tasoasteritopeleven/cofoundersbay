import { beforeEach, describe, expect, it } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommitmentsService } from './commitments.service';
import { createFakePrisma } from './fake-prisma';

/**
 * The commitment ladder, walked end to end against an in-memory database.
 *
 * Elena publishes a card; Marcus answers it; the two talk without contact
 * details, confirm separately, version terms and agree. Each rule the
 * product states is asserted where it bites: who may act, what is refused,
 * what the other side can and cannot see, and what each reversal restores.
 */

const ELENA = { id: 'u-elena' };
const MARCUS = { id: 'u-marcus' };
const SOFIA = { id: 'u-sofia' };

const CARD = {
  kind: 'cofounder',
  title: 'Technical co-founder for Harbor',
  exists: 'A working founder workspace with $375K of a $750K seed committed.',
  goal: 'Ship the workspace to the first twenty paying teams this year.',
  missing: 'A technical co-founder who has taken a real-time product to production.',
  offerRole: 'CTO and co-founder',
  offerEquity: '10–15%',
  offerHours: 40,
  offerScope: 'Own the platform and hire the first two engineers.',
  category: 'B2B SaaS',
  place: 'Athens, Greece',
  isRemote: false,
  stage: 'building',
  commitment: 'full_time',
  projectRef: '1',
};

const TERMS = { role: 'CTO', equityPct: 10, vestingMonths: 48, cliffMonths: 12, hoursPerWeek: 40, scope: 'Platform and the first two hires' };

function refusalDetails(error: unknown) {
  const body = (error as BadRequestException).getResponse() as { error?: { details?: Record<string, unknown> } };
  return body?.error?.details ?? {};
}

describe('CommitmentsService', () => {
  let fake: ReturnType<typeof createFakePrisma>;
  let service: CommitmentsService;
  let verified: Set<string>;
  let roleBlocked: Set<string>;

  beforeEach(() => {
    fake = createFakePrisma();
    fake.addUser(ELENA.id, 'Elena Papadopoulos', { email: 'elena@harbor.test', emailVerified: true, milestonesCompleted: 3, endorsements: 2 });
    fake.addUser(MARCUS.id, 'Marcus Chen');
    fake.addUser(SOFIA.id, 'Sofia Alexiou');
    verified = new Set([ELENA.id, MARCUS.id, SOFIA.id]);
    roleBlocked = new Set();
    service = new CommitmentsService(fake.prisma as never, fake.notifications as never, {
      isVerified: async (id: string) => verified.has(id),
      publicMethods: async (id: string) => (verified.has(id) ? ['work_email'] : []),
      roleCleared: async (id: string) => !roleBlocked.has(id),
    });
  });

  async function publish() {
    const { card } = await service.createCard(ELENA, CARD);
    return card;
  }

  async function toConversation() {
    const card = await publish();
    const { thread } = await service.expressInterest(MARCUS, card.id, { note: 'I shipped a real-time trading platform.' });
    await service.acceptInterest(ELENA, thread.id);
    return { card, threadId: thread.id };
  }

  async function toTerms() {
    const { card, threadId } = await toConversation();
    await service.confirm(ELENA, threadId);
    await service.confirm(MARCUS, threadId);
    return { card, threadId };
  }

  describe('publishing', () => {
    it('publishes a complete card with evidence from the owner’s own records', async () => {
      const card = await publish();
      expect(card.outcome).toBe('open');
      expect(card.version).toBe(1);
      expect(card.evidence).toEqual([
        { id: 'milestones_completed', count: 3 },
        { id: 'endorsements', count: 2 },
        { id: 'email_verified', value: true },
      ]);
      expect(fake.db.cards[0].expiresAt).toBeInstanceOf(Date);
    });

    it('refuses an incomplete card and names the failing checks', async () => {
      const error = await service.createCard(ELENA, { ...CARD, missing: 'A CTO' }).catch((e) => e);
      expect(error).toBeInstanceOf(BadRequestException);
      expect(refusalDetails(error)).toMatchObject({ reason: 'card_incomplete', failing: ['missing'] });
    });

    it('refuses contact details on the card', async () => {
      const error = await service.createCard(ELENA, { ...CARD, offerScope: 'Own the platform; write to elena@harbor.io' }).catch((e) => e);
      expect(refusalDetails(error)).toMatchObject({ reason: 'card_incomplete', kinds: ['email'] });
    });

    it('makes an offer change a new version and keeps the old offer', async () => {
      const card = await publish();
      const result = await service.updateCard(ELENA, card.id, { offerEquity: '12–15%' });
      expect(result.newVersion).toBe(true);
      expect(result.card.version).toBe(2);
      expect(fake.db.cards[0].history).toEqual([expect.objectContaining({ version: 1, changed: ['offerEquity'], offer: expect.objectContaining({ equity: '10–15%' }) })]);
      const wording = await service.updateCard(ELENA, card.id, { title: 'CTO for Harbor' });
      expect(wording.newVersion).toBe(false);
      expect(wording.card.version).toBe(2);
    });

    it('lets only the author edit, close or share', async () => {
      const card = await publish();
      await expect(service.updateCard(MARCUS, card.id, { title: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.closeCard(MARCUS, card.id, 'filled')).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.shareCard(MARCUS, card.id)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('filters by kind, stage, place and project', async () => {
      await publish();
      expect((await service.listCards(MARCUS, { stage: 'building', place: 'athens' })).cards).toHaveLength(1);
      // A place in either language, as the wall's chip and the saved-search alert send it.
      expect((await service.listCards(MARCUS, { place: 'Αθήνα' })).cards).toHaveLength(1);
      expect((await service.listCards(MARCUS, { place: 'Αθήνα', q: 'nowhere-in-the-card' })).cards).toHaveLength(0);
      expect((await service.listCards(MARCUS, { stage: 'idea' })).cards).toHaveLength(0);
      expect((await service.listCards(MARCUS, { projectRefs: ['1', '9'] })).cards).toHaveLength(1);
      expect((await service.listCards(MARCUS, { mine: true })).cards).toHaveLength(0);
      // One member's cards, for their profile's Activity.
      const [card] = (await service.listCards(MARCUS, {})).cards;
      expect((await service.listCards(MARCUS, { owner: card.owner.id })).cards).toHaveLength(1);
      expect((await service.listCards(MARCUS, { owner: 'someone-else' })).cards).toHaveLength(0);
    });

    it('expires an open card that went quiet, on read', async () => {
      const card = await publish();
      fake.db.cards[0].expiresAt = new Date(Date.now() - 1000);
      const { card: read } = await service.getCard(MARCUS, card.id);
      expect(read.outcome).toBe('closed');
      expect(read.closedReason).toBe('expired');
      expect(read.settledAt).not.toBeNull();
    });
  });

  describe('closing and reopening', () => {
    it('restores exactly the outcome the card had, touching no thread and notifying nobody', async () => {
      const { card } = await toConversation();
      const before = fake.db.notifications.length;
      const closed = await service.closeCard(ELENA, card.id, 'filled');
      expect(closed).toMatchObject({ outcome: 'closed', closedReason: 'filled', previousOutcome: 'in_discussion' });
      expect(fake.db.threads[0].step).toBe('conversation');
      const expiresBefore = fake.db.cards[0].expiresAt;
      const { card: reopened } = await service.reopenCard(ELENA, card.id);
      expect(fake.db.cards[0].expiresAt).toBe(expiresBefore);
      expect(reopened.outcome).toBe('in_discussion');
      expect(reopened.closedReason).toBeNull();
      expect(reopened.settledAt).toBeNull();
      expect(fake.db.notifications.length).toBe(before);
    });

    it('takes no interest while closed', async () => {
      const card = await publish();
      await service.closeCard(ELENA, card.id, 'withdrawn');
      await expect(service.expressInterest(MARCUS, card.id, {})).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('the public card', () => {
    it('creates one token, then returns the same one', async () => {
      const card = await publish();
      const first = await service.shareCard(ELENA, card.id);
      const second = await service.shareCard(ELENA, card.id);
      expect(first.created).toBe(true);
      expect(second).toEqual({ token: first.token, created: false });
    });

    it('shows the card, the author’s name and nothing that reaches them outside the platform', async () => {
      const card = await publish();
      const { token } = await service.shareCard(ELENA, card.id);
      const { card: open } = await service.getPublicCard(token);
      expect(open.title).toBe(CARD.title);
      // The badge says how she is verified, never the domain or the date.
      expect(open.owner).toEqual({ displayName: 'Elena Papadopoulos', headline: null, avatarUrl: null, verifiedMethods: ['work_email'] });
      const serialised = JSON.stringify(open);
      for (const leak of ['u-elena', 'projectRef', 'shareToken', token, 'elena@harbor.test']) {
        expect(serialised).not.toContain(leak);
      }
    });

    it('carries the author’s verification live, on the board and on the public card', async () => {
      const card = await publish();
      expect((await service.getCard(MARCUS, card.id)).card.owner.verifiedMethods).toEqual(['work_email']);
      expect((await service.listCards(MARCUS, {})).cards[0].owner.verifiedMethods).toEqual(['work_email']);
      // A signal that lapses after the card was written is not shown.
      verified.delete(ELENA.id);
      expect((await service.getCard(MARCUS, card.id)).card.owner.verifiedMethods).toEqual([]);
      const { token } = await service.shareCard(ELENA, card.id);
      expect((await service.getPublicCard(token)).card.owner.verifiedMethods).toEqual([]);
    });

    it('stops working the moment it is revoked', async () => {
      const card = await publish();
      const { token } = await service.shareCard(ELENA, card.id);
      await service.revokeShare(ELENA, card.id);
      await expect(service.getPublicCard(token)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('never tells anyone but the author the token', async () => {
      const card = await publish();
      await service.shareCard(ELENA, card.id);
      const { card: asMarcus } = await service.getCard(MARCUS, card.id);
      expect(asMarcus.shareToken).toBeNull();
      expect(asMarcus.shared).toBe(true);
    });
  });

  describe('interest', () => {
    it('notifies the author and lets the candidate withdraw until it is accepted', async () => {
      const card = await publish();
      const { thread } = await service.expressInterest(MARCUS, card.id, { note: 'Keen to talk.' });
      expect(fake.db.notifications.at(-1)).toMatchObject({ userId: ELENA.id, type: 'commitment_update' });
      await expect(service.withdrawInterest(ELENA, thread.id)).rejects.toBeInstanceOf(ForbiddenException);
      await service.withdrawInterest(MARCUS, thread.id);
      expect(fake.db.threads).toHaveLength(0);
    });

    it('cannot be withdrawn once the author has answered', async () => {
      const { threadId } = await toConversation();
      await expect(service.withdrawInterest(MARCUS, threadId)).rejects.toBeInstanceOf(ConflictException);
    });

    it('keeps at most five answers waiting on authors, and frees a place when one is accepted', async () => {
      const cards = [];
      for (let i = 0; i < 6; i++) cards.push(await publish());
      for (let i = 0; i < 5; i++) await service.expressInterest(MARCUS, cards[i].id, {});
      expect(await service.interestBudget(MARCUS)).toEqual({ budget: 5, waiting: 5, left: 0 });
      const refused = await service.expressInterest(MARCUS, cards[5].id, {}).catch((e) => e);
      expect(refusalDetails(refused)).toMatchObject({ reason: 'interest_budget', budget: 5, waiting: 5, messageEl: expect.stringContaining('απαντήσεις') });
      const [first] = await fake.prisma.commitmentThread.findMany({ where: { candidateId: MARCUS.id } });
      await service.acceptInterest(ELENA, first.id);
      expect((await service.interestBudget(MARCUS)).left).toBe(1);
      await expect(service.expressInterest(MARCUS, cards[5].id, {})).resolves.toBeDefined();
    });

    it('refuses one’s own card, a second answer and contact details in the note', async () => {
      const card = await publish();
      await expect(service.expressInterest(ELENA, card.id, {})).rejects.toBeInstanceOf(BadRequestException);
      const error = await service.expressInterest(MARCUS, card.id, { note: 'viber me on 6912345678' }).catch((e) => e);
      expect(refusalDetails(error)).toMatchObject({ reason: 'contact_details', kinds: ['phone', 'messenger'] });
      await service.expressInterest(MARCUS, card.id, {});
      await expect(service.expressInterest(MARCUS, card.id, {})).rejects.toBeInstanceOf(ConflictException);
    });

    it('is accepted by the author only, which opens the conversation and the discussion', async () => {
      const card = await publish();
      const { thread } = await service.expressInterest(MARCUS, card.id, {});
      await expect(service.acceptInterest(MARCUS, thread.id)).rejects.toBeInstanceOf(ForbiddenException);
      await service.acceptInterest(ELENA, thread.id);
      expect(fake.db.threads[0].step).toBe('conversation');
      expect(fake.db.cards[0].status).toBe('in_discussion');
    });
  });

  describe('the protected conversation', () => {
    it('refuses contact details, names the kinds in both languages, and stores nothing', async () => {
      const { threadId } = await toConversation();
      const error = await service.sendMessage(MARCUS, threadId, { body: 'Easier on WhatsApp: +30 691 234 5678' }).catch((e) => e);
      expect(error).toBeInstanceOf(BadRequestException);
      const details = refusalDetails(error);
      expect(details.kinds).toEqual(['phone', 'messenger']);
      expect(String(details.messageEl)).toContain('αριθμό τηλεφώνου');
      expect(fake.db.messages).toHaveLength(0);
    });

    it('keeps outsiders out', async () => {
      const { threadId } = await toConversation();
      await expect(service.getThread(SOFIA, threadId)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.sendMessage(SOFIA, threadId, { body: 'hi' })).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('cannot start before the author accepts', async () => {
      const card = await publish();
      const { thread } = await service.expressInterest(MARCUS, card.id, {});
      await expect(service.sendMessage(MARCUS, thread.id, { body: 'Hello there' })).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('confirmation', () => {
    it('is blind: the other side learns nothing until both have confirmed', async () => {
      const { threadId } = await toConversation();
      const notesBefore = fake.db.notifications.length;
      const first = await service.confirm(ELENA, threadId);
      expect(first).toEqual({ ok: true, bothConfirmed: false, step: 'conversation' });
      expect(fake.db.notifications.length).toBe(notesBefore);
      const asMarcus = await service.getThread(MARCUS, threadId);
      expect(asMarcus.thread.myConfirmed).toBe(false);
      expect(asMarcus.thread.bothConfirmed).toBe(false);
      expect(JSON.stringify(asMarcus)).not.toContain('ownerConfirmedAt');
    });

    it('can be taken back while the other has not confirmed, not after', async () => {
      const { threadId } = await toConversation();
      await service.confirm(ELENA, threadId);
      await service.retractConfirmation(ELENA, threadId);
      expect(fake.db.threads[0].ownerConfirmedAt).toBeNull();
      await service.confirm(ELENA, threadId);
      await service.confirm(MARCUS, threadId);
      await expect(service.retractConfirmation(ELENA, threadId)).rejects.toBeInstanceOf(ConflictException);
    });

    it('opens the terms space when both confirm and makes the first conversation read-only', async () => {
      const { threadId } = await toTerms();
      expect(fake.db.threads[0].step).toBe('terms');
      const view = await service.getThread(MARCUS, threadId);
      expect(view.thread.conversationReadOnly).toBe(true);
      await expect(service.sendMessage(MARCUS, threadId, { body: 'One more thing' })).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('terms', () => {
    it('cannot be proposed before both confirm', async () => {
      const { threadId } = await toConversation();
      await expect(service.proposeTerms(ELENA, threadId, TERMS)).rejects.toBeInstanceOf(ConflictException);
    });

    it('versions substantive changes, edits a note in place, and stops after three revisions', async () => {
      const { threadId } = await toTerms();
      expect(await service.proposeTerms(ELENA, threadId, TERMS)).toMatchObject({ version: 1, substantive: true, revisionsUsed: 0 });
      expect(await service.proposeTerms(MARCUS, threadId, { ...TERMS, note: 'Happy with these.' })).toMatchObject({ version: 1, substantive: false });
      expect(await service.proposeTerms(MARCUS, threadId, { ...TERMS, equityPct: 12 })).toMatchObject({ version: 2, revisionsUsed: 1, changed: ['equityPct'] });
      await service.proposeTerms(ELENA, threadId, { ...TERMS, equityPct: 11 });
      await service.proposeTerms(MARCUS, threadId, { ...TERMS, equityPct: 11, hoursPerWeek: 35 });
      const error = await service.proposeTerms(ELENA, threadId, { ...TERMS, equityPct: 10 }).catch((e) => e);
      expect(error).toBeInstanceOf(ConflictException);
      expect(String(error.message)).toContain('three revisions');
      expect(fake.db.terms).toHaveLength(4);
    });

    it('refuses invalid terms and contact details in them', async () => {
      const { threadId } = await toTerms();
      const bad = await service.proposeTerms(ELENA, threadId, { ...TERMS, cliffMonths: 60, vestingMonths: 24 }).catch((e) => e);
      expect(refusalDetails(bad)).toMatchObject({ reason: 'terms_invalid', problems: ['cliff_after_vesting'] });
      const leak = await service.proposeTerms(ELENA, threadId, { ...TERMS, note: 'details at harbor.io/terms' }).catch((e) => e);
      expect(refusalDetails(leak)).toMatchObject({ reason: 'contact_details', kinds: ['link'] });
    });

    it('shows each side the diff and who accepted, and agrees when both accept the latest', async () => {
      const { threadId } = await toTerms();
      await service.proposeTerms(ELENA, threadId, TERMS);
      await service.proposeTerms(MARCUS, threadId, { ...TERMS, equityPct: 12 });
      const view = await service.getThread(ELENA, threadId);
      expect(view.thread.terms[1]).toMatchObject({ version: 2, changed: ['equityPct'], acceptedByMe: false, acceptedByThem: true, isLatest: true });
      await expect(service.acceptTerms(ELENA, threadId, 1)).rejects.toBeInstanceOf(ConflictException);
      const result = await service.acceptTerms(ELENA, threadId, 2);
      expect(result).toEqual({ ok: true, agreed: true, step: 'agreed' });
      expect(fake.db.threads[0]).toMatchObject({ step: 'agreed', dealRoomActive: true });
      expect(fake.db.cards[0].status).toBe('agreed');
      expect(fake.db.cards[0].settledAt).toBeInstanceOf(Date);
    });

    it('freezes agreed terms while the deal room is open and unfreezes when it closes', async () => {
      const { threadId } = await toTerms();
      await service.proposeTerms(ELENA, threadId, TERMS);
      await service.acceptTerms(MARCUS, threadId, 1);
      const frozen = await service.proposeTerms(MARCUS, threadId, { ...TERMS, equityPct: 9 }).catch((e) => e);
      expect(String(frozen.message)).toContain('frozen');
      await expect(service.closeThread(MARCUS, threadId, {})).rejects.toBeInstanceOf(ConflictException);
      await service.closeDealRoom(MARCUS, threadId);
      expect(fake.db.threads[0]).toMatchObject({ step: 'terms', dealRoomActive: false, agreedAt: null });
      expect(fake.db.terms[0]).toMatchObject({ ownerAcceptedAt: null, candidateAcceptedAt: null });
      expect(fake.db.cards[0].status).toBe('in_discussion');
      expect(fake.db.cards[0].settledAt).toBeNull();
      expect(await service.proposeTerms(MARCUS, threadId, { ...TERMS, equityPct: 9 })).toMatchObject({ version: 2 });
    });
  });

  describe('stepping back', () => {
    it('closes the thread for both, tells the other, and recomputes the card', async () => {
      const { card, threadId } = await toConversation();
      await service.closeThread(MARCUS, threadId, { reason: 'Timing does not work for me.' });
      expect(fake.db.threads[0]).toMatchObject({ step: 'closed', closedById: MARCUS.id });
      expect(fake.db.notifications.at(-1)).toMatchObject({ userId: ELENA.id, body: 'Timing does not work for me.' });
      const { card: after } = await service.getCard(ELENA, card.id);
      expect(after.outcome).toBe('open');
    });
  });

  describe('the lists', () => {
    it('lists threads for each side with their role and the counterpart', async () => {
      await toConversation();
      const asOwner = await service.listThreads(ELENA, 'owner');
      const asCandidate = await service.listThreads(MARCUS, 'candidate');
      expect(asOwner.threads[0]).toMatchObject({ role: 'owner', step: 'conversation', counterpart: { displayName: 'Marcus Chen' } });
      expect(asCandidate.threads[0]).toMatchObject({ role: 'candidate', counterpart: { displayName: 'Elena Papadopoulos' } });
      expect((await service.listThreads(SOFIA)).threads).toHaveLength(0);
    });

    it('tells a candidate which thread is theirs on the card', async () => {
      const { card, threadId } = await toConversation();
      const { card: asMarcus } = await service.getCard(MARCUS, card.id);
      expect(asMarcus).toMatchObject({ myThreadId: threadId, myThreadStep: 'conversation', isMine: false });
      const { card: asElena } = await service.getCard(ELENA, card.id);
      expect(asElena).toMatchObject({ isMine: true, interestCount: 1, myThreadId: null });
    });
  });
  describe('verification gate', () => {
    it('lets an unverified person show interest and talk, but not propose or accept terms, and says why in both languages', async () => {
      verified.delete(MARCUS.id);
      const { threadId } = await toConversation();
      await service.sendMessage(MARCUS, threadId, { body: 'Happy to start with a pilot.' });
      await service.confirm(ELENA, threadId);
      await service.confirm(MARCUS, threadId);
      const refused = await service.proposeTerms(MARCUS, threadId, TERMS).catch((e) => e);
      expect(refused).toBeInstanceOf(BadRequestException);
      expect(refused.getResponse().error.details).toMatchObject({ reason: 'verification_required', messageEl: expect.stringContaining('Επαληθευτείτε') });
      await service.proposeTerms(ELENA, threadId, TERMS);
      await expect(service.acceptTerms(MARCUS, threadId, 1)).rejects.toBeInstanceOf(BadRequestException);
      const { thread } = await service.getThread(MARCUS, threadId);
      expect(thread.verification).toEqual({ meVerified: false, counterpartMethods: ['work_email'] });
      verified.add(MARCUS.id);
      expect(await service.acceptTerms(MARCUS, threadId, 1)).toMatchObject({ agreed: true });
    });

    it('is lifted by COMMITMENT_VERIFICATION=off', async () => {
      verified.delete(MARCUS.id);
      const { threadId } = await toTerms();
      process.env.COMMITMENT_VERIFICATION = 'off';
      try {
        expect(await service.proposeTerms(MARCUS, threadId, TERMS)).toMatchObject({ version: 1 });
      } finally {
        delete process.env.COMMITMENT_VERIFICATION;
      }
    });
  });

  describe('role verification for investor-introduction cards', () => {
    const INTRO_CARD = { ...CARD, kind: 'investor_intro', title: 'An introduction to a pre-seed fund for Harbor' };

    it('asks an investor or organisation account without a workplace signal to verify before answering', async () => {
      const { card } = await service.createCard(ELENA, INTRO_CARD);
      roleBlocked.add(MARCUS.id);
      await expect(service.expressInterest(MARCUS, card.id, { note: 'I back B2B SaaS at pre-seed.' })).rejects.toMatchObject({
        response: { error: { details: { reason: 'role_verification_required', methods: ['work_email', 'linkedin_workplace', 'admin'] } } },
      });
      roleBlocked.delete(MARCUS.id);
      const { thread } = await service.expressInterest(MARCUS, card.id, { note: 'I back B2B SaaS at pre-seed.' });
      expect(thread.step).toBe('interest');
    });

    it('leaves co-founder and equity-role cards to the ordinary progressive rule', async () => {
      const card = await publish();
      roleBlocked.add(MARCUS.id);
      const { thread } = await service.expressInterest(MARCUS, card.id, { note: 'I shipped a real-time trading platform.' });
      expect(thread.step).toBe('interest');
    });
  });
});
