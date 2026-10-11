import { ApiError, apiFetch, apiRequest, withApiAbort } from './api';
import type { CfbGlyphName } from '@/components/icons/CfbGlyph';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** Set on a `tool` message: which declared capability the result belongs to. */
  toolName?: string;
}

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  suggestedQuestions: string[];
}

export interface ModelInfo {
  name: string;
  size: number;
  modifiedAt: string;
}

export interface AIHealthStatus {
  available: boolean;
  version?: string;
  models: string[];
  error?: string;
}

export interface AIConversation {
  id: string;
  userId: string;
  agentId: string;
  title: string;
  messages: AIConversationMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface AIConversationMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  model?: string;
  createdAt: string;
}

export interface ChatResponse {
  message: string;
  agent: string;
  model: string;
  fallback?: boolean;
  /**
   * The non-streaming route returns these exactly as the streaming route's
   * terminal event does — the controller reviews them the same way. They were
   * missing from this type, so a client that fell back to this route discarded
   * every proposal the model made.
   */
  toolCalls?: AIToolCallProposal[];
  rejectedToolCalls?: AIToolCallRejection[];
}

export interface ChatRequest {
  message: string;
  conversationId?: string;
  agentId?: string;
  model?: string;
  history?: ChatMessage[];
  context?: Record<string, unknown>;
  /**
   * Ask the server to offer the model the function-calling catalogue.
   *
   * Opt-in: omitting it produces the same request as before tools existed, and
   * not every model Ollama serves supports them.
   */
  enableTools?: boolean;
}

/**
 * A capability the model asked for, already checked against the shared
 * declarations by the server.
 *
 * It is a proposal, not an outcome. Nothing has run: `writes` says whether
 * confirming it would reach a write endpoint, and the user confirms before it
 * does.
 */
export interface AIToolCallProposal {
  name: string;
  args: Record<string, string | number | boolean>;
  writes: boolean;
  droppedArgs: string[];
}

export interface AIToolCallRejection {
  name: string;
  reason: string;
}

/**
 * Build the turn that follows a tool call the user confirmed.
 *
 * The constraint this exists to satisfy: AGENTS.md forbids repeating an AI POST
 * after partial streaming output. A streamed turn that ends in a proposal has
 * already delivered text to the screen, so that request can never be sent
 * again -- not to "finish" it, not to hand the model the result.
 *
 * So the loop is closed by moving forward rather than back. The turn that
 * proposed is *complete*: its prompt and the text that streamed both become
 * history. The result of the action the user confirmed is appended as a `tool`
 * message, and the next turn is a new POST with its own prompt. The model sees
 * the whole exchange; the transport never replays anything.
 *
 * It is written as a pure function over the previous request for the same
 * reason: there is no path here that reaches the network, so no caller can
 * accidentally turn a continuation into a retry. It returns a request; sending
 * it is a separate, deliberate act.
 */
export function continueAfterToolCall(params: {
  /** The request whose turn produced the proposal. Used only as a source of history. */
  previous: ChatRequest;
  /** The assistant text that already streamed. Carried forward, never re-fetched. */
  assistantText: string;
  /** The capability that ran, as named in the accepted proposal. */
  toolName: string;
  /** What the client's action returned, serialised for the model to read. */
  result: string;
  /**
   * What to ask next. Defaults to a neutral continuation so the caller is not
   * forced to invent a prompt for the common "now carry on" case.
   */
  followUp?: string;
}): ChatRequest {
  const { previous, assistantText, toolName, result, followUp } = params;

  const history: ChatMessage[] = [
    ...(previous.history ?? []),
    { role: 'user', content: previous.message },
  ];
  // An empty assistant turn is possible when the model proposed before saying
  // anything; carrying an empty message would only add noise for the model.
  if (assistantText.trim()) {
    history.push({ role: 'assistant', content: assistantText });
  }
  history.push({ role: 'tool', content: result, toolName });

  return {
    ...previous,
    message: followUp ?? `The ${toolName} action completed. Continue from its result.`,
    history,
  };
}

export type AIPreferences = {
  preferredModel?: string | null;
  preferredProvider?: string | null;
  temperature?: number | null;
  maxTokens?: number | null;
  responseStyle?: string | null;
  responseLanguage?: string | null;
  useEmoji?: boolean;
  enableStreaming?: boolean;
  enableSuggestions?: boolean;
  enableContextMemory?: boolean;
  enableAutoSave?: boolean;
  saveConversations?: boolean;
  shareForTraining?: boolean;
  anonymizeData?: boolean;
  defaultAgent?: string | null;
};

