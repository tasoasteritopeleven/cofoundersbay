import { beforeEach, describe, expect, it, vi } from 'vitest';
import { INTEREST_BUDGET, interestBudgetLeft } from '@cofounderbay/shared';
import { previewScoutApi, resetDemoScout } from '@/lib/demo/scout-world';
import { previewCommitmentsApi, resetDemoCommitments } from '@/lib/demo/commitments-world';
import { getScout, runScout } from '@/lib/scout-api';
import { executeAction, isUndoable } from './action-registry';
import { AREA_READERS } from './copilot-reads';
import { planCopilotTools } from './copilot-planner';
import { takeFormDraft } from './form-draft';
import { translate } from './i18n/translate';

/**
 * The co-founder scout and the interest budget. The scout proposes and
 * never sends; the budget keeps at most five answers waiting on authors.
 */

vi.mock('@/lib/scout-api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/scout-api')>()), getScout: vi.fn(), runScout: vi.fn() }));

const NOW = Date.parse('2026-10-07T09:00:00Z');
const scout = (path: string, method = 'GET', body: Record<string, unknown> = {}) => previewScoutApi(path, method, body, NOW) as Record<string, any>;
const commitments = (path: string, method = 'GET', body: Record<string, unknown> = {}) => previewCommitmentsApi(path, path, method, body, NOW) as Record<string, any>;

beforeEach(() => {
  resetDemoScout();
  resetDemoCommitments();
  vi.mocked(getScout).mockReset();
  vi.mocked(runScout).mockReset();
});

describe('the scout demo', () => {
  it('starts with a brief and proposals, Marcus first, each with reasons and a draft note', () => {
    const state = scout('/api/scout');
    expect(state.brief).toMatchObject({ role: 'Technical co-founder', skills: ['TypeScript', 'AI'] });
    expect(state.proposals[0].person.displayName).toBe('Marcus Chen');
    expect(state.proposals[0].reasons.map((r: { en: string }) => r.en)).toContain('Open to co-founding');
    expect(state.proposals[0].draftNote).toMatch(/^Hi Marcus/);
    expect(state.proposals[0].draftNote).not.toMatch(/@|\+\d/);
  });

  it('never proposes a dismissed person again, and restores one exactly', () => {
    const [first] = scout('/api/scout').proposals;
    scout(`/api/scout/proposals/${first.id}/dismiss`, 'POST');
    expect(scout('/api/scout/run', 'POST').added).toBe(0);
    expect(scout('/api/scout').proposals.some((p: { id: string }) => p.id === first.id)).toBe(false);
    scout(`/api/scout/proposals/${first.id}/restore`, 'POST');
    expect(scout('/api/scout').proposals.find((p: { id: string }) => p.id === first.id)?.status).toBe('proposed');
  });

  it('refuses a brief without a role, in both languages', () => {
    let caught: any;
    try {
      scout('/api/scout/brief', 'PUT', { role: '' });
    } catch (err) {
      caught = err;
    }
    expect(caught).toMatchObject({ status: 400, details: { reason: 'scout_brief_invalid', problems: ['role'] } });
  });
});

describe('the interest budget', () => {
  it('counts answers waiting on authors in the demo, as the API does', () => {
    const budget = commitments('/api/commitments/interest-budget');
    expect(budget.budget).toBe(INTEREST_BUDGET);
    expect(budget.left).toBe(interestBudgetLeft(budget.waiting));
  });
});

describe('the assistant', () => {
  it('reads the scout in Greek, with ids it can act on', async () => {
    vi.mocked(getScout).mockResolvedValue(scout('/api/scout') as never);
    const reply = await AREA_READERS.get_scout({}, { t: (s: string, v?: Record<string, string | number>) => translate('el', s, v), locale: 'el' });
    expect(reply.section).toContain('Ο ανιχνευτής προτείνει:');
    expect(reply.section).toMatch(/\*\*Marcus Chen\*\* \(\d+, id scout-\d+\) — .*Ανοιχτός\/ή σε συνίδρυση/);
  });

  it('runs the scout (nothing to undo) and drafts a brief into the form without saving', async () => {
    vi.mocked(runScout).mockResolvedValue({ added: 2, brief: null, lastRunAt: null, proposals: [] });
    expect(isUndoable('run_scout')).toBe(false);
    expect(await executeAction('run_scout', {})).toMatchObject({ ok: true, href: '/scout' });
    expect(await executeAction('draft_scout_brief', { role: 'Technical co-founder', skills: 'TypeScript, AI', place: 'Athens' })).toMatchObject({ ok: true, href: '/scout' });
    expect(takeFormDraft('scout_brief')).toEqual({ role: 'Technical co-founder', skills: 'TypeScript, AI', place: 'Athens' });
  });

  it('plans the scout read for a question and a draft for a request', () => {
    expect(planCopilotTools('What did my co-founder scout find?').map((t) => t.name)).toContain('get_scout');
    const draft = planCopilotTools('Draft a scout brief for a technical co-founder').find((t) => t.name === 'draft_scout_brief');
    expect(draft?.args).toEqual({ role: 'Technical co-founder' });
  });
});
