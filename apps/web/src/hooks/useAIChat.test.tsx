import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { AIStreamError, sendAIChat, streamAIChat } from '@/lib/ai-api';
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
