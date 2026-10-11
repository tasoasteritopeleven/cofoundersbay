import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toToolCatalog } from '@cofounderbay/shared';
import { OllamaService } from './ollama.service';

/**
 * Covers the transport half of tool calling: whether the catalogue reaches the
 * model, and whether what it asks for survives a stream.
 *
 * Streaming is the interesting case. Ollama sends tool calls inside a streamed
 * message rather than as character deltas, and may send more than one such
 * message, so they are collected across the whole stream instead of the last
 * one winning. They are delivered through `onToolCalls`, which is passed per
 * them, because `chatStream` yields strings and every existing caller depends
 * on that signature.
 *
 * What this does not cover: a real Ollama server, or whether any particular
 * model honours a catalogue at all.
 */

function service(models: string[] = ['test-model']): OllamaService {
  const config = { get: (key: string) => (key === 'OLLAMA_MODEL' ? 'test-model' : undefined) };
  const instance = new OllamaService(config as never, { register: vi.fn() } as never);
  // Both guarded by `isAvailable`, which normally comes from a health check.
  Object.assign(instance, { isAvailable: true, availableModels: models });
  return instance;
}

/** One Ollama NDJSON stream, delivered in arbitrarily-chopped byte slices. */
function streamResponse(lines: unknown[], chunkSize = 7): Response {
  const payload = lines.map((line) => `${JSON.stringify(line)}\n`).join('');
  const bytes = new TextEncoder().encode(payload);
  let offset = 0;

  return {
    ok: true,
    body: {
      getReader: () => ({
        read: async () => {
          if (offset >= bytes.length) return { done: true, value: undefined };
          const slice = bytes.slice(offset, offset + chunkSize);
          offset += chunkSize;
          return { done: false, value: slice };
        },
      }),
    },
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

function bodyOf(call: number = 0): Record<string, unknown> {
  return JSON.parse(fetchMock.mock.calls[call][1].body);
}

/**
 * Collects what a single request produced.
 *
 * Tool calls used to live on the service as `lastToolCalls` and be read back
 * with a `takeLastToolCalls()` reader. A provider is a singleton, so two
 * chats shared that field and could consume each other's proposals; delivery
 * is per-request now, through the `onToolCalls` option.
 */
function collector() {
  const seen: unknown[] = [];
  return {
    onToolCalls: (calls: unknown) => {
      seen.push(calls);
    },
    /** What this request delivered, or null when it delivered nothing. */
    get last(): unknown {
      return seen.length ? seen[seen.length - 1] : null;
    },
    get count(): number {
      return seen.length;
    },
  };
}

describe('offering the catalogue to the model', () => {
  it('omits tools entirely when none are supplied', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: 'hello' } }),
    } as unknown as Response);

    await service().chat([{ role: 'user', content: 'hi' }]);

    // The request has to stay byte-identical to before tools existed.
    expect(bodyOf()).not.toHaveProperty('tools');
  });

  it('omits tools when the catalogue is empty rather than sending []', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: 'hello' } }),
    } as unknown as Response);

    await service().chat([{ role: 'user', content: 'hi' }], { tools: [] });
    expect(bodyOf()).not.toHaveProperty('tools');
  });

  it('sends the catalogue on both the single-shot and streaming paths', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: 'hello' } }),
    } as unknown as Response);
    await service().chat([{ role: 'user', content: 'hi' }], { tools: toToolCatalog() });
    expect((bodyOf().tools as unknown[]).length).toBe(toToolCatalog().length);

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(streamResponse([{ message: { content: 'hi' } }, { done: true }]));
    for await (const _ of service().chatStream([{ role: 'user', content: 'hi' }], {
      tools: toToolCatalog(),
    })) {
      /* drain */
    }
    // chatStream used to build its body without ever looking at options.tools.
    expect((bodyOf().tools as unknown[]).length).toBe(toToolCatalog().length);
  });
});

