import { beforeEach, describe, expect, it, vi } from 'vitest';
import { previewIntrosApi, resetDemoIntros } from '@/lib/demo/intros-world';
import { previewOpenToApi, resetDemoOpenTo } from '@/lib/demo/open-to-world';
import { resetDemoCommitments, previewCommitmentsApi } from '@/lib/demo/commitments-world';
import { getIntroPaths, listIntros, requestIntro, toIntro, withdrawIntro } from '@/lib/intros-api';
import { clearOpenTo, getMyOpenTo, setOpenTo } from '@/lib/open-to-api';
import { executeAction, isUndoable, undoAction } from './action-registry';
import { AREA_READERS } from './copilot-reads';
import { planCopilotTools } from './copilot-planner';
import { translate } from './i18n/translate';

/**
 * Warm introductions and the "Open to" signal, from the demo world to the
 * assistant. The demo applies the shared rules the API applies; accepting an
 * introduction answers the need card in the commitments demo.
 */

vi.mock('@/lib/intros-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/intros-api')>()),
  listIntros: vi.fn(),
  getIntroPaths: vi.fn(),
  requestIntro: vi.fn(),
  withdrawIntro: vi.fn(),
}));
vi.mock('@/lib/open-to-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/open-to-api')>()),
  getMyOpenTo: vi.fn(),
  setOpenTo: vi.fn(),
  clearOpenTo: vi.fn(),
}));

const NOW = Date.parse('2026-10-07T09:00:00Z');
const intros = (path: string, method = 'GET', body: Record<string, unknown> = {}) =>
  previewIntrosApi(path.split('?')[0], path, method, body, NOW) as Record<string, any>;
const openTo = (path: string, method = 'GET', body: Record<string, unknown> = {}) => previewOpenToApi(path, method, body, NOW) as Record<string, any>;

beforeEach(() => {
  resetDemoIntros();
  resetDemoOpenTo();
  resetDemoCommitments();
  vi.mocked(listIntros).mockReset();
  vi.mocked(getIntroPaths).mockReset();
  vi.mocked(requestIntro).mockReset();
  vi.mocked(withdrawIntro).mockReset();
  vi.mocked(getMyOpenTo).mockReset();
  vi.mocked(setOpenTo).mockReset();
  vi.mocked(clearOpenTo).mockReset();
});

describe('the intros demo', () => {
  it('shows each side, and tells the founder only “not forwarded”', () => {
    const lists = intros('/api/intros');
    expect(lists.sent.map((i: { status: string }) => i.status)).toEqual(['pending', 'not_forwarded']);
    expect(lists.toForward[0]).toMatchObject({ role: 'intermediary', status: 'pending', target: { displayName: 'Dr. Sarah Kim' } });
    expect(lists.received[0]).toMatchObject({ role: 'target', status: 'forwarded', forwardNote: expect.any(String) });
  });

  it('finds the two people who know Nikos, and only the founder’s open cards', () => {
    const route = intros('/api/intros/paths?targetId=user-nikos');
    expect(route.direct).toBe(false);
    expect(route.paths.map((p: { intermediary: { displayName: string } }) => p.intermediary.displayName)).toEqual(['Elena Papadopoulos', 'Dr. Sarah Kim']);
    expect(route.cards.map((c: { id: string }) => c.id)).toEqual(['need-athens-intros']);
    expect(intros('/api/intros/paths?targetId=user-elena').direct).toBe(true);
  });

  it('refuses a repeat, someone who knows only one of you, and contact details', () => {
    expect(() => intros('/api/intros', 'POST', { intermediaryId: 'user-sarah', targetId: 'user-nikos', cardId: 'need-athens-intros', note: 'Again please.' })).toThrow(/already asked/);
    expect(() => intros('/api/intros', 'POST', { intermediaryId: 'user-marcus', targetId: 'user-nikos', cardId: 'need-athens-intros', note: 'Hello.' })).toThrow(/does not know both/);
    expect(() => intros('/api/intros', 'POST', { intermediaryId: 'user-elena', targetId: 'user-christina', cardId: 'need-athens-intros', note: 'Mail me at a@b.co' })).toThrow();
  });

  it('accepting answers the founder’s card on the commitments ladder', () => {
    const res = intros('/api/intros/intro-christina-alex/accept', 'POST');
    expect(res).toMatchObject({ cardId: 'need-aegis-growth', intro: { status: 'accepted' } });
    const card = previewCommitmentsApi('/api/commitments/cards/need-aegis-growth', '/api/commitments/cards/need-aegis-growth', 'GET', {}, NOW) as { card: { myThread?: unknown } };
    expect(JSON.stringify(card)).toContain(res.threadId);
  });

  it('lets the intermediary forward, and the founder withdraw only while pending', () => {
    expect(intros('/api/intros/intro-dimitris-sarah/forward', 'POST', { note: 'Happy to.' }).intro).toMatchObject({ status: 'forwarded', forwardNote: 'Happy to.' });
    expect(intros('/api/intros/intro-alex-nikos', 'DELETE').intro.status).toBe('withdrawn');
    expect(() => intros('/api/intros/intro-alex-nikos', 'DELETE')).toThrow(/not yours/);
  });
});

