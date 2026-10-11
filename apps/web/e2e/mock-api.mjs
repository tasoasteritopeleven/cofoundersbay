/**
 * Stub API for the end-to-end suite.
 *
 * The authenticated half of the app (dashboards, admin, settings, messages)
 * cannot be rendered — and therefore cannot be accessibility-tested — without
 * something answering the API. This serves plausible, correctly-shaped payloads
 * for the endpoints those pages call, and a generic empty-collection response
 * for everything else, so a page either renders with data or renders its empty
 * state. Both are real states worth asserting against.
 *
 * It is a test fixture, not a mock framework: it deliberately has no
 * persistence, no auth logic and no validation.
 *
 *   node e2e/mock-api.mjs [port]
 */
import http from 'node:http';

const PORT = Number(process.argv[2] ?? process.env.MOCK_API_PORT ?? 3001);

const now = () => new Date().toISOString();
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString();

const USER = { id: 'u_1', email: 'admin@cofounderbay.test', role: 'admin', emailVerified: true };

const PROFILE = {
  id: 'p_1',
  userId: 'u_1',
  displayName: 'Alex Rivera',
  headline: 'Building developer tools · ex-Stripe',
  bio: 'Technical founder focused on developer experience.',
  avatarUrl: null,
  location: 'Athens, GR',
  roles: ['existing_founder'],
  primaryRole: 'existing_founder',
  skills: [
    { skillId: 's1', skillName: 'TypeScript', level: 'expert' },
    { skillId: 's2', skillName: 'Product', level: 'advanced' },
  ],
  lookingFor: ['technical_cofounder'],
  completeness: 78,
};

/** Endpoints whose shape the pages actually destructure. */
const ROUTES = {
  'GET /api/auth/me': { user: USER },
  'GET /api/me/profile': { profile: PROFILE, hasCompletedOnboarding: true },
  'GET /api/auth/2fa/status': { enabled: false, backupCodesRemaining: 0 },
  'GET /api/auth/linked-accounts': { accounts: [] },

  // A shared need card, opened by someone without an account (/c/[token]).
  'GET /api/commitments/public/e2e-public-card': {
    card: {
      id: 'need-e2e',
      kind: 'cofounder',
      title: 'Technical co-founder for a developer-tools startup',
      exists: 'A paid beta used by eleven engineering teams, with two design partners renewing.',
      goal: 'Reach forty paying teams and a seed round within the next twelve months.',
      missing: 'A technical co-founder who has run developer infrastructure in production.',
      offer: { role: 'CTO and co-founder', equity: '10–15%', hoursPerWeek: 40, scope: 'Own the platform and the first engineering hires.' },
      category: 'Developer Tools',
      place: 'Athens, Greece',
      isRemote: false,
      stage: 'building',
      commitment: 'full_time',
      evidence: [{ id: 'milestones_completed', count: 4 }, { id: 'email_verified', value: true }],
      version: 1,
      outcome: 'open',
      settledAt: null,
      owner: { displayName: 'Alex Rivera', headline: 'Building developer tools', avatarUrl: null },
    },
  },

  'GET /api/dashboard/stats': {
    activeProfiles: 1240,
    matchesThisWeek: 18,
    trendPercent: 12,
    chartData: [
      { label: 'Mon', value: 12 }, { label: 'Tue', value: 18 },
      { label: 'Wed', value: 9 },  { label: 'Thu', value: 24 },
      { label: 'Fri', value: 16 }, { label: 'Sat', value: 7 },
      { label: 'Sun', value: 11 },
    ],
  },
  'GET /api/dashboard/me': { profile: PROFILE, stats: { connections: 42, messages: 8 } },
  'GET /api/dashboard/venture-readiness': {
    overallScore: 68,
    dimensions: [
      { key: 'team', label: 'Team', score: 7, maxScore: 10 },
      { key: 'product', label: 'Product', score: 6, maxScore: 10 },
      { key: 'market', label: 'Market', score: 8, maxScore: 10 },
      { key: 'traction', label: 'Traction', score: 5, maxScore: 10 },
      { key: 'funding', label: 'Funding', score: 6, maxScore: 10 },
    ],
  },

  'GET /api/admin/stats': {
    stats: {
      totalUsers: 12480, usersByRole: { founder: 7200, mentor: 2100, investor: 1900, provider: 1280 },
      newUsersToday: 42, newUsersThisWeek: 318, newUsersThisMonth: 1240,
      activeUsersToday: 890, activeUsersThisWeek: 4100, activeUsersThisMonth: 8800,
      totalConnections: 31200, totalMessages: 98400, totalEvents: 240,
      totalGroups: 88, totalJobs: 156, pendingReports: 3,
    },
  },

  'GET /api/gamification/users/me/xp': { xp: 1000, level: 5, nextLevelXp: 1200, rank: 30 },
  'GET /api/gamification/users/me/streak': { current: 6, longest: 14, lastActiveAt: now() },
  // getMyBadges() is typed Promise<GamificationBadge[]> — a bare array.
  'GET /api/gamification/users/me/badges': [],

  'GET /api/ai/health': { available: true, models: [{ id: 'default', name: 'Default' }] },
  'GET /api/ai/agents': {
    agents: [
      { id: 'general', name: 'General', description: 'Ask anything about your venture' },
      { id: 'fundraising', name: 'Fundraising', description: 'Deck, round strategy, investor prep' },
    ],
  },

  'GET /api/billing/subscription': { subscription: null, plan: 'free' },
  'GET /api/billing/plans': {
    plans: [
      { id: 'free', name: 'Free', priceMonthly: 0, priceYearly: 0, features: ['5 matches / month'], popular: false },
      { id: 'pro', name: 'Pro', priceMonthly: 29, priceYearly: 290, features: ['Unlimited matches', 'AI insights'], popular: true },
      { id: 'team', name: 'Team', priceMonthly: 99, priceYearly: 990, features: ['Everything in Pro', 'Shared workspace'], popular: false },
    ],
  },
};

