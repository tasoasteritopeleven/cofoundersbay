import { afterEach, describe, expect, it } from 'vitest';
import { previewFundraisingApi, resetDemoOwnFundraising } from './fundraising-world';
import { apiCategory, apiLeadStatus, docFromApi, leadFromApi, roundFromApi, type FundraisingState } from '../fundraising-api';

const NOW = '2026-11-06T10:00:00.000Z';
const api = (path: string, method = 'GET', body: Record<string, unknown> = {}, upload: Parameters<typeof previewFundraisingApi>[3] = null) =>
  previewFundraisingApi(path, method, body, upload, NOW) as FundraisingState;

afterEach(() => resetDemoOwnFundraising());

describe('a visitor’s own round in the demo, with the API’s rules', () => {
  it('starts empty rather than with invented figures', () => {
    expect(api('/api/fundraising')).toEqual({ round: null, leads: [], documents: [] });
  });

  it('opens a plain round for the first contact', () => {
    const state = api('/api/fundraising/leads', 'POST', { investorName: 'Ada', status: 'contacted' });
    expect(state.round).toMatchObject({ name: 'My round', status: 'planning', raisedAmount: 0, targetAmount: null });
    expect(state.leads[0]).toMatchObject({ investorName: 'Ada', lastContactAt: NOW });
  });

  it('adds up what the committed investors put in, and only those', () => {
    api('/api/fundraising/rounds', 'POST', { name: 'Seed', targetAmount: 750000, currency: 'eur' });
    api('/api/fundraising/leads', 'POST', { investorName: 'Ada', status: 'committed', committedAmount: 250000 });
    const added = api('/api/fundraising/leads', 'POST', { investorName: 'Ben', status: 'meeting', committedAmount: 999 });
    expect(added.round).toMatchObject({ raisedAmount: 250000, investors: 1, currency: 'EUR' });
    const moved = api(`/api/fundraising/leads/${added.leads[0].id}`, 'PATCH', { status: 'committed' });
    expect(moved.round).toMatchObject({ raisedAmount: 250999, investors: 2 });
  });

  it('keeps a document’s name but no file, and removes it', () => {
    const state = api('/api/fundraising/documents', 'POST', {}, { name: 'deck.pdf', size: 10, type: 'application/pdf', category: 'pitch' });
    expect(state.documents[0]).toMatchObject({ name: 'deck.pdf', status: 'ready', hasFile: false, category: 'pitch' });
    expect(api(`/api/fundraising/documents/${state.documents[0].id}`, 'DELETE').documents).toEqual([]);
  });

  it('refuses what the API refuses', () => {
    expect(() => api('/api/fundraising/leads', 'POST', {})).toThrow(/investorName/);
    expect(() => api('/api/fundraising/rounds', 'POST', { name: ' ' })).toThrow(/name/);
    expect(() => api('/api/fundraising/documents', 'POST')).toThrow(/file/);
    expect(() => api('/api/fundraising/leads/nope', 'PATCH', { status: 'meeting' })).toThrow(/not found/);
    expect(() => api('/api/fundraising/rounds/nope', 'PATCH', { name: 'x' })).toThrow(/not found/);
  });

  it('leaves other paths alone', () => {
    expect(previewFundraisingApi('/api/fundraisingx', 'GET', {}, null, NOW)).toBeUndefined();
  });
});

