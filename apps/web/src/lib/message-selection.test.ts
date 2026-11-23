import { describe, expect, it } from 'vitest';
import { conversationDraft, pendingConversation } from './message-selection';

describe('conversation deep-link selection', () => {
  const conversations = [{ id: 'one' }, { id: 'two' }];

  it('waits for the requested thread and does not replay it on unread-count updates', () => {
    expect(pendingConversation('two', null, [])).toBeUndefined();
    expect(pendingConversation('two', null, conversations)).toBe(conversations[1]);
    expect(pendingConversation('two', 'two', conversations.map((row) => ({ ...row })))).toBeUndefined();
  });

  it('opens only a newly requested exact id, never an unrelated conversation', () => {
    expect(pendingConversation('two', 'one', conversations)).toBe(conversations[1]);
    expect(pendingConversation('unknown', 'one', conversations)).toBeUndefined();
  });
});

it('keeps the same prefill seed when reopening a conversation without a new draft', () => {
  const seed = conversationDraft(undefined, 'one', 'original text');
  expect(conversationDraft(seed, 'one')).toBe(seed);
  expect(conversationDraft(seed, 'two')).toBeUndefined();
  expect(conversationDraft(seed, 'one', 'new text')).toEqual({ id: 'one', text: 'new text' });
});
