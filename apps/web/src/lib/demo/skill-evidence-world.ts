import { SKILL_EVIDENCE_LIMITS, isLinkableEvidenceKind, sameSkill, type LinkableEvidenceKind } from '@cofounderbay/shared';
import { DemoRefusal } from './demo-refusal';

/**
 * Skills with evidence in the preview demo, with the API's rules.
 *
 * Alex's skills are the demo profile's (Product, Growth). What can be linked
 * is Alex's own completed work elsewhere in the demo: milestones ms-7, ms-10
 * and ms-12, the builder's Idea Core, Business Model Canvas and Market
 * Analysis, and the agreed designer commitment with Katerina. Product starts
 * with one link; Dr. Kim's approved endorsement names Product strategy and
 * comes from a mentoring session, so it shows as from work done together.
 */

const ME = 'preview-demo-user';
const STORAGE_KEY = 'cfb:demo-skill-evidence:v1';
const DAY = 86_400_000;

const CANDIDATES: Array<{ kind: LinkableEvidenceKind; refId: string; label: string; ageDays: number }> = [
  { kind: 'milestone', refId: 'ms-12', label: 'GTM canvas on Research', ageDays: 46 },
  { kind: 'milestone', refId: 'ms-10', label: 'Pitch deck outline for the $750K seed', ageDays: 69 },
  { kind: 'milestone', refId: 'ms-7', label: 'Idea Core v1 in Builder', ageDays: 111 },
  { kind: 'builder_document', refId: 'preview-doc-idea', label: 'Idea Core', ageDays: 20 },
  { kind: 'builder_document', refId: 'preview-doc-bmc', label: 'Business Model Canvas', ageDays: 25 },
  { kind: 'builder_document', refId: 'preview-doc-market', label: 'Market Analysis', ageDays: 30 },
  { kind: 'agreement', refId: 'thr-designer-katerina', label: 'Part-time product designer for the readiness score', ageDays: 15 },
];

/** Other people's skills, for their profiles in the demo. */
const OTHERS: Record<string, Array<{ name: string; evidence: Array<{ kind: LinkableEvidenceKind; label: string }>; endorsements: number; verified: number }>> = {
  'user-elena': [
    { name: 'Product', evidence: [{ kind: 'milestone', label: 'Four clinics live' }], endorsements: 2, verified: 1 },
    { name: 'Fundraising', evidence: [{ kind: 'agreement', label: 'Commercial co-founder for Harbor' }], endorsements: 1, verified: 0 },
  ],
  'user-marcus': [{ name: 'Full-stack engineering', evidence: [{ kind: 'builder_document', label: 'Harbor technical plan' }], endorsements: 1, verified: 0 }],
};

type Row = { id: string; skillName: string; kind: LinkableEvidenceKind; refId: string; label: string; ageMs: number };
type State = { rows: Row[]; seq: number };
let memory: State | null = null;

function seed(): State {
  return { seq: 1, rows: [{ id: 'ev-1', skillName: 'Product', kind: 'builder_document', refId: 'preview-doc-idea', label: 'Idea Core', ageMs: 5 * DAY }] };
}

function load(): State {
  if (memory) return memory;
  try {
    const raw = typeof window !== 'undefined' ? window.sessionStorage.getItem(STORAGE_KEY) : null;
    memory = raw ? (JSON.parse(raw) as State) : seed();
  } catch {
    memory = seed();
  }
  return memory;
}

function save() {
  try {
    if (memory && typeof window !== 'undefined') window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // storage blocked: the change lasts this page view
  }
}

