/**
 * The declarative half of the assistant's capability contract.
 *
 * It lives here, rather than in the web app where it started, because the
 * server has to enforce the same contract it offers a model. A tool catalogue
 * built in the browser and trusted by the API would let a caller name any
 * function it liked; a second registry written on the server would drift from
 * the first. So the declaration is shared and the *execution* is not: only the
 * side that owns a write can perform it.
 *
 * Nothing in this file may import from an app. Executors and undo functions
 * are deliberately absent — they close over each app's own API client, and a
 * function cannot cross this boundary as data anyway.
 */

/** English is canonical; Greek is additive. Matches the apps' BilingualPair. */
export type BilingualCopy = {
  en: string;
  el: string;
};

export type ActionParamType = 'string' | 'number' | 'boolean';

export type ActionParam = {
  name: string;
  type: ActionParamType;
  required: boolean;
  /** The `en` half is what a model sees; both halves are shown to the user. */
  description: BilingualCopy;
  /** Constrains a model's output when the argument is a closed set. */
  enumValues?: readonly string[];
};

/** `read` answers a question; `mutation` changes something the user owns. */
export type ActionKind = 'read' | 'mutation';

/**
 * Verified against the API, never assumed.
 *
 * `none` is the honest answer more often than it looks: a connection request
 * notifies its recipient before the call returns and has no sender-side
 * withdraw route, and a direct conversation cannot be deleted at all.
 */
export type ActionReversalKind = 'none' | 'full' | 'partial';

export type ActionReversalDeclaration = {
  kind: ActionReversalKind;
  explanation: BilingualCopy;
};

export type ActionOutcome = {
  ok: boolean;
  href?: string;
  error?: string;
  /**
   * The reader said no in the page's own confirmation, so nothing was written.
   *
   * Always paired with `ok: false`. A caller that has never heard of
   * cancellation still reads it as "not applied", which is the safe reading;
   * the ones that know show "Cancelled — no changes made" instead of an error,
   * and file nothing in the audit trail, because nothing happened.
   */
  cancelled?: boolean;
  /**
   * What the undo will need, produced by the action itself.
   *
   * An undo used to be handed only the original payload, which is why every
   * "create" declared `reversal: none`: asked to make a workspace called
   * Helios, the undo knew the name and nothing else, and archiving by name
   * could archive a workspace the user already had. The executor knows the id
   * it just created, so it hands it over here and the undo acts on that exact
   * row. Actions with nothing to hand over leave it undefined.
   */
  undo?: Record<string, unknown>;
};

/**
 * What a capability can make stale, named in terms of the product rather than
 * of any cache.
 *
 * The app used to decide this at the call site, in a chain of `if (tool ===
 * ...)` that covered four of the nine mutations: ticking a readiness criterion
 * or creating a workspace refreshed nothing, so an open page kept showing the
 * state from before the assistant changed it. Declaring it here puts the
 * answer next to the capability it belongs to, and a new capability that
 * forgets is caught by a test rather than by a stale screen.
 *
 * The web app maps each topic to its own query keys, exhaustively, so a topic
 * added here without a binding does not compile.
 */
export type InvalidationTopic =
  | 'connections'
  | 'messages'
  | 'shortlist'
  | 'readiness'
  | 'workspaces'
  | 'investor'
  | 'graph'
  | 'research'
  | 'profile'
  | 'milestones'
  | 'events'
  | 'groups'
  | 'programs'
  | 'invites'
  | 'endorsements'
  | 'mentorships'
  | 'commitments'
  | 'follows'
  | 'intros'
  | 'open_to'
  | 'skill_evidence'
  | 'scout';

export type ActionDeclaration = {
  id: string;
  kind: ActionKind;
  label: BilingualCopy;
  description: BilingualCopy;
  params: readonly ActionParam[];
  /**
   * The topics this capability makes stale. Present on every mutation, empty
   * where nothing is written — `navigate` moves the user and changes no data.
   */
  invalidates?: readonly InvalidationTopic[];
  /**
   * True when a confirmed run reaches a write endpoint. Navigation moves the
   * user rather than their data, so it is false there — that distinction is
   * what lets the UI decide whether a warning is warranted.
   */
  writes: boolean;
  reversal?: ActionReversalDeclaration;
  /**
   * True when a successful run should move the user to the `href` its outcome
   * returns.
   *
   * This used to be a pair of tool ids written into `CopilotWorkspace`, which
   * meant a new capability returning an `href` was silently ignored by the one
   * component able to act on it. It belongs next to the declaration: whether
   * confirming an action takes you somewhere is a property of the action, not
   * of the component that renders its button. `shortlist_add` is why the flag
   * is needed at all rather than "navigate whenever an href comes back" — it
   * returns `/shortlist` as the place the result can be seen, while leaving
   * the user exactly where they were.
   */
  navigatesOnSuccess?: boolean;
  /**
   * Which argument the audit log should file this action against, and what
   * that argument is.
   *
   * The audit derives the subject from the first required parameter and calls
   * it a user unless it is named `href`. That held while every mutation acted
   * on a person, and stopped holding the moment one acted on a readiness
   * dimension: the log would have recorded "team" as a user id. Declared here
   * rather than mapped inside the audit service so the fact lives with the
   * capability, and omitted wherever the original heuristic is already right.
   */
  auditSubject?: { param: string; entityType: string };
  confirmLabel?: BilingualCopy;
  /**
   * The platform roles (`User.role`) allowed to use this capability. Absent
   * means every signed-in user.
   *
   * Mirrors the endpoint's own guard and nothing more: a capability gets
   * `roles` only when its controller carries `@Roles(...)`. Stricter here
   * would hide something the API permits; looser would offer the model a call
   * the API will refuse. The endpoint stays the authority either way.
   */
  roles?: readonly PlatformRole[];
};

/** `User.role` in the Prisma schema. */
export type PlatformRole = 'founder' | 'mentor' | 'investor' | 'org' | 'admin' | 'super_admin';

/** An entry in the catalogue handed to a model that supports function calling. */
export type ToolCatalogEntry = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<
        string,
        { type: ActionParamType; description: string; enum?: readonly string[] }
      >;
      required: string[];
    };
  };
};
