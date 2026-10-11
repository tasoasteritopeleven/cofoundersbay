export type ProjectStatus = 'idea' | 'validating' | 'building' | 'launched' | 'scaling';

export type DemoRole = {
  title: string;
  titleEl?: string;
  description: string;
  descriptionEl?: string;
  equity: string;
  commitment: string;
};

export type DemoMember = {
  id: string;
  name: string;
  avatar?: string;
  role: string;
  roleEl?: string;
  joinedAt?: string;
};

export type DemoMilestone = {
  id: string;
  title: string;
  titleEl?: string;
  status: 'completed' | 'in_progress' | 'pending';
  date: string;
};

export type DemoUpdate = {
  id: string;
  content: string;
  contentEl?: string;
  date: string;
  author: string;
};

export type DemoProject = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  /**
   * Greek rendering of the seed catalogue's description — the demo cards were
   * the only English paragraphs left on a Greek-primary Projects page.
   * User-created projects never set it and render exactly what was typed.
   */
  descriptionEl?: string;
  taglineEl?: string;
  status: ProjectStatus;
  stage: string;
  industry: string;
  location: string;
  website: string;
  teamSize: number;
  maxTeamSize: number;
  createdAt: string;
  updatedAt: string;
  founder: { id: string; name: string; avatar?: string; role: string };
  members: DemoMember[];
  rolesNeeded: DemoRole[];
  tags: string[];
  isStarred?: boolean;
  messageCount?: number;
  progress?: number;
  milestones: DemoMilestone[];
  updates: DemoUpdate[];
};

/** Same id as preview-api `ME_ID` so demo tabs match the signed-in Alex Demo. */
export const DEMO_PROJECTS_ME_ID = 'preview-demo-user';
export const DEMO_PROJECT_ELENA_ID = 'user-elena';

const STORAGE_KEY = 'cfb:demo-projects';

export const PROJECT_STATUS_GLYPH: Record<ProjectStatus, 'spark' | 'target' | 'builder' | 'award' | 'chart'> = {
  idea: 'spark',
  validating: 'target',
  building: 'builder',
  launched: 'award',
  scaling: 'chart',
};

const ELENA = { id: DEMO_PROJECT_ELENA_ID, name: 'Elena Papadopoulos', role: 'founder' } as const;
const ALEX = { id: DEMO_PROJECTS_ME_ID, name: 'Alex Demo', role: 'founder' } as const;

/**
 * Harbor catalogue aligned with Idea Core, the GTM board, and the $750K seed.
 * Fast Refresh plus leftover sessionStorage can keep EcoTrack / Fortune 500.
 */