describe('the open-to demo', () => {
  it('starts empty for Alex, saves for 90 days, and shows others only as their visibility allows', () => {
    expect(openTo('/api/open-to/me')).toEqual({ signal: null, active: false });
    const saved = openTo('/api/open-to/me', 'PUT', { kinds: ['advisor'], visibility: 'verified' });
    expect(saved.signal).toMatchObject({ kinds: ['advisor'], visibility: 'verified' });
    expect(openTo('/api/open-to/user-elena').kinds).toEqual(['cofounder']);
    // Alex is verified in the demo, so a verified-only signal shows.
    expect(openTo('/api/open-to/user-nikos').kinds).toEqual(['angel']);
    expect(openTo('/api/open-to/user-sofia').kinds).toEqual([]);
    expect(() => openTo('/api/open-to/me', 'PUT', { kinds: [] })).toThrow(/at least one/);
  });
});

describe('the assistant', () => {
  const t = (locale: 'en' | 'el') => (s: string, v?: Record<string, string | number>) => translate(locale, s, v);

  it('reads introductions and, for a named person, who could introduce them', async () => {
    const lists = intros('/api/intros');
    vi.mocked(listIntros).mockResolvedValue({ sent: lists.sent.map(toIntro), toForward: lists.toForward.map(toIntro), received: lists.received.map(toIntro) });
    vi.mocked(getIntroPaths).mockResolvedValue(intros('/api/intros/paths?targetId=user-nikos') as never);
    const reply = await AREA_READERS.get_intros({ targetId: 'user-nikos' }, { t: t('el'), locale: 'el' });
    expect(reply.section).toContain('Περιμένουν να τα προωθήσετε:');
    expect(reply.section).toContain('Δεν προωθήθηκε');
    expect(reply.section).toContain('(id user-sarah)');
    expect(reply.section).toContain('(id need-athens-intros)');
  });

  it('plans the intros read for a question, never a connection request', () => {
    const planned = planCopilotTools('Who could introduce me to Nikos?');
    expect(planned.find((p) => p.name === 'get_intros')?.args).toEqual({ name: 'Nikos' });
    expect(planned.some((p) => p.name === 'send_connection')).toBe(false);
    const greek = planCopilotTools('Δείξε μου τις συστάσεις γνωριμίας').map((p) => p.name);
    expect(greek).toContain('get_intros');
    expect(greek).not.toContain('get_endorsements');
  });

  it('requests an introduction with the withdraw as its undo', async () => {
    vi.mocked(requestIntro).mockResolvedValue(toIntro({ id: 'intro-9', status: 'pending' }));
    vi.mocked(withdrawIntro).mockResolvedValue(toIntro({ id: 'intro-9', status: 'withdrawn' }));
    expect(isUndoable('request_intro')).toBe(true);
    const outcome = await executeAction('request_intro', { targetId: 'user-nikos', intermediaryId: 'user-elena', cardId: 'need-athens-intros', note: 'Pre-seed.' });
    expect(outcome).toMatchObject({ ok: true, undo: { introId: 'intro-9' } });
    expect(await undoAction('request_intro', {}, outcome.undo)).toMatchObject({ ok: true });
    expect(withdrawIntro).toHaveBeenCalledWith('intro-9');
    expect(await executeAction('request_intro', { targetId: 'user-nikos' })).toMatchObject({ ok: false });
  });

  it('sets the signal and puts back exactly what was there before', async () => {
    vi.mocked(getMyOpenTo).mockResolvedValue({ signal: { kinds: ['mentor'], visibility: 'everyone', note: 'Fintech', expiresAt: '2026-12-01T00:00:00Z' }, active: true });
    vi.mocked(setOpenTo).mockResolvedValue({ signal: null, active: true });
    const outcome = await executeAction('set_open_to', { kinds: 'advisor, angel, astronaut', visibility: 'verified' });
    expect(setOpenTo).toHaveBeenLastCalledWith({ kinds: ['advisor', 'angel'], visibility: 'verified', note: null });
    await undoAction('set_open_to', {}, outcome.undo);
    expect(setOpenTo).toHaveBeenLastCalledWith({ kinds: ['mentor'], visibility: 'everyone', note: 'Fintech' });

    vi.mocked(getMyOpenTo).mockResolvedValue({ signal: null, active: false });
    const first = await executeAction('set_open_to', { kinds: 'cofounder' });
    await undoAction('set_open_to', {}, first.undo);
    expect(clearOpenTo).toHaveBeenCalledTimes(1);
  });
});
