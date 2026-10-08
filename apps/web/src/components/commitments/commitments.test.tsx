import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { previewCommitmentsApi, resetDemoCommitments } from '@/lib/demo/commitments-world';
import { resetPageControlsForTests, runPageControl } from '@/lib/page-controls';
import { ThreadWorkspace } from './ThreadWorkspace';
import { executeAction, undoAction } from '@/lib/action-registry';
import { takeFormDraft } from '@/lib/form-draft';
import { NeedCard } from './NeedCard';

/**
 * The commitments UI against the preview demo's world: the same ladder rules
 * the API enforces, run in the browser. The demo user is Alex Demo; Harbor's
 * card is Elena's, the Athens intro programme is Alex's own.
 */

const mocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ success: mocks.success, error: mocks.error }) }));

const reportBlockProps = vi.hoisted(() => ({ last: null as Record<string, any> | null }));
vi.mock('@/components/common/ReportBlockModal', () => ({
  ReportBlockModal: (props: Record<string, any>) => {
    reportBlockProps.last = props;
    return props.open ? <div role="dialog" aria-label="report or block" /> : null;
  },
}));

const NOW = Date.parse('2026-10-06T12:00:00Z');
const api = (path: string, method = 'GET', body: Record<string, unknown> = {}) =>
  previewCommitmentsApi(path.split('?')[0], path, method, body, NOW) as Record<string, any>;

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  // The preview demo answers apiRequest from the demo world.
  localStorage.setItem('cfb_demo_data', '1');
  resetDemoCommitments();
  resetPageControlsForTests();
});
afterEach(cleanup);

describe('the demo world keeps the ladder rules', () => {
  it('opens the terms space only when the second side confirms, and the first never learns early', () => {
    const before = api('/api/commitments/threads/thr-intros-giorgos');
    // Giorgos confirmed already; the demo user cannot see it.
    expect(before.thread).toMatchObject({ step: 'conversation', myConfirmed: false, bothConfirmed: false });
    const result = api('/api/commitments/threads/thr-intros-giorgos/confirm', 'POST');
    expect(result).toEqual({ ok: true, bothConfirmed: true, step: 'terms' });
    expect(api('/api/commitments/threads/thr-intros-giorgos').thread.conversationReadOnly).toBe(true);
  });

  it('refuses contact details in the protected conversation with the Greek reason', () => {
    let error: any;
    try {
      api('/api/commitments/threads/thr-intros-giorgos/messages', 'POST', { body: 'Πάρε με τηλέφωνο στο 6944123456' });
    } catch (e) {
      error = e;
    }
    expect(error?.status).toBe(400);
    expect(error?.details?.kinds).toEqual(['phone', 'messenger']);
    expect(error?.details?.messageEl).toContain('αριθμό τηλεφώνου');
  });

  it('stops terms after three revisions', () => {
    const terms = { role: 'Co-founder, commercial', equityPct: 10, vestingMonths: 48, cliffMonths: 12, hoursPerWeek: 40, scope: 'Sales and partnerships' };
    // Harbor: v1 by Elena, v2 by Alex (one revision used).
    api('/api/commitments/threads/thr-harbor-alex/terms', 'POST', { ...terms, equityPct: 9 });
    api('/api/commitments/threads/thr-harbor-alex/terms', 'POST', { ...terms, equityPct: 9.5 });
    expect(() => api('/api/commitments/threads/thr-harbor-alex/terms', 'POST', { ...terms, equityPct: 9.75 })).toThrow(/three revisions/);
  });

  it('serves a public card without the author’s id or the project', () => {
    const { card } = api('/api/commitments/public/harbor-commercial-demo');
    expect(card.title).toBe('Commercial co-founder for Harbor');
    expect(JSON.stringify(card)).not.toMatch(/user-elena|projectRef|shareToken/);
  });
});