export const DEMO_PROJECTS_SEED: DemoProject[] = [
  {
    id: '1',
    name: 'Harbor',
    tagline: 'Graph + readiness + builder for complementary cofounders',
    taglineEl: 'Γράφος + ετοιμότητα + builder για συμπληρωματικούς συνιδρυτές',
    description:
      'Harbor OS for early-stage founders. Elena Papadopoulos is Founder & CEO. The job is a complementary cofounder — technical + commercial.\n\nProblem: founders waste weeks stitching matching, messaging, and fundraising tools. Product: one workspace with a product graph, readiness, and builder.\n\nSeed: $375K committed of a $750K target. Lead: Athens Tech Angels.',
    descriptionEl:
      'Harbor OS για ιδρυτές πρώιμου σταδίου. Η Elena Papadopoulos είναι ιδρύτρια και CEO. Η εργασία είναι συμπληρωματικός συνιδρυτής — τεχνικό + εμπορικό ζεύγος.\n\nΠρόβλημα: οι ιδρυτές χάνουν εβδομάδες ράβοντας εργαλεία matching, μηνυμάτων και fundraising. Προϊόν: ένας χώρος με γράφο προϊόντος, ετοιμότητα και builder.\n\nΓύρος: $375K δεσμευμένα από στόχο $750K. Lead: Athens Tech Angels.',
    status: 'building',
    stage: 'Pre-seed',
    industry: 'B2B SaaS',
    location: 'Athens, Greece',
    website: '',
    teamSize: 1,
    maxTeamSize: 2,
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-09-04T10:00:00.000Z',
    founder: { ...ELENA },
    members: [
      { id: ELENA.id, name: ELENA.name, role: 'Founder & CEO', roleEl: 'Ιδρύτρια & CEO', joinedAt: '2026-01-15T00:00:00.000Z' },
    ],
    rolesNeeded: [
      {
        title: 'Complementary cofounder — technical + commercial pair',
        titleEl: 'Συμπληρωματικός συνιδρυτής — τεχνικό + εμπορικό ζεύγος',
        description: 'Job: find a complementary cofounder.',
        descriptionEl: 'Εργασία: εύρεση συμπληρωματικού συνιδρυτή.',
        equity: '',
        commitment: 'Full-time',
      },
    ],
    tags: ['Founders', 'Matching', 'Fundraising', 'Athens'],
    isStarred: true,
    messageCount: 1,
    progress: 40,
    milestones: [
      { id: 'h1', title: 'Idea Core v1 in Builder', titleEl: 'Πυρήνας ιδέας v1 στον Builder', status: 'completed', date: '2026-08-01T00:00:00.000Z' },
      { id: 'h2', title: 'BMC v1 in Builder', titleEl: 'Καμβάς μοντέλου v1 στον Builder', status: 'in_progress', date: '2026-09-30T17:00:00.000Z' },
      { id: 'h3', title: 'Pitch deck outline for the $750K seed', titleEl: 'Δομή pitch deck για τον γύρο $750K', status: 'completed', date: '2026-08-20T00:00:00.000Z' },
      { id: 'h4', title: 'Close $750K seed', titleEl: 'Κλείσιμο γύρου $750K', status: 'in_progress', date: '2026-08-20T17:00:00.000Z' },
      { id: 'h5', title: 'Complementary cofounder — technical + commercial pair', titleEl: 'Συμπληρωματικός συνιδρυτής — τεχνικό + εμπορικό ζεύγος', status: 'pending', date: '2026-10-15T17:00:00.000Z' },
    ],
    updates: [
      {
        id: 'hu1',
        content: '$375K committed of a $750K target. Lead: Athens Tech Angels.',
        contentEl: '$375K δεσμευμένα από στόχο $750K. Lead: Athens Tech Angels.',
        date: '2026-09-01T10:00:00.000Z',
        author: ELENA.name,
      },
      {
        id: 'hu2',
        content: 'GTM canvas on Research aligned with Idea Core and the $750K seed.',
        contentEl: 'Καμβάς GTM στους πίνακες έρευνας σε συμφωνία με τον Πυρήνα ιδέας και τον γύρο $750K.',
        date: '2026-08-29T10:00:00.000Z',
        author: ELENA.name,
      },
    ],
  },
  {
    id: '2',
    name: 'Harbor GTM board',
    tagline: 'A filled Idea Core and a research board founders can share',
    taglineEl: 'Συμπληρωμένος Πυρήνας ιδέας και πίνακας έρευνας που μοιράζεται',
    description:
      'First conversion from the GTM offer: a filled Idea Core and a research board they can share. Elena leads; Alex Demo is on the board as a collaborator.\n\nHarbor GTM notes stay aligned with Idea Core and the $750K seed.',
    descriptionEl:
      'Πρώτη μετατροπή από το GTM: συμπληρωμένος Πυρήνας ιδέας και πίνακας έρευνας που μοιράζεται. Η Elena ηγείται· ο Alex Demo είναι συνεργάτης στον πίνακα.\n\nΟι σημειώσεις GTM του Harbor μένουν σε συμφωνία με τον Πυρήνα ιδέας και τον γύρο $750K.',
    status: 'validating',
    stage: 'Idea',
    industry: 'Marketplace',
    location: 'Athens, Greece',
    website: '',
    teamSize: 2,
    maxTeamSize: 3,
    createdAt: '2026-02-20T00:00:00.000Z',
    updatedAt: '2026-09-04T10:00:00.000Z',
    founder: { ...ELENA },
    members: [
      { id: ELENA.id, name: ELENA.name, role: 'Founder & CEO', roleEl: 'Ιδρύτρια & CEO', joinedAt: '2026-02-20T00:00:00.000Z' },
      { id: ALEX.id, name: ALEX.name, role: 'Collaborator', roleEl: 'Συνεργάτης', joinedAt: '2026-03-01T00:00:00.000Z' },
    ],
    rolesNeeded: [],
    tags: ['GTM', 'Research', 'Idea Core'],
    messageCount: 0,
    progress: 30,
    milestones: [
      { id: 'g1', title: 'GTM canvas on Research', titleEl: 'Καμβάς GTM στους πίνακες έρευνας', status: 'completed', date: '2026-08-29T00:00:00.000Z' },
      { id: 'g2', title: 'Shareable Idea Core and GTM board', titleEl: 'Πυρήνας ιδέας και πίνακας GTM που μοιράζονται', status: 'in_progress', date: '2026-10-01T17:00:00.000Z' },
    ],
    updates: [
      {
        id: 'gu1',
        content: 'Harbor GTM notes aligned with Idea Core and the $750K seed.',
        contentEl: 'Σημειώσεις GTM του Harbor σε συμφωνία με τον Πυρήνα ιδέας και τον γύρο $750K.',
        date: '2026-08-29T09:00:00.000Z',
        author: ELENA.name,
      },
    ],
  },
  {
    id: '3',
    name: 'First founder-network path in Athens',
    tagline: 'Discover, matches, and shareable Builder docs',
    taglineEl: 'Discover, matches και παραδοτέα Builder που μοιράζονται',
    description:
      'Alex Demo leads this project: a first path into founder networks.\n\nFirst path: founder networks in Athens and EU time zones. Waiting on a warm intro.',
    descriptionEl:
      'Ο Alex Demo ηγείται αυτού του έργου: μια πρώτη διαδρομή μέσα από δίκτυα ιδρυτών.\n\nΠρώτη διαδρομή: δίκτυα ιδρυτών στην Αθήνα και ζώνες ώρας ΕΕ. Αναμονή ζεστής γνωριμίας.',
    status: 'idea',
    stage: 'Concept',
    industry: 'Other',
    location: 'Athens, Greece',
    website: '',
    teamSize: 1,
    maxTeamSize: 2,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-09-04T10:00:00.000Z',
    founder: { ...ALEX },
    members: [
      { id: ALEX.id, name: ALEX.name, role: 'Founder', roleEl: 'Ιδρυτής', joinedAt: '2026-03-01T00:00:00.000Z' },
    ],
    rolesNeeded: [],
    tags: ['Athens', 'Networks', 'Matches'],
    progress: 10,
    milestones: [
      { id: 'a1', title: 'Warm intro from Athens founder networks', titleEl: 'Ζεστή γνωριμία μέσω δικτύων ιδρυτών στην Αθήνα', status: 'in_progress', date: '2026-10-01T17:00:00.000Z' },
    ],
    updates: [
      {
        id: 'au1',
        content: 'First path: founder networks in Athens and EU time zones.',
        contentEl: 'Πρώτη διαδρομή: δίκτυα ιδρυτών στην Αθήνα και ζώνες ΕΕ.',
        date: '2026-09-02T10:00:00.000Z',
        author: ALEX.name,
      },
    ],
  },
];

