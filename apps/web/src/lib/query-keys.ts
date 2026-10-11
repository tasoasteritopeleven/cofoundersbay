/**
 * Every React Query key in the app, from one place.
 *
 * `invalidateQueries({ queryKey: ['x'] })` refreshes every key that starts
 * with `['x']` and nothing else, so the first segment of a key decides which
 * writes reach which screens. Written as array literals across 145 files,
 * the app had grown 115 first segments for about 60 resources: "my XP" was
 * cached under `['xp','me']`, `['gamification-xp-me']` and `['my-xp']`; a
 * research board's versions, snapshots, branches and comments each had a
 * root of their own; and three writes invalidated keys that no query read at
 * all - restoring a canvas version refreshed `['board', id]` while the canvas
 * read `['research-board', id]`, so the restored board kept showing the old
 * one.
 *
 * Now a key is `qk(root, ...rest)`. The root must be one of `QUERY_ROOTS`,
 * one per resource, so a new spelling of an existing resource does not
 * compile. Parts of a resource are the second segment (`qk('research-boards',
 * 'versions', boardId)`), which puts them under the resource's invalidation:
 * whatever refreshes the board refreshes its versions. `queryKeyFactory.test.ts`
 * fails on an array-literal key outside this file and on an invalidation that
 * no query can match.
 */

export const QUERY_ROOTS = [
  'achievements',
  'activity-feed',
  'admin',
  'ai',
  'analytics',
  'auth',
  'automation',
  'billing',
  'builder',
  // Need cards, the commitment ladder and public cards (one resource).
  'commitments',
  'connection-status',
  'connections',
  'conversations',
  'dashboard',
  'data-exports',
  // The endorsement dialog's recipient picker: a search of its own (see
  // queryKeyCoherence.test.ts), kept apart so its results are not dropped by
  // another search's invalidation.
  'endorsement-recipient-search',
  'endorsements',
  'entity-search',
  'events',
  'expert-reviews',
  'feed',
  'follows',
  'founder-updates',
  'gamification',
  'graph',
  'groups',
  'intros',
  'investor',
  'invites',
  'jobs',
  'learning',
  'marketplace',
  'matching',
  'me',
  'members',
  'mentors',
  'mentorships',
  'messages',
  'milestones',
  'next-action',
  'notifications',
  'open-to',
  'opportunities',
  'org',
  'pitch-deck',
  'polls',
  'programs',
  'provider',
  'public-profile',
  'public-stats',
  'readiness',
  'recommendations',
  'research-boards',
  'roles',
  // Saved listings and jobs (LinkedIn's "Save"), one resource.
  'saved-items',
  'saved-searches',
  'scout',
  'search',
  'search-suggestions',
  'shortlist',
  'skill-evidence',
  'skills',
  'sso',
  'tenant',
  'transparency',
  'user-search-invite',
  'verification',
  'weekly-digest',
  'workspaces',
] as const;

export type QueryRoot = (typeof QUERY_ROOTS)[number];

/** A key under one of the app's resources: `qk('programs', 'mine')`. */
export function qk<const R extends QueryRoot, const T extends readonly unknown[]>(
  root: R,
  ...rest: T
): readonly [R, ...T] {
  return [root, ...rest] as const;
}

const connectionsList = (tab?: string) => (tab ? qk('connections', tab) : qk('connections'));
const connectionsPending = () => qk('connections', 'pending-received');

const connections = Object.assign(qk('connections'), {
  list: connectionsList,
  pendingReceived: connectionsPending,
});

type ConnectionsKey = readonly ['connections'] & {
  list: (tab?: string) => readonly unknown[];
  pendingReceived: () => readonly ['connections', 'pending-received'];
};

/** Named keys shared by several screens. Everything else is `qk(...)` at the call site. */
export const queryKeys = {
  me: {
    /** Current user's profile. */
    profile: () => qk('me', 'profile'),
  },
  /** Connections query-key family. Use as an array or call `.list()` / `.pendingReceived()`. */
  connections: connections as ConnectionsKey,
  profileMe: qk('me', 'profile'),
  connectionsPending: qk('connections', 'pending-received'),
  conversations: qk('conversations'),
  conversationsList: qk('conversations', 'list'),
  messages: (conversationId: string) => qk('messages', conversationId),
  notifications: qk('notifications'),
  notificationsUnread: qk('notifications', 'unread-count'),
  recommendations: qk('recommendations'),
  graphMe: qk('graph', 'me'),
  xpMe: qk('gamification', 'xp', 'me'),
  aiConversations: qk('ai', 'conversations'),
  aiConversation: (id: string) => qk('ai', 'conversation', id),
  aiPreferences: qk('ai', 'preferences'),
  aiHealth: qk('ai', 'health'),
  aiModels: qk('ai', 'models'),
  aiAgents: qk('ai', 'agents'),
  roles: qk('roles', 'dashboard-context'),
  shortlist: qk('shortlist'),
  shortlistIds: qk('shortlist', 'ids'),
};

/*
 * `['me-profile']`, a second key for the same profile, was listed here so a
 * write would refresh both. No query reads it any more, so the invalidation
 * it asked for reached nothing; the profile has the one key above.
 */
export const PROFILE_KEYS = [queryKeys.profileMe] as const;
export const CONNECTION_KEYS = [
  queryKeys.connections,
  queryKeys.connectionsPending,
  queryKeys.connections.pendingReceived(),
] as const;
export const MESSAGE_KEYS = [queryKeys.conversations, queryKeys.conversationsList] as const;
