import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import {
  INTRO_LIMITS,
  INTRO_PROBLEM_COPY,
  OPEN_INTRO_STATUSES,
  acceptsInterest,
  introPaths,
  introStatusForRequester,
  introTransition,
  knowsDirectly,
  readForwardNote,
  readIntroRequest,
  type CommitmentOutcome,
  type IntroAction,
  type IntroGraph,
  type IntroProblem,
  type IntroRole,
  type IntroStatus,
  ROLE_VERIFICATION_COPY,
} from '@cofounderbay/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CommitmentsService } from '../commitments/commitments.service';
import { VerificationService } from '../verification/verification.service';
import { TransparencyService } from '../transparency/transparency.service';

/**
 * Warm introductions (rules in `@cofounderbay/shared` intros).
 *
 * A founder asks someone they know to introduce them to someone that person
 * knows, for one of the founder's own need cards. The intermediary forwards
 * or declines; the person introduced accepts or says not now. Accepting is
 * expressing interest on the card through `CommitmentsService`, so the
 * ladder's own rules apply from there (protected conversation, then terms).
 *
 * The target never learns of a request the intermediary declined, and the
 * founder is told only "not forwarded".
 */

const personSelect = { id: true, profile: { select: { displayName: true, headline: true, avatarUrl: true } } } as const;
type PersonRow = { id: string; profile: { displayName: string | null; headline: string | null; avatarUrl: string | null } | null };
const person = (p: PersonRow | undefined) => ({
  id: p?.id ?? '',
  displayName: p?.profile?.displayName ?? 'Member',
  headline: p?.profile?.headline ?? null,
  avatarUrl: p?.profile?.avatarUrl ?? null,
});

type IntroRow = {
  id: string;
  requesterId: string;
  intermediaryId: string;
  targetId: string;
  cardId: string;
  note: string;
  forwardNote: string | null;
  status: IntroStatus;
  toRequester: string[];
  toTarget: string[];
  threadId: string | null;
  decidedAt: Date | null;
  createdAt: Date;
};

function introRefusal(problems: IntroProblem[]) {
  return new BadRequestException({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: problems.map((p) => INTRO_PROBLEM_COPY[p].en).join(' '),
      details: { reason: 'intro_invalid', problems, messageEl: problems.map((p) => INTRO_PROBLEM_COPY[p].el).join(' ') },
    },
  });
}

function refusal(reason: string, message: string, messageEl: string) {
  return new BadRequestException({ success: false, error: { code: 'VALIDATION_ERROR', message, details: { reason, messageEl } } });
}

/** Mentoring that happened or is happening counts; a request never answered does not. */
const MENTORING_STATUSES = ['active', 'paused', 'completed'] as const;