describe('sharing the data room in the demo', () => {
  const room = () => {
    const state = api('/api/fundraising/documents', 'POST', {}, { name: 'deck.pdf', size: 10, type: 'application/pdf', category: 'pitch' });
    const withLead = api('/api/fundraising/leads', 'POST', { investorName: 'Ada' });
    return { doc: state.documents[0].id, lead: withLead.leads[0].id };
  };

  it('links a lead to a member of the demo, and unlinks', () => {
    const { lead } = room();
    const linked = api(`/api/fundraising/leads/${lead}`, 'PATCH', { platformUserId: 'demo-nikos' });
    expect(linked.leads[0]).toMatchObject({ isVerifiedOnPlatform: true, linkedAccount: { displayName: 'Nikos Andreou' } });
    expect(api(`/api/fundraising/leads/${lead}`, 'PATCH', { platformUserId: null }).leads[0]).toMatchObject({ isVerifiedOnPlatform: false, linkedAccount: null });
  });

  it('refuses a member it does not know, as the API does', () => {
    const { lead } = room();
    expect(() => api(`/api/fundraising/leads/${lead}`, 'PATCH', { platformUserId: 'nobody' })).toThrow('Member not found');
  });

  it('shares a document and takes it back', () => {
    const { doc } = room();
    const shared = api('/api/fundraising/documents/sharing', 'POST', { documentIds: [doc], shared: true });
    expect(shared.documents[0]).toMatchObject({ sharedWithLeads: true, status: 'shared' });
    const back = api('/api/fundraising/documents/sharing', 'POST', { documentIds: [doc], shared: false });
    expect(back.documents[0]).toMatchObject({ sharedWithLeads: false, status: 'ready' });
  });

  it('finds members by name, and shows the investor’s side a room', () => {
    const found = previewFundraisingApi('/api/fundraising/investors/search', 'GET', { q: 'nik' }, null, NOW) as { members: Array<{ id: string }> };
    expect(found.members.map((m) => m.id)).toEqual(['demo-nikos']);
    const shared = previewFundraisingApi('/api/fundraising/shared', 'GET', {}, null, NOW) as { rooms: Array<{ documents: unknown[] }> };
    expect(shared.rooms[0].documents.length).toBeGreaterThan(0);
  });
});

describe('the API’s words on the page’s cards', () => {
  it('maps a lead, with the committed amount over the first guess', () => {
    const lead = {
      id: 'l1', investorName: 'Ada', investorFirm: 'Aegean', investorType: 'VC', stageFocus: 'Seed', checkSizeText: '€25K–€150K',
      status: 'due_diligence' as const, committedAmount: null, currency: 'EUR', lastContactAt: NOW, notes: 'Warm', isVerifiedOnPlatform: false, linkedAccount: null, nextFollowUpAt: null, nextStep: null,
    };
    expect(leadFromApi(lead)).toMatchObject({ name: 'Ada', firm: 'Aegean', status: 'dd', checkSize: '€25K–€150K', lastContact: NOW, notes: 'Warm' });
    expect(leadFromApi({ ...lead, status: 'committed', committedAmount: 250000 }).checkSize).toBe('€250,000');
    expect(leadFromApi({ ...lead, status: 'inactive' }).status).toBe('passed');
    expect(leadFromApi({ ...lead, nextFollowUpAt: '2026-10-25T00:00:00.000Z' }).nextFollowUp).toBe('2026-10-25');
    expect(apiLeadStatus('dd')).toBe('due_diligence');
  });

  it('maps a round without a target to zero, which the card reads as no target', () => {
    const round = roundFromApi({
      id: 'r1', name: 'Seed', roundType: 'convertible_note', status: 'cancelled', currency: 'USD', targetAmount: null, raisedAmount: 0,
      investors: 0, preMoneyValuation: null, leadInvestorName: null, closingDate: null, description: null,
    });
    expect(round).toMatchObject({ target: 0, currency: '$', type: 'Convertible note', status: 'closed', currencyCode: 'USD' });
  });

  it('maps a document and its category both ways', () => {
    const doc = docFromApi({ id: 'd1', name: 'Deck', category: 'financials', status: 'archived', isRequired: true, hasFile: true, fileName: 'deck.pdf', sharedWithLeads: false, openedBy: [], lastOpenedAt: null, fileMimeType: null, fileSizeBytes: 1, viewCount: 0, updatedAt: NOW });
    expect(doc).toMatchObject({ category: 'Financials', status: 'draft', hasFile: true, fileName: 'deck.pdf', isRequired: true });
    expect(apiCategory('Financials')).toBe('financials');
  });
});