export function resetDemoSkillEvidence() {
  memory = null;
  try {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

const MY_SKILLS = ['Product', 'Growth'];
const MY_ENDORSEMENTS = [{ skill: 'Product strategy', verified: true }, { skill: 'Go-to-market', verified: false }, { skill: 'Fundraising', verified: false }];

/** Answers `/api/skill-evidence…` for the demo, or `undefined` for any other path. */
export function previewSkillEvidenceApi(pathname: string, method: string, body: Record<string, unknown>, now: number): unknown {
  if (!pathname.startsWith('/api/skill-evidence')) return undefined;
  const state = load();
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent).slice(2);

  if (parts[0] === 'candidates' && method === 'GET') {
    return { candidates: CANDIDATES.map((c) => ({ kind: c.kind, refId: c.refId, label: c.label, at: new Date(now - c.ageDays * DAY).toISOString() })) };
  }
  if (parts[0] === 'user' && parts[1] && method === 'GET') {
    if (parts[1] !== ME) {
      return {
        skills: (OTHERS[parts[1]] ?? []).map((s, i) => ({
          name: s.name,
          evidence: s.evidence.map((e, j) => ({ id: `${parts[1]}-${i}-${j}`, kind: e.kind, refId: `${parts[1]}-${i}-${j}`, label: e.label, at: new Date(now - (j + 3) * DAY).toISOString() })),
          endorsements: s.endorsements,
          verifiedEndorsements: s.verified,
        })),
      };
    }
    const names: string[] = [];
    const add = (n: string) => {
      if (n && !names.some((x) => sameSkill(x, n))) names.push(n);
    };
    MY_SKILLS.forEach(add);
    state.rows.forEach((r) => add(r.skillName));
    MY_ENDORSEMENTS.forEach((e) => add(e.skill));
    return {
      skills: names.map((name) => {
        const ends = MY_ENDORSEMENTS.filter((e) => sameSkill(e.skill, name));
        return {
          name,
          evidence: state.rows.filter((r) => sameSkill(r.skillName, name)).map((r) => ({ id: r.id, kind: r.kind, refId: r.refId, label: r.label, at: new Date(now - r.ageMs).toISOString() })),
          endorsements: ends.length,
          verifiedEndorsements: ends.filter((e) => e.verified).length,
        };
      }),
    };
  }
  if (!parts.length && method === 'POST') {
    const skillName = typeof body.skillName === 'string' ? body.skillName.trim() : '';
    if (!skillName || skillName.length > SKILL_EVIDENCE_LIMITS.skillName) {
      throw new DemoRefusal(400, 'Name the skill in a few words.', { reason: 'skill_name', messageEl: 'Ονομάστε τη δεξιότητα σε λίγες λέξεις.' });
    }
    const target = CANDIDATES.find((c) => c.kind === body.kind && c.refId === body.refId);
    if (!isLinkableEvidenceKind(body.kind) || !target) throw new DemoRefusal(404, 'That is not one of your completed items');
    const forSkill = state.rows.filter((r) => sameSkill(r.skillName, skillName));
    if (forSkill.some((r) => r.kind === target.kind && r.refId === target.refId)) throw new DemoRefusal(409, 'Already linked to this skill');
    if (forSkill.length >= SKILL_EVIDENCE_LIMITS.perSkill) {
      throw new DemoRefusal(400, `Up to ${SKILL_EVIDENCE_LIMITS.perSkill} pieces of evidence per skill: keep the strongest.`, {
        reason: 'too_many',
        messageEl: `Έως ${SKILL_EVIDENCE_LIMITS.perSkill} τεκμήρια ανά δεξιότητα: κρατήστε τα πιο δυνατά.`,
      });
    }
    state.seq += 1;
    const row: Row = { id: `ev-${state.seq}`, skillName: forSkill[0]?.skillName ?? skillName, kind: target.kind, refId: target.refId, label: target.label, ageMs: 0 };
    state.rows.push(row);
    save();
    return { evidence: { id: row.id, skillName: row.skillName, kind: row.kind, refId: row.refId, label: row.label, at: new Date(now).toISOString() } };
  }
  if (parts.length === 1 && method === 'DELETE') {
    const row = state.rows.find((r) => r.id === parts[0]);
    if (!row) throw new DemoRefusal(404, 'Evidence not found');
    state.rows = state.rows.filter((r) => r.id !== row.id);
    save();
    return { ok: true, restore: { skillName: row.skillName, kind: row.kind, refId: row.refId } };
  }
  return undefined;
}
