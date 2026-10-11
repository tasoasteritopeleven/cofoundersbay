import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  SKILL_EVIDENCE_LIMITS,
  isLinkableEvidenceKind,
  sameSkill,
  type LinkableEvidenceKind,
  type SkillEvidenceKind,
} from '@cofounderbay/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Skills with evidence (rules in `@cofounderbay/shared` evidence).
 *
 * A person links a skill to something they did here — a completed
 * milestone, a document in one of their builder workspaces, an agreed
 * commitment — and approved endorsements naming the skill count too. The
 * server checks each link against the person's own records and copies the
 * title, so a link can never point at someone else's work.
 */

export interface EvidenceCandidate {
  kind: LinkableEvidenceKind;
  refId: string;
  label: string;
  at: string;
}

function refusal(reason: string, message: string, messageEl: string) {
  return new BadRequestException({ success: false, error: { code: 'VALIDATION_ERROR', message, details: { reason, messageEl } } });
}

@Injectable()
export class SkillEvidenceService {
  constructor(private readonly prisma: PrismaService) {}

  /** What this person may link: their own completed milestones, builder documents and agreed commitments. */
  async candidates(userId: string): Promise<{ candidates: EvidenceCandidate[] }> {
    const [milestones, documents, threads] = await Promise.all([
      this.prisma.milestone.findMany({
        where: { status: 'completed', OR: [{ ownerId: userId }, { collaboratorId: userId }] },
        select: { id: true, title: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
      this.prisma.builderDocument.findMany({
        where: { workspace: { ownerId: userId } },
        select: { id: true, title: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
      this.prisma.commitmentThread.findMany({
        where: { agreedAt: { not: null }, OR: [{ candidateId: userId }, { card: { ownerId: userId } }] },
        select: { id: true, agreedAt: true, card: { select: { title: true } } },
        orderBy: { agreedAt: 'desc' },
        take: 50,
      }),
    ]);
    return {
      candidates: [
        ...milestones.map((m) => ({ kind: 'milestone' as const, refId: m.id, label: m.title, at: m.updatedAt.toISOString() })),
        ...documents.map((d) => ({ kind: 'builder_document' as const, refId: d.id, label: d.title, at: d.updatedAt.toISOString() })),
        ...threads.map((t) => ({ kind: 'agreement' as const, refId: t.id, label: t.card.title, at: (t.agreedAt ?? new Date()).toISOString() })),
      ],
    };
  }

  /** A person's skills, each with the evidence behind it. Signed-in viewers see the same thing the owner does. */
  async forUser(userId: string) {
    const [profile, links, endorsements] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId }, select: { skills: { select: { skill: { select: { name: true } } } } } }),
      this.prisma.skillEvidence.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.endorsement.findMany({
        where: { toUserId: userId, isApproved: true, isPublic: true, skill: { not: null } },
        select: { skill: true, basis: true },
      }),
    ]);
    const names: string[] = [];
    const add = (name: string | null | undefined) => {
      const n = (name ?? '').trim();
      if (n && !names.some((x) => sameSkill(x, n))) names.push(n);
    };
    profile?.skills.forEach((s) => add(s.skill.name));
    links.forEach((l) => add(l.skillName));
    endorsements.forEach((e) => add(e.skill));
    return {
      skills: names.map((name) => {
        const ends = endorsements.filter((e) => e.skill && sameSkill(e.skill, name));
        return {
          name,
          evidence: links
            .filter((l) => sameSkill(l.skillName, name))
            .map((l) => ({ id: l.id, kind: l.kind as SkillEvidenceKind, refId: l.refId, label: l.label, at: l.createdAt.toISOString() })),
          endorsements: ends.length,
          verifiedEndorsements: ends.filter((e) => (e.basis ?? []).length > 0).length,
        };
      }),
    };
  }

  async link(userId: string, body: unknown) {
    const b = (body ?? {}) as Record<string, unknown>;
    const skillName = typeof b.skillName === 'string' ? b.skillName.trim() : '';
    const kind = b.kind;
    const refId = typeof b.refId === 'string' ? b.refId : '';
    if (!skillName || skillName.length > SKILL_EVIDENCE_LIMITS.skillName) {
      throw refusal('skill_name', 'Name the skill in a few words.', 'Ονομάστε τη δεξιότητα σε λίγες λέξεις.');
    }
    if (!isLinkableEvidenceKind(kind) || !refId) throw refusal('evidence', 'Choose a milestone, a builder document or an agreed commitment.', 'Επιλέξτε ορόσημο, έγγραφο του builder ή συμφωνημένη δέσμευση.');
    const { candidates } = await this.candidates(userId);
    const target = candidates.find((c) => c.kind === kind && c.refId === refId);
    if (!target) throw new NotFoundException('That is not one of your completed items');
    const existing = await this.prisma.skillEvidence.findMany({ where: { userId }, select: { skillName: true, kind: true, refId: true } });
    const forSkill = existing.filter((e) => sameSkill(e.skillName, skillName));
    if (forSkill.some((e) => e.kind === kind && e.refId === refId)) throw new ConflictException('Already linked to this skill');
    if (forSkill.length >= SKILL_EVIDENCE_LIMITS.perSkill) {
      throw refusal(
        'too_many',
        `Up to ${SKILL_EVIDENCE_LIMITS.perSkill} pieces of evidence per skill: keep the strongest.`,
        `Έως ${SKILL_EVIDENCE_LIMITS.perSkill} τεκμήρια ανά δεξιότητα: κρατήστε τα πιο δυνατά.`,
      );
    }
    // The existing spelling wins, so one skill does not split in two.
    const name = forSkill[0]?.skillName ?? skillName;
    const row = await this.prisma.skillEvidence.create({ data: { userId, skillName: name, kind, refId, label: target.label } });
    return { evidence: { id: row.id, skillName: row.skillName, kind: row.kind as SkillEvidenceKind, refId: row.refId, label: row.label, at: row.createdAt.toISOString() } };
  }

  async unlink(userId: string, id: string) {
    const row = await this.prisma.skillEvidence.findUnique({ where: { id } });
    if (!row || row.userId !== userId) throw new NotFoundException('Evidence not found');
    await this.prisma.skillEvidence.delete({ where: { id } });
    return { ok: true, restore: { skillName: row.skillName, kind: row.kind, refId: row.refId } };
  }
}
