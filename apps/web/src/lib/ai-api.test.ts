import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { continueAfterToolCall, streamAIChat, type ChatRequest } from './ai-api';

const encoder = new TextEncoder();

function sse(text: string) {
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  }), { headers: { 'Content-Type': 'text/event-stream' } });
}

function controlledStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const sourceCancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({
    start(value) { controller = value; },
    cancel: sourceCancel,
  });
  const response = new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
  const reader = body.getReader();
  const cancel = vi.spyOn(reader, 'cancel');
  const release = vi.spyOn(reader, 'releaseLock');
  vi.spyOn(body, 'getReader').mockReturnValue(reader);
  return {
    response,
    controller,
    cancel,
    release,
    sourceCancel,
  };
}

function httpError(status: number) {
  return new Response(JSON.stringify({ success: false, error: {
    message: `Denied ${status}`, code: `E${status}`, details: { reason: 'test' }, requestId: 'request-1',
  } }), { status, headers: { 'Content-Type': 'application/json' } });
}

async function collect(signal?: AbortSignal) {
  const events = [];
  for await (const event of streamAIChat({ message: 'Hello' }, signal)) events.push(event);
  return events;
}

beforeEach(() => {
  document.cookie = 'cfb_csrf=stream%20token; path=/';
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.cookie = 'cfb_csrf=; Max-Age=0; path=/';
});