const PREVIEW_PROJECT_LEGACY_NAMES = new Set(['EcoTrack', 'MentorMatch', 'HealthSync']);
const PREVIEW_PROJECT_LEGACY_SNIPPETS = [
  'Fortune 500',
  'carbon footprint',
  'First 10 Customers',
  'wearable',
  'Pilot cohort of 12 teams',
];

export function isStaleHarborProjectSeed(row: Pick<DemoProject, 'id' | 'name' | 'description'>): boolean {
  const seeded = DEMO_PROJECTS_SEED.find((s) => s.id === row.id);
  if (!seeded) return false;
  const description = row.description ?? '';
  return (
    PREVIEW_PROJECT_LEGACY_NAMES.has(row.name) ||
    PREVIEW_PROJECT_LEGACY_SNIPPETS.some((snippet) => description.includes(snippet))
  );
}

export type ProjectsOverlay = {
  created: DemoProject[];
  starred: Record<string, boolean>;
  deleted: string[];
  /** Project ids Alex has asked to join; the founder has not accepted yet. */
  joinRequested: string[];
  /** Role titles applied to, keyed by project id. */
  appliedRoles: Record<string, string[]>;
};

export function emptyProjectsOverlay(): ProjectsOverlay {
  return { created: [], starred: {}, deleted: [], joinRequested: [], appliedRoles: {} };
}

