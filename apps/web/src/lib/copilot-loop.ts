import { getActionDeclaration } from '@cofounderbay/shared';
import { continueAfterToolCall, type AIToolCallProposal, type ChatRequest } from '@/lib/ai-api';
import type { CopilotToolName, PlannedTool } from '@/lib/copilot-types';

/**
 * The second half of a tool-calling turn: running what the model asked to read,
 * and handing the result back so it can finish its answer.
 *
 * The first half has existed for a while. The catalogue is offered, the server
 * validates each call against the shared declarations, and a proposed *write*
 * becomes a card the user confirms. A proposed *read* went nowhere:
 * `actionsFromToolCalls` correctly makes no card for a question, and nothing
 * else ran it, so a model that decided it needed the user's milestones got an
 * empty turn and had to answer from what it already had. `continueAfterToolCall`
 * was written and tested for exactly this and never called.
 *
 * Kept free of React so the decisions — which calls run, and what the follow-up
 * request looks like — can be tested without rendering a chat.
 */

/** A turn reads at most this many things on the model's behalf. */
export const MAX_MODEL_READS = 3;

/**
 * The reads worth running from a model's proposals.
 *
 * Writes are excluded here and not merely elsewhere: a write is only ever run
 * by the user confirming its card, and this path confirms nothing. A read the
 * keyword planner already ran this turn is skipped, because its result is
 * already in the model's context as the tool narrative — running it twice would
 * only make the model read the same data again. Duplicate calls collapse.
 */
export function readsToRun(
  proposals: readonly AIToolCallProposal[] | undefined,
  alreadyRan: readonly string[] = [],
): PlannedTool[] {
  if (!proposals?.length) return [];
  const seen = new Set<string>(alreadyRan);
  const reads: PlannedTool[] = [];

  for (const proposal of proposals) {
    if (proposal.writes) continue;
    const declaration = getActionDeclaration(proposal.name);
    if (declaration?.kind !== 'read') continue;

    const args: Record<string, string> = {};
    for (const [key, value] of Object.entries(proposal.args ?? {})) {
      if (value === null || value === undefined) continue;
      args[key] = String(value);
    }

    const signature = `${proposal.name}:${JSON.stringify(args)}`;
    if (seen.has(proposal.name) || seen.has(signature)) continue;
    seen.add(signature);
    reads.push({ name: proposal.name as CopilotToolName, args });
    if (reads.length === MAX_MODEL_READS) break;
  }
  return reads;
}

/**
 * The request that lets the model finish, given what its reads returned.
 *
 * Three things differ from the turn that asked, each on purpose:
 * - **No `conversationId`.** The server appends the request's message to a
 *   conversation it is given, and this message is an instruction to the model,
 *   not something the user said. The history it needs travels inline instead.
 * - **No tools.** One round of reads per question. A model that could keep
 *   asking could keep a user waiting, and nothing here needs a second round.
 * - **An explicit follow-up.** The default continuation says an "action
 *   completed", which is the wrong frame for a question that was answered.
 */
export function followUpRequest(
  previous: ChatRequest,
  assistantText: string,
  reads: readonly PlannedTool[],
  result: string,
): ChatRequest {
  const names = reads.map((read) => read.name).join(', ');
  const next = continueAfterToolCall({
    previous,
    assistantText,
    toolName: names,
    result,
    followUp: `Using the ${names} result above, answer my previous message. Do not repeat the result verbatim; say what it means for me and what I should do next.`,
  });
  return { ...next, conversationId: undefined, enableTools: false };
}