describe('streamAIChat authenticated transport', () => {
  it('sends the double-submit CSRF cookie and authenticated credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(sse('data: {"done":true,"model":"test"}\n\n'));
    vi.stubGlobal('fetch', fetchMock);

    await collect();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/ai\/chat\/stream$/);
    expect(init.credentials).toBe('include');
    expect(new Headers(init.headers).get('x-csrf-token')).toBe('stream token');
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
    expect(new Headers(init.headers).get('Accept')).toBe('text/event-stream');
  });

  it('refreshes once on 401 and retries with the rotated CSRF cookie', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(httpError(401))
      .mockImplementationOnce(async () => {
        document.cookie = 'cfb_csrf=rotated; path=/';
        return new Response(null, { status: 204 });
      })
      .mockResolvedValueOnce(sse('data: {"done":true,"model":"refreshed"}\n\n'));
    vi.stubGlobal('fetch', fetchMock);

    expect(await collect()).toEqual([{ done: true, model: 'refreshed' }]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/api\/auth\/refresh$/);
    expect(new Headers(fetchMock.mock.calls[2][1].headers).get('x-csrf-token')).toBe('rotated');
    expect(fetchMock.mock.calls.every(([, init]) => init.credentials === 'include')).toBe(true);
  });

  it.each([403, 429])('preserves structured HTTP %i without retry', async (status) => {
    const fetchMock = vi.fn().mockResolvedValue(httpError(status));
    vi.stubGlobal('fetch', fetchMock);
    await expect(collect()).rejects.toMatchObject({
      name: 'ApiError', status, message: `Denied ${status}`, code: `E${status}`,
      requestId: 'request-1', details: { reason: 'test' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces expired sessions and does not loop after a second 401', async () => {
    const logout = vi.fn();
    window.addEventListener('cfb:logout', logout);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(httpError(401))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(httpError(401));
    vi.stubGlobal('fetch', fetchMock);
    try {
      await expect(collect()).rejects.toMatchObject({ status: 401 });
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(logout).toHaveBeenCalledOnce();
      expect(document.cookie).not.toContain('cfb_csrf=');
    } finally {
      window.removeEventListener('cfb:logout', logout);
    }
  });

  it('does not send an already-cancelled request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(sse('data: {"done":true}\n\n'));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    controller.abort();
    await expect(collect(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('cancels after headers while a read is pending and releases the reader', async () => {
    const source = controlledStream();
    source.controller.enqueue(encoder.encode('data: {"chunk":"partial","done":false}\n\n'));
    const fetchMock = vi.fn().mockResolvedValue(source.response);
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    const iterator = streamAIChat({ message: 'Hi' }, controller.signal);
    expect((await iterator.next()).value).toMatchObject({ chunk: 'partial' });
    const pending = iterator.next();
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await rejected;
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    expect(source.cancel).toHaveBeenCalledOnce();
    expect(source.release).toHaveBeenCalledOnce();
    expect(source.sourceCancel).toHaveBeenCalledOnce();
  });

  it('distinguishes initial connection timeout from user cancellation', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
    })));
    const rejected = expect(collect()).rejects.toMatchObject({ name: 'TimeoutError' });
    await vi.advanceTimersByTimeAsync(30_001);
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('times out a stalled body and cleans up without confusing it with user cancellation', async () => {
    vi.useFakeTimers();
    const source = controlledStream();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(source.response));
    const rejected = expect(collect()).rejects.toMatchObject({ name: 'TimeoutError' });
    await vi.advanceTimersByTimeAsync(30_001);
    await rejected;
    expect(source.cancel).toHaveBeenCalledOnce();
    expect(source.release).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('streamAIChat SSE framing and cleanup', () => {
  it('decodes byte-fragmented UTF-8, CRLF, multiline data and a terminal EOF frame', async () => {
    const text = ': keepalive\r\nevent: message\r\ndata:{"chunk":"Καλημέρα",\r\ndata: "done":false,"model":"test"}\r\n\r\ndata:{"done":true,"model":"test"}';
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const byte of encoder.encode(text)) controller.enqueue(Uint8Array.of(byte));
        controller.close();
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, {
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
    })));
    expect(await collect()).toEqual([
      { chunk: 'Καλημέρα', done: false, model: 'test' },
      { done: true, model: 'test' },
    ]);
    expect(body.locked).toBe(false);
  });

  it.each([
    '',
    'data: {"chunk":"partial","done":false}\n\n',
    'data: {"chunk":"partial","done":false}',
  ])('rejects EOF without a terminal done event (%s)', async (text) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sse(text)));
    await expect(collect()).rejects.toMatchObject({ code: 'AI_STREAM_INCOMPLETE' });
  });

  it.each([
    'data: {bad json}\n\ndata: {"done":true}\n\n',
    'data: {"done":"true"}\n\n',
    'data: {"chunk":3,"done":false}\n\n',
    'data: {"fallback":"yes","done":true}\n\n',
  ])('rejects malformed events rather than claiming successful truncation (%s)', async (text) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sse(text)));
    await expect(collect()).rejects.toMatchObject({ code: 'AI_STREAM_INVALID' });
  });

  it('carries validated tool-call proposals on the terminal event', async () => {
    // They arrive at the end, not mid-stream: replaying an AI POST after
    // partial output is forbidden, so the calls are assembled during the one
    // stream and handed over once it has finished.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sse(
      'data: {"chunk":"on it","done":false}\n\n' +
      'data: {"done":true,"model":"test","toolCalls":[{"name":"shortlist_add","args":{"userId":"u2"},"writes":true,"droppedArgs":[]}]}\n\n',
    )));

    const events = await collect();
    expect(events[0]).toEqual({ chunk: 'on it', done: false });
    expect(events[1].toolCalls).toEqual([
      { name: 'shortlist_add', args: { userId: 'u2' }, writes: true, droppedArgs: [] },
    ]);
  });

  it('surfaces the calls the server refused', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sse(
      'data: {"done":true,"rejectedToolCalls":[{"name":"rm_rf","reason":"\\"rm_rf\\" is not a declared capability"}]}\n\n',
    )));

    const events = await collect();
    expect(events[0].rejectedToolCalls).toEqual([
      { name: 'rm_rf', reason: '"rm_rf" is not a declared capability' },
    ]);
  });

  it('leaves both fields absent when the model asked for nothing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sse('data: {"done":true,"model":"test"}\n\n')));

    const events = await collect();
    expect(events[0].toolCalls).toBeUndefined();
    expect(events[0].rejectedToolCalls).toBeUndefined();
  });

  it.each([
    // Not a list at all.
    'data: {"done":true,"toolCalls":"shortlist_add"}\n\n',
    'data: {"done":true,"toolCalls":{"name":"shortlist_add"}}\n\n',
    // A nameless or unnamed call would build a card out of nothing.
    'data: {"done":true,"toolCalls":[{"args":{},"writes":true}]}\n\n',
    'data: {"done":true,"toolCalls":[{"name":"","args":{},"writes":true}]}\n\n',
    // Without `writes` the UI cannot tell a read from a mutation.
    'data: {"done":true,"toolCalls":[{"name":"x","args":{}}]}\n\n',
    // Args have to be an object, not a list or null.
    'data: {"done":true,"toolCalls":[{"name":"x","args":[],"writes":false}]}\n\n',
    'data: {"done":true,"toolCalls":[{"name":"x","args":null,"writes":false}]}\n\n',
    'data: {"done":true,"rejectedToolCalls":[{"name":"x"}]}\n\n',
  ])('rejects a malformed proposal instead of passing it to the UI (%s)', async (text) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sse(text)));
    await expect(collect()).rejects.toMatchObject({ code: 'AI_STREAM_INVALID' });
  });

  it('surfaces an SSE error even when followed by done', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sse(
      'event: error\ndata: {"error":"Provider failed","done":true}\n\n',
    )));
    await expect(collect()).rejects.toThrow('Provider failed');
  });

  it('does not reinterpret an unexpected success body as permission to resend', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"message":"already processed"}', {
      headers: { 'Content-Type': 'application/json' },
    })));
    await expect(collect()).rejects.toMatchObject({ code: 'AI_STREAM_INVALID' });
  });

  it('cancels and releases immediately on done, even when the server keeps the connection open', async () => {
    const source = controlledStream();
    source.controller.enqueue(encoder.encode('data: {"done":true,"fallback":true}\n\n'));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(source.response));
    expect(await collect()).toEqual([{ done: true, fallback: true }]);
    expect(source.cancel).toHaveBeenCalledOnce();
    expect(source.release).toHaveBeenCalledOnce();
  });

  it('cancels and releases when the consumer exits before done', async () => {
    const source = controlledStream();
    source.controller.enqueue(encoder.encode('data: {"chunk":"first","done":false}\n\n'));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(source.response));
    for await (const event of streamAIChat({ message: 'Hi' })) {
      expect(event.chunk).toBe('first');
      break;
    }
    expect(source.cancel).toHaveBeenCalledOnce();
    expect(source.release).toHaveBeenCalledOnce();
  });

  it('releases the reader after a network failure midstream', async () => {
    const source = controlledStream();
    source.controller.enqueue(encoder.encode('data: {"chunk":"first","done":false}\n\n'));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(source.response));
    const iterator = streamAIChat({ message: 'Hi' });
    await iterator.next();
    source.controller.error(new TypeError('Connection reset'));
    await expect(iterator.next()).rejects.toThrow('Connection reset');
    expect(source.cancel).toHaveBeenCalledOnce();
    expect(source.release).toHaveBeenCalledOnce();
  });
});