// ─────────────────────────────────────────────────────────────
// API Functions
// ─────────────────────────────────────────────────────────────

export async function getAIHealth(): Promise<AIHealthStatus> {
  return apiRequest<AIHealthStatus>('/api/ai/health');
}

export async function getAIModels(): Promise<{ models: ModelInfo[]; default: string }> {
  return apiRequest<{ models: ModelInfo[]; default: string }>('/api/ai/models');
}

export async function getAIAgents(): Promise<{ agents: AgentConfig[] }> {
  return apiRequest<{ agents: AgentConfig[] }>('/api/ai/agents');
}

export type AIActionOutcome = 'applied' | 'undone' | 'failed';

export type AIActionAuditEntry = {
  id: string;
  actionId: string;
  outcome: string;
  entityType: string;
  entityId: string | null;
  args: Record<string, unknown>;
  writes: boolean;
  reversalKind: string | null;
  createdAt: string;
};

/**
 * Records an assistant action the user confirmed.
 *
 * The server validates `actionId` and `args` against the shared declarations
 * and answers `{ recorded: false, reason }` for anything it will not store, so
 * a caller cannot fill the trail with capabilities that do not exist.
 *
 * Callers must not surface a failure here: by the time this runs the action has
 * already happened, and reporting the audit write as the action's outcome would
 * tell the user something untrue.
 */
export async function recordAIAction(entry: {
  actionId: string;
  outcome: AIActionOutcome;
  args?: Record<string, unknown>;
}): Promise<{ recorded: boolean; reason?: string }> {
  return apiRequest<{ recorded: boolean; reason?: string }>('/api/ai/actions', {
    method: 'POST',
    body: JSON.stringify(entry),
  });
}

/** The signed-in user's own action trail. */
export async function listAIActions(limit?: number): Promise<{ entries: AIActionAuditEntry[] }> {
  const query = limit ? `?limit=${limit}` : '';
  return apiRequest<{ entries: AIActionAuditEntry[] }>(`/api/ai/actions${query}`);
}

export async function sendAIChat(request: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
  return apiRequest<ChatResponse>('/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify(request),
    signal,
  });
}

export interface AIStreamEvent {
  chunk?: string;
  done: boolean;
  model?: string;
  fallback?: boolean;
  /**
   * Present only on the terminal event, and only when the model asked for
   * something the server accepted.
   *
   * They arrive at the end rather than mid-stream on purpose: replaying an AI
   * POST after partial output is forbidden, so the calls are assembled during
   * the one stream and handed over once it has finished. Acting on them is a
   * new turn the user starts by confirming, never a resend of this one.
   */
  toolCalls?: AIToolCallProposal[];
  /** Calls the server refused, so a model that invents capabilities is visible. */
  rejectedToolCalls?: AIToolCallRejection[];
}

function isToolCallProposalList(value: unknown): value is AIToolCallProposal[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        entry !== null &&
        typeof entry === 'object' &&
        typeof (entry as AIToolCallProposal).name === 'string' &&
        (entry as AIToolCallProposal).name.length > 0 &&
        typeof (entry as AIToolCallProposal).writes === 'boolean' &&
        typeof (entry as AIToolCallProposal).args === 'object' &&
        (entry as AIToolCallProposal).args !== null &&
        !Array.isArray((entry as AIToolCallProposal).args),
    )
  );
}

function isToolCallRejectionList(value: unknown): value is AIToolCallRejection[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        entry !== null &&
        typeof entry === 'object' &&
        typeof (entry as AIToolCallRejection).name === 'string' &&
        typeof (entry as AIToolCallRejection).reason === 'string',
    )
  );
}

export class AIStreamError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'AIStreamError';
  }
}

export function isAIStreamUnsupported(error: unknown): boolean {
  return error instanceof ApiError && [405, 501].includes(error.status);
}

