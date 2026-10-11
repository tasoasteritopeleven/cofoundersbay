import { BadRequestException, Injectable, NotFoundException, Optional, Inject } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {

  SCOUT_PROBLEM_COPY,
  draftScoutNote,
  meetsLadderPolicy,
  openToShownTo,
  pickScoutProposals,
  readScoutBrief,
  scoreScoutCandidate,
  type OpenToKind,
  type OpenToSignal,
  type ScoutBrief,
  type ScoutCandidate,
  type ScoutReason,
  type VerificationMethod, isHiddenFromSearch } from '@cofounderbay/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TransparencyService } from '../transparency/transparency.service';

/**
 * The co-founder scout (rules in `@cofounderbay/shared` scout).
 *
 * It proposes and never sends: a run writes proposals to the founder's own
 * list and nothing else. Nobody it proposes is told, messaged, connected or
 * followed. Saving a proposal puts the person on the founder's shortlist,
 * the same row the Save button on a profile writes; dismissing one means the
 * scout never proposes that person again.
 */

const DAY_MS = 86_400_000;
type BriefRow = { userId: string; role: string; skills: string[]; place: string | null; remoteOk: boolean; commitment: string | null; stage: string | null; note: string | null; active: boolean; lastRunAt: Date | null };

const toBrief = (row: BriefRow): ScoutBrief => ({
  role: row.role,
  skills: row.skills,
  place: row.place,
  remoteOk: row.remoteOk,
  commitment: (row.commitment as ScoutBrief['commitment']) ?? null,
  stage: (row.stage as ScoutBrief['stage']) ?? null,
  note: row.note,
  active: row.active,
});