function coerceOverlay(parsed: Partial<ProjectsOverlay> | null | undefined): ProjectsOverlay {
  const applied =
    parsed?.appliedRoles && typeof parsed.appliedRoles === 'object' && !Array.isArray(parsed.appliedRoles)
      ? Object.fromEntries(
          Object.entries(parsed.appliedRoles).map(([id, titles]) => [
            id,
            Array.isArray(titles) ? titles.filter((title): title is string => typeof title === 'string') : [],
          ]),
        )
      : {};
  return {
    created: Array.isArray(parsed?.created) ? parsed.created : [],
    starred: parsed?.starred && typeof parsed.starred === 'object' && !Array.isArray(parsed.starred) ? parsed.starred : {},
    deleted: Array.isArray(parsed?.deleted) ? parsed.deleted : [],
    joinRequested: Array.isArray(parsed?.joinRequested)
      ? parsed.joinRequested.filter((id): id is string => typeof id === 'string')
      : [],
    appliedRoles: applied,
  };
}

export function readProjectsOverlay(): ProjectsOverlay {
  if (typeof window === 'undefined') return emptyProjectsOverlay();
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProjectsOverlay();
    return coerceOverlay(JSON.parse(raw) as Partial<ProjectsOverlay>);
  } catch {
    return emptyProjectsOverlay();
  }
}

export function writeProjectsOverlay(overlay: ProjectsOverlay) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(overlay));
}

const SEED_IDS = new Set(DEMO_PROJECTS_SEED.map((p) => p.id));

export function resolveDemoProjects(overlay: Partial<ProjectsOverlay> = emptyProjectsOverlay()): DemoProject[] {
  const resolved = coerceOverlay(overlay);
  const fromSeed = DEMO_PROJECTS_SEED
    .filter((p) => !resolved.deleted.includes(p.id))
    .map((p) => ({
      ...p,
      isStarred: resolved.starred[p.id] ?? p.isStarred,
    }));
  const created = resolved.created
    .filter((p) => !resolved.deleted.includes(p.id) && !SEED_IDS.has(p.id))
    .map((p) => {
      if (isStaleHarborProjectSeed(p)) {
        const fresh = DEMO_PROJECTS_SEED.find((s) => s.id === p.id);
        return fresh
          ? { ...fresh, isStarred: resolved.starred[p.id] ?? fresh.isStarred }
          : p;
      }
      return {
        ...p,
        isStarred: resolved.starred[p.id] ?? p.isStarred,
      };
    });
  return [...created, ...fromSeed];
}

export function listDemoProjects(): DemoProject[] {
  return resolveDemoProjects(readProjectsOverlay());
}

export function getDemoProject(id: string, overlay?: Partial<ProjectsOverlay>): DemoProject | undefined {
  return resolveDemoProjects(overlay ?? readProjectsOverlay()).find((p) => p.id === id);
}

export function isOwnedProject(project: DemoProject, userId = DEMO_PROJECTS_ME_ID): boolean {
  return project.founder.id === userId;
}

export function isJoinedProject(project: DemoProject, userId = DEMO_PROJECTS_ME_ID): boolean {
  return !isOwnedProject(project, userId) && project.members.some((m) => m.id === userId);
}

export function demoProjectStats(projects: DemoProject[]) {
  return {
    total: projects.length,
    active: projects.filter((p) => p.status === 'building' || p.status === 'launched' || p.status === 'scaling').length,
    openRoles: projects.reduce((n, p) => n + p.rolesNeeded.length, 0),
    industries: new Set(projects.map((p) => p.industry)).size,
  };
}

