'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

function useOptionalQueryClient() {
  try {
    return useQueryClient();
  } catch {
    return undefined;
  }
}
import { useSession } from '@/hooks/useSession';
import { useApiAvailability } from '@/hooks/useApiAvailability';
import {
  AgentConfig,
  sendAIChat,
  getAIAgents,
  getAIHealth,
  createAIConversation,
  getAIConversation,
  listAIConversations,
  AIConversation,
  isAIStreamUnsupported,
  streamAIChat,
  type AIToolCallProposal,
  type ChatRequest,
  type ChatMessage,
} from '@/lib/ai-api';
import { followUpRequest, readsToRun } from '@/lib/copilot-loop';
import { isPreviewDemo } from '@/lib/preview-demo';
import { actionsFromToolCalls, executeCopilotAction, replyLocaleFor, runCopilotTurn, type PageContextPacket } from '@/lib/copilot-engine';
import type { InvalidationTopic } from '@cofounderbay/shared';
import { getActionSpec, undoAvailable, undoAction as runUndo } from '@/lib/action-registry';
import { recordAIAction, type AIActionOutcome } from '@/lib/ai-api';
import type { CopilotAction, CopilotCitation, CopilotTurnResult } from '@/lib/copilot-types';
import { CONNECTION_KEYS, MESSAGE_KEYS, PROFILE_KEYS, queryKeys, qk } from '@/lib/query-keys';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  model?: string;
  fallback?: boolean;
  isStreaming?: boolean;
  actions?: CopilotAction[];
  citations?: CopilotCitation[];
}

export interface UseAIChatOptions {
  agentId?: string;
  conversationId?: string;
  autoCreateConversation?: boolean;
  initialPrompt?: string;
  enableCopilot?: boolean;
  pageContext?: PageContextPacket;
}

export interface UseAIChatReturn {
  messages: AIMessage[];
  isStreaming: boolean;
  isLoading: boolean;
  error: string | null;
  agents: AgentConfig[];
  currentAgent: string;
  isAIAvailable: boolean;
  conversationId: string | null;
  conversations: AIConversation[];
  pendingActionId: string | null;
  sendMessage: (content: string) => Promise<void>;
  setAgent: (agentId: string) => void;
  clearMessages: () => void;
  retryLastMessage: () => void;
  confirmAction: (action: CopilotAction) => Promise<{ href?: string } | void>;
  /** Resolves `false` when the action declares no undo, so the caller can say so. */
  undoAction: (action: CopilotAction) => Promise<boolean>;
  dismissAction: (action: CopilotAction) => void;
  loadConversation: (id: string) => Promise<void>;
  refreshConversations: () => Promise<void>;
}

/**
 * Each topic a capability can declare, bound to the query keys that hold it.
 *
 * Exhaustive by construction: `Record<InvalidationTopic, …>` means a topic
 * added to the shared contract without an entry here stops the build, which is
 * the point — the alternative is a capability that quietly refreshes nothing.
 */
const TOPIC_KEYS: Record<InvalidationTopic, readonly (readonly unknown[])[]> = {
  connections: [...CONNECTION_KEYS, queryKeys.graphMe],
  messages: [...MESSAGE_KEYS],
  shortlist: [queryKeys.shortlist, queryKeys.shortlistIds],
  graph: [queryKeys.graphMe],
  // Both the canonical score and anything keyed under a workspace beneath it.
  readiness: [qk('readiness')],
  workspaces: [qk('builder'), qk('workspaces')],
  // One key covers the board, its summary and its activity: they are one row.
  investor: [qk('investor')],
  // One root for boards, a board, and its versions, snapshots and comments.
  research: [qk('research-boards')],
  profile: [...PROFILE_KEYS],
  // The page keys its list by the filters in state, so the base key is the
  // only shape that reaches every variant of it.
  milestones: [qk('milestones')],
  events: [qk('events')],
  groups: [qk('groups')],
  programs: [qk('programs')],
  invites: [qk('invites')],
  endorsements: [qk('endorsements')],
  // Mentorship relationships and the mentor directory's counts both move.
  mentorships: [qk('mentorships'), qk('mentors')],
  // Cards, the ladder threads and a card's public link: one resource.
  commitments: [qk('commitments')],
  // Who the reader follows, and the updates feed that follows from it.
  follows: [qk('follows'), qk('founder-updates')],
  // A request, a forward or an acceptance; accepting also answers a need card.
  intros: [qk('intros'), qk('commitments')],
  open_to: [qk('open-to'), qk('matching'), qk('recommendations')],
  skill_evidence: [qk('skill-evidence')],
  scout: [qk('scout')],
};