export async function* streamAIChat(
  request: ChatRequest,
  signal?: AbortSignal,
): AsyncGenerator<AIStreamEvent> {
  if (typeof document !== 'undefined') {
    try {
      const preview =
        document.cookie.includes('cfb_preview_demo=1') ||
        document.cookie.includes('cfb_session=preview-demo') ||
        window.localStorage.getItem('cfb_demo_data') === '1' ||
        window.location.hostname.endsWith('.trycloudflare.com');
      if (preview) {
        throw new Error('Preview uses the copilot engine instead of LLM streaming');
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('copilot engine')) throw err;
    }
  }

  // 30s timeout for the initial connection — matches api.ts circuit breaker intent
  const timeoutController = new AbortController();
  const timedOut = () => timeoutController.abort(new DOMException('AI stream timed out', 'TimeoutError'));
  let timeoutId = setTimeout(timedOut, 30_000);

  // Merge user abort signal with our timeout signal
  const handleUserAbort = () => timeoutController.abort(new DOMException('AI request cancelled', 'AbortError'));
  signal?.addEventListener('abort', handleUserAbort, { once: true });
  if (signal?.aborted) handleUserAbort();

  let response: Response | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    timeoutController.signal.throwIfAborted();
    response = await apiFetch('/api/ai/chat/stream', {
      method: 'POST',
      headers: { Accept: 'text/event-stream' },
      body: JSON.stringify(request),
      signal: timeoutController.signal,
    }, { fetcher: (url, init) => fetch(url, init) });
    clearTimeout(timeoutId);
    timeoutController.signal.throwIfAborted();

    if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'text/event-stream') {
      throw new AIStreamError('Expected an AI event stream', 'AI_STREAM_INVALID');
    }
    reader = response.body?.getReader();
    if (!reader) throw new AIStreamError('No AI stream response body', 'AI_STREAM_INVALID');

    const decoder = new TextDecoder('utf-8', { fatal: true });
    let buffer = '';
    let dataLines: string[] = [];
    let eventType = '';
    let frameSize = 0;

    const parseEvent = (): AIStreamEvent | undefined => {
      const eventName = eventType;
      eventType = '';
      frameSize = 0;
      if (!dataLines.length) {
        if (eventName === 'error') throw new AIStreamError('AI stream failed', 'AI_STREAM_ERROR');
        return undefined;
      }
      const text = dataLines.join('\n');
      dataLines = [];
      let data: AIStreamEvent & { error?: string | { message?: string }; message?: string };
      try {
        data = JSON.parse(text);
      } catch {
        // Skip malformed data
        throw new AIStreamError('Malformed AI stream event', 'AI_STREAM_INVALID');
      }
      if (data && (eventName === 'error' || data.error)) {
        const message = typeof data.error === 'string' ? data.error : data.error?.message;
        throw new AIStreamError(message || data.message || 'AI stream failed', 'AI_STREAM_ERROR');
      }
      if (!data || typeof data !== 'object' || typeof data.done !== 'boolean' ||
        (data.chunk !== undefined && typeof data.chunk !== 'string') ||
        (data.model !== undefined && typeof data.model !== 'string') ||
        (data.fallback !== undefined && typeof data.fallback !== 'boolean') ||
        // Validated to the same standard as the rest of the frame. A proposal
        // that is not an array of named calls would otherwise reach the UI as
        // an actionable card built from nothing.
        (data.toolCalls !== undefined && !isToolCallProposalList(data.toolCalls)) ||
        (data.rejectedToolCalls !== undefined && !isToolCallRejectionList(data.rejectedToolCalls))) {
        throw new AIStreamError('Invalid AI stream event', 'AI_STREAM_INVALID');
      }
      return data;
    };

    const consumeLine = (line: string): AIStreamEvent | undefined => {
      if (line === '') return parseEvent();
      if (line.startsWith(':')) return undefined;
      const colon = line.indexOf(':');
      const field = colon < 0 ? line : line.slice(0, colon);
      const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '');
      if (field === 'data') {
        dataLines.push(value);
        frameSize += value.length;
        if (frameSize > 1_048_576) throw new AIStreamError('AI stream event too large', 'AI_STREAM_INVALID');
      } else if (field === 'event') {
        eventType = value;
      }
      return undefined;
    };

    while (true) {
      timeoutController.signal.throwIfAborted();
      timeoutId = setTimeout(timedOut, 30_000);
      const { done, value } = await withApiAbort(reader.read(), timeoutController.signal);
      clearTimeout(timeoutId);
      timeoutController.signal.throwIfAborted();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });

      let separator: RegExpExecArray | null;
      while ((separator = /\r\n|\r|\n/.exec(buffer))) {
        if (!done && separator[0] === '\r' && separator.index === buffer.length - 1) break;
        const line = buffer.slice(0, separator.index);
        buffer = buffer.slice(separator.index + separator[0].length);
        const data = consumeLine(line);
        if (data) {
          timeoutController.signal.throwIfAborted();
          yield data;
          if (data.done) return;
        }
      }
      if (buffer.length > 1_048_576) throw new AIStreamError('AI stream event too large', 'AI_STREAM_INVALID');
      if (done) {
        if (buffer) consumeLine(buffer);
        const data = parseEvent();
        if (data) {
          yield data;
          if (data.done) return;
        }
        throw new AIStreamError('AI stream ended before completion', 'AI_STREAM_INCOMPLETE');
      }
    }
  } catch (err) {
    // Notify circuit breaker — only for real network errors, not user aborts
    if (
      typeof window !== 'undefined' &&
      !timeoutController.signal.aborted &&
      err instanceof TypeError
    ) {
      window.dispatchEvent(new Event('cfb:api-offline'));
    }
    if (timeoutController.signal.aborted) throw timeoutController.signal.reason;
    throw err;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', handleUserAbort);
    try {
      if (reader) await reader.cancel().catch(() => {});
      else await response?.body?.cancel().catch(() => {});
    } finally {
      reader?.releaseLock();
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Conversation Management
// ─────────────────────────────────────────────────────────────

export async function createAIConversation(data: {
  agentId?: string;
  title?: string;
  initialMessage?: string;
}): Promise<{ conversation: AIConversation }> {
  return apiRequest<{ conversation: AIConversation }>('/api/ai/conversations', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listAIConversations(): Promise<{ conversations: AIConversation[] }> {
  return apiRequest<{ conversations: AIConversation[] }>('/api/ai/conversations');
}

export async function getAIConversation(id: string): Promise<{ conversation: AIConversation }> {
  return apiRequest<{ conversation: AIConversation }>(`/api/ai/conversations/${id}`);
}

export async function deleteAIConversation(id: string): Promise<{ deleted: boolean }> {
  return apiRequest<{ deleted: boolean }>(`/api/ai/conversations/${id}`, {
    method: 'DELETE',
  });
}

export async function getAIPreferences(): Promise<{ preferences: AIPreferences | null }> {
  return apiRequest<{ preferences: AIPreferences | null }>('/api/ai/preferences');
}

export async function updateAIPreferences(
  data: Partial<AIPreferences>,
): Promise<{ preferences: AIPreferences }> {
  return apiRequest<{ preferences: AIPreferences }>('/api/ai/preferences', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ─────────────────────────────────────────────────────────────
// Async Job Queue (heavy generation)
// ─────────────────────────────────────────────────────────────

export type AIJobType = 'generate-document' | 'analyze-profile';

export interface AIJobRequest {
  type: AIJobType;
  agentId?: string;
  prompt?: string;
  conversationId?: string;
  model?: string;
  featureUsed?: string;
  targetUserId?: string;
}

export type AIJobState = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'unknown';

export interface AIJobStatus {
  id: string;
  state: AIJobState;
  progress: number;
  result?: {
    message: string;
    model: string;
    fallback?: boolean;
    completedAt: string;
  };
  failedReason?: string;
}

export async function enqueueAIJob(request: AIJobRequest): Promise<{ queued: boolean; jobId?: string; message?: string }> {
  return apiRequest<{ queued: boolean; jobId?: string; message?: string }>('/api/ai/jobs', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function getAIJobStatus(jobId: string): Promise<AIJobStatus> {
  return apiRequest<AIJobStatus>(`/api/ai/jobs/${jobId}`);
}

// ─────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────

export function formatModelName(name: string): string {
  // llama3.2:8b -> Llama 3.2 8B
  return name
    .replace(/([a-z])(\d)/gi, '$1 $2')
    .replace(/:/, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getAgentIcon(agentId: string): string {
  const icons: Record<string, string> = {
    general: '🤖',
    matching: '🤝',
    research: '🔬',
    'pitch-coach': '🎯',
    'mentor-finder': '👨‍🏫',
    'market-analyst': '📊',
    fundraising: '💰',
    'legal-advisor': '⚖️',
    'technical-advisor': '🔧',
    'growth-strategist': '📈',
  };
  return icons[agentId] || '🤖';
}

/**
 * CfbGlyph name for an agent. The assistant's avatar was a robot emoji next
 * to a product that has its own glyph system; chrome surfaces should use this
 * and leave `getAgentIcon` to the places where an emoji is the content.
 */
export function getAgentGlyph(agentId: string): CfbGlyphName {
  const glyphs: Record<string, CfbGlyphName> = {
    general: 'spark',
    matching: 'matches',
    research: 'research',
    'pitch-coach': 'target',
    'mentor-finder': 'mentor',
    'market-analyst': 'chart',
    fundraising: 'wallet',
    'legal-advisor': 'shield',
    'technical-advisor': 'builder',
    'growth-strategist': 'chart',
  };
  return glyphs[agentId] ?? 'spark';
}
