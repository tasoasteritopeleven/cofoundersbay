import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { LanguagePreferenceProvider } from '@/lib/i18n/LanguagePreferenceContext';
import { canForwardMessage } from '@/lib/message-selection';
import { ChatWindow, type Message } from './ChatWindow';

/**
 * Changing what was said (docs §114): the sender corrects a recent message in
 * the composer, an old one stays as it is, and a voice note gets a player.
 */

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000);
const message = (over: Partial<Message>): Message => ({ id: 'm1', senderId: 'me', content: 'Original', timestamp: minutesAgo(1), status: 'read', ...over });

function renderThread(messages: Message[], handlers: { onEditMessage?: (id: string, body: string) => void; onDeleteMessage?: (m: Message) => void; onForwardMessage?: (m: Message) => void; canForwardMessage?: (m: Message) => boolean } = {}) {
  const onSendMessage = vi.fn();
  render(
    <LanguagePreferenceProvider>
      <ChatWindow
        conversation={{ id: 'c1', recipientId: 'them', recipientName: 'Elena Papadopoulos', recipientRole: 'founder' } as never}
        messages={messages}
        currentUserId="me"
        onSendMessage={onSendMessage}
        {...handlers}
      />
    </LanguagePreferenceProvider>,
  );
  return { onSendMessage };
}

/** The actions open on hover, for a real mouse. */
function hover(text: string) {
  const row = screen.getByText(text).closest('.group') as HTMLElement;
  const event = new MouseEvent('pointerover', { bubbles: true });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  fireEvent(row, event);
  fireEvent.pointerEnter(row, { pointerType: 'mouse' });
}

describe('marks on a message', () => {
  it('says when it was edited and when it was forwarded', () => {
    renderThread([message({ editedAt: minutesAgo(0), forwarded: true })]);
    expect(document.querySelector('[data-edited]')).toBeTruthy();
    expect(document.querySelector('[data-forwarded]')).toBeTruthy();
  });

  it('plays a voice note instead of linking to it', () => {
    renderThread([message({ content: 'Voice message', attachments: [{ type: 'audio/webm', url: 'https://x.test/a.webm', name: 'voice-note.webm' }] })]);
    expect(document.querySelector('audio[data-voice-note]')?.getAttribute('src')).toBe('https://x.test/a.webm');
  });

  it('keeps a link for any other file', () => {
    renderThread([message({ content: 'Deck', attachments: [{ type: 'application/pdf', url: 'https://x.test/a.pdf', name: 'deck.pdf' }] })]);
    expect(document.querySelector('audio')).toBeNull();
    expect(screen.getByRole('link', { name: /deck\.pdf/ })).toBeTruthy();
  });
});

describe('editing in the composer', () => {
  it('sends the correction, not a new message', () => {
    const onEditMessage = vi.fn();
    const { onSendMessage } = renderThread([message({})], { onEditMessage });
    hover('Original');
    fireEvent.click(screen.getByTitle(/Edit/));
    const box = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(box.value).toBe('Original');
    expect(document.querySelector('[data-editing-banner]')).toBeTruthy();
    fireEvent.change(box, { target: { value: 'Corrected' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onEditMessage).toHaveBeenCalledWith('m1', 'Corrected');
    expect(onSendMessage).not.toHaveBeenCalled();
  });

  it('asks the server for nothing when the words did not change', () => {
    const onEditMessage = vi.fn();
    renderThread([message({})], { onEditMessage });
    hover('Original');
    fireEvent.click(screen.getByTitle(/Edit/));
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onEditMessage).not.toHaveBeenCalled();
  });
});

describe('who can do what', () => {
  it('leaves demo audio playable without offering to forward it as text', () => {
    const audio = message({ content: 'Voice message', attachments: [{ type: 'audio/webm', url: 'blob:recording', name: 'voice-note.webm' }] });
    renderThread([audio, message({ id: 'm2', content: 'Plain text' })], {
      onForwardMessage: vi.fn(),
      canForwardMessage: (m) => canForwardMessage(m, true),
    });

    hover('Voice message');
    expect(document.querySelector('audio[data-voice-note]')).toBeTruthy();
    expect(screen.queryByTitle(/Forward/)).toBeNull();
    expect(canForwardMessage(audio, false)).toBe(true);

    hover('Plain text');
    expect(screen.getByTitle(/Forward/)).toBeTruthy();
  });

  it('offers no edit after fifteen minutes, but still delete and forward', () => {
    renderThread([message({ timestamp: minutesAgo(20) })], { onEditMessage: vi.fn(), onDeleteMessage: vi.fn(), onForwardMessage: vi.fn() });
    hover('Original');
    expect(screen.queryByTitle(/Edit/)).toBeNull();
    expect(screen.getByTitle(/Delete/)).toBeTruthy();
    expect(screen.getByTitle(/Forward/)).toBeTruthy();
  });

  it('offers forward alone on the other person\'s message', () => {
    renderThread([message({ senderId: 'them' })], { onEditMessage: vi.fn(), onDeleteMessage: vi.fn(), onForwardMessage: vi.fn() });
    hover('Original');
    expect(screen.queryByTitle(/Edit/)).toBeNull();
    expect(screen.queryByTitle(/Delete/)).toBeNull();
    expect(screen.getByTitle(/Forward/)).toBeTruthy();
  });

  it('offers nothing on a message still on its way', () => {
    renderThread([message({ id: 'temp-1' })], { onEditMessage: vi.fn(), onDeleteMessage: vi.fn(), onForwardMessage: vi.fn() });
    hover('Original');
    expect(screen.queryByTitle(/Edit/)).toBeNull();
    expect(screen.queryByTitle(/Delete/)).toBeNull();
    expect(screen.queryByTitle(/Forward/)).toBeNull();
  });
});