describe('continueAfterToolCall', () => {
  const previous: ChatRequest = {
    message: 'Raise my market score',
    agentId: 'readiness',
    model: 'llama3.1',
    enableTools: true,
    context: { page: '/readiness' },
    history: [{ role: 'user', content: 'hello' }, { role: 'assistant', content: 'hi' }],
  };

  it('moves the finished turn into history instead of resending it', () => {
    const next = continueAfterToolCall({
      previous,
      assistantText: 'I can tick that criterion for you.',
      toolName: 'readiness.tickCriterion',
      result: '{"ok":true,"score":55}',
    });

    // the prompt that produced the proposal is now history, not the message
    expect(next.message).not.toBe(previous.message);
    expect(next.history?.map((m) => [m.role, m.content])).toEqual([
      ['user', 'hello'],
      ['assistant', 'hi'],
      ['user', 'Raise my market score'],
      ['assistant', 'I can tick that criterion for you.'],
      ['tool', '{"ok":true,"score":55}'],
    ]);
    expect(next.history?.at(-1)?.toolName).toBe('readiness.tickCriterion');
  });

  it('carries the rest of the turn forward unchanged', () => {
    const next = continueAfterToolCall({
      previous, assistantText: 'ok', toolName: 't', result: '{}',
    });
    expect(next.agentId).toBe('readiness');
    expect(next.model).toBe('llama3.1');
    expect(next.enableTools).toBe(true);
    expect(next.context).toEqual({ page: '/readiness' });
  });

  it('omits an empty assistant turn rather than carrying a blank message', () => {
    const next = continueAfterToolCall({
      previous, assistantText: '   ', toolName: 't', result: '{}',
    });
    expect(next.history?.some((m) => m.role === 'assistant' && !m.content.trim())).toBe(false);
    expect(next.history?.at(-1)?.role).toBe('tool');
  });

  it('accepts an explicit follow-up prompt', () => {
    const next = continueAfterToolCall({
      previous, assistantText: 'ok', toolName: 't', result: '{}',
      followUp: 'What should I do next?',
    });
    expect(next.message).toBe('What should I do next?');
  });

  it('never touches the network — building a continuation sends nothing', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    continueAfterToolCall({ previous, assistantText: 'ok', toolName: 't', result: '{}' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('leaves the previous request untouched, so it can never be resent by accident', () => {
    const snapshot = JSON.parse(JSON.stringify(previous));
    continueAfterToolCall({ previous, assistantText: 'ok', toolName: 't', result: '{}' });
    expect(previous).toEqual(snapshot);
  });
});
