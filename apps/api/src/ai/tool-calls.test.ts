import { describe, expect, it } from 'vitest';
import { listActionIds, toToolCatalog } from '@cofounderbay/shared';
import { reviewToolCall, reviewToolCalls } from './tool-calls';

/**
 * These are the checks that make "enforcement on the server" mean something.
 *
 * The catalogue the model is offered and the list checked here come from the
 * same declarations, so the interesting cases are the ones where a model does
 * not cooperate: a name nobody declared, a required argument left out, a type
 * that does not match, arguments as a JSON string, and output that is not the
 * shape the code hoped for.
 */

describe('tool catalogue', () => {
  it('offers exactly the declared capabilities', () => {
    const offered = toToolCatalog()
      .map((entry) => entry.function.name)
      .sort();
    expect(offered).toEqual([...listActionIds()].sort());
  });

  it('describes every tool as a function with an object parameter schema', () => {
    for (const entry of toToolCatalog()) {
      expect(entry.type).toBe('function');
      expect(entry.function.description.trim().length).toBeGreaterThan(0);
      expect(entry.function.parameters.type).toBe('object');
      for (const name of entry.function.parameters.required) {
        expect(Object.keys(entry.function.parameters.properties)).toContain(name);
      }
    }
  });
});

describe('reviewing a single tool call', () => {
  it('accepts a declared read with no arguments', () => {
    const result = reviewToolCall({ function: { name: 'get_graph', arguments: {} } });
    expect(result).toEqual({
      ok: true,
      call: { name: 'get_graph', args: {}, writes: false, droppedArgs: [] },
    });
  });

  it('accepts a declared mutation and reports that it writes', () => {
    const result = reviewToolCall({
      function: { name: 'shortlist_add', arguments: { userId: 'u1' } },
    });
    expect(result.ok).toBe(true);
    expect(result.ok && result.call).toEqual({
      name: 'shortlist_add',
      args: { userId: 'u1' },
      writes: true,
      droppedArgs: [],
    });
  });

  it('rejects a capability nobody declared', () => {
    const result = reviewToolCall({ function: { name: 'delete_account', arguments: {} } });
    expect(result).toEqual({
      ok: false,
      rejection: { name: 'delete_account', reason: '"delete_account" is not a declared capability' },
    });
  });

  it('rejects a call with no name at all', () => {
    expect(reviewToolCall({})).toEqual({
      ok: false,
      rejection: { name: '', reason: 'tool call has no name' },
    });
  });

  it('rejects a missing required argument by name', () => {
    const result = reviewToolCall({ function: { name: 'send_connection', arguments: {} } });
    expect(result).toEqual({
      ok: false,
      rejection: { name: 'send_connection', reason: 'missing required argument "receiverId"' },
    });
  });

  it('rejects a wrong type instead of coercing it', () => {
    // A model that sends a number for a string argument has misread the
    // schema. Coercing hides that from the logs where it would be fixed.
    const result = reviewToolCall({
      function: { name: 'shortlist_add', arguments: { userId: 42 } },
    });
    expect(result).toEqual({
      ok: false,
      rejection: { name: 'shortlist_add', reason: 'argument "userId" must be string, got number' },
    });
  });

  it('treats an empty string as an absent argument', () => {
    expect(reviewToolCall({ function: { name: 'shortlist_add', arguments: { userId: '' } } })).toEqual(
      {
        ok: false,
        rejection: { name: 'shortlist_add', reason: 'missing required argument "userId"' },
      },
    );
  });

  it('omits optional arguments that were not supplied', () => {
    const result = reviewToolCall({
      function: { name: 'search_people', arguments: { q: 'technical cofounder' } },
    });
    expect(result.ok && result.call.args).toEqual({ q: 'technical cofounder' });
  });

  it('drops arguments the declaration does not define, and says which', () => {
    const result = reviewToolCall({
      function: { name: 'shortlist_add', arguments: { userId: 'u1', isAdmin: true, note: 'x' } },
    });
    expect(result.ok).toBe(true);
    expect(result.ok && result.call.args).toEqual({ userId: 'u1' });
    expect(result.ok && result.call.droppedArgs.sort()).toEqual(['isAdmin', 'note']);
  });

  it('parses arguments delivered as a JSON string', () => {
    // Ollama sends an object; OpenAI-compatible endpoints send a string.
    const result = reviewToolCall({
      function: { name: 'navigate', arguments: '{"href":"/matches"}' },
    });
    expect(result.ok && result.call.args).toEqual({ href: '/matches' });
  });

  it('treats unparseable arguments as absent rather than throwing', () => {
    const result = reviewToolCall({ function: { name: 'navigate', arguments: '{not json' } });
    expect(result).toEqual({
      ok: false,
      rejection: { name: 'navigate', reason: 'missing required argument "href"' },
    });
  });

  it('reads the flattened shape as well as the nested one', () => {
    const result = reviewToolCall({ name: 'navigate', arguments: { href: '/dashboard' } });
    expect(result.ok && result.call.args).toEqual({ href: '/dashboard' });
  });
});

