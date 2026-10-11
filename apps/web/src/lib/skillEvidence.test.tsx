import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { previewSkillEvidenceApi, resetDemoSkillEvidence } from '@/lib/demo/skill-evidence-world';
import { linkSkillEvidence, unlinkSkillEvidence, getSkillEvidence, getEvidenceCandidates } from '@/lib/skill-evidence-api';
import { getMeProfile } from '@/lib/api';
import { EndorsementBasisLine } from '@/components/endorsements/EndorsementBasisLine';
import { executeAction, isUndoable, undoAction } from './action-registry';
import { AREA_READERS } from './copilot-reads';
import { translate } from './i18n/translate';

/**
 * Reputation with evidence: the demo world applies the API's rules, an
 * endorsement shows its verified basis only when it has one, and the
 * assistant links evidence with the unlink as its exact undo.
 */

vi.mock('@/lib/skill-evidence-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/skill-evidence-api')>()),
  linkSkillEvidence: vi.fn(),
  unlinkSkillEvidence: vi.fn(),
  getSkillEvidence: vi.fn(),
  getEvidenceCandidates: vi.fn(),
}));
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), getMeProfile: vi.fn() }));

const NOW = Date.parse('2026-10-07T09:00:00Z');
const api = (path: string, method = 'GET', body: Record<string, unknown> = {}) => previewSkillEvidenceApi(path, method, body, NOW) as Record<string, any>;

beforeEach(() => {
  cleanup();
  resetDemoSkillEvidence();
  vi.mocked(linkSkillEvidence).mockReset();
  vi.mocked(unlinkSkillEvidence).mockReset();
  vi.mocked(getSkillEvidence).mockReset();
  vi.mocked(getEvidenceCandidates).mockReset();
  vi.mocked(getMeProfile).mockReset();
});

describe('the skill-evidence demo', () => {
  it('lists Alex’s skills with evidence and endorsements, each skill once', () => {
    const { skills } = api('/api/skill-evidence/user/preview-demo-user');
    expect(skills.map((s: { name: string }) => s.name)).toEqual(['Product', 'Growth', 'Product strategy', 'Go-to-market', 'Fundraising']);
    expect(skills[0].evidence[0]).toMatchObject({ kind: 'builder_document', label: 'Idea Core' });
    expect(skills[2]).toMatchObject({ endorsements: 1, verifiedEndorsements: 1 });
  });

  it('links only Alex’s own completed work, never twice, and unlinks with what Undo needs', () => {
    const { evidence } = api('/api/skill-evidence', 'POST', { skillName: 'growth', kind: 'builder_document', refId: 'preview-doc-market' });
    expect(evidence).toMatchObject({ skillName: 'growth', label: 'Market Analysis' });
    expect(() => api('/api/skill-evidence', 'POST', { skillName: 'Growth', kind: 'builder_document', refId: 'preview-doc-market' })).toThrow(/Already linked/);
    expect(() => api('/api/skill-evidence', 'POST', { skillName: 'Growth', kind: 'milestone', refId: 'someone-elses' })).toThrow(/not one of your/);
    expect(api(`/api/skill-evidence/${evidence.id}`, 'DELETE')).toEqual({ ok: true, restore: { skillName: 'growth', kind: 'builder_document', refId: 'preview-doc-market' } });
  });
});

describe('the endorsement basis line', () => {
  it('says what the platform saw, and nothing without a basis', () => {
    const { rerender, container } = render(<EndorsementBasisLine basis={['mentoring', 'cohort']} />);
    expect(screen.getAllByText(/Worked together: mentoring session · Same cohort/).length).toBeGreaterThan(0);
    rerender(<EndorsementBasisLine basis={[]} />);
    expect(container.innerHTML).toBe('');
    rerender(<EndorsementBasisLine basis={['made-up']} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('the assistant', () => {
  it('reads skills, evidence and what can still be linked, in Greek for a Greek reader', async () => {
    vi.mocked(getMeProfile).mockResolvedValue({ profile: { userId: 'preview-demo-user' } as never, hasCompletedOnboarding: true });
    vi.mocked(getSkillEvidence).mockResolvedValue(api('/api/skill-evidence/user/preview-demo-user').skills);
    vi.mocked(getEvidenceCandidates).mockResolvedValue(api('/api/skill-evidence/candidates').candidates);
    const t = (s: string, v?: Record<string, string | number>) => translate('el', s, v);
    const reply = await AREA_READERS.get_skill_evidence({}, { t, locale: 'el' });
    expect(reply.section).toContain('Οι δεξιότητές σας και τα τεκμήριά τους:');
    expect(reply.section).toContain('Έγγραφο του builder: Idea Core');
    expect(reply.section).toContain('1 συστάσεις, 1 από κοινή δουλειά');
    expect(reply.section).toContain('(milestone, id ms-12)');
  });

  it('links evidence with the unlink as its exact undo', async () => {
    vi.mocked(linkSkillEvidence).mockResolvedValue({ id: 'ev-9', skillName: 'Growth', kind: 'milestone', refId: 'ms-12', label: 'GTM canvas on Research', at: '' });
    vi.mocked(unlinkSkillEvidence).mockResolvedValue({ ok: true });
    expect(isUndoable('link_skill_evidence')).toBe(true);
    const outcome = await executeAction('link_skill_evidence', { skillName: 'Growth', kind: 'milestone', refId: 'ms-12' });
    expect(outcome).toMatchObject({ ok: true, undo: { evidenceId: 'ev-9' } });
    await undoAction('link_skill_evidence', {}, outcome.undo);
    expect(unlinkSkillEvidence).toHaveBeenCalledWith('ev-9');
    expect(await executeAction('link_skill_evidence', { skillName: 'Growth', kind: 'endorsement', refId: 'x' })).toMatchObject({ ok: false });
  });
});