/** Keys that a page may destructure off a collection response. */
const COLLECTION_KEYS = [
  'items', 'data', 'results', 'connections', 'conversations', 'messages',
  'notifications', 'events', 'groups', 'jobs', 'members', 'tenants', 'users',
  'programs', 'projects', 'milestones', 'suggestions', 'recommendations',
  'rules', 'providers', 'domains', 'skills', 'boards', 'posts', 'reviews',
  'sessions', 'requests', 'applications', 'startups', 'invoices', 'logs',
  'flags', 'reports', 'cohorts', 'templates', 'coupons', 'webhooks', 'keys',
];

/**
 * Endpoints the client types as returning a BARE array (`Promise<T[]>`), rather
 * than a `{ items: [] }` envelope. Derived from the `Promise<X[]>` signatures in
 * lib/api.ts — handing these an object makes the page crash on `.find`/`.map`,
 * which is exactly what the first run of this fixture did.
 */
const ARRAY_PATHS = [
  '/api/admin/config',
  '/api/admin/experiments',
  '/api/admin/score/platform/badge-rates',
  '/api/admin/score/platform/xp-distribution',
  '/api/analytics/achievements',
  '/api/analytics/profile-views',
  '/api/analytics/top-content',
  '/api/automation/executions',
  '/api/automation/templates',
  '/api/behavior/admin/nudge-logs',
  '/api/billing/admin/coupons',
  '/api/billing/admin/invoices',
  '/api/billing/admin/subscriptions',
  '/api/collab/documents',
  '/api/collab/workspaces',
  '/api/gamification/users',
  '/api/gamification/users/me/badges',
  '/api/gamification/workspaces',
  '/api/research/boards',
  '/api/sso/admin/events',
  '/api/sso/tenants',
  '/api/tenants',
];

function isArrayPath(path) {
  return ARRAY_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

function genericBody(path) {
  if (isArrayPath(path)) return [];
  const body = { total: 0, page: 1, pageSize: 20, nextCursor: null, hasMore: false, stats: {} };
  for (const key of COLLECTION_KEYS) body[key] = [];
  return body;
}

const server = http.createServer((req, res) => {
  const origin = req.headers.origin ?? '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type,x-csrf-token,authorization');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }

  const path = new URL(req.url, `http://localhost:${PORT}`).pathname;
  const key = `${req.method} ${path}`;
  const body = ROUTES[key] ?? genericBody(path);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
});

server.listen(PORT, () => {
  console.log(`[mock-api] listening on http://localhost:${PORT}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
