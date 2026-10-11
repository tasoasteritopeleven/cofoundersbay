import { describe, expect, it } from 'vitest';
import type { AIToolCallProposal, ChatRequest } from './ai-api';
import { MAX_MODEL_READS, followUpRequest, readsToRun } from './copilot-loop';

/**
 * Which of a model's calls run on its behalf, and what it is asked next.
 *
 * The rules that matter are the ones that keep this path safe: it never runs a
 * write, never re-reads what the planner already fetched, never lets a model
 * loop, and never writes an instruction to the model into the user's saved
 * conversation.
 */

const call = (name: string, args: AIToolCallProposal['args'] = {}, writes = false): AIToolCallProposal => ({
  name,
  args,
  writes,
  droppedArgs: [],
});

describe('choosing the reads to run', () => {
  it('runs a declared read the model asked for', () => {
    expect(readsToRun([call('get_milestones')])).toEqual([{ name: 'get_milestones', args: {} }]);
  });

  it('never runs a write, whatever the proposal claims', () => {
    // A write is only ever run by the user confirming its card.
    expect(readsToRun([call('send_connection', { receiverId: 'u1' }, true)])).toEqual([]);
    // Even one that arrives mislabelled as not writing: the declaration decides.
    expect(readsToRun([call('shortlist_add', { userId: 'u1' }, false)])).toEqual([]);
  });

  it('ignores a capability nobody declared', () => {
    expect(readsToRun([call('get_everything')])).toEqual([]);
  });

  it('skips a read the planner already ran this turn', () => {
    // Its result is already in the model's context as the tool narrative.
    expect(readsToRun([call('get_graph'), call('get_events')], ['get_graph'])).toEqual([
      { name: 'get_events', args: {} },
    ]);
  });

  it('collapses duplicate calls and caps how many run', () => {
    const many = [
      call('get_events'), call('get_events'), call('get_jobs'), call('get_groups'),
      call('get_milestones'), call('get_shortlist'),
    ];
    const reads = readsToRun(many);
    expect(reads.map((r) => r.name)).toEqual(['get_events', 'get_jobs', 'get_groups']);
    expect(reads).toHaveLength(MAX_MODEL_READS);
  });

  it('carries arguments through as strings', () => {
    expect(readsToRun([call('get_events', { q: 'fintech', limit: 3 })])).toEqual([
      { name: 'get_events', args: { q: 'fintech', limit: '3' } },
    ]);
  });
});

describe('the follow-up request', () => {
  const previous: ChatRequest = {
    message: 'which milestones are overdue?',
    conversationId: 'conv-1',
    agentId: 'cofounder',
    history: [],
    context: { route: '/dashboard' },
    enableTools: true,
  };

  const next = followUpRequest(previous, 'Let me check.', [{ name: 'get_milestones', args: {} }], '1 overdue: **Pitch deck**');

  it('does not write the instruction into the user’s saved conversation', () => {
    // The server appends a request's message to the conversation it is given.
    expect(next.conversationId).toBeUndefined();
  });

  it('offers no tools, so one question is one round of reads', () => {
    expect(next.enableTools).toBe(false);
  });

  it('carries the question, the partial answer and the result inline', () => {
    expect(next.history).toEqual([
      { role: 'user', content: 'which milestones are overdue?' },
      { role: 'assistant', content: 'Let me check.' },
      { role: 'tool', content: '1 overdue: **Pitch deck**', toolName: 'get_milestones' },
    ]);
    expect(next.message).toContain('get_milestones');
    expect(next.context).toEqual(previous.context);
  });
});