@Injectable()
export class IntrosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Inject(CommitmentsService) private readonly commitments: Pick<CommitmentsService, 'expressInterest'>,
    @Inject(VerificationService) private readonly verification: Pick<VerificationService, 'publicMethods' | 'roleCleared'>,
    @Optional() @Inject(TransparencyService) private readonly transparency?: Pick<TransparencyService, 'record'>,
  ) {}

  private countIntroRefusal(problems: readonly string[]) {
    if (problems.includes('contact')) this.transparency?.record('contact_refused', 'intro');
    if (problems.includes('promise')) this.transparency?.record('promise_refused', 'intro');
  }

  /** The edges that touch either person: enough to find everyone who knows both. */
  async graphAround(a: string, b: string): Promise<IntroGraph> {
    const ids = [a, b];
    const [connections, mentorships, memberships] = await Promise.all([
      this.prisma.connectionRequest.findMany({
        where: { status: 'accepted', OR: [{ requesterId: { in: ids } }, { receiverId: { in: ids } }] },
        select: { requesterId: true, receiverId: true },
      }),
      this.prisma.mentorshipRelationship.findMany({
        where: { status: { in: [...MENTORING_STATUSES] }, OR: [{ mentorId: { in: ids } }, { menteeId: { in: ids } }] },
        select: { mentorId: true, menteeId: true },
      }),
      this.prisma.cohortMember.findMany({ where: { userId: { in: ids } }, select: { cohortId: true } }),
    ]);
    const cohortIds = [...new Set(memberships.map((m) => m.cohortId))];
    const cohorts = cohortIds.length
      ? await this.prisma.cohortMember.findMany({ where: { cohortId: { in: cohortIds } }, select: { cohortId: true, userId: true } })
      : [];
    return {
      connections: connections.map((c) => [c.requesterId, c.receiverId] as const),
      mentorships,
      cohorts,
    };
  }

  private async people(ids: string[]) {
    const rows = await this.prisma.user.findMany({ where: { id: { in: [...new Set(ids)] } }, select: personSelect });
    return new Map(rows.map((r) => [r.id, person(r as PersonRow)]));
  }

  /** The founder's own cards that can still take interest. */
  private async openCards(ownerId: string) {
    const cards = await this.prisma.commitmentCard.findMany({
      where: { ownerId },
      select: { id: true, title: true, kind: true, status: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return cards.filter((c) => acceptsInterest(c.status as CommitmentOutcome)).map(({ id, title, kind }) => ({ id, title, kind }));
  }

  /** Who could introduce the founder to `targetId`, and for which card. */
  async paths(requesterId: string, targetId: string) {
    if (!targetId || targetId === requesterId) throw new BadRequestException('Choose someone other than yourself');
    const graph = await this.graphAround(requesterId, targetId);
    const found = introPaths(graph, requesterId, targetId);
    const names = await this.people(found.map((p) => p.intermediaryId));
    return {
      direct: knowsDirectly(graph, requesterId, targetId),
      paths: found.slice(0, 8).map((p) => ({ intermediary: names.get(p.intermediaryId) ?? person(undefined), toRequester: p.toRequester, toTarget: p.toTarget })),
      cards: await this.openCards(requesterId),
    };
  }

  private shape(row: IntroRow, viewerId: string, names: Map<string, ReturnType<typeof person>>, cardTitles: Map<string, string>) {
    const role: IntroRole = row.requesterId === viewerId ? 'requester' : row.intermediaryId === viewerId ? 'intermediary' : 'target';
    return {
      id: row.id,
      role,
      // The founder sees "not forwarded"; the other two see what happened.
      status: role === 'requester' ? introStatusForRequester(row.status) : row.status,
      requester: names.get(row.requesterId) ?? person(undefined),
      intermediary: names.get(row.intermediaryId) ?? person(undefined),
      target: names.get(row.targetId) ?? person(undefined),
      card: { id: row.cardId, title: cardTitles.get(row.cardId) ?? '' },
      note: row.note,
      forwardNote: row.forwardNote,
      toRequester: row.toRequester,
      toTarget: row.toTarget,
      threadId: role === 'intermediary' ? null : row.threadId,
      createdAt: row.createdAt.toISOString(),
      decidedAt: row.decidedAt?.toISOString() ?? null,
    };
  }

  private async shapeAll(rows: IntroRow[], viewerId: string) {
    const names = await this.people(rows.flatMap((r) => [r.requesterId, r.intermediaryId, r.targetId]));
    const cards = rows.length
      ? await this.prisma.commitmentCard.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.cardId))] } }, select: { id: true, title: true } })
      : [];
    const titles = new Map(cards.map((c) => [c.id, c.title]));
    return rows.map((r) => this.shape(r, viewerId, names, titles));
  }

  /** Everything the viewer is part of, from where they stand. */
  async list(viewerId: string) {
    const rows = (await this.prisma.introRequest.findMany({
      where: {
        OR: [
          { requesterId: viewerId },
          { intermediaryId: viewerId },
          // The person introduced sees a request only once it was forwarded.
          { targetId: viewerId, status: { in: ['forwarded', 'accepted', 'not_now'] } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })) as IntroRow[];
    const shaped = await this.shapeAll(rows, viewerId);
    return {
      sent: shaped.filter((i) => i.role === 'requester'),
      toForward: shaped.filter((i) => i.role === 'intermediary'),
      received: shaped.filter((i) => i.role === 'target'),
    };
  }

  async request(requesterId: string, body: unknown) {
    const read = readIntroRequest(body, requesterId);
    if (!read.ok) {
      this.countIntroRefusal(read.problems);
      throw introRefusal(read.problems);
    }
    const { intermediaryId, targetId, cardId, note } = read.value;

    const card = await this.prisma.commitmentCard.findUnique({ where: { id: cardId }, select: { id: true, ownerId: true, title: true, status: true } });
    if (!card || card.ownerId !== requesterId) throw new NotFoundException('Need card not found');
    if (!acceptsInterest(card.status as CommitmentOutcome)) throw new ConflictException('This card is not taking interest any more');

    const graph = await this.graphAround(requesterId, targetId);
    const path = introPaths(graph, requesterId, targetId).find((p) => p.intermediaryId === intermediaryId);
    if (!path) {
      throw refusal('no_path', 'That person does not know both of you on CoFounderBay, so they cannot introduce you.', 'Αυτό το πρόσωπο δεν γνωρίζει και τους δύο στο CoFounderBay, οπότε δεν μπορεί να σας συστήσει.');
    }

    const open = await this.prisma.introRequest.findMany({
      where: { requesterId, status: { in: [...OPEN_INTRO_STATUSES] } },
      select: { targetId: true, cardId: true },
    });
    if (open.some((o) => o.targetId === targetId && o.cardId === cardId)) throw new ConflictException('You already asked for this introduction');
    if (open.length >= INTRO_LIMITS.openPerRequester) {
      throw refusal(
        'too_many_open',
        `You have ${INTRO_LIMITS.openPerRequester} introductions waiting. Wait for an answer or withdraw one first.`,
        `Έχετε ${INTRO_LIMITS.openPerRequester} συστάσεις σε αναμονή. Περιμένετε μια απάντηση ή αποσύρετε μία πρώτα.`,
      );
    }
    const onLadder = await this.prisma.commitmentThread.findUnique({ where: { cardId_candidateId: { cardId, candidateId: targetId } } });
    if (onLadder) throw new ConflictException('They have already answered this card');

    const row = (await this.prisma.introRequest.create({
      data: { requesterId, intermediaryId, targetId, cardId, note, toRequester: path.toRequester, toTarget: path.toTarget },
    })) as IntroRow;
    const names = await this.people([requesterId, targetId]);
    await this.notify(
      intermediaryId,
      `${names.get(requesterId)?.displayName ?? 'Someone'} asks you for an introduction to ${names.get(targetId)?.displayName ?? 'someone you know'}`,
      'You decide whether to forward it. Nobody is told why if you do not.',
      `/intros?tab=forward&intro=${row.id}`,
    );
    return { intro: (await this.shapeAll([row], requesterId))[0] };
  }

  private async load(id: string): Promise<IntroRow> {
    const row = (await this.prisma.introRequest.findUnique({ where: { id } })) as IntroRow | null;
    if (!row) throw new NotFoundException('Introduction not found');
    return row;
  }

  private roleOf(row: IntroRow, viewerId: string): IntroRole | null {
    if (row.requesterId === viewerId) return 'requester';
    if (row.intermediaryId === viewerId) return 'intermediary';
    // A target who was never forwarded the request is not part of it.
    if (row.targetId === viewerId && row.status !== 'pending' && row.status !== 'declined' && row.status !== 'withdrawn') return 'target';
    return null;
  }

  private async move(viewerId: string, id: string, action: IntroAction, extra: Partial<IntroRow> = {}) {
    const row = await this.load(id);
    const role = this.roleOf(row, viewerId);
    if (!role) throw new NotFoundException('Introduction not found');
    const next = introTransition(row.status, role, action);
    if (!next) throw new ForbiddenException('That step is not yours to take now');
    const updated = (await this.prisma.introRequest.update({
      where: { id },
      data: { status: next, decidedAt: new Date(), ...extra },
    })) as IntroRow;
    return { row: updated, before: row };
  }

  /** The founder takes back a request the intermediary has not answered; the intermediary was already notified. */
  async withdraw(requesterId: string, id: string) {
    const { row } = await this.move(requesterId, id, 'withdraw');
    return { intro: (await this.shapeAll([row], requesterId))[0] };
  }

  async forward(intermediaryId: string, id: string, body: unknown) {
    const note = readForwardNote(body);
    if (!note.ok) {
      this.countIntroRefusal(note.problems);
      throw introRefusal(note.problems);
    }
    const { row } = await this.move(intermediaryId, id, 'forward', { forwardNote: note.value });
    const names = await this.people([row.requesterId, intermediaryId]);
    await this.notify(
      row.targetId,
      `${names.get(intermediaryId)?.displayName ?? 'Someone you know'} introduces you to ${names.get(row.requesterId)?.displayName ?? 'a founder'}`,
      note.value ?? 'Accept to start a protected conversation on their need card, or say not now.',
      `/intros?tab=received&intro=${row.id}`,
    );
    await this.notify(row.requesterId, 'Your introduction was forwarded', 'They will see your card and decide.', `/intros?intro=${row.id}`);
    return { intro: (await this.shapeAll([row], intermediaryId))[0] };
  }

  /** The founder hears "not forwarded", nothing more; the target never hears of it. */
  async decline(intermediaryId: string, id: string) {
    const { row } = await this.move(intermediaryId, id, 'decline');
    await this.notify(row.requesterId, 'An introduction was not forwarded', 'Try someone else who knows them, or answer on the card directly.', `/intros?intro=${row.id}`);
    return { intro: (await this.shapeAll([row], intermediaryId))[0] };
  }

  /** Accepting is interest on the founder's card: the ladder takes it from here. */
  async accept(targetId: string, id: string) {
    const before = await this.load(id);
    if (this.roleOf(before, targetId) !== 'target' || !introTransition(before.status, 'target', 'accept')) {
      throw new ForbiddenException('That step is not yours to take now');
    }
    // An investor or organisation account verifies its workplace before it
    // takes up an introduction (the founder is told nothing either way).
    if (process.env.COMMITMENT_VERIFICATION !== 'off' && !(await this.verification.roleCleared(targetId))) {
      throw refusal('role_verification_required', ROLE_VERIFICATION_COPY.en, ROLE_VERIFICATION_COPY.el);
    }
    const names = await this.people([before.intermediaryId]);
    const { thread } = await this.commitments.expressInterest({ id: targetId }, before.cardId, {
      note: `Introduced by ${names.get(before.intermediaryId)?.displayName ?? 'a member'}.`,
    });
    const { row } = await this.move(targetId, id, 'accept', { threadId: thread.id });
    await this.notify(row.intermediaryId, 'Your introduction was accepted', 'They are talking on the need card now.', `/intros?tab=forward&intro=${row.id}`);
    return { intro: (await this.shapeAll([row], targetId))[0], threadId: thread.id, cardId: row.cardId };
  }

  async notNow(targetId: string, id: string) {
    const { row } = await this.move(targetId, id, 'not_now');
    await this.notify(row.requesterId, 'Not now, for an introduction', 'The person you were introduced to is not taking this up at the moment.', `/intros?intro=${row.id}`);
    return { intro: (await this.shapeAll([row], targetId))[0] };
  }

  /** The verification methods of the founder, for the person deciding whether to accept. */
  async requesterMethods(id: string, viewerId: string) {
    const row = await this.load(id);
    if (!this.roleOf(row, viewerId)) throw new NotFoundException('Introduction not found');
    return { methods: await this.verification.publicMethods(row.requesterId) };
  }

  private async notify(userId: string, title: string, body: string, link: string) {
    await this.notifications.createNotification({ userId, type: 'intro_request', title, body, link }).catch(() => undefined);
  }
}
