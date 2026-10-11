import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IAIProvider, ProviderHealthStatus } from './providers/ai-provider.interface';
import { AIProviderRegistry } from './providers/ai-provider.registry';

export type { ChatMessage, ChatOptions } from './providers/ai-provider.interface';
import type { ChatMessage, ChatOptions } from './providers/ai-provider.interface';

export interface ModelInfo {
  name: string;
  size: number;
  modifiedAt: string;
  digest: string;
}

export type OllamaHealthStatus = ProviderHealthStatus;

@Injectable()
export class OllamaService implements OnModuleInit, IAIProvider {
  readonly providerId = 'ollama';

  private readonly logger = new Logger(OllamaService.name);
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private isAvailable = false;
  private availableModels: string[] = [];

  constructor(
    private readonly config: ConfigService,
    private readonly registry: AIProviderRegistry,
  ) {
    this.baseUrl = this.config.get<string>('OLLAMA_URL') || 'http://localhost:11434';
    this.defaultModel = this.config.get<string>('OLLAMA_MODEL') || 'llama3.2:latest';
  }

  async onModuleInit() {
    this.registry.register(this);
    await this.checkHealth();
  }

  async checkHealth(): Promise<ProviderHealthStatus> {
    try {
      const versionRes = await fetch(`${this.baseUrl}/api/version`, {
        signal: AbortSignal.timeout(3000),
      });
      
      if (!versionRes.ok) {
        this.isAvailable = false;
        return { available: false, provider: this.providerId, models: [], error: 'Ollama server not responding' };
      }

      const versionData = await versionRes.json();
      
      const modelsRes = await fetch(`${this.baseUrl}/api/tags`);
      const modelsData = await modelsRes.json();
      this.availableModels = (modelsData.models || []).map((m: any) => m.name);
      
      this.isAvailable = true;
      this.logger.log(`Ollama connected: v${versionData.version}, models: ${this.availableModels.join(', ') || 'none'}`);
      
      return {
        available: true,
        provider: this.providerId,
        version: versionData.version,
        models: this.availableModels,
      };
    } catch (err: any) {
      this.isAvailable = false;
      this.logger.warn(`Ollama not available: ${err.message}`);
      return { available: false, provider: this.providerId, models: [], error: err.message };
    }
  }

  isReady(): boolean {
    return this.isAvailable;
  }

  getAvailableModels(): string[] {
    return this.availableModels;
  }

  getDefaultModel(): string {
    return this.defaultModel;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    if (!this.isAvailable) {
      throw new Error('Ollama service is not available');
    }

    const model = options?.model || this.defaultModel;
    
    // Ensure model is available, fallback to first available
    const targetModel = this.availableModels.includes(model) 
      ? model 
      : this.availableModels[0] || model;

    const body: any = {
      model: targetModel,
      messages: this.toWireMessages(this.formatMessages(messages, options?.systemPrompt)),
      stream: false,
      options: {
        temperature: options?.temperature ?? 0.7,
        num_predict: options?.maxTokens ?? 1024,
      },
    };

    // Only sent when a caller supplies a catalogue. Until this existed the
    // request carried model/messages/options and nothing else, so no model in
    // this product had ever been offered a tool -- and the rule-based planner
    // documented as a fallback for 'when the LLM has no tools' was in fact the
    // only path there was.
    if (options?.tools?.length) {
      body.tools = options.tools;
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60000), // 60s timeout for generation
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Ollama error ${res.status}: ${errorText}`);
      }

      const data = await res.json();
      options?.onToolCalls?.(data.message?.tool_calls ?? null);
      return data.message?.content || '';
    } catch (err: any) {
      this.logger.error(`Ollama chat failed: ${err.message}`);
      throw err;
    }
  }

  async *chatStream(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): AsyncGenerator<string, void, unknown> {
    if (!this.isAvailable) {
      throw new Error('Ollama service is not available');
    }

    const model = options?.model || this.defaultModel;
    const targetModel = this.availableModels.includes(model)
      ? model
      : this.availableModels[0] || model;

    const body: any = {
      model: targetModel,
      messages: this.toWireMessages(this.formatMessages(messages, options?.systemPrompt)),
      stream: true,
      options: {
        temperature: options?.temperature ?? 0.7,
        num_predict: options?.maxTokens ?? 1024,
      },
    };

    if (options?.tools?.length) {
      body.tools = options.tools;
    }

    const streamedToolCalls: unknown[] = [];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 min timeout

    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Ollama stream error ${res.status}: ${errorText}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.message?.content) {
              yield data.message.content;
            }
            // Ollama emits tool calls inside a streamed message rather than as
            // character deltas, but it may emit more than one such message, so
            // they are collected across the whole stream instead of the last
            // one winning.
            if (Array.isArray(data.message?.tool_calls)) {
              streamedToolCalls.push(...data.message.tool_calls);
            }
            if (data.done) {
              return;
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    } finally {
      clearTimeout(timeoutId);
      // Request-local delivery prevents one concurrent user from consuming
      // another user's proposals. This also reports calls collected before an
      // early consumer stop or an aborted stream.
      options?.onToolCalls?.(streamedToolCalls.length ? streamedToolCalls : null);
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      if (!res.ok) throw new Error(`Failed to list models: ${res.status}`);
      const data = await res.json();
      return (data.models || []).map((m: any) => ({
        name: m.name,
        size: m.size,
        modifiedAt: m.modified_at,
        digest: m.digest,
      }));
    } catch (err: any) {
      this.logger.error(`Failed to list models: ${err.message}`);
      return [];
    }
  }

  async pullModel(modelName: string): Promise<void> {
    this.logger.log(`Pulling model: ${modelName}`);
    const res = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: false }),
    });

    if (!res.ok) {
      throw new Error(`Failed to pull model: ${res.status}`);
    }

    // Refresh available models
    await this.checkHealth();
  }

  private formatMessages(messages: ChatMessage[], systemPrompt?: string): ChatMessage[] {
    const formatted: ChatMessage[] = [];

    if (systemPrompt) {
      formatted.push({ role: 'system', content: systemPrompt });
    }

    // Check if first message is already a system message
    const hasSystem = messages[0]?.role === 'system';
    if (!hasSystem && !systemPrompt) {
      formatted.push({
        role: 'system',
        content: 'You are a helpful AI assistant for CoFounderBay, a platform connecting founders, co-founders, mentors, and investors. Be concise, professional, and helpful.',
      });
    }

    formatted.push(...messages);
    return formatted;
  }

  /**
   * Ollama names the tool-result field `tool_name`, not `toolName`, and rejects
   * unknown keys on a message. Everything else passes through untouched, so a
   * conversation with no tool results produces byte-identical bodies to before
   * the role existed.
   */
  private toWireMessages(messages: ChatMessage[]): Array<Record<string, unknown>> {
    return messages.map((m) =>
      m.role === 'tool'
        ? { role: 'tool', content: m.content, ...(m.toolName ? { tool_name: m.toolName } : {}) }
        : { role: m.role, content: m.content },
    );
  }
}
