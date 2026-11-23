import { StrictMode, useEffect, useRef } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { AIStreamError, sendAIChat, streamAIChat } from '@/lib/ai-api';
import * as copilot from '@/lib/copilot-engine';
import { useAIChat } from './useAIChat';

vi.mock('@/hooks/useSession', () => ({ useSession: () => ({ hasSession: false, mounted: true }) }));
vi.mock('@/hooks/useApiAvailability', () => ({ useApiAvailability: () => true }));
vi.mock('@/lib/ai-api', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/ai-api')>(),
  streamAIChat: vi.fn(),
  sendAIChat: vi.fn(),
}));

const stream = vi.mocked(streamAIChat);
const send = vi.mocked(sendAIChat);

beforeEach(() => {
  stream.mockReset();
  send.mockReset();
  send.mockResolvedValue({ message: 'Nonstream response', model: 'nonstream-model', agent: 'general' });
});

afterEach(cleanup);

describe('useAIChat streaming safety', () => {
  it('keeps a page-list answer with no tools or actions when the provider fails', async () => {
    const question = 'Which deals are in due diligence?';
    const pageContext = { route: '/fundraising', lists: [{ id: 'due_diligence', label: 'Due diligence', shown: 1, rows: ['Aegean Ventures'] }] };
    const local = await copilot.runCopilotTurn(question, pageContext);
    expect(local).toMatchObject({ usedTools: [], actions: [] });
    expect(local.message).toContain('Aegean Ventures');
    stream.mockImplementation(async function* () { throw new ApiError(503, 'AI unavailable'); });
    const { result } = renderHook(() => useAIChat({ enableCopilot: true, pageContext }));
    await act(() => result.current.sendMessage(question));
    expect(result.current.messages[1]).toMatchObject({ content: local.message, localFallback: true });
    expect(result.current.error).toBeNull();
    expect(stream).toHaveBeenCalledOnce();
    expect(send).not.toHaveBeenCalled();
  });

  it.each([503, 401, 403, 429])('uses an existing local answer only for provider failure (%i)', async (status) => {
    vi.spyOn(copilot, 'runCopilotTurn').mockResolvedValue({ message: 'Local calendar result', actions: [], citations: [], usedTools: ['get_events'] });
    stream.mockImplementation(async function* () { throw new ApiError(status, 'AI unavailable'); });
    const { result } = renderHook(() => useAIChat({ enableCopilot: true }));
    await act(() => result.current.sendMessage('What is on my calendar?'));
    expect(stream).toHaveBeenCalledOnce();
    expect(send).not.toHaveBeenCalled();
    if (status === 503) {
      expect(result.current.messages[1]).toMatchObject({ content: 'Local calendar result', localFallback: true, isStreaming: false });
      expect(result.current.error).toBeNull();
    } else {
      expect(result.current.messages[1]).toMatchObject({ content: '', failed: true, isStreaming: false });
      expect(result.current.error).toBe('AI unavailable');
    }
  });

  it.each([
    new ApiError(401, 'Session expired'),
    new ApiError(403, 'Not allowed'),
    new ApiError(429, 'Rate limited'),
    new ApiError(404, 'Conversation not found'),
    new ApiError(500, 'Server failed'),
    new TypeError('Connection lost'),
    new DOMException('Connection timed out', 'TimeoutError'),
    new AIStreamError('Stream ended early', 'AI_STREAM_INCOMPLETE'),
    new AIStreamError('Malformed event', 'AI_STREAM_INVALID'),
  ])('does not resend on $message', async (error) => {
    stream.mockImplementation(async function* () { throw error; });
    const { result } = renderHook(() => useAIChat());
    await act(() => result.current.sendMessage('Hello'));
    expect(send).not.toHaveBeenCalled();
    expect(result.current.error).toBe(error.message);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.messages[1].isStreaming).toBe(false);
  });

  it.each([405, 501])('uses nonstream fallback only for unsupported transport %i before content', async (status) => {
    stream.mockImplementation(async function* () { throw new ApiError(status, 'Unsupported transport'); });
    const { result } = renderHook(() => useAIChat({ conversationId: 'conversation-1', agentId: 'research' }));
    await act(() => result.current.sendMessage('Hello'));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ message: 'Hello', conversationId: 'conversation-1', agentId: 'research' });
    expect(send.mock.calls[0][1]).toBeInstanceOf(AbortSignal);
    expect(result.current.messages[1]).toMatchObject({ content: 'Nonstream response', model: 'nonstream-model', isStreaming: false });
  });

  it('never resends after partial content and keeps that content visible on failure', async () => {
    stream.mockImplementation(async function* () {
      yield { chunk: 'Useful partial response', done: false, model: 'partial-model' };
      throw new ApiError(501, 'Stream interrupted');
    });
    const { result } = renderHook(() => useAIChat());
    await act(() => result.current.sendMessage('Hello'));
    expect(send).not.toHaveBeenCalled();
    expect(result.current.messages[1]).toMatchObject({ content: 'Useful partial response', model: 'partial-model', isStreaming: false });
    expect(result.current.error).toBe('Stream interrupted');
  });

  it('retains model metadata when the final event omits it', async () => {
    stream.mockImplementation(async function* () {
      yield { chunk: 'Answer', done: false, model: 'actual-model' };
      yield { done: true };
    });
    const { result } = renderHook(() => useAIChat());
    await act(() => result.current.sendMessage('Hello'));
    expect(result.current.messages[1]).toMatchObject({ content: 'Answer', model: 'actual-model', isStreaming: false });
  });

  it('marks provider fallback and replaces an interrupted partial answer with its fallback response', async () => {
    stream.mockImplementation(async function* () {
      yield { chunk: 'Interrupted answer', done: false, model: 'unavailable-model' };
      yield { chunk: 'Fallback answer', done: true, fallback: true };
    });
    const { result } = renderHook(() => useAIChat());
    await act(() => result.current.sendMessage('Hello'));
    expect(result.current.messages[1]).toMatchObject({ content: 'Fallback answer', model: 'fallback', fallback: true, isStreaming: false });
    expect(send).not.toHaveBeenCalled();
  });

  it('retains fallback metadata from the nonstream response', async () => {
    stream.mockImplementation(async function* () { throw new ApiError(405, 'Unsupported'); });
    send.mockResolvedValue({ message: 'Offline answer', model: 'fallback', fallback: true, agent: 'general' });
    const { result } = renderHook(() => useAIChat());
    await act(() => result.current.sendMessage('Hello'));
    expect(result.current.messages[1]).toMatchObject({ fallback: true, model: 'fallback' });
  });

  it('prevents duplicate sends before React has rerendered', async () => {
    stream.mockImplementation(async function* () { yield { done: true, chunk: 'Answer' }; });
    const { result } = renderHook(() => useAIChat());
    await act(async () => {
      await Promise.all([result.current.sendMessage('Hello'), result.current.sendMessage('Hello')]);
    });
    expect(stream).toHaveBeenCalledOnce();
    expect(result.current.messages).toHaveLength(2);
  });

  it('does not turn user cancellation into an error or a fallback POST', async () => {
    stream.mockImplementation(async function* () { throw new DOMException('Cancelled', 'AbortError'); });
    const { result } = renderHook(() => useAIChat());
    await act(() => result.current.sendMessage('Hello'));
    expect(send).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.isStreaming).toBe(false);
  });

  it('cancels pending nonstream fallback when messages are cleared', async () => {
    stream.mockImplementation(async function* () { throw new ApiError(405, 'Unsupported'); });
    let pendingSignal: AbortSignal | undefined;
    let started!: () => void;
    const ready = new Promise<void>((resolve) => { started = resolve; });
    send.mockImplementation((_request, signal) => {
      pendingSignal = signal;
      started();
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')));
      });
    });
    const { result } = renderHook(() => useAIChat());
    let pending!: Promise<void>;
    await act(async () => {
      pending = result.current.sendMessage('Hello');
      await ready;
    });
    expect(pendingSignal).toBeInstanceOf(AbortSignal);
    await act(async () => {
      result.current.clearMessages();
      await pending;
    });
    expect(pendingSignal?.aborted).toBe(true);
    expect(result.current.messages).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.isStreaming).toBe(false);
  });

  it('ignores late events from a cleared request and keeps a newer request active', async () => {
    let releaseOld!: () => void;
    const oldWait = new Promise<void>((resolve) => { releaseOld = resolve; });
    let releaseNew!: () => void;
    const newWait = new Promise<void>((resolve) => { releaseNew = resolve; });
    stream.mockImplementationOnce(async function* () {
      yield { chunk: 'Old partial', done: false };
      await oldWait;
      yield { chunk: 'Late old text', done: true };
    }).mockImplementationOnce(async function* () {
      yield { chunk: 'New partial', done: false };
      await newWait;
      yield { chunk: ' answer', done: true, model: 'new-model' };
    });
    const { result } = renderHook(() => useAIChat());
    let oldSend!: Promise<void>;
    let newSend!: Promise<void>;
    await act(async () => { oldSend = result.current.sendMessage('Old'); });
    act(() => result.current.clearMessages());
    await act(async () => { newSend = result.current.sendMessage('New'); });
    await act(async () => { releaseOld(); await oldSend; });
    expect(result.current.isStreaming).toBe(true);
    expect(result.current.messages.map((message) => message.content)).toEqual(['New', 'New partial']);
    await act(async () => { releaseNew(); await newSend; });
    expect(result.current.messages[1]).toMatchObject({ content: 'New partial answer', model: 'new-model', isStreaming: false });
  });

  it('stops an answer on request, keeping what arrived and marking it', async () => {
    let release: () => void = () => {};
    stream.mockImplementation(async function* (_payload: unknown, signal?: AbortSignal) {
      yield { chunk: 'The first half', done: false, model: 'm' };
      await new Promise<void>((resolve, reject) => {
        release = resolve;
        signal?.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')));
      });
      yield { chunk: ' and the rest', done: true, model: 'm' };
    } as never);
    const { result } = renderHook(() => useAIChat());
    let pending: Promise<void> = Promise.resolve();
    await act(async () => {
      pending = result.current.sendMessage('Hello');
      await new Promise((r) => setTimeout(r, 0));
    });
    await act(async () => {
      result.current.stopStreaming();
      await pending;
    });
    release();
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.messages[1]).toMatchObject({ content: 'The first half', stopped: true, isStreaming: false });
  });

  it('marks a failure with nothing received instead of writing English into the answer', async () => {
    stream.mockImplementation(async function* () { throw new ApiError(500, 'Server failed'); });
    const { result } = renderHook(() => useAIChat());
    await act(() => result.current.sendMessage('Hello'));
    expect(result.current.messages[1]).toMatchObject({ content: '', failed: true, isStreaming: false });
  });

  it('answers a question sent on mount under StrictMode (the ask bar hand-off)', async () => {
    stream.mockImplementation(async function* () {
      yield { chunk: 'The answer', done: true, model: 'm' };
    } as never);
    // What the workspace does with the ask bar's question: send once, from an
    // effect on mount, and remember it was sent.
    const useAskOnMount = () => {
      const chat = useAIChat();
      const sent = useRef(false);
      useEffect(() => {
        if (sent.current) return;
        sent.current = true;
        void chat.sendMessage('Hello');
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return chat;
    };
    const { result } = renderHook(useAskOnMount, { wrapper: StrictMode });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.messages[1]).toMatchObject({ content: 'The answer', isStreaming: false });
  });

  it('aborts the active stream on unmount', async () => {
    let activeSignal: AbortSignal | undefined;
    stream.mockImplementation(async function* (_request, signal) {
      activeSignal = signal;
      yield { chunk: 'Partial', done: false };
      await new Promise<void>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')));
      });
    });
    const { result, unmount } = renderHook(() => useAIChat());
    let pending!: Promise<void>;
    await act(async () => { pending = result.current.sendMessage('Hello'); });
    unmount();
    await pending;
    expect(activeSignal?.aborted).toBe(true);
    expect(send).not.toHaveBeenCalled();
  });
});
