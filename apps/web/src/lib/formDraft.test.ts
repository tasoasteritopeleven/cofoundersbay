import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getActionDeclaration } from '@cofounderbay/shared';
import { executeAction } from './action-registry';
import { planCopilotTools } from './copilot-planner';
import { FORM_DRAFT_ROUTES, stashFormDraft, takeFormDraft, useFormDraft } from './form-draft';

/**
 * Wave D: forms as proposals.
 *
 * The assistant fills a form; the person submits it. Asserted here: a draft
 * survives one navigation and no more, a stale one is ignored, an open form
 * fills in place, a form that loads its own values first is filled after
 * them, the executors pass only the declared fields and write nothing, and
 * both languages plan a draft.
 */

beforeEach(() => {
  window.sessionStorage.clear();
});
// An open form takes the draft meant for it, so each test unmounts its own.
afterEach(cleanup);

describe('the draft store', () => {
  it('hands a draft over once', () => {
    stashFormDraft('milestone', { title: 'Close the pre-seed', notes: '  ' });
    expect(takeFormDraft('milestone')).toEqual({ title: 'Close the pre-seed' });
    expect(takeFormDraft('milestone')).toBeNull();
  });

  it('ignores a draft left for longer than ten minutes', () => {
    stashFormDraft('event', { title: 'Demo day' });
    expect(takeFormDraft('event', Date.now() + 11 * 60_000)).toBeNull();
  });

  it('keeps each form’s draft to itself', () => {
    stashFormDraft('project', { name: 'Helios' });
    expect(takeFormDraft('milestone')).toBeNull();
    expect(takeFormDraft('project')).toEqual({ name: 'Helios' });
  });
});

describe('useFormDraft', () => {
  it('fills a form that opens after the draft was made', () => {
    stashFormDraft('milestone', { title: 'Hire a first engineer', priority: 'high' });
    const apply = vi.fn();
    const { result } = renderHook(() => useFormDraft('milestone', apply));
    expect(apply).toHaveBeenCalledWith({ title: 'Hire a first engineer', priority: 'high' });
    expect(result.current.filled).toEqual(['title', 'priority']);
    act(() => result.current.dismiss());
    expect(result.current.filled).toEqual([]);
  });

  it('fills a form that is already open', () => {
    const apply = vi.fn();
    const { result } = renderHook(() => useFormDraft('event', apply));
    expect(apply).not.toHaveBeenCalled();
    act(() => stashFormDraft('event', { title: 'Founder breakfast' }));
    expect(apply).toHaveBeenCalledWith({ title: 'Founder breakfast' });
    expect(result.current.filled).toEqual(['title']);
  });

  it('waits until a form that loads its own values is ready', () => {
    stashFormDraft('profile', { headline: 'Founder at Harbor' });
    const apply = vi.fn();
    const { rerender } = renderHook(({ ready }) => useFormDraft('profile', apply, ready), { initialProps: { ready: false } });
    expect(apply).not.toHaveBeenCalled();
    rerender({ ready: true });
    expect(apply).toHaveBeenCalledWith({ headline: 'Founder at Harbor' });
  });
});

describe('the draft actions', () => {
  it('write nothing and say so', () => {
    for (const id of ['draft_milestone', 'draft_event', 'draft_project', 'draft_profile']) {
      const spec = getActionDeclaration(id);
      expect(spec?.writes).toBe(false);
      expect(spec?.invalidates).toEqual([]);
      expect(spec?.reversal?.kind).toBe('none');
      expect(spec?.navigatesOnSuccess).toBe(true);
    }
  });

  it('stash only the declared fields and open the form', async () => {
    const outcome = await executeAction('draft_milestone', { title: 'Close the pre-seed', dueDate: '2027-06-30', ownerId: 'someone-else' });
    expect(outcome).toEqual({ ok: true, href: FORM_DRAFT_ROUTES.milestone });
    expect(takeFormDraft('milestone')).toEqual({ title: 'Close the pre-seed', dueDate: '2027-06-30' });
  });

  it('refuse a draft without its required field', async () => {
    expect((await executeAction('draft_event', { description: 'No title' })).ok).toBe(false);
    expect((await executeAction('draft_profile', {})).ok).toBe(false);
    expect((await executeAction('draft_profile', { bio: 'Two exits.' })).ok).toBe(true);
  });
});

describe('planning drafts', () => {
  const plan = (message: string) => planCopilotTools(message);
  it.each([
    ['Draft a milestone “Close the pre-seed round”', 'draft_milestone', { title: 'Close the pre-seed round' }],
    ['Ετοίμασε ορόσημο «Πρόσληψη μηχανικού»', 'draft_milestone', { title: 'Πρόσληψη μηχανικού' }],
    ['Draft an event "Founder breakfast"', 'draft_event', { title: 'Founder breakfast' }],
    ['Ετοίμασε εκδήλωση «Πρωινό ιδρυτών»', 'draft_event', { title: 'Πρωινό ιδρυτών' }],
    ['Draft a project "Helios"', 'draft_project', { name: 'Helios' }],
    ['Draft my headline "Founder at Harbor"', 'draft_profile', { headline: 'Founder at Harbor' }],
  ])('%s → %s', (message, tool, args) => {
    const planned = plan(message).find((t) => t.name === tool);
    expect(planned?.args).toMatchObject(args);
  });

  it('does not read the area a draft names', () => {
    expect(plan('Draft a milestone “Close the round”').map((t) => t.name)).not.toContain('get_milestones');
    expect(plan('Which milestones are overdue?').map((t) => t.name)).toContain('get_milestones');
  });
});
