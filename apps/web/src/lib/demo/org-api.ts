/**
 * The preview API's organisation, program and tenant endpoints, answered from
 * the one organisation in `org-world.ts`.
 *
 * Each handler returns what the real controller returns, not what a page
 * wishes it did: program reads are Prisma rows (`name`, `_count`,
 * `currentParticipants`, `settings`), `/programs/my-programs` is the caller's
 * participant rows, `/programs/:id` is the row without an envelope, and the
 * organisation lists are bare arrays where the controller's are. The client
 * normalises those shapes in `lib/api.ts`, so the showcase runs the same code
 * path the API does instead of a friendlier shape that hides a mismatch.
 *
 * Returns `undefined` for a path it does not own, so the caller falls through
 * to its other handlers.
 */
import {
  ORG,
  ORG_FOUNDERS,
  ORG_ID,
  ORG_INVESTORS,
  ORG_MENTORS,
  ORG_PROGRAMS,
  ORG_SLUG,
  ORG_STAFF,
  TENANT_ID,
  orgPerson,
  type OrgParticipant,
  type OrgProgram,
} from './org-world';
import type { CohortDetail, CohortItem } from '@/lib/api';

type Iso = (days: number, hour?: number) => string;

const ENROLLED: OrgParticipant['status'][] = ['accepted', 'active', 'completed'];

function programRow(prog: OrgProgram, iso: Iso) {
  return {
    id: prog.id,
    organizationId: ORG_ID,
    tenantId: TENANT_ID,
    name: prog.title,
    slug: prog.slug,
    description: prog.description,
    shortDescription: null,
    programType: prog.programType,
    status: prog.status,
    startDate: iso(prog.start, 9),
    endDate: iso(prog.end, 18),
    applicationDeadline: prog.deadline == null ? null : iso(prog.deadline, 23),
    capacity: prog.capacity,
    currentParticipants: prog.participants.filter((p) => ENROLLED.includes(p.status)).length,
    isPublic: true,
    isFeatured: prog.status === 'upcoming',
    logoUrl: null,
    coverImageUrl: null,
    curriculum: null,
    requirements: null,
    benefits: prog.benefits,
    settings: { industries: prog.industries, location: prog.location, isRemote: prog.isRemote },
    createdAt: iso(prog.start - 90, 10),
    updatedAt: iso(-1, 10),
    organization: { id: ORG_ID, name: ORG.name, slug: ORG_SLUG, logoUrl: null, type: ORG.type },
    _count: { participants: prog.participants.length },
  };
}

function participantRow(part: OrgParticipant, iso: Iso) {
  const person = orgPerson(part.userId);
  return {
    id: part.id,
    userId: part.userId,
    status: part.status,
    role: 'participant',
    appliedAt: iso(-part.applied, 10),
    acceptedAt: part.decided != null && part.status !== 'rejected' && part.status !== 'applied' ? iso(-part.decided, 11) : null,
    completedAt: part.completed != null ? iso(-part.completed, 17) : null,
    score: part.score ?? null,
    user: {
      id: part.userId,
      profile: person
        ? { displayName: person.name, avatarUrl: null, headline: person.headline, location: person.location }
        : null,
    },
  };
}

/** The mentees a mentor has, or had, in a program. */
function menteesIn(prog: OrgProgram, mentor: (typeof ORG_MENTORS)[number]) {
  const enrolled = new Set(prog.participants.filter((p) => ENROLLED.includes(p.status)).map((p) => p.userId));
  return [...mentor.mentees, ...mentor.pastMentees].filter((id) => enrolled.has(id));
}

/** Mentors whose mentees are, or were, enrolled in a program. */
function mentorsOf(prog: OrgProgram) {
  return ORG_MENTORS.filter((m) => menteesIn(prog, m).length > 0);
}

