import type { DeclaredActionId, MutationActionId } from '@cofounderbay/shared';

/**
 * Every capability the assistant can name, derived from the declarations
 * rather than restated here.
 *
 * These two unions used to be written out by hand, which made them a second
 * registry: a capability declared in `@cofounderbay/shared` and offered to the
 * model was not representable in the type the planner and engine speak, so the
 * model could ask for something this app could not carry. Deriving them means
 * a declaration is the only place a capability is added.
 */
export type CopilotToolName = DeclaredActionId;

export type PlannedTool = {
  name: CopilotToolName;
  args: Record<string, string>;
};

/** The subset that is proposed for confirmation: exactly the mutations. */
export type CopilotActionTool = MutationActionId;

/**
 * `undone` is distinct from `dismissed`: dismissed means the user declined
 * before anything ran, undone means it ran and was then taken back. Collapsing
 * them would lose the fact that a write reached the backend.
 *
 * `cancelled` is the third "nothing changed": the reader confirmed the card,
 * then said no in the page's own confirmation. It is a settled answer, not a
 * failure, so the card says so plainly and offers neither Retry nor Undo.
 */
export type CopilotActionStatus = 'pending' | 'done' | 'dismissed' | 'error' | 'undone' | 'cancelled';

export type CopilotAction = {
  id: string;
  tool: CopilotActionTool;
  title: string;
  description: string;
  confirmLabel: string;
  payload: Record<string, unknown>;
  status: CopilotActionStatus;
  href?: string;
  /**
   * Set from the outcome when the action runs, and handed back to the undo.
   * It is how a "create" becomes reversible: the id exists only after the
   * write, so nothing earlier in the chain could have carried it.
   */
  undoContext?: Record<string, unknown>;
  /**
   * Why the last attempt did not go through, shown on the card it belongs
   * to. A single line under the chat could not say which of several cards
   * had failed, and it outlived the card's own retry.
   */
  error?: string;
};

export type CopilotCitation = {
  type:
    | 'person'
    | 'match'
    | 'conversation'
    | 'notification'
    | 'graph'
    | 'route'
    // The areas `copilot-reads.ts` reads. The type is part of the dedup key, so
    // an event and a milestone that happen to share an id stay two citations.
    | 'event'
    | 'milestone'
    | 'job'
    | 'group'
    | 'endorsement'
    | 'opportunity'
    | 'session'
    | 'research'
    | 'workspace'
    | 'update';
  id: string;
  label: string;
  href?: string;
};

export type CopilotGraph = {
  me: {
    id: string;
    displayName: string;
    headline: string | null;
    role: string;
    location: string | null;
    avatarUrl: string | null;
  };
  unreadMessages: number;
  pendingIntros: number;
  unreadNotifications: number;
  readiness: { overall: number; lowestLabel?: string; lowestHref?: string } | null;
  nextAction: { id: string; label: string; href: string } | null;
};

export type CopilotTurnResult = {
  message: string;
  actions: CopilotAction[];
  citations: CopilotCitation[];
  usedTools: CopilotToolName[];
};
