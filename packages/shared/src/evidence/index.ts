/**
 * Reputation with evidence behind it.
 *
 * LinkedIn's recommendations do not check that two people worked together,
 * and an endorsement is one click from anyone. Here an endorsement carries a
 * *basis* when the platform can see the relationship it speaks to — a
 * commitment ladder that reached agreed terms, a mentoring session that took
 * place, or a cohort both were in — and the label says which. Endorsements
 * without one keep working exactly as before; they are simply not labelled.
 *
 * Skills work the same way, after LinkedIn retired its skill assessments in
 * 2023: a skill shows where it was applied — a completed milestone, a builder
 * document, an agreed commitment, or approved endorsements naming it.
 */

export const ENDORSEMENT_BASES = ['agreement', 'mentoring', 'cohort'] as const;
export type EndorsementBasis = (typeof ENDORSEMENT_BASES)[number];

export interface RelationshipFacts {
  /** Ladder threads between the two people that reached agreed terms. */
  agreedThreads: number;
  /** Mentoring sessions between them that were completed. */
  completedSessions: number;
  /** Cohorts both of them were members of. */
  sharedCohorts: number;
}

/** The verified bases for an endorsement between two people, strongest first. */
export function endorsementBasis(facts: RelationshipFacts): EndorsementBasis[] {
  const out: EndorsementBasis[] = [];
  if (facts.agreedThreads > 0) out.push('agreement');
  if (facts.completedSessions > 0) out.push('mentoring');
  if (facts.sharedCohorts > 0) out.push('cohort');
  return out;
}

export function isEndorsementBasis(value: unknown): value is EndorsementBasis {
  return typeof value === 'string' && (ENDORSEMENT_BASES as readonly string[]).includes(value);
}

/** Endorsements with a verified basis first, the rest in their own order. */
export function byBasis<T extends { basis?: readonly string[] | null }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => (b.basis?.length ? 1 : 0) - (a.basis?.length ? 1 : 0));
}

export const ENDORSEMENT_BASIS_COPY: Record<EndorsementBasis, { en: string; el: string }> = {
  agreement: { en: 'Worked together: agreed terms', el: 'Συνεργάστηκαν: συμφωνημένοι όροι' },
  mentoring: { en: 'Worked together: mentoring session', el: 'Συνεργάστηκαν: συνεδρία καθοδήγησης' },
  cohort: { en: 'Same cohort', el: 'Ίδιος κύκλος' },
};

export const SKILL_EVIDENCE_KINDS = ['milestone', 'builder_document', 'agreement', 'endorsement'] as const;
export type SkillEvidenceKind = (typeof SKILL_EVIDENCE_KINDS)[number];
/** Kinds a person links by hand; endorsements are counted, not linked. */
export const LINKABLE_EVIDENCE_KINDS = ['milestone', 'builder_document', 'agreement'] as const;
export type LinkableEvidenceKind = (typeof LINKABLE_EVIDENCE_KINDS)[number];

export function isLinkableEvidenceKind(value: unknown): value is LinkableEvidenceKind {
  return typeof value === 'string' && (LINKABLE_EVIDENCE_KINDS as readonly string[]).includes(value);
}

export const SKILL_EVIDENCE_LIMITS = { perSkill: 5, skillName: 60 } as const;

export const SKILL_EVIDENCE_COPY: Record<SkillEvidenceKind, { en: string; el: string }> = {
  milestone: { en: 'Completed milestone', el: 'Ολοκληρωμένο ορόσημο' },
  builder_document: { en: 'Builder document', el: 'Έγγραφο του builder' },
  agreement: { en: 'Agreed commitment', el: 'Συμφωνημένη δέσμευση' },
  endorsement: { en: 'Endorsement', el: 'Σύσταση' },
};

/** Two skill names are the same skill when they match ignoring case, spacing and punctuation. */
export function sameSkill(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '');
  return !!a && !!b && norm(a) === norm(b);
}