export function createDemoProject(input: {
  name: string;
  tagline: string;
  description: string;
  status: ProjectStatus;
  industry: string;
  location: string;
  website: string;
  maxTeamSize: number;
  rolesNeeded: string[];
  tags: string[];
}): DemoProject {
  const now = new Date().toISOString();
  const project: DemoProject = {
    id: `p-${Date.now()}`,
    name: input.name.trim(),
    tagline: input.tagline.trim(),
    description: input.description.trim(),
    status: input.status,
    stage: input.status === 'idea' ? 'Concept' : input.status === 'validating' ? 'Idea' : 'Pre-seed',
    industry: input.industry,
    location: input.location.trim(),
    website: input.website.trim(),
    teamSize: 1,
    maxTeamSize: input.maxTeamSize,
    createdAt: now,
    updatedAt: now,
    founder: { id: DEMO_PROJECTS_ME_ID, name: 'Alex Demo', role: 'founder' },
    members: [{ id: DEMO_PROJECTS_ME_ID, name: 'Alex Demo', role: 'Founder', roleEl: 'Ιδρυτής', joinedAt: now }],
    rolesNeeded: input.rolesNeeded.map((title) => ({
      title,
      description: '',
      equity: '',
      commitment: 'Full-time',
    })),
    tags: input.tags,
    progress: 5,
    milestones: [],
    updates: [],
  };
  const overlay = readProjectsOverlay();
  overlay.created = [project, ...overlay.created.filter((p) => !SEED_IDS.has(p.id))];
  writeProjectsOverlay(overlay);
  return project;
}

export function toggleDemoStar(id: string): boolean {
  const overlay = readProjectsOverlay();
  const current = getDemoProject(id, overlay);
  const next = !(current?.isStarred ?? false);
  overlay.starred[id] = next;
  writeProjectsOverlay(overlay);
  return next;
}

export function deleteDemoProject(id: string) {
  const overlay = readProjectsOverlay();
  if (!overlay.deleted.includes(id)) overlay.deleted.push(id);
  overlay.created = overlay.created.filter((p) => p.id !== id);
  overlay.joinRequested = overlay.joinRequested.filter((projectId) => projectId !== id);
  const { [id]: _dropped, ...appliedRoles } = overlay.appliedRoles;
  overlay.appliedRoles = appliedRoles;
  writeProjectsOverlay(overlay);
}

export function overlayRequestJoin(
  overlay: Partial<ProjectsOverlay>,
  id: string,
  userId = DEMO_PROJECTS_ME_ID,
): ProjectsOverlay {
  const resolved = coerceOverlay(overlay);
  const project = getDemoProject(id, resolved);
  if (!project || isOwnedProject(project, userId) || isJoinedProject(project, userId)) return resolved;
  if (resolved.joinRequested.includes(id)) return resolved;
  return { ...resolved, joinRequested: [...resolved.joinRequested, id] };
}

export function overlayApplyRole(
  overlay: Partial<ProjectsOverlay>,
  projectId: string,
  roleTitle: string,
  userId = DEMO_PROJECTS_ME_ID,
): ProjectsOverlay {
  const resolved = coerceOverlay(overlay);
  const project = getDemoProject(projectId, resolved);
  if (!project || isOwnedProject(project, userId)) return resolved;
  if (!project.rolesNeeded.some((role) => role.title === roleTitle)) return resolved;
  const current = resolved.appliedRoles[projectId] ?? [];
  if (current.includes(roleTitle)) return resolved;
  return {
    ...resolved,
    appliedRoles: { ...resolved.appliedRoles, [projectId]: [...current, roleTitle] },
  };
}

export function hasJoinRequest(id: string, overlay?: Partial<ProjectsOverlay>): boolean {
  return coerceOverlay(overlay ?? readProjectsOverlay()).joinRequested.includes(id);
}

export function appliedRolesFor(id: string, overlay?: Partial<ProjectsOverlay>): string[] {
  return coerceOverlay(overlay ?? readProjectsOverlay()).appliedRoles[id] ?? [];
}

export function requestJoinDemoProject(id: string): boolean {
  const before = readProjectsOverlay();
  const next = overlayRequestJoin(before, id);
  if (!next.joinRequested.includes(id)) return false;
  if (!before.joinRequested.includes(id)) writeProjectsOverlay(next);
  return true;
}

export function applyDemoRole(projectId: string, roleTitle: string): boolean {
  const before = readProjectsOverlay();
  const next = overlayApplyRole(before, projectId, roleTitle);
  const titles = next.appliedRoles[projectId] ?? [];
  if (!titles.includes(roleTitle)) return false;
  if (!(before.appliedRoles[projectId] ?? []).includes(roleTitle)) writeProjectsOverlay(next);
  return true;
}