function cohortItem(prog: OrgProgram, iso: Iso) {
  const founders = prog.participants.filter((p) => ENROLLED.includes(p.status)).length;
  const investors = prog.programType === 'accelerator' ? ORG_INVESTORS.length : 0;
  return {
    id: prog.cohortId,
    name: prog.cohortName,
    slug: prog.cohortId.replace(/^cohort-/, ''),
    description: prog.description,
    startDate: iso(prog.start, 9),
    endDate: iso(prog.end, 18),
    capacity: prog.capacity,
    isPublic: true,
    isActive: prog.status === 'active',
    createdAt: iso(prog.start - 30, 10),
    updatedAt: iso(-1, 10),
    organizerId: 'user-anna',
    _count: { members: founders + mentorsOf(prog).length + investors },
  };
}

/** Everyone in the organisation's cohorts that have started, as `/org/:slug/members` lists them. */
function orgMembers(iso: Iso) {
  const rows: {
    id: string;
    displayName: string;
    avatarUrl: null;
    headline: string;
    location: string;
    role: string;
    cohortName: string;
    joinedAt: string;
  }[] = [];
  const seen = new Set<string>();
  for (const prog of ORG_PROGRAMS.filter((p) => p.status !== 'upcoming')) {
    for (const part of prog.participants.filter((p) => ENROLLED.includes(p.status))) {
      const f = ORG_FOUNDERS[part.userId];
      if (!f || seen.has(f.id)) continue;
      seen.add(f.id);
      rows.push({ id: f.id, displayName: f.name, avatarUrl: null, headline: f.headline, location: f.location, role: 'founder', cohortName: prog.cohortName, joinedAt: iso(-(part.decided ?? part.applied), 11) });
    }
    for (const m of mentorsOf(prog)) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      rows.push({ id: m.id, displayName: m.name, avatarUrl: null, headline: m.headline, location: m.location, role: 'mentor', cohortName: prog.cohortName, joinedAt: iso(-m.joined, 11) });
    }
  }
  for (const inv of ORG_INVESTORS) {
    rows.push({ id: inv.id, displayName: inv.name, avatarUrl: null, headline: inv.headline, location: inv.location, role: 'investor', cohortName: ORG_PROGRAMS[0].cohortName, joinedAt: iso(-inv.joined, 11) });
  }
  return rows;
}

