import { describe, expect, it } from 'vitest';
import { actionsFromToolCalls } from './copilot-engine';
import { getActionSpec } from './action-registry';
import { listActionIds } from '@cofounderbay/shared';
import type { AIToolCallProposal } from './ai-api';

/**
 * The path a capability takes when the *model* chooses it.
 *
 * This is the half that was missing: the catalogue was declared, offered and
 * validated server-side, and the client never asked for it, so a model's tool
 * call had nowhere to land. These cover the landing — that a proposal becomes
 * the same confirmable card a keyword match produces, and that a proposal the
 * user must not be shown is dropped rather than rendered.
 */

const call = (name: string, args: Record<string, string | number | boolean> = {}): AIToolCallProposal => ({
  name,
  args,
  writes: getActionSpec(name)?.writes ?? false,
  droppedArgs: [],
});

describe('rendering a model’s tool calls', () => {
  it('builds a card from the declaration, so no second copy exists to drift', () => {
    const [card] = actionsFromToolCalls([call('shortlist_add', { userId: 'u1' })]);
    const spec = getActionSpec('shortlist_add');

    expect(card.tool).toBe('shortlist_add');
    expect(card.title).toBe(spec?.label.en);
    expect(card.confirmLabel).toBe(spec?.confirmLabel?.en);
    expect(card.payload).toEqual({ userId: 'u1' });
    expect(card.status).toBe('pending');
  });

  it('answers a Greek reader in Greek without a catalogue entry', () => {
    // The declaration carries both halves, which is why adding a capability
    // needs no i18n work before it can be shown.
    const [card] = actionsFromToolCalls([call('shortlist_add', { userId: 'u1' })], 'el');
    const spec = getActionSpec('shortlist_add');

    expect(card.title).toBe(spec?.label.el);
    expect(card.confirmLabel).toBe(spec?.confirmLabel?.el);
    expect(card.title).not.toBe(spec?.label.en);
  });

  it('drops a read tool rather than asking the user to confirm a question', () => {
    expect(actionsFromToolCalls([call('get_graph'), call('search_people', { q: 'x' })])).toEqual([]);
  });

  it('ignores a capability nobody declared', () => {
    // The server refuses these first; this is the second line, because a card
    // for an unknown tool would confirm into `Unsupported action`.
    expect(actionsFromToolCalls([call('delete_everything', { yes: true })])).toEqual([]);
  });

  it('carries a navigation target through as the card’s destination', () => {
    const [card] = actionsFromToolCalls([call('navigate', { href: '/matches' })]);
    expect(card.href).toBe('/matches');
    expect(card.payload).toEqual({ href: '/matches' });
  });

  it('names arguments the server dropped instead of hiding them', () => {
    const [card] = actionsFromToolCalls([
      { ...call('send_connection', { receiverId: 'u2' }), droppedArgs: ['urgency', 'tone'] },
    ]);
    expect(card.description).toContain('urgency, tone');
  });

  it('renders every declared mutation, so no capability is unreachable by model', () => {
    const mutations = [...listActionIds()].filter((id) => getActionSpec(id)?.kind === 'mutation');
    const cards = actionsFromToolCalls(mutations.map((id) => call(id)));

    expect(cards.map((c) => c.tool).sort()).toEqual([...mutations].sort());
    for (const card of cards) {
      expect(card.title.trim(), `${card.tool} has no title`).not.toBe('');
      expect(card.confirmLabel.trim(), `${card.tool} has no confirm label`).not.toBe('');
      expect(card.id, `${card.tool} has no id`).toBeTruthy();
    }
    // Ids must be distinct or React renders one card for several proposals.
    expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);
  });

  it('preserves the order the model asked in', () => {
    const cards = actionsFromToolCalls([
      call('navigate', { href: '/readiness' }),
      call('shortlist_add', { userId: 'u1' }),
    ]);
    expect(cards.map((c) => c.tool)).toEqual(['navigate', 'shortlist_add']);
  });
});
