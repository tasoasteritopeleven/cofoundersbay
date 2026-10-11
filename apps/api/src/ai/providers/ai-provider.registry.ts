import { Injectable, Logger } from '@nestjs/common';
import type { IAIProvider } from './ai-provider.interface';

/**
 * AIProviderRegistry — lightweight registry for all AI provider implementations.
 *
 * Usage pattern (in a provider service's onModuleInit):
 *   constructor(private registry: AIProviderRegistry) {}
 *   async onModuleInit() { this.registry.register(this); }
 *
 * The controller/service then asks for the active provider:
 *   const provider = this.registry.getActive();
 */
@Injectable()
export class AIProviderRegistry {
  private readonly logger = new Logger(AIProviderRegistry.name);
  private readonly providers = new Map<string, IAIProvider>();
  private activeProviderId: string | null = null;

  /**
   * Register a provider. The first provider registered becomes the active one
   * unless `setActive` is called explicitly.
   */
  register(provider: IAIProvider): void {
    this.providers.set(provider.providerId, provider);
    if (!this.activeProviderId) {
      this.activeProviderId = provider.providerId;
      this.logger.log(`Default AI provider set to '${provider.providerId}'`);
    } else {
      this.logger.log(`AI provider '${provider.providerId}' registered`);
    }
  }

  /**
   * Return the currently active provider, or null if none is registered.
   * Callers should handle the null case gracefully (fallback response).
   */
  getActive(): IAIProvider | null {
    if (!this.activeProviderId) return null;
    return this.providers.get(this.activeProviderId) ?? null;
  }

  /**
   * Return a specific provider by ID, or null if not registered.
   */
  get(providerId: string): IAIProvider | null {
    return this.providers.get(providerId) ?? null;
  }

  /**
   * Switch the active provider. Throws if the providerId is unknown.
   */
  setActive(providerId: string): void {
    if (!this.providers.has(providerId)) {
      throw new Error(`AI provider '${providerId}' is not registered`);
    }
    this.activeProviderId = providerId;
    this.logger.log(`Active AI provider switched to '${providerId}'`);
  }

  /** IDs of all registered providers */
  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  getActiveProviderId(): string | null {
    return this.activeProviderId;
  }

  /**
   * Convenience: return active provider if ready, else first ready provider,
   * else null. Used by the controller to find any working provider.
   */
  getReady(): IAIProvider | null {
    const active = this.getActive();
    if (active?.isReady()) return active;
    for (const provider of this.providers.values()) {
      if (provider.isReady()) return provider;
    }
    return null;
  }
}