export function useAIChat(options: UseAIChatOptions = {}): UseAIChatReturn {
  const { hasSession, mounted } = useSession();
  const apiAvailable = useApiAvailability();
  const queryClient = useOptionalQueryClient();
  const pageContext = options.pageContext;
  const enableCopilot = options.enableCopilot ?? false;

  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [currentAgent, setCurrentAgent] = useState(options.agentId || 'general');
  const [isAIAvailable, setIsAIAvailable] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(options.conversationId || null);
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  /**
   * The same claim, readable synchronously. State updates land on the next
   * render, so two clicks in one tick both saw `pendingActionId === null` and
   * both ran the write; the ref is set before the first await.
   */
  const pendingRef = useRef<string | null>(null);

  const lastUserMessageRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const autoCreate = options.autoCreateConversation !== false;

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!hasSession || !mounted || !apiAvailable) return;

    const init = async () => {
      try {
        const [health, agentsData] = await Promise.all([
          getAIHealth().catch(() => ({ available: false, models: [] })),
          getAIAgents().catch(() => ({ agents: [] })),
        ]);

        setIsAIAvailable(Boolean(health?.available));
        // A 200 with a malformed body (older API, proxy interstitial) is not a
        // rejection, so `?? []` alone is not enough — coerce before storing or
        // every consumer of `agents.find(...)` crashes past route boundaries.
        setAgents(Array.isArray(agentsData?.agents) ? agentsData.agents : []);
      } catch {
        setIsAIAvailable(false);
        setAgents([]);
      }
    };

    void init();
  }, [hasSession, mounted, apiAvailable]);

  const refreshConversations = useCallback(async () => {
    if (!hasSession) return;
    try {
      const res = await listAIConversations();
      setConversations(res.conversations ?? []);
    } catch {
      /* preview or offline */
    }
  }, [hasSession]);

  useEffect(() => {
    if (!hasSession || !mounted) return;
    void refreshConversations();
  }, [hasSession, mounted, refreshConversations]);

  useEffect(() => {
    if (!hasSession || !mounted || conversationId || !autoCreate) return;

    createAIConversation({ agentId: currentAgent })
      .then((res) => {
        if (res?.conversation?.id) setConversationId(res.conversation.id);
      })
      .catch(() => {
        /* works without persistence */
      });
  }, [hasSession, mounted, conversationId, currentAgent, autoCreate]);

  const mapHistory = (conv: AIConversation): AIMessage[] =>
    (conv.messages ?? [])
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: new Date(m.createdAt),
        model: m.model,
      }));

  const loadConversation = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const res = await getAIConversation(id);
      if (res?.conversation) {
        setConversationId(res.conversation.id);
        setMessages(mapHistory(res.conversation));
      }
    } catch {
      setError('Could not load that conversation');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateAction = useCallback((actionId: string, patch: Partial<CopilotAction>) => {
    setMessages((prev) =>
      prev.map((m) => ({
        ...m,
        actions: m.actions?.map((a) => (a.id === actionId ? { ...a, ...patch } : a)),
      })),
    );
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || abortControllerRef.current) return;

      // Cancel any existing request
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const isCurrent = () => abortControllerRef.current === controller && !controller.signal.aborted;
      setError(null);
      lastUserMessageRef.current = content;
      let receivedEvent = false;

      const turnId = crypto.randomUUID();
      const userMessage: AIMessage = {
        id: `user-${turnId}`,
        role: 'user',
        content: content.trim(),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);

      const assistantMessageId = `assistant-${turnId}`;
      const assistantMessage: AIMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsStreaming(true);

      try {
        let turn: CopilotTurnResult | undefined;

        if (enableCopilot) {
          try {
            turn = await runCopilotTurn(content.trim(), pageContext);
            if (!isCurrent()) return;
          } catch {
            /* proceed without copilot tools */
          }
        }

        const narrative = turn?.message ?? '';
        const actions = turn?.actions;
        const citations = turn?.citations;

        if (isAIAvailable && !isPreviewDemo()) {
          const history: ChatMessage[] = conversationId
            ? []
            : messages.slice(-8).map((m) => ({
                role: m.role,
                content: m.content,
              }));
          const request: ChatRequest = {
            message: content.trim(),
            agentId: currentAgent,
            conversationId: conversationId || undefined,
            history,
            context: {
              ...pageContext,
              toolNarrative: narrative,
              usedTools: turn?.usedTools ?? [],
            },
            // Offer the model the capability catalogue.
            //
            // Everything behind this flag — the shared declarations, the
            // server-side validation, the confirm/undo/audit contract, the
            // assembly of tool calls out of a single stream — was built and
            // tested while nothing ever set it, so the catalogue was never
            // sent and the model could only narrate whatever the keyword
            // planner had already matched. The planner still runs and its
            // proposals still stand: a model that supports no tools, or asks
            // for none, produces exactly the turn it produced before.
            enableTools: true,
          };
          let fullContent = '';
          let finalModel = '';
          let fallback = false;
          let proposed: CopilotAction[] = [];
          // Every call the model made, reads included. Writes become cards
          // below; reads are run after the stream so the model can finish.
          let modelCalls: AIToolCallProposal[] = [];

          try {
            for await (const data of streamAIChat(request, controller.signal)) {
              if (!isCurrent()) return;
              receivedEvent = true;
              if (data.fallback) {
                fullContent = data.chunk ?? '';
                fallback = true;
                finalModel = data.model || 'fallback';
              } else {
                fullContent += data.chunk ?? '';
                finalModel = data.model || finalModel;
              }
              setMessages((prev) =>
                prev.map((message) =>
                  message.id === assistantMessageId
                    ? { ...message, content: fullContent, model: finalModel, fallback }
                    : message,
                ),
              );
              if (data.done) {
                // Proposals ride the terminal event. They are rendered with
                // the same card the planner uses, because both read the same
                // declaration — so a capability the model picks looks and
                // behaves exactly like one a keyword matched.
                if (data.toolCalls?.length) {
                  modelCalls = data.toolCalls;
                  proposed = actionsFromToolCalls(data.toolCalls, replyLocaleFor(content, pageContext?.locale));
                }
                break;
              }
            }
          } catch (streamError) {
            // If streaming fails, fall back to non-streaming only when no content was received
            if (!isCurrent() || receivedEvent || !isAIStreamUnsupported(streamError)) throw streamError;
            const response = await sendAIChat(request, controller.signal);
            fullContent = response.message;
            finalModel = response.model;
            fallback = response.fallback ?? false;
            // The non-streaming route returns the same validated proposals;
            // they were typed away here, so a model on this path could neither
            // offer a write nor ask for a read.
            if (response.toolCalls?.length) {
              modelCalls = response.toolCalls;
              proposed = actionsFromToolCalls(response.toolCalls, replyLocaleFor(content, pageContext?.locale));
            }
          }

          if (!isCurrent()) return;

          // Reads the model asked for — run them, then let it finish.
          //
          // The planner's reads already reached the model as the tool
          // narrative; these are the ones it decided it needed on its own. They
          // go through `runCopilotTurn` with the calls passed in, so a read
          // answers identically whether a keyword or the model chose it. If the
          // model cannot continue, the read result itself is shown, so what was
          // fetched is never silently dropped.
          const modelReads = fallback ? [] : readsToRun(modelCalls, turn?.usedTools ?? []);
          let readCitations: CopilotCitation[] = [];
          let readActions: CopilotAction[] = [];
          if (modelReads.length) {
            try {
              const readTurn = await runCopilotTurn(content.trim(), pageContext, { tools: modelReads });
              if (!isCurrent()) return;
              readCitations = readTurn.citations;
              readActions = readTurn.actions;

              if (readTurn.message) {
                const base = fullContent;
                const separator = base.trim() ? '\n\n' : '';
                let continuation = '';
                try {
                  for await (const data of streamAIChat(
                    followUpRequest(request, base, modelReads, readTurn.message),
                    controller.signal,
                  )) {
                    if (!isCurrent()) return;
                    if (data.fallback) break;
                    continuation += data.chunk ?? '';
                    const shown = base + separator + continuation;
                    setMessages((prev) =>
                      prev.map((message) =>
                        message.id === assistantMessageId ? { ...message, content: shown } : message,
                      ),
                    );
                    if (data.done) break;
                  }
                } catch {
                  if (!isCurrent()) return;
                  // The first answer stands; the read result is appended below.
                }
                fullContent = base + separator + (continuation.trim() ? continuation : readTurn.message);
              }
            } catch {
              if (!isCurrent()) return;
              // A read that failed outright leaves the model's first answer as the reply.
            }
          }

          // What the model asked for leads, because it read the question; what
          // the planner matched follows, minus anything the model already
          // covered. Nothing the planner found is thrown away — a keyword hit
          // the model missed is still a capability the user asked for.
          const merged = proposed.length
            ? [...proposed, ...(actions ?? []).filter((a) => !proposed.some((p) => p.tool === a.tool))]
            : actions;
          const withReads = [
            ...(merged ?? []),
            ...readActions.filter((read) => !(merged ?? []).some((a) => a.tool === read.tool && a.href === read.href)),
          ];
          const allCitations = [...(citations ?? []), ...readCitations].filter(
            (c, i, list) => list.findIndex((x) => x.type === c.type && x.id === c.id) === i,
          );
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantMessageId
                ? {
                    ...message,
                    content: fullContent,
                    model: finalModel,
                    fallback,
                    isStreaming: false,
                    actions: withReads.length ? withReads.slice(0, 6) : merged,
                    citations: allCitations.length ? allCitations.slice(0, 10) : citations,
                  }
                : message,
            ),
          );
        } else {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantMessageId
                ? { ...message, content: narrative, model: 'copilot', isStreaming: false, actions, citations }
                : message,
            ),
          );
        }

        void refreshConversations();
      } catch (err) {
        if (!isCurrent()) return;
        const requestError = err instanceof Error || err instanceof DOMException ? err : null;
        if (requestError?.name === 'AbortError') {
          // Remove the empty assistant message on abort
          setMessages((prev) => prev.filter((message) => message.id !== assistantMessageId));
          return;
        }

        setError(requestError?.message || 'Failed to get AI response');
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  content: receivedEvent ? message.content : 'Sorry, I encountered an error. Please try again.',
                  isStreaming: false,
                }
              : message,
          ),
        );
      } finally {
        if (abortControllerRef.current === controller) {
          setIsStreaming(false);
          abortControllerRef.current = null;
        }
      }
    },
    [messages, currentAgent, conversationId, isAIAvailable, pageContext, refreshConversations, enableCopilot],
  );

  /**
   * The caches a tool touches. Undo writes to the same rows as the action it
   * reverses, so both paths refresh the same keys -- an undo that left the old
   * value on screen would read as a failed undo.
   */
  /**
   * Refreshes what the action disturbed, reading the capability's own
   * `invalidates` rather than a chain of `if (tool === …)`.
   *
   * That chain covered four of the nine mutations: ticking a readiness
   * criterion, creating a workspace and running a canvas command refreshed
   * nothing, so a page open beside the chat kept showing the state from before
   * the assistant changed it. `TOPIC_KEYS` is exhaustive over the topic union,
   * so a topic added to the contract without a binding here fails to compile.
   */
  const invalidateFor = useCallback(
    (tool: CopilotAction['tool']) => {
      if (!queryClient || isPreviewDemo()) return;
      const topics = getActionSpec(tool)?.invalidates ?? [];
      for (const topic of topics) {
        for (const key of TOPIC_KEYS[topic]) {
          void queryClient.invalidateQueries({ queryKey: key });
        }
      }
    },
    [queryClient],
  );

  /**
   * Files the action in the user's trail. Deliberately not awaited by its
   * callers and never allowed to throw: the action has already happened by the
   * time this runs, so a failed audit write must not be reported as a failed
   * action. Demo mode writes nothing, so it records nothing either.
   */
  const audit = useCallback(
    (action: CopilotAction, outcome: AIActionOutcome) => {
      if (isPreviewDemo()) return;
      void recordAIAction({
        actionId: action.tool,
        outcome,
        args: (action.payload ?? {}) as Record<string, unknown>,
      }).catch(() => {
        /* the trail is best-effort; the action itself already succeeded */
      });
    },
    [],
  );

  const confirmAction = useCallback(
    async (action: CopilotAction) => {
      if (pendingRef.current) return;
      pendingRef.current = action.id;
      setPendingActionId(action.id);
      try {
        const result = await executeCopilotAction(action);
        // The reader said no in the page's own confirmation. Nothing was
        // written, so nothing is refreshed, filed or offered for Undo.
        if (result.cancelled) {
          updateAction(action.id, { status: 'cancelled', error: undefined });
          return;
        }
        if (!result.ok) {
          audit(action, 'failed');
          updateAction(action.id, { status: 'error', error: result.error ?? 'Action failed' });
          return;
        }
        // A page command is not applied when its request merely started. Its
        // handler contract keeps `executeCopilotAction` pending until the
        // underlying mutation settles, so cache refresh, audit and Undo all
        // become visible only after a confirmed success.
        invalidateFor(action.tool);
        audit(action, 'applied');
        // Carried on the card so the undo can act on what was created, not on
        // what was asked for. Without it a create can only ever be `none`.
        updateAction(action.id, { status: 'done', undoContext: result.undo, error: undefined });
        return { href: result.href };
      } finally {
        pendingRef.current = null;
        setPendingActionId(null);
      }
    },
    [audit, invalidateFor, updateAction],
  );

  /**
   * Only ever called for an action whose registry entry declares an undo. The
   * registry refuses the rest rather than attempting a best-effort reversal, so
   * a `false` here means "this genuinely cannot be taken back", not "it failed".
   */
  const undoAction = useCallback(
    async (action: CopilotAction) => {
      if (pendingRef.current) return false;
      if (!undoAvailable(action.tool, action.undoContext)) return false;

      pendingRef.current = action.id;
      setPendingActionId(action.id);
      try {
        const payload: Record<string, unknown> = { ...(action.payload ?? {}) };
        const result = await runUndo(action.tool, payload, action.undoContext ?? {});
        // Declined inside the opposite: the command still stands, so the card
        // stays done and Undo stays on offer. Filing "failed" here would put
        // an error in the trail for a choice the reader made on purpose.
        if (result.cancelled) return false;
        // The same order as confirm: refresh and file "undone" only once the
        // undo has actually landed, never on its attempt.
        if (!result.ok) {
          audit(action, 'failed');
          updateAction(action.id, { error: result.error ?? 'Undo failed' });
          return false;
        }
        invalidateFor(action.tool);
        audit(action, 'undone');
        updateAction(action.id, { status: 'undone', error: undefined });
        return true;
      } finally {
        pendingRef.current = null;
        setPendingActionId(null);
      }
    },
    [audit, invalidateFor, updateAction],
  );

  const dismissAction = useCallback(
    (action: CopilotAction) => {
      updateAction(action.id, { status: 'dismissed' });
    },
    [updateAction],
  );

  const setAgent = useCallback((agentId: string) => {
    setCurrentAgent(agentId);
  }, []);

  const clearMessages = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    lastUserMessageRef.current = null;
    setIsStreaming(false);
    setMessages([]);
    setError(null);
    setConversationId(null);
  }, []);

  const retryLastMessage = useCallback(() => {
    if (lastUserMessageRef.current) {
      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg?.role === 'assistant') return prev.slice(0, -1);
        return prev;
      });
      void sendMessage(lastUserMessageRef.current);
    }
  }, [sendMessage]);

  return {
    messages,
    isStreaming,
    isLoading,
    error,
    agents,
    currentAgent,
    isAIAvailable,
    conversationId,
    conversations,
    pendingActionId,
    sendMessage,
    setAgent,
    clearMessages,
    retryLastMessage,
    confirmAction,
    undoAction,
    dismissAction,
    loadConversation,
    refreshConversations,
  };
}
