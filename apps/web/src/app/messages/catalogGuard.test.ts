import { describe, expect, it } from 'vitest';
import { candidatesFromInbox } from '@/app/messages/ComposeMessageDialog';
import { MESSAGES_STRINGS } from '@/lib/i18n/strings-messages';
import type { Conversation } from '@/components/messaging/ConversationList';
import type { ConnectionRequestItem } from '@/lib/api';

describe('messages inbox lockstep', () => {
  it('keeps a distinct Greek string for every messages chrome key', () => {
    const missing = Object.entries(MESSAGES_STRINGS).filter(([, pair]) => !pair.el || pair.el === pair.en);
    expect(missing.map(([key]) => key)).toEqual([]);
  });

  it('builds compose candidates from chats plus accepted connections without duplicates', () => {
    const conversations: Conversation[] = [
      {
        id: 'conv-elena',
        recipientId: 'user-elena',
        recipientName: 'Elena Papadopoulos',
        recipientRole: 'founder',
        lastMessage: 'Hi',
        lastMessageTime: new Date(),
        unreadCount: 1,
      },
    ];
    const connections = [
      {
        id: 'conn-elena',
        requesterId: 'user-elena',
        receiverId: 'me',
        status: 'accepted',
        message: null,
        createdAt: '',
        updatedAt: '',
        requester: {
          id: 'user-elena',
          displayName: 'Elena Papadopoulos',
          avatarUrl: null,
          role: 'founder',
          headline: 'Harbor',
        },
        receiver: {
          id: 'me',
          displayName: 'Alex',
          avatarUrl: null,
          role: 'founder',
          headline: null,
        },
      },
      {
        id: 'conn-sarah',
        requesterId: 'me',
        receiverId: 'user-sarah',
        status: 'accepted',
        message: null,
        createdAt: '',
        updatedAt: '',
        requester: {
          id: 'me',
          displayName: 'Alex',
          avatarUrl: null,
          role: 'founder',
          headline: null,
        },
        receiver: {
          id: 'user-sarah',
          displayName: 'Sarah Kim',
          avatarUrl: null,
          role: 'mentor',
          headline: 'Mentor',
        },
      },
      {
        id: 'conn-pending',
        requesterId: 'user-x',
        receiverId: 'me',
        status: 'pending',
        message: null,
        createdAt: '',
        updatedAt: '',
        requester: {
          id: 'user-x',
          displayName: 'Pending',
          avatarUrl: null,
          role: 'founder',
          headline: null,
        },
        receiver: {
          id: 'me',
          displayName: 'Alex',
          avatarUrl: null,
          role: 'founder',
          headline: null,
        },
      },
    ] as ConnectionRequestItem[];

    const people = candidatesFromInbox(conversations, connections, 'me');
    expect(people.map((p) => p.userId).sort()).toEqual(['user-elena', 'user-sarah']);
    expect(people.find((p) => p.userId === 'user-sarah')?.name).toBe('Sarah Kim');
  });
});