describe('reviewing a batch of tool calls', () => {
  it('keeps the good ones and explains the rest', () => {
    const review = reviewToolCalls([
      { function: { name: 'get_graph', arguments: {} } },
      { function: { name: 'rm_rf', arguments: {} } },
      { function: { name: 'shortlist_add', arguments: {} } },
    ]);

    expect(review.accepted.map((c) => c.name)).toEqual(['get_graph']);
    expect(review.rejected).toEqual([
      { name: 'rm_rf', reason: '"rm_rf" is not a declared capability' },
      { name: 'shortlist_add', reason: 'missing required argument "userId"' },
    ]);
  });

  it('returns nothing accepted for output that is not a list', () => {
    // A malformed AI response has already taken this product's pages down once
    // (1a309c6). It has to come back empty, not throw.
    for (const malformed of [undefined, null, 'tools', 42, {}, { tool_calls: [] }]) {
      expect(reviewToolCalls(malformed)).toEqual({ accepted: [], rejected: [] });
    }
  });

  it('rejects non-object entries without throwing', () => {
    const review = reviewToolCalls(['get_graph', null, 7]);
    expect(review.accepted).toEqual([]);
    expect(review.rejected).toHaveLength(3);
    expect(review.rejected.every((r) => r.reason === 'tool call is not an object')).toBe(true);
  });

  it('never accepts a write without marking it as one', () => {
    const review = reviewToolCalls([
      { function: { name: 'send_connection', arguments: { receiverId: 'u2' } } },
      { function: { name: 'start_or_send_message', arguments: { userId: 'u3' } } },
      { function: { name: 'search_people', arguments: { q: 'x' } } },
    ]);

    const writes = review.accepted.filter((call) => call.writes).map((c) => c.name).sort();
    expect(writes).toEqual(['send_connection', 'start_or_send_message']);
    expect(review.accepted.find((c) => c.name === 'search_people')?.writes).toBe(false);
  });
});

describe('role gating (Wave E)', () => {
  // AdminController is @Roles('admin', 'super_admin'); the two platform reads
  // that call it declare the same roles, and nothing else declares any.
  it('declares roles only where the endpoint has them', () => {
    const limited = listActionIds().filter((id) => toToolCatalog('founder').every((tool) => tool.function.name !== id));
    expect(limited.sort()).toEqual(['get_moderation_queue', 'get_platform_stats']);
  });

  it('offers admin reads to an admin and not to a founder', () => {
    const forAdmin = toToolCatalog('admin').map((tool) => tool.function.name);
    expect(forAdmin).toContain('get_platform_stats');
    expect(toToolCatalog('super_admin').map((tool) => tool.function.name)).toContain('get_moderation_queue');
    expect(toToolCatalog(null).map((tool) => tool.function.name)).not.toContain('get_platform_stats');
    // No role argument: the full catalogue, for documentation.
    expect(toToolCatalog().length).toBe(listActionIds().length);
  });

  it('rejects a role-limited call from a caller without the role, with a reason', () => {
    const call = { function: { name: 'get_moderation_queue', arguments: {} } };
    const refused = reviewToolCall(call, 'founder');
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.rejection.reason).toMatch(/not available to this role/);
    expect(reviewToolCall(call, 'admin').ok).toBe(true);
    // Shape-only review (no role given) is unchanged.
    expect(reviewToolCall(call).ok).toBe(true);
  });

  it('keeps every other capability open to every role', () => {
    const review = reviewToolCalls([
      { function: { name: 'get_events', arguments: {} } },
      { function: { name: 'get_platform_stats', arguments: {} } },
    ], 'investor');
    expect(review.accepted.map((c) => c.name)).toEqual(['get_events']);
    expect(review.rejected.map((r) => r.name)).toEqual(['get_platform_stats']);
  });
});
