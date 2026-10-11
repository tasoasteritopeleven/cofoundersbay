'use client';

import { useState, useCallback, useRef } from 'react';
import { sendAIChat } from '@/lib/ai-api';

interface UseAIInsightOptions {
  agentId?: string;
  context?: Record<string, unknown>;
  /**
   * Optional stable key used for in-session caching.
   * If two calls share the same cacheKey the second returns the cached result.
   * Defaults to `${agentId}:${prompt}`.
   */
  cacheKey?: string;
}

interface UseAIInsightReturn {
  response: string | null;
  isLoading: boolean;
  error: string | null;
  fetchInsight: (context?: Record<string, unknown>) => Promise<void>;
  clear: () => void;
}

/**
 * useAIInsight — fire-and-cache hook for single-shot AI queries.
 *
 * Suitable for profile pages, match explanations, pitch feedback callouts —
 * any place that needs a one-off AI response without opening a full chat.
 *
 * Caches responses in a module-level Map so navigating away and back to
 * the same page does not retrigger the call.
 */

// Module-level LRU-style cache (max 50 entries, cleared on page reload)
const insightCache = new Map<string, string>();
const MAX_CACHE = 50;

function cacheSet(key: string, value: string) {
  if (insightCache.size >= MAX_CACHE) {
    const first = insightCache.keys().next().value;
    if (first !== undefined) insightCache.delete(first);
  }
  insightCache.set(key, value);
}

export function useAIInsight(
  prompt: string,
  options: UseAIInsightOptions = {},
): UseAIInsightReturn {
  const { agentId = 'general', cacheKey } = options;

  const [response, setResponse] = useState<string | null>(() => {
    const key = cacheKey ?? `${agentId}:${prompt}`;
    return insightCache.get(key) ?? null;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable ref so fetchInsight identity is stable (safe in useEffect deps)
  const promptRef = useRef(prompt);
  const agentIdRef = useRef(agentId);
  const cacheKeyRef = useRef(cacheKey);
  promptRef.current = prompt;
  agentIdRef.current = agentId;
  cacheKeyRef.current = cacheKey;

  const fetchInsight = useCallback(async (runtimeContext?: Record<string, unknown>) => {
    const key = cacheKeyRef.current ?? `${agentIdRef.current}:${promptRef.current}`;

    // Return cached value immediately
    const cached = insightCache.get(key);
    if (cached) {
      setResponse(cached);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await sendAIChat({
        message: promptRef.current,
        agentId: agentIdRef.current,
        context: runtimeContext ?? options.context,
      });
      cacheSet(key, result.message);
      setResponse(result.message);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to get AI insight';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clear = useCallback(() => {
    const key = cacheKeyRef.current ?? `${agentIdRef.current}:${promptRef.current}`;
    insightCache.delete(key);
    setResponse(null);
    setError(null);
  }, []);

  return { response, isLoading, error, fetchInsight, clear };
}