@Injectable()
export class ScoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Optional() @Inject(TransparencyService) private readonly transparency?: Pick<TransparencyService, 'record'>,
  ) {}

  async get(userId: string) {
    const [row, proposals] = await Promise.all([
      this.prisma.scoutBrief.findUnique({ where: { userId } }),
      this.prisma.scoutProposal.findMany({ where: { userId, status: { in: ['proposed', 'saved'] } }, orderBy: [{ score: 'desc' }, { createdAt: 'desc' }], take: 50 }),
    ]);
    const people = proposals.length
      ? await this.prisma.user.findMany({
          where: { id: { in: proposals.map((p) => p.candidateId) } },
          select: { id: true, profile: { select: { displayName: true, headline: true, avatarUrl: true, location: true } } },
        })
      : [];
    const byId = new Map(people.map((p) => [p.id, p]));
    return {
      brief: row ? toBrief(row as BriefRow) : null,
      lastRunAt: row?.lastRunAt?.toISOString() ?? null,
      proposals: proposals.map((p) => {
        const person = byId.get(p.candidateId);
        return {
          id: p.id,
          status: p.status,
          score: p.score,
          reasons: (Array.isArray(p.reasons) ? p.reasons : []) as unknown as ScoutReason[],
          draftNote: p.draftNote,
          createdAt: p.createdAt.toISOString(),
          person: {
            id: p.candidateId,
            displayName: person?.profile?.displayName ?? 'Member',
            headline: person?.profile?.headline ?? null,
            avatarUrl: person?.profile?.avatarUrl ?? null,
            location: person?.profile?.location ?? null,
          },
        };
      }),
    };
  }

  async setBrief(userId: string, body: unknown) {
    const read = readScoutBrief(body);
    if (!read.ok) {
      if (read.problems.includes('contact')) this.transparency?.record('contact_refused', 'scout_brief');
      if (read.problems.includes('promise')) this.transparency?.record('promise_refused', 'scout_brief');
      throw new BadRequestException({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: read.problems.map((p) => SCOUT_PROBLEM_COPY[p].en).join(' '),
          details: { reason: 'scout_brief_invalid', problems: read.problems, messageEl: read.problems.map((p) => SCOUT_PROBLEM_COPY[p].el).join(' ') },
        },
      });
    }
    const { value } = read;
    await this.prisma.scoutBrief.upsert({ where: { userId }, create: { userId, ...value }, update: value });
    return this.get(userId);
  }

  /** The member base as the scout reads it, without anyone already proposed to, or known by, this founder. */
  private async candidates(userId: string, now: Date): Promise<ScoutCandidate[]> {
    const [seen, connections, viewerSignals] = await Promise.all([
      this.prisma.scoutProposal.findMany({ where: { userId }, select: { candidateId: true } }),
      this.prisma.connectionRequest.findMany({
        where: { status: 'accepted', OR: [{ requesterId: userId }, { receiverId: userId }] },
        select: { requesterId: true, receiverId: true },
      }),
      this.prisma.userVerification.findMany({ where: { userId } }),
    ]);
    const skip = new Set<string>([userId, ...seen.map((s) => s.candidateId), ...connections.flatMap((c) => [c.requesterId, c.receiverId])]);
    const viewerVerified = meetsLadderPolicy(
      viewerSignals
        .filter((v) => !v.expiresAt || v.expiresAt > now)
        .map((v) => ({ method: v.method as VerificationMethod, verifiedAt: v.verifiedAt.toISOString(), expiresAt: v.expiresAt?.toISOString() ?? null })),
    );
    const pool = await this.prisma.user.findMany({
      where: { id: { notIn: [...skip] }, moderationStatus: 'active', profile: { isNot: null } },
      select: { id: true, profile: { select: { displayName: true, headline: true, location: true, visibilityRules: true, skills: { select: { skill: { select: { name: true } } } } } } },
      take: 300,
    });
    // A member who chose "Appear in search: off" is never proposed.
    const users = pool.filter((u) => !isHiddenFromSearch(u.profile?.visibilityRules));
    const ids = users.map((u) => u.id);
    const [signals, verifications] = ids.length
      ? await Promise.all([
          this.prisma.openToSignal.findMany({ where: { userId: { in: ids }, expiresAt: { gt: now } } }),
          this.prisma.userVerification.findMany({ where: { userId: { in: ids }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, select: { userId: true } }),
        ])
      : [[], []];
    const signalOf = new Map(signals.map((s) => [s.userId, { kinds: s.kinds as OpenToKind[], visibility: s.visibility, note: s.note, expiresAt: s.expiresAt.toISOString() } as OpenToSignal]));
    const verified = new Set(verifications.map((v) => v.userId));
    return users.map((u) => {
      const signal = signalOf.get(u.id);
      return {
        userId: u.id,
        displayName: u.profile?.displayName ?? 'Member',
        headline: u.profile?.headline ?? null,
        location: u.profile?.location ?? null,
        skills: u.profile?.skills.map((s) => s.skill.name) ?? [],
        openTo: signal?.kinds ?? [],
        openToVisible: openToShownTo(signal, { isOwner: false, verified: viewerVerified }, now.getTime()),
        verified: verified.has(u.id),
      };
    });
  }

  /** One pass: scores the base against the brief and writes the best few as proposals. Sends nothing. */
  async run(userId: string, now = new Date(), lang: 'en' | 'el' = 'en') {
    const row = await this.prisma.scoutBrief.findUnique({ where: { userId } });
    if (!row) {
      throw new BadRequestException({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Write a brief first: the role you are looking for.', details: { reason: 'no_brief', messageEl: 'Γράψτε πρώτα ένα σημείωμα: τον ρόλο που ψάχνετε.' } },
      });
    }
    const brief = toBrief(row as BriefRow);
    const scored = (await this.candidates(userId, now)).map((c) => ({ c, ...scoreScoutCandidate(brief, c) }));
    const picked = pickScoutProposals(scored);
    for (const p of picked) {
      await this.prisma.scoutProposal.create({
        data: { userId, candidateId: p.c.userId, score: p.score, reasons: p.reasons as unknown as Prisma.InputJsonValue, draftNote: draftScoutNote(brief, p.c, lang) },
      });
    }
    await this.prisma.scoutBrief.update({ where: { userId }, data: { lastRunAt: now } });
    return { added: picked.length, ...(await this.get(userId)) };
  }

  private async own(userId: string, id: string) {
    const row = await this.prisma.scoutProposal.findUnique({ where: { id } });
    if (!row || row.userId !== userId) throw new NotFoundException('Proposal not found');
    return row;
  }

  /** Puts the person on the founder's shortlist, as the profile's Save button does. */
  async save(userId: string, id: string) {
    const row = await this.own(userId, id);
    await this.prisma.savedProfile.upsert({
      where: { savedById_userId: { savedById: userId, userId: row.candidateId } },
      create: { savedById: userId, userId: row.candidateId },
      update: {},
    });
    await this.prisma.scoutProposal.update({ where: { id }, data: { status: 'saved' } });
    return { ok: true };
  }

  async dismiss(userId: string, id: string) {
    await this.own(userId, id);
    await this.prisma.scoutProposal.update({ where: { id }, data: { status: 'dismissed' } });
    return { ok: true };
  }

  /** Takes a dismissal back: the proposal returns exactly as it was. */
  async restore(userId: string, id: string) {
    await this.own(userId, id);
    await this.prisma.scoutProposal.update({ where: { id }, data: { status: 'proposed' } });
    return { ok: true };
  }

  /** Daily: active briefs not run for a day get a pass; the founder alone is told how many are new. */
  async runDue(now = new Date()) {
    const due = await this.prisma.scoutBrief.findMany({
      where: { active: true, OR: [{ lastRunAt: null }, { lastRunAt: { lt: new Date(now.getTime() - DAY_MS) } }] },
      select: { userId: true },
      take: 200,
    });
    let notified = 0;
    for (const { userId } of due) {
      const { added } = await this.run(userId, now).catch(() => ({ added: 0 }));
      if (added > 0) {
        notified += 1;
        await this.notifications
          .createNotification({
            userId,
            type: 'match_suggestion',
            title: `The scout found ${added} people for your brief`,
            body: 'Proposals only: nobody was contacted. Open them, save, ask for an introduction or dismiss.',
            link: '/scout',
          })
          .catch(() => undefined);
      }
    }
    return { checked: due.length, notified };
  }
}

