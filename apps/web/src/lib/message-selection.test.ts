import { describe, expect, it } from 'vitest';
import { confirmSentMessage, conversationDraft, mergeReopenedMessages, pendingConversation } from './message-selection';

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

it('keeps live messages past the first 200 and does not replace current rows with older copies', () => {
  const firstPage = Array.from({ length: 200 }, (_, index) => ({ id: String(index), timestamp: new Date(index), content: 'on server' }));
  const edited = { ...firstPage[199], content: 'edited live' };
  const recent = { id: '200', timestamp: new Date(200), content: 'received live while away' };
  const merged = mergeReopenedMessages([...firstPage.slice(0, 198), edited, recent], firstPage);
  expect(merged).toHaveLength(201);
  expect(merged.slice(-3)).toEqual([firstPage[198], edited, recent]);
});

it('replaces the temporary ID without losing local attachments, even when history arrives before the acknowledgment', () => {
  const optimistic = { id: 'temp', timestamp: new Date(10), attachments: ['local audio'] };
  const fetched = { id: 'saved', timestamp: new Date(11), attachments: [] as string[] };
  const saved = { id: fetched.id, timestamp: fetched.timestamp };
  const confirmed = [{ ...optimistic, ...saved }];
  expect(mergeReopenedMessages(confirmSentMessage([optimistic], 'temp', saved), [fetched])).toEqual(confirmed);
  expect(confirmSentMessage(mergeReopenedMessages([optimistic], [fetched]), 'temp', saved)).toEqual(confirmed);
  expect(confirmSentMessage<typeof optimistic>([], 'temp', saved)).toEqual([]);
});