function cohortDetail(prog: OrgProgram, iso: Iso) {
  const founders = prog.participants.filter((p) => ENROLLED.includes(p.status));
  const mentors = mentorsOf(prog);
  const investors = prog.programType === 'accelerator' ? ORG_INVESTORS : [];
  const participants = [
    ...founders.map((part) => {
      const f = ORG_FOUNDERS[part.userId];
      return {
        id: `cp-${part.id}`,
        userId: part.userId,
        role: 'founder' as const,
        cohortRole: `Founder, ${f?.startup ?? ''}`.trim(),
        name: f?.name ?? null,
        email: f?.email ?? '',
        headline: f?.headline ?? null,
        avatarUrl: null,
        location: f?.location ?? null,
        joinedAt: iso(-(part.decided ?? part.applied), 11),
        status: prog.status === 'completed' ? ('inactive' as const) : ('active' as const),
      };
    }),
    ...mentors.map((m) => ({
      id: `cp-${prog.id}-${m.id}`,
      userId: m.id,
      role: 'mentor' as const,
      cohortRole: 'Mentor',
      name: m.name,
      email: m.email,
      headline: m.headline,
      avatarUrl: null,
      location: m.location,
      joinedAt: iso(prog.start, 11),
      status: 'active' as const,
    })),
    ...investors.map((inv) => ({
      id: `cp-${prog.id}-${inv.id}`,
      userId: inv.id,
      role: 'investor' as const,
      cohortRole: 'Investor partner',
      name: inv.name,
      email: inv.email,
      headline: inv.headline,
      avatarUrl: null,
      location: inv.location,
      joinedAt: iso(prog.start, 11),
      status: 'active' as const,
    })),
  ];
  const person = (id: string) => {
    const p = orgPerson(id);
    return { id, name: p?.name ?? null, avatarUrl: null };
  };
  // Weekly sessions for each mentor pair. The reader's pairs carry the
  // counts, times and lengths /mentor/* shows (4, 3 and 2 held; the next at
  // +1, +3 and +5 days), so the cohort and the mentor's calendar agree.
  const completedProgram = prog.status === 'completed';
  const sessions = mentors.flatMap((m) =>
    menteesIn(prog, m).flatMap((menteeId, i) => {
      const reader = m.id === 'preview-demo-user';
      const held = completedProgram ? 4 : reader ? ([4, 3, 2][i] ?? 2) : 2;
      const anchor = completedProgram ? prog.end : 0;
      const slots = [
        ...Array.from({ length: held }, (_, w) => ({ day: anchor - 7 * (w + 1) + i, upcoming: false, w })),
        ...(completedProgram ? [] : [{ day: reader ? 1 + i * 2 : 2 + i * 2, upcoming: true, w: held }]),
      ];
      return slots.map(({ day, upcoming, w }) => ({
        id: `cs-${prog.id}-${m.id}-${menteeId}-${w}`,
        mentor: { id: m.id, name: m.name, avatarUrl: null },
        mentee: person(menteeId),
        title: upcoming || w % 2 === 0 ? 'Weekly check-in' : 'Pricing and pipeline review',
        scheduledAt: iso(day, reader && upcoming ? 10 + i * 2 : 10 + i),
        duration: reader ? ([60, 45, 30][i] ?? 45) : 45,
        status: upcoming ? ('scheduled' as const) : ('completed' as const),
        rating: upcoming ? null : 4 + ((w + i) % 2),
      }));
    }),
  );
  // Suggested introductions inside the cohort: founders who sell to the same
  // buyers, and each founder with the investor partner.
  const matches = founders.slice(0, -1).map((part, i) => {
    const a = orgPerson(part.userId);
    const next = founders[i + 1];
    const b = orgPerson(next.userId);
    return {
      id: `cm-${prog.id}-${i}`,
      a: { id: part.userId, name: a?.name ?? null, role: 'founder', avatarUrl: null },
      b: { id: next.userId, name: b?.name ?? null, role: 'founder', avatarUrl: null },
      score: 82 - i * 4,
      status: i === 0 ? ('connected' as const) : i === 1 ? ('saved' as const) : ('pending' as const),
      generatedAt: iso(prog.start + 3, 9),
      reasons: ['Sell to the same operations teams', 'Both hiring a first salesperson'],
    };
  });
  const done = sessions.filter((s) => s.status === 'completed');
  const rated = done.filter((s) => s.rating != null);
  return {
    cohort: {
      id: prog.cohortId,
      name: prog.cohortName,
      slug: prog.cohortId.replace(/^cohort-/, ''),
      description: prog.description,
      startDate: iso(prog.start, 9),
      endDate: iso(prog.end, 18),
      capacity: prog.capacity,
      isPublic: true,
      isActive: prog.status === 'active',
      imageUrl: null,
      tags: prog.industries,
      organizerId: 'user-anna',
      createdAt: iso(prog.start - 30, 10),
    },
    participants,
    matches,
    sessions,
    stats: {
      participants: participants.length,
      founders: founders.length,
      mentors: mentors.length,
      investors: investors.length,
      completedSessions: done.length,
      upcomingSessions: sessions.length - done.length,
      matches: matches.length,
      connectedMatches: matches.filter((m) => m.status === 'connected').length,
      avgMatchScore: matches.length ? Math.round(matches.reduce((s, m) => s + m.score, 0) / matches.length) : null,
      avgSessionRating: rated.length ? Math.round((rated.reduce((s, x) => s + (x.rating ?? 0), 0) / rated.length) * 10) / 10 : null,
    },
  };
}

function tenantItem(iso: Iso) {
  return {
    id: TENANT_ID,
    slug: ORG_SLUG,
    name: ORG.name,
    displayName: ORG.name,
    shortDescription: ORG.tagline,
    description: ORG.description,
    aboutText: ORG.mission,
    website: ORG.website,
    logoUrl: null,
    faviconUrl: null,
    status: 'active' as const,
    branding: null,
    createdAt: iso(-ORG.founded, 10),
    updatedAt: iso(-3, 10),
  };
}

