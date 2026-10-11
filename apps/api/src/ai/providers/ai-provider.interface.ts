import type { ToolCatalogEntry } from '@cofounderbay/shared';

/**
 * IAIProvider — contract that every AI backend must satisfy.
 *
 * Adding a new provider (OpenAI, Anthropic, Groq, etc.) requires:
 *   1. Create a service that implements this interface
 *   2. Register it with AIProviderRegistry in onModuleInit
 *   3. Export from AIModule if needed by other modules
 *
 * The OllamaService is the reference implementation.
 */

export interface ChatMessage {
  /**
   * `tool` closes the function-calling loop.
   *
   * A turn where the model proposed a call ends with that proposal and nothing
   * else; the user confirms, the *client* performs the action, and the result
   * comes back as a `tool` message inside the history of a NEW turn. It is
   * never a replay of the turn that proposed -- see the note on
   * `continueAfterToolCall` in apps/web/src/lib/ai-api.ts, and the rule in
   * AGENTS.md that forbids repeating an AI POST after partial streaming.
   */
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /**
   * Which declared capability this result belongs to. Ollama and OpenAI name
   * the field differently on the wire; the adapter maps it, so callers here
   * only ever set `toolName`.
   */
  toolName?: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  /**
   * Function-calling catalogue, derived from `ACTION_DECLARATIONS` in
   * `@cofounderbay/shared`. Optional because not every provider or local model
   * supports tools, and because omitting it has to keep the previous
   * behaviour exactly: before this existed, no model in this product was ever
   * offered one.
   */
  tools?: ToolCatalogEntry[];
  /**
   * Receives tool calls produced by this exact request. Providers are
   * singletons, so tool-call state must stay request-local.
   */
  onToolCalls?: (toolCalls: unknown) => void;
}

export interface ProviderHealthStatus {
  available: boolean;
  /** e.g. 'ollama', 'openai', 'anthropic' */
  provider: string;
  version?: string;
  models: string[];
  error?: string;
}

export interface IAIProvider {
  /** Stable identifier used for registry lookup */
  readonly providerId: string;

  /** Network check — returns availability + metadata */
  checkHealth(): Promise<ProviderHealthStatus>;

  /** Synchronous flag — avoids network call in hot paths */
  isReady(): boolean;

  /** List model identifiers currently available via this provider */
  getAvailableModels(): string[];

  /** The model this provider uses when none is specified */
  getDefaultModel(): string;

  /** Single-shot completion — returns the full response string */
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>;

  /** Streaming completion — yields content chunks as they arrive */
  chatStream(messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<string, void, unknown>;
}
