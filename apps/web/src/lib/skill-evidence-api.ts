import type { LinkableEvidenceKind, SkillEvidenceKind } from '@cofounderbay/shared';
import { apiRequest } from '@/lib/api';

/** Skills with the evidence behind them, and what the reader can link. */

export interface SkillEvidenceItem {
  id: string;
  kind: SkillEvidenceKind;
  refId: string;
  label: string;
  at: string;
}

export interface SkillWithEvidence {
  name: string;
  evidence: SkillEvidenceItem[];
  endorsements: number;
  verifiedEndorsements: number;
}

export interface EvidenceCandidate {
  kind: LinkableEvidenceKind;
  refId: string;
  label: string;
  at: string;
}

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const KINDS = ['milestone', 'builder_document', 'agreement', 'endorsement'];

function toItem(raw: unknown): SkillEvidenceItem {
  const e = rec(raw);
  return { id: str(e.id), kind: (KINDS.includes(str(e.kind)) ? e.kind : 'milestone') as SkillEvidenceKind, refId: str(e.refId), label: str(e.label), at: str(e.at) };
}

export async function getSkillEvidence(userId: string): Promise<SkillWithEvidence[]> {
  const skills = rec(await apiRequest(`/api/skill-evidence/user/${encodeURIComponent(userId)}`)).skills;
  return (Array.isArray(skills) ? skills : [])
    .map((s) => {
      const r = rec(s);
      return {
        name: str(r.name),
        evidence: (Array.isArray(r.evidence) ? r.evidence : []).map(toItem),
        endorsements: num(r.endorsements),
        verifiedEndorsements: num(r.verifiedEndorsements),
      };
    })
    .filter((s) => s.name);
}

export async function getEvidenceCandidates(): Promise<EvidenceCandidate[]> {
  const list = rec(await apiRequest('/api/skill-evidence/candidates')).candidates;
  return (Array.isArray(list) ? list : [])
    .map((c) => ({ kind: str(rec(c).kind) as LinkableEvidenceKind, refId: str(rec(c).refId), label: str(rec(c).label), at: str(rec(c).at) }))
    .filter((c) => c.refId && ['milestone', 'builder_document', 'agreement'].includes(c.kind));
}

export async function linkSkillEvidence(input: { skillName: string; kind: LinkableEvidenceKind; refId: string }): Promise<SkillEvidenceItem & { skillName: string }> {
  const e = rec(rec(await apiRequest('/api/skill-evidence', { method: 'POST', body: JSON.stringify(input) })).evidence);
  return { ...toItem(e), skillName: str(e.skillName) };
}

export async function unlinkSkillEvidence(id: string): Promise<{ ok: boolean; restore?: { skillName: string; kind: LinkableEvidenceKind; refId: string } }> {
  const r = rec(await apiRequest(`/api/skill-evidence/${encodeURIComponent(id)}`, { method: 'DELETE' }));
  const restore = rec(r.restore);
  return { ok: r.ok === true, ...(str(restore.refId) ? { restore: { skillName: str(restore.skillName), kind: str(restore.kind) as LinkableEvidenceKind, refId: str(restore.refId) } } : {}) };
}