function ssoProvider(iso: Iso) {
  return {
    id: 'idp-aegean-google',
    tenantId: TENANT_ID,
    providerType: 'oidc' as const,
    providerName: 'Aegean Venture Lab Google Workspace',
    isActive: true,
    oidcIssuerUrl: 'https://accounts.google.com',
    oidcClientId: 'aegean-lab.apps.googleusercontent.example',
    oidcScopes: 'openid email profile',
    loginButtonText: 'Sign in with Aegean Venture Lab',
    loginButtonColor: '#6756dc',
    logoUrl: null,
    createdAt: iso(-121, 10),
    updatedAt: iso(-30, 10),
  };
}

/** Everyone with a seat in the tenant: staff, the mentor pool, and enrolled founders. */
function tenantMembers(iso: Iso) {
  const rows = new Map<string, { role: string; joined: number; email: string; name: string; headline: string }>();
  for (const s of ORG_STAFF) rows.set(s.id, { role: s.role === 'member' ? 'member' : 'admin', joined: s.joined, email: s.email, name: s.name, headline: s.headline });
  for (const m of ORG_MENTORS) if (!rows.has(m.id)) rows.set(m.id, { role: 'mentor', joined: m.joined, email: m.email, name: m.name, headline: m.headline });
  for (const inv of ORG_INVESTORS) rows.set(inv.id, { role: 'investor', joined: inv.joined, email: inv.email, name: inv.name, headline: inv.headline });
  for (const prog of ORG_PROGRAMS) {
    for (const part of prog.participants.filter((p) => ENROLLED.includes(p.status))) {
      const f = ORG_FOUNDERS[part.userId];
      if (f && !rows.has(f.id)) rows.set(f.id, { role: 'founder', joined: part.decided ?? part.applied, email: f.email, name: f.name, headline: f.headline });
    }
  }
  return [...rows.entries()].map(([userId, r]) => ({
    id: `tm-${userId}`,
    tenantId: TENANT_ID,
    userId,
    role: userId === 'user-anna' ? 'owner' : r.role,
    isActive: true,
    joinedAt: iso(-r.joined, 10),
    provisionedViaSSO: r.email.endsWith('@aegeanlab.example'),
    user: { id: userId, email: r.email, role: r.role, profile: { displayName: r.name, avatarUrl: null, headline: r.headline } },
  }));
}

/** Offsets in days from `now`, at an hour in UTC - what the preview API's dates are. */
function isoFrom(now: number): Iso {
  return (days, hour = 14) => {
    const d = new Date(now + days * 86_400_000);
    d.setUTCHours(hour, 0, 0, 0);
    return d.toISOString();
  };
}

/**
 * The organisation's cohorts, for a page showing samples outside the preview
 * session (a real account with sample data on). The same rows the preview API
 * serves, so both paths show one organisation. Call after mount: the dates
 * are counted from `now`.
 */
export function demoCohortItems(now: number): CohortItem[] {
  return ORG_PROGRAMS.map((p) => cohortItem(p, isoFrom(now)));
}

/** One cohort in the shape `GET /org/:slug/cohorts/:id` returns, or null when absent. */
export function demoCohortDetail(cohortId: string, now: number): CohortDetail | null {
  const prog = ORG_PROGRAMS.find((p) => p.cohortId === cohortId || p.cohortId.replace(/^cohort-/, '') === cohortId);
  return prog ? cohortDetail(prog, isoFrom(now)) as CohortDetail : null;
}