describe('reading tool calls back off a stream', () => {
  it('collects calls from every message, not just the last', async () => {
    fetchMock.mockResolvedValue(
      streamResponse([
        { message: { content: 'looking' } },
        { message: { tool_calls: [{ function: { name: 'get_graph', arguments: {} } }] } },
        { message: { content: ' and searching' } },
        {
          message: {
            tool_calls: [{ function: { name: 'search_people', arguments: { q: 'x' } } }],
          },
        },
        { done: true },
      ]),
    );

    const instance = service();
    const sink = collector();
    const chunks: string[] = [];
    for await (const chunk of instance.chatStream([{ role: 'user', content: 'hi' }], {
      onToolCalls: sink.onToolCalls,
    })) {
      chunks.push(chunk);
    }

    // Text still streams exactly as before.
    expect(chunks.join('')).toBe('looking and searching');

    const calls = sink.last as Array<{ function: { name: string } }>;
    expect(calls.map((c) => c.function.name)).toEqual(['get_graph', 'search_people']);
  });

  it('survives the JSON being split across byte reads', async () => {
    // chunkSize 3 cuts through the middle of tokens and of the NDJSON newline.
    fetchMock.mockResolvedValue(
      streamResponse(
        [
          { message: { tool_calls: [{ function: { name: 'navigate', arguments: { href: '/matches' } } }] } },
          { done: true },
        ],
        3,
      ),
    );

    const instance = service();
    const sink = collector();
    for await (const _ of instance.chatStream([{ role: 'user', content: 'hi' }], {
      onToolCalls: sink.onToolCalls,
    })) {
      /* drain */
    }

    expect(sink.last).toEqual([
      { function: { name: 'navigate', arguments: { href: '/matches' } } },
    ]);
  });

  it('delivers to this request only, so a later turn cannot inherit them', async () => {
    fetchMock.mockResolvedValue(
      streamResponse([
        { message: { tool_calls: [{ function: { name: 'get_graph', arguments: {} } }] } },
        { done: true },
      ]),
    );

    const instance = service();
    const first = collector();
    for await (const _ of instance.chatStream([{ role: 'user', content: 'hi' }], {
      onToolCalls: first.onToolCalls,
    })) {
      /* drain */
    }
    expect(first.last).not.toBeNull();

    // A second request on the same singleton gets its own sink, so nothing of
    // the first turn's can reach it. That is the whole point of the change.
    fetchMock.mockResolvedValue(
      streamResponse([{ message: { content: 'text only' } }, { done: true }]),
    );
    const second = collector();
    for await (const _ of instance.chatStream([{ role: 'user', content: 'again' }], {
      onToolCalls: second.onToolCalls,
    })) {
      /* drain */
    }
    expect(second.last).toBeNull();
    expect(first.count).toBe(1);
  });

  it('reports null when the model asked for nothing', async () => {
    fetchMock.mockResolvedValue(streamResponse([{ message: { content: 'just text' } }, { done: true }]));

    const instance = service();
    const sink = collector();
    for await (const _ of instance.chatStream([{ role: 'user', content: 'hi' }], {
      onToolCalls: sink.onToolCalls,
    })) {
      /* drain */
    }

    expect(sink.last).toBeNull();
  });

  it('still reports what it collected when the consumer stops early', async () => {
    fetchMock.mockResolvedValue(
      streamResponse([
        { message: { tool_calls: [{ function: { name: 'get_graph', arguments: {} } }] } },
        { message: { content: 'more' } },
        { done: true },
      ]),
    );

    const instance = service();
    const stopped = collector();
    // Abandoning the generator runs its `finally`, which is where the calls are
    // delivered — so an aborted stream still reports what it had assembled.
    for await (const _ of instance.chatStream([{ role: 'user', content: 'hi' }], {
      onToolCalls: stopped.onToolCalls,
    })) {
      break;
    }
    expect(stopped.last).not.toBeNull();

    fetchMock.mockResolvedValue(streamResponse([{ message: { content: 'text only' } }, { done: true }]));
    const next = collector();
    for await (const _ of instance.chatStream([{ role: 'user', content: 'again' }], {
      onToolCalls: next.onToolCalls,
    })) {
      /* drain */
    }
    expect(next.last).toBeNull();
  });

  it('ignores a malformed tool_calls field instead of throwing', async () => {
    fetchMock.mockResolvedValue(
      streamResponse([
        { message: { tool_calls: 'get_graph' } },
        { message: { tool_calls: null } },
        { message: { content: 'ok' } },
        { done: true },
      ]),
    );

    const instance = service();
    const sink = collector();
    const chunks: string[] = [];
    for await (const chunk of instance.chatStream([{ role: 'user', content: 'hi' }], {
      onToolCalls: sink.onToolCalls,
    })) {
      chunks.push(chunk);
    }

    expect(chunks.join('')).toBe('ok');
    expect(sink.last).toBeNull();
  });
});

describe('sending a tool result back', () => {
  /**
   * The other half of the loop. A turn that proposed is finished; the result of
   * the confirmed action arrives inside the history of the *next* turn, as a
   * `tool` message. These cover the wire shape, because Ollama names the field
   * `tool_name` and rejects unknown keys on a message.
   */

  it('maps a tool result onto the Ollama wire shape', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: 'done' } }),
    } as unknown as Response);

    await service().chat([
      { role: 'user', content: 'tick it' },
      { role: 'assistant', content: 'I can do that.' },
      { role: 'tool', content: '{"ok":true}', toolName: 'readiness.tickCriterion' },
    ]);

    const sent = bodyOf().messages as Array<Record<string, unknown>>;
    expect(sent.at(-1)).toEqual({
      role: 'tool',
      content: '{"ok":true}',
      tool_name: 'readiness.tickCriterion',
    });
  });

  it('omits tool_name when the caller did not name one', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: 'done' } }),
    } as unknown as Response);

    await service().chat([{ role: 'tool', content: '{}' }]);

    const sent = bodyOf().messages as Array<Record<string, unknown>>;
    expect(sent.at(-1)).toEqual({ role: 'tool', content: '{}' });
    expect(sent.at(-1)).not.toHaveProperty('tool_name');
  });

  it('leaves a conversation without tool results byte-identical to before the role existed', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: 'hi' } }),
    } as unknown as Response);

    await service().chat([
      { role: 'system', content: 'be brief' },
      { role: 'user', content: 'hello' },
    ]);

    const sent = bodyOf().messages as Array<Record<string, unknown>>;
    expect(sent).toEqual([
      { role: 'system', content: 'be brief' },
      { role: 'user', content: 'hello' },
    ]);
    expect(sent.every((m) => Object.keys(m).length === 2)).toBe(true);
  });

  it('carries a tool result through the streaming path too', async () => {
    fetchMock.mockResolvedValue(streamResponse([
      { message: { content: 'ok' }, done: false },
      { done: true },
    ]));

    const out: string[] = [];
    for await (const chunk of service().chatStream([
      { role: 'tool', content: '{"score":55}', toolName: 'readiness.tickCriterion' },
    ])) {
      out.push(chunk);
    }

    const sent = bodyOf().messages as Array<Record<string, unknown>>;
    expect(sent.at(-1)).toEqual({
      role: 'tool',
      content: '{"score":55}',
      tool_name: 'readiness.tickCriterion',
    });
    expect(out.join('')).toBe('ok');
  });
});
