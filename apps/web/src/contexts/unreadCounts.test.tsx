import { act, cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MessagingProvider, useMessaging, useMessagingUnreadCount } from './MessagingContext';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
import { queryKeys } from '@/lib/query-keys';

/**
 * One source for every unread counter.
 *
 * The sidebar, phone navigation, bottom bar and dashboard counted messages
 * from a 60 s poll; the chat bubble from MessagingContext; the chat popup's
 * tab from its own list; the header bell counted unread among the fifteen
 * notifications it had loaded. After reading a conversation or a notification
 * they showed different numbers until the next poll, and the bell's never
 * matched the sidebar's at all.
 *
 * What is asserted: a conversation list written to the shared cache by any
 * surface is the count every reader reports; marking a conversation read
 * zeroes the count and the cached row; and the surfaces that show a total
 * read it from the shared hooks rather than counting their own rows.
 */

vi.mock('@/hooks/useSession', () => ({
  useSession: () => ({ mounted: false }),
  useHasSession: () => false,
}));
vi.mock('@/hooks/useAuthenticatedSession', () => ({
  useAuthenticatedSession: () => ({ isAuthenticated: false, isChecking: false }),
}));

afterEach(cleanup);

function Readers() {
  const bubble = useMessagingUnreadCount();
  const { messages } = useUnreadCounts();
  const { markConversationRead } = useMessaging();
  return (
    <>
      <p data-testid="bubble">{bubble}</p>
      <p data-testid="nav">{messages}</p>
      <button type="button" onClick={() => markConversationRead('c1')}>read c1</button>
    </>
  );
}

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MessagingProvider>
        <Readers />
      </MessagingProvider>
    </QueryClientProvider>,
  );
  return client;
}

const LIST = {
  conversations: [
    { id: 'c1', unreadCount: 2 },
    { id: 'c2', unreadCount: 3 },
  ],
};

describe('unread messages', () => {
  it('reports one number everywhere once any surface writes the conversation list', async () => {
    const client = mount();
    expect(screen.getByTestId('bubble').textContent).toBe('0');
    await act(async () => {
      client.setQueryData(queryKeys.conversationsList, LIST);
    });
    expect(screen.getByTestId('bubble').textContent).toBe('5');
    expect(screen.getByTestId('nav').textContent).toBe('5');
  });

  it('marking a conversation read zeroes the count and the cached row', async () => {
    const client = mount();
    await act(async () => {
      client.setQueryData(queryKeys.conversationsList, LIST);
    });
    await act(async () => {
      screen.getByRole('button', { name: 'read c1' }).click();
    });
    expect(screen.getByTestId('bubble').textContent).toBe('3');
    expect(screen.getByTestId('nav').textContent).toBe('3');
    const cached = client.getQueryData<typeof LIST>(queryKeys.conversationsList);
    expect(cached?.conversations.find((c) => c.id === 'c1')?.unreadCount).toBe(0);
  });
});

describe('surfaces that show a total', () => {
  const read = (path: string) => readFileSync(path, 'utf8');

  it('the header bell shows the server count, not a count of the rows it loaded', () => {
    const bell = read('src/components/layout/NotificationsBell.tsx');
    expect(bell).toContain('useUnreadCounts()');
    expect(bell).not.toMatch(/items\.filter\([^)]*readAt[^)]*\)\.length/);
  });

  it('the chat popup tab shows the shared count, not a sum of its own list', () => {
    const popup = read('src/components/chat/UnifiedChatPopup.tsx');
    expect(popup).toContain('useMessagingUnreadCount()');
    expect(popup).not.toMatch(/conversations\.reduce\(\(s, c\) => s \+ \(c\.unreadCount/);
  });

  it('every page that fetches the conversation list publishes it to the shared cache', () => {
    for (const file of ['src/app/messages/page.tsx', 'src/components/chat/UnifiedChatPopup.tsx']) {
      const source = read(file);
      const fetches = source.match(/await listMessageConversations\(\)/g)?.length ?? 0;
      const publishes = source.match(/setQueryData\(queryKeys\.conversationsList/g)?.length ?? 0;
      expect({ file, publishes }).toEqual({ file, publishes: fetches });
    }
  });
});