describe('ThreadWorkspace', () => {
  it('shows the terms diff, who accepted, and the revisions left', async () => {
    renderWithQuery(<ThreadWorkspace threadId="thr-harbor-alex" />);
    await screen.findByText('Elena Papadopoulos');
    expect(screen.getByRole('list', { name: /Commitment ladder/ })).toBeTruthy();
    expect(screen.getAllByText(/changed/).length).toBeGreaterThan(0);
    expect(screen.getByText(/2 revisions left/)).toBeTruthy();
    expect(screen.getAllByText(/Waiting for them/).length).toBeGreaterThan(0);
    // The demo user proposed v2, so accepting it is not offered again.
    expect(screen.queryByRole('button', { name: /Accept version 2/ })).toBeNull();
    expect(screen.getByText(/CoFounderBay organises the decision/)).toBeTruthy();
    // The offer changed since Alex answered version 1.
    expect(screen.getByText(/The offer changed since you answered \(v1 → v2\)/)).toBeTruthy();
  });

  it('offers report or block on the counterpart, with the thread as context', async () => {
    renderWithQuery(<ThreadWorkspace threadId="thr-harbor-alex" />);
    await screen.findByText('Elena Papadopoulos');
    fireEvent.click(screen.getByRole('button', { name: /Report or block/ }));
    expect(reportBlockProps.last).toMatchObject({
      open: true,
      userId: 'user-elena',
      mode: 'both',
      context: { surface: 'commitment_thread', threadId: 'thr-harbor-alex', cardId: 'need-harbor' },
    });
  });

  it('blocks Send while a message carries contact details and says why', async () => {
    renderWithQuery(<ThreadWorkspace threadId="thr-intros-giorgos" />);
    const box = await screen.findByRole('textbox', { name: /Write a message/ });
    fireEvent.change(box, { target: { value: 'my email is alex@example.com' } });
    expect(screen.getByRole('status').textContent).toMatch(/an email address/);
    expect((screen.getByRole('button', { name: /^Send/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(box, { target: { value: 'Happy to start with your founders evening.' } });
    expect((screen.getByRole('button', { name: /^Send/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('offers the assistant the same confirm the button runs, with its undo', async () => {
    renderWithQuery(<ThreadWorkspace threadId="thr-intros-giorgos" />);
    await screen.findByText('Giorgos Vlachos');
    let outcome: any;
    await act(async () => {
      outcome = await runPageControl('confirm_terms_talk', undefined, true);
    });
    expect(outcome.ok).toBe(true);
    expect(outcome.undo).toEqual({ control: 'retract_confirmation' });
    await waitFor(() => expect(api('/api/commitments/threads/thr-intros-giorgos').thread.step).toBe('terms'));
  });
});

describe('NeedCard', () => {
  it('reads as three sentences and an offer, with the non-guarantee only where equity appears', () => {
    const base = {
      kind: 'equity_role',
      title: 'Head of growth',
      exists: 'A pilot in four clinics.',
      goal: 'Forty clinics in a year.',
      missing: 'A growth lead from regulated sales.',
      offer: { role: 'Head of growth', equity: '1–2%', hoursPerWeek: 30, scope: 'Clinic acquisition' },
      category: 'HealthTech',
      place: 'Thessaloniki',
      isRemote: false,
      stage: 'validating',
      commitment: 'part_time',
    };
    const { rerender } = render(<NeedCard card={base} />);
    for (const label of ['What already exists', 'The outcome it is for', 'Who is missing']) expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByText(/1–2% · 30 h\/week/)).toBeTruthy();
    expect(screen.getByText(/does not promise funding/)).toBeTruthy();
    rerender(<NeedCard card={{ ...base, kind: 'cofounder', offer: { ...base.offer, equity: null } }} />);
    expect(screen.queryByText(/does not promise funding/)).toBeNull();
  });
});

describe('the assistant’s commitment capabilities', () => {
  it('sends interest and takes it back by the thread it created', async () => {
    const sent = await executeAction('express_interest', { cardId: 'need-aegis-growth', note: 'Six years selling to clinics in Thessaloniki.' });
    expect(sent.ok).toBe(true);
    const threadId = sent.undo?.threadId as string;
    expect(threadId).toBeTruthy();
    expect(api(`/api/commitments/threads/${threadId}`).thread.step).toBe('interest');
    const undone = await undoAction('express_interest', {}, sent.undo);
    expect(undone.ok).toBe(true);
    expect(() => api(`/api/commitments/threads/${threadId}`)).toThrow(/not found/i);
  });

  it('refuses a note with contact details and writes nothing', async () => {
    const before = api('/api/commitments/threads').threads.length;
    const sent = await executeAction('express_interest', { cardId: 'need-aegis-growth', note: 'viber 6944123456' });
    expect(sent.ok).toBe(false);
    expect(api('/api/commitments/threads').threads.length).toBe(before);
  });

  it('closes a card and reopens it to exactly the outcome it had', async () => {
    const before = api('/api/commitments/cards/need-athens-intros').card;
    const closed = await executeAction('close_need_card', { cardId: 'need-athens-intros', reason: 'filled' });
    expect(closed.ok).toBe(true);
    expect(api('/api/commitments/cards/need-athens-intros').card).toMatchObject({ outcome: 'closed', closedReason: 'filled' });
    await undoAction('close_need_card', { cardId: 'need-athens-intros' }, closed.undo);
    const after = api('/api/commitments/cards/need-athens-intros').card;
    expect(after).toMatchObject({ outcome: before.outcome, closedReason: null, settledAt: before.settledAt, expiresAt: before.expiresAt });
  });

  it('drafts a need card into the guide and saves nothing', async () => {
    const cardsBefore = api('/api/commitments/cards?mine=1').cards.length;
    const outcome = await executeAction('draft_need_card', { kind: 'investor_intro', title: 'Lead angel for Orion Grid', offerHours: '2' });
    expect(outcome).toEqual({ ok: true, href: '/commitments/new' });
    expect(takeFormDraft('need_card')).toEqual({ kind: 'investor_intro', title: 'Lead angel for Orion Grid', offerHours: '2' });
    expect(api('/api/commitments/cards?mine=1').cards.length).toBe(cardsBefore);
  });
});

describe('the aspiring-founder demo', () => {
  it('has no card of its own, keeps other people’s, and keeps what it posts', async () => {
    const { resolvePreviewApi } = await import('@/lib/preview-api');
    const { resetDemoCommitments } = await import('@/lib/demo/commitments-world');
    const cards = (q: string) => (resolvePreviewApi(`/api/commitments/cards${q}`) as { cards: Array<{ id: string; isMine: boolean }> }).cards;
    const threadsAs = () => (resolvePreviewApi('/api/commitments/threads?as=all') as { threads: Array<{ role: string }> }).threads;
    resetDemoCommitments();
    const founderOwn = cards('?mine=1').length;
    expect(founderOwn).toBeGreaterThan(0);
    expect(threadsAs().some((t) => t.role === 'owner')).toBe(true);
    document.cookie = 'cfb_primary_role=aspiring_founder; path=/';
    try {
      expect(cards('?mine=1')).toEqual([]);
      expect(cards('').length).toBeGreaterThan(0);
      expect(threadsAs().length).toBeGreaterThan(0);
      expect(threadsAs().every((t) => t.role !== 'owner')).toBe(true);
    } finally {
      document.cookie = 'cfb_primary_role=existing_founder; path=/';
    }
    // The founder's own world is untouched by the switch.
    expect(cards('?mine=1')).toHaveLength(founderOwn);
  });
});