export function previewOrgApi(pathname: string, path: string, method: string, iso: Iso): unknown {
  if (method !== 'GET') return undefined;
  const params = new URLSearchParams(path.split('?')[1] ?? '');
  const parts = pathname.split('/').filter(Boolean); // ['api', ...]

  // ── Organisation membership and profile ────────────────────────────────
  if (pathname === '/api/org/my-memberships') {
    return {
      memberships: [
        { id: 'om-demo', organizationId: ORG_ID, role: 'admin', organization: { id: ORG_ID, name: ORG.name, slug: ORG_SLUG, avatarUrl: null } },
      ],
    };
  }
  if (parts[1] === 'org' && parts[2] === ORG_SLUG) {
    const rest = parts.slice(3);
    if (rest.length === 0) {
      const members = orgMembers(iso);
      return {
        org: {
          id: ORG_ID,
          name: ORG.name,
          slug: ORG_SLUG,
          tagline: ORG.tagline,
          description: ORG.description,
          mission: ORG.mission,
          avatarUrl: null,
          website: ORG.website,
          email: ORG.email,
          location: ORG.location,
          industry: ORG.industry,
          focus: ORG.focus,
          size: ORG.size,
          type: ORG.type,
          country: ORG.country,
          timezone: ORG.timezone,
          primaryColor: ORG.primaryColor,
          settings: null,
          createdAt: iso(-ORG.founded, 10),
          updatedAt: iso(-3, 10),
          _count: { opportunities: 2, cohorts: ORG_PROGRAMS.length, members: members.length, events: 3 },
        },
      };
    }
    if (rest[0] === 'cohorts' && rest.length === 1) {
      const cohorts = ORG_PROGRAMS.map((p) => cohortItem(p, iso));
      return { cohorts, total: cohorts.length };
    }
    if (rest[0] === 'cohorts' && rest[1]) {
      const prog = ORG_PROGRAMS.find((p) => p.cohortId === rest[1] || p.cohortId.replace(/^cohort-/, '') === rest[1]);
      return prog ? cohortDetail(prog, iso) : null;
    }
    if (rest[0] === 'members') {
      const all = orgMembers(iso);
      const limit = Number(params.get('limit') ?? 100);
      const offset = Number(params.get('offset') ?? 0);
      return { members: all.slice(offset, offset + limit), total: all.length };
    }
    // Opportunities are answered by the caller, which owns that list.
    return undefined;
  }
  if (parts[1] === 'org' && parts[2] && parts.length === 3) return { org: null };

  // ── Organisations (admin view) ─────────────────────────────────────────
  if (pathname === `/api/organizations/slug/${ORG_SLUG}`) {
    return { id: ORG_ID, name: ORG.name, slug: ORG_SLUG, logo: null, logoUrl: null, _count: { memberships: ORG_STAFF.length + ORG_MENTORS.length, programs: ORG_PROGRAMS.length } };
  }
  if (pathname.startsWith('/api/organizations/slug/')) return null;
  if (parts[1] === 'organizations' && parts[2] === ORG_ID) {
    if (parts[3] === 'members') {
      const people = [...ORG_STAFF.map((s) => ({ ...s, title: s.title, department: 'Programs' })), ...ORG_MENTORS.filter((m) => !ORG_STAFF.some((s) => s.id === m.id)).map((m) => ({ ...m, role: 'mentor', title: 'Mentor', department: 'Mentor pool' }))];
      return people.map((person) => ({
        id: `om-${person.id}`,
        userId: person.id,
        role: person.role,
        isActive: true,
        title: person.title,
        department: person.department,
        joinedAt: iso(-person.joined, 10),
        user: { id: person.id, email: person.email, profile: { displayName: person.name, firstName: person.name.split(' ')[0], lastName: person.name.split(' ').slice(1).join(' '), avatarUrl: null } },
      }));
    }
    if (parts[3] === 'mentors') {
      return {
        mentors: ORG_MENTORS.map((m) => ({
          id: `mp-${m.id}`,
          userId: m.id,
          displayName: m.name,
          avatarUrl: null,
          headline: m.headline,
          expertiseAreas: m.expertise,
          maxMentees: m.maxMentees,
          currentMentees: m.mentees.length,
          isActive: true,
          assignedAt: iso(-m.joined, 10),
        })),
      };
    }
    return undefined;
  }

  // ── Programs ───────────────────────────────────────────────────────────
  if (pathname === '/api/programs') {
    const type = params.get('programType');
    const search = params.get('search')?.toLowerCase() ?? '';
    // The public list: upcoming and running programs, as findPublicPrograms answers.
    const rows = ORG_PROGRAMS
      .filter((p) => p.status === 'upcoming' || p.status === 'active')
      .filter((p) => !type || p.programType === type)
      .filter((p) => !search || `${p.title} ${p.description}`.toLowerCase().includes(search))
      .map((p) => programRow(p, iso));
    return { programs: rows, pagination: { page: 1, limit: 20, total: rows.length, totalPages: 1 } };
  }
  if (pathname === '/api/programs/my-programs') {
    // The reader mentors in the running seed cohort: their participant row.
    const prog = ORG_PROGRAMS[0];
    return [{ id: 'pp-demo-mentor', programId: prog.id, userId: 'preview-demo-user', status: 'active', role: 'mentor', program: programRow(prog, iso) }];
  }
  if (parts[1] === 'programs' && parts[2] === 'organization' && parts[3] === ORG_ID) {
    const status = params.get('status');
    const type = params.get('programType');
    return ORG_PROGRAMS.filter((p) => !status || p.status === status).filter((p) => !type || p.programType === type).map((p) => programRow(p, iso));
  }
  if (parts[1] === 'programs' && parts[2] && ORG_PROGRAMS.some((p) => p.id === parts[2] || p.slug === parts[2])) {
    const prog = ORG_PROGRAMS.find((p) => p.id === parts[2] || p.slug === parts[2])!;
    if (parts[3] === 'participants') {
      const status = params.get('status');
      return { participants: prog.participants.filter((p) => !status || p.status === status).map((p) => participantRow(p, iso)) };
    }
    if (!parts[3]) {
      return { ...programRow(prog, iso), participants: prog.participants.map((p) => participantRow(p, iso)), milestones: [] };
    }
    return undefined;
  }

  // ── Tenant ─────────────────────────────────────────────────────────────
  if (pathname === '/api/sso/memberships') {
    const t = tenantItem(iso);
    return {
      memberships: [
        { id: 'tm-demo', tenantId: TENANT_ID, role: 'admin', isActive: true, joinedAt: iso(-400, 10), tenant: { id: t.id, slug: t.slug, name: t.name, displayName: t.displayName, logoUrl: null } },
      ],
    };
  }
  // Aegean Venture Lab signs its staff in with Google Workspace; founders and
  // mentors keep passwords, so SSO is optional and the lab's domain is mapped.
  if (pathname === `/api/sso/tenants/${TENANT_ID}/providers`) {
    return [ssoProvider(iso)];
  }
  if (pathname === `/api/sso/tenants/${TENANT_ID}/config`) {
    return {
      id: 'sso-config-aegean',
      tenantId: TENANT_ID,
      identityProviderId: 'idp-aegean-google',
      ssoMode: 'optional',
      allowedDomains: ['aegeanlab.example'],
      enforceEmailDomain: false,
      autoProvisionEnabled: true,
      defaultRole: 'member',
      autoAssignToTenant: true,
      roleMappingRules: [{ claim: 'groups', value: 'programs-team', role: 'admin' }],
      postLoginRedirect: '/org/dashboard',
      requireProfileCompletion: true,
      sessionDurationHours: 24,
      allowPasswordFallback: true,
      identityProvider: ssoProvider(iso),
    };
  }
  if (pathname === `/api/sso/tenants/${TENANT_ID}/domains`) {
    return [{ id: 'sso-domain-aegean', domain: 'aegeanlab.example', tenantId: TENANT_ID, isVerified: true, autoRedirectToSSO: false, verifiedAt: iso(-120, 10), createdAt: iso(-121, 10) }];
  }
  // The platform's tenant list: the demo platform hosts one organisation, the
  // one every /org and /tenant screen is about.
  if (pathname === '/api/tenants') {
    const status = params.get('status');
    return [tenantItem(iso)].filter((t) => !status || t.status === status);
  }
  if (pathname === `/api/tenants/by-slug/${ORG_SLUG}` || pathname === `/api/tenants/${TENANT_ID}`) {
    return tenantItem(iso);
  }
  if (pathname.startsWith('/api/tenants/by-slug/')) return null;
  if (pathname === `/api/tenants/${TENANT_ID}/members`) {
    const all = tenantMembers(iso);
    const limit = Number(params.get('limit') ?? 100);
    const offset = Number(params.get('offset') ?? 0);
    return all.slice(offset, offset + limit);
  }
  return undefined;
}
