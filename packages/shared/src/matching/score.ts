/**
 * Rule-based matching score (0–100) for two profiles.
 * Used for cofounder/founder suggestions. Pure function, no I/O.
 */

import type { ProfileSnapshot, MatchScoreResult, MatchScoreBreakdown, UserRole } from './types';

const MAX_SCORE = 100;
const WEIGHTS = {
  roleComplementarity: 25,
  skillsOverlap: 25,
  stageAlignment: 20,
  commitmentAlignment: 15,
  locationProximity: 5,
  recencyBonus: 10,
} as const;

/** Normalize string for comparison. */
function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().trim();
}

/** Jaccard similarity of two sets (0–1). */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const inter = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union > 0 ? inter / union : 0;
}

/** Complementary roles for cofounder/team matching (founder ↔ founder gets full; founder ↔ mentor/investor gets full). */
function roleComplementarityScore(viewerRole: UserRole, candidateRole: UserRole): number {
  if (viewerRole === 'founder' && candidateRole === 'founder') return WEIGHTS.roleComplementarity; // cofounder match
  if (viewerRole === 'founder' && (candidateRole === 'mentor' || candidateRole === 'investor')) return WEIGHTS.roleComplementarity;
  if ((viewerRole === 'mentor' || viewerRole === 'investor') && candidateRole === 'founder') return WEIGHTS.roleComplementarity;
  if (viewerRole === 'org' && (candidateRole === 'founder' || candidateRole === 'mentor')) return WEIGHTS.roleComplementarity;
  return Math.floor(WEIGHTS.roleComplementarity * 0.5); // same role or other: partial
}

/** rolesSought: viewer wants these roles; candidate's role/skills can "fill" one. */
function rolesSoughtMatch(viewerPayload: Record<string, unknown> | null, candidateRole: UserRole, candidateSkillNames: string[]): boolean {
  const sought = viewerPayload?.rolesSought as string[] | undefined;
  if (!sought?.length) return true;
  const roleMap: Record<string, string> = {
    founder: 'founder',
    mentor: 'mentor',
    investor: 'investor',
    cto: 'technical',
    coo: 'operations',
    ceo: 'leadership',
    business_partner: 'business',
  };
  const candidateRoleLower = candidateRole.toLowerCase();
  const candidateSkillsLower = new Set(candidateSkillNames.map((s) => s.toLowerCase()));
  for (const r of sought) {
    const rn = norm(r);
    if (rn === candidateRoleLower) return true;
    if (roleMap[rn] && candidateSkillsLower.has(roleMap[rn])) return true;
    if (candidateSkillsLower.has(rn)) return true;
  }
  return false;
}

/**
 * Compute match score (0–100) between viewer and candidate profile snapshots.
 * Deterministic and side-effect free.
 */
export function computeMatchScore(viewer: ProfileSnapshot, candidate: ProfileSnapshot): MatchScoreResult {
  const reasons: string[] = [];
  let roleComplementarity = roleComplementarityScore(viewer.role, candidate.role);
  if (viewer.role === 'founder' && candidate.role === 'founder' && !rolesSoughtMatch(viewer.rolePayload, candidate.role, candidate.skillNames)) {
    roleComplementarity = Math.floor(roleComplementarity * 0.6);
  } else if (viewer.role === 'founder' && candidate.role === 'founder') {
    reasons.push('Cofounder match');
  }

  const viewerSkills = new Set(viewer.skillNames.map(norm).filter(Boolean));
  const candidateSkills = new Set(candidate.skillNames.map(norm).filter(Boolean));
  const j = jaccard(viewerSkills, candidateSkills);
  const skillsOverlap = Math.round(j * WEIGHTS.skillsOverlap);
  if (skillsOverlap > 0) reasons.push('Skills overlap');

  const viewerStage = (viewer.rolePayload?.stage as string) ?? '';
  const candidateStage = (candidate.rolePayload?.stage as string) ?? '';
  let stageAlignment = 0;
  if (viewerStage && candidateStage) {
    const vs = norm(viewerStage);
    const cs = norm(candidateStage);
    if (vs === cs) {
      stageAlignment = WEIGHTS.stageAlignment;
      reasons.push('Same stage');
    } else {
      const stages = ['idea', 'mvp', 'traction', 'scaling', 'pre_seed', 'seed', 'growth'];
      const vi = stages.indexOf(vs);
      const ci = stages.indexOf(cs);
      if (vi >= 0 && ci >= 0 && Math.abs(vi - ci) <= 1) {
        stageAlignment = Math.floor(WEIGHTS.stageAlignment * 0.5);
        reasons.push('Similar stage');
      }
    }
  }

  const viewerCommitment = norm((viewer.rolePayload?.commitment as string) ?? '');
  const candidateCommitment = norm((candidate.rolePayload?.commitment as string) ?? '');
  let commitmentAlignment = 0;
  if (viewerCommitment && candidateCommitment) {
    if (viewerCommitment === candidateCommitment) {
      commitmentAlignment = WEIGHTS.commitmentAlignment;
      reasons.push('Same commitment');
    } else if (
      (viewerCommitment.includes('full') && candidateCommitment.includes('full')) ||
      (viewerCommitment.includes('part') && candidateCommitment.includes('part'))
    ) {
      commitmentAlignment = Math.floor(WEIGHTS.commitmentAlignment * 0.7);
      reasons.push('Compatible commitment');
    }
  }

  const viewerLoc = norm(viewer.location);
  const candidateLoc = norm(candidate.location ?? '');
  let locationProximity = 0;
  if (viewerLoc && candidateLoc) {
    if (viewerLoc === candidateLoc || viewerLoc.includes(candidateLoc) || candidateLoc.includes(viewerLoc)) {
      locationProximity = WEIGHTS.locationProximity;
      reasons.push('Same or nearby location');
    }
  }

  const now = Date.now();
  const candidateDaysSinceUpdate = (now - candidate.updatedAtMs) / 86400000;
  let recencyBonus = 0;
  if (candidateDaysSinceUpdate <= 7) {
    recencyBonus = WEIGHTS.recencyBonus;
    reasons.push('Active recently');
  } else if (candidateDaysSinceUpdate <= 30) {
    recencyBonus = Math.floor(WEIGHTS.recencyBonus * 0.5);
  }

  const total =
    roleComplementarity +
    skillsOverlap +
    stageAlignment +
    commitmentAlignment +
    locationProximity +
    recencyBonus;
  const score = Math.min(MAX_SCORE, total);

  const breakdown: MatchScoreBreakdown = {
    roleComplementarity,
    skillsOverlap,
    stageAlignment,
    commitmentAlignment,
    locationProximity,
    recencyBonus,
    reasons: reasons.length ? reasons : ['Profile match'],
  };

  return { score, breakdown };
}
