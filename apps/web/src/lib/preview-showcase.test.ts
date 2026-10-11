import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolvePreviewApi } from './preview-api';
import { demoCohortDetail } from './demo/org-api';

/**
 * /events, /jobs, /groups and /opportunities used to fall through to the
 * generic fallback: the pages rendered empty and their stat tiles showed
 * invented copy ("40+", "5+"). These assert the four areas answer with their
 * real shape AND that the controls on those pages actually narrow the list —
 * a filter that returns the same rows every time reads as broken.
 */

type Events = { events: Array<{ id: string; mode: string; startAt: string; viewerRsvp: string | null }> };
describe('preview event identity', () => {
  it('keeps a known record distinct from a missing record', () => {
    expect(resolvePreviewApi('/api/events/ev-demo-day')).toMatchObject({
      event: { id: 'ev-demo-day' },
    });
    expect(resolvePreviewApi('/api/events/__audit_missing__')).toEqual({ event: null });
  });
});

describe('preview dynamic detail identity', () => {
  it('does not substitute the first group for unknown group and nested reads', () => {
    expect(resolvePreviewApi('/api/groups/grp-athens-founders')).toMatchObject({ group: { id: 'grp-athens-founders' } });
    expect(resolvePreviewApi('/api/groups/athens-founders')).toMatchObject({ group: { id: 'grp-athens-founders' } });
    expect(resolvePreviewApi('/api/groups/__audit_missing__')).toMatchObject({ group: null });
    expect(resolvePreviewApi('/api/groups/__audit_missing__/posts')).toMatchObject({ posts: [], total: 0 });
    expect(resolvePreviewApi('/api/groups/__audit_missing__/members')).toMatchObject({ members: [], total: 0 });
  });

  it('does not alias the research board or an investor deal', () => {
    expect(resolvePreviewApi('/api/research/boards/board-gtm')).toMatchObject({ board: { id: 'board-gtm' } });
    expect(resolvePreviewApi('/api/research/boards/__audit_missing__')).toEqual({ board: null });
    expect(resolvePreviewApi('/api/investor/deals/deal-harbor')).toMatchObject({ deal: { id: 'deal-harbor' } });
    expect(resolvePreviewApi('/api/investor/deals/__audit_missing__')).toEqual({ deal: null });
  });

  it('keeps cohort, organisation and tenant identifiers distinct', () => {
    expect(resolvePreviewApi('/api/org/aegean-lab/cohorts/cohort-autumn-2026')).toMatchObject({ cohort: { id: 'cohort-autumn-2026' } });
    expect(resolvePreviewApi('/api/org/aegean-lab/cohorts/__audit_missing__')).toBeNull();
    expect(demoCohortDetail('cohort-autumn-2026', Date.now())).toMatchObject({ cohort: { id: 'cohort-autumn-2026' } });
    expect(demoCohortDetail('__audit_missing__', Date.now())).toBeNull();
    expect(resolvePreviewApi('/api/organizations/slug/aegean-lab')).toMatchObject({ slug: 'aegean-lab' });
    expect(resolvePreviewApi('/api/organizations/slug/__audit_missing__')).toBeNull();
    expect(resolvePreviewApi('/api/org/__audit_missing__')).toEqual({ org: null });
    expect(resolvePreviewApi('/api/tenants/by-slug/aegean-lab')).toMatchObject({ slug: 'aegean-lab' });
    expect(resolvePreviewApi('/api/tenants/by-slug/__audit_missing__')).toBeNull();
  });
});

type Groups = { groups: Array<{ id: string; category: string | null; memberCount: number; isMember: boolean }>; total: number; hasMore: boolean };
type Opps = { opportunities: Array<{ id: string; type: string; isRemote: boolean }>; total: number };

const NOW = '2026-09-04T10:00:00.000Z';

// The resolver splits upcoming from past on the demo's own clock, which the
// app moves to the reader's week (previewClock.test.ts). Pinned to the seed
// day here, the split is the seed's, and these assertions do not depend on
// the date the suite runs.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
});
afterEach(() => vi.useRealTimers());

describe('preview showcase areas', () => {
  it('serves upcoming events, and past ones only under the past scope', () => {
    const upcoming = resolvePreviewApi('/api/events?scope=upcoming&limit=48') as Events;
    expect(upcoming.events.length).toBeGreaterThan(0);
    expect(upcoming.events.every((e) => e.startAt >= NOW)).toBe(true);
    // Upcoming reads forwards, so the soonest event is first.
    expect(upcoming.events[0]!.startAt).toBe(
      [...upcoming.events].sort((a, b) => a.startAt.localeCompare(b.startAt))[0]!.startAt,
    );

    const past = resolvePreviewApi('/api/events?scope=past') as Events;
    expect(past.events.length).toBeGreaterThan(0);
    expect(past.events.every((e) => e.startAt < NOW)).toBe(true);
  });

  it('narrows events by mode and by search text', () => {
    const online = resolvePreviewApi('/api/events?scope=upcoming&mode=online') as Events;
    expect(online.events.length).toBeGreaterThan(0);
    expect(online.events.every((e) => e.mode === 'online')).toBe(true);

    const all = resolvePreviewApi('/api/events?scope=upcoming') as Events;
    expect(online.events.length).toBeLessThan(all.events.length);

    const searched = resolvePreviewApi('/api/events?scope=upcoming&q=pitch') as Events;
    expect(searched.events.length).toBeGreaterThan(0);
    expect(searched.events.length).toBeLessThan(all.events.length);
  });

  it('scopes "my events" to the ones the viewer answered', () => {
    const mine = resolvePreviewApi('/api/events?scope=mine') as Events;
    expect(mine.events.length).toBeGreaterThan(0);
    expect(mine.events.every((e) => e.viewerRsvp != null)).toBe(true);
  });

  it('serves jobs and honours the limit', () => {
    const jobs = resolvePreviewApi('/api/jobs?limit=50') as { jobs: unknown[] };
    expect(jobs.jobs.length).toBeGreaterThan(0);
    const capped = resolvePreviewApi('/api/jobs?limit=2') as { jobs: unknown[] };
    expect(capped.jobs).toHaveLength(2);
  });

  it('serves groups with a real total, and filters by category and search', () => {
    const all = resolvePreviewApi('/api/groups?limit=30&sort=popular') as Groups;
    expect(all.groups.length).toBeGreaterThan(0);
    expect(all.total).toBe(all.groups.length);
    expect(all.hasMore).toBe(false);
    // popular = most members first
    expect(all.groups[0]!.memberCount).toBe(Math.max(...all.groups.map((g) => g.memberCount)));

    const local = resolvePreviewApi('/api/groups?category=Local') as Groups;
    expect(local.groups.length).toBeGreaterThan(0);
    expect(local.groups.every((g) => g.category === 'Local')).toBe(true);
    expect(local.groups.length).toBeLessThan(all.groups.length);

    const searched = resolvePreviewApi('/api/groups?search=metrics') as Groups;
    expect(searched.groups.length).toBeGreaterThan(0);
    expect(searched.groups.length).toBeLessThan(all.groups.length);
  });

  it('returns only joined groups from /api/groups/my', () => {
    const mine = resolvePreviewApi('/api/groups/my') as { groups: Array<{ isMember: boolean; memberRole: string; joinedAt: string }> };
    expect(mine.groups.length).toBeGreaterThan(0);
    expect(mine.groups.every((g) => g.isMember)).toBe(true);
    expect(mine.groups.every((g) => typeof g.memberRole === 'string' && typeof g.joinedAt === 'string')).toBe(true);
  });

  it('serves opportunities and filters by type and remote', () => {
    const all = resolvePreviewApi('/api/opportunities?limit=20') as Opps;
    expect(all.opportunities.length).toBeGreaterThan(0);
    expect(all.total).toBe(all.opportunities.length);

    const cofounder = resolvePreviewApi('/api/opportunities?type=cofounder') as Opps;
    expect(cofounder.opportunities.length).toBeGreaterThan(0);
    expect(cofounder.opportunities.every((o) => o.type === 'cofounder')).toBe(true);

    const remote = resolvePreviewApi('/api/opportunities?isRemote=true') as Opps;
    expect(remote.opportunities.length).toBeGreaterThan(0);
    expect(remote.opportunities.every((o) => o.isRemote)).toBe(true);
    expect(remote.opportunities.length).toBeLessThan(all.opportunities.length);
  });

  /*
   * The organisation screens (/org/*, /tenant/*, the incubator home) each
   * invented an organisation, or said "No organization context" because the
   * reader belonged to none. There is one: the org membership, the tenant
   * membership and every count on those screens come from the same rows.
   */
  it('gives the reader one organisation, the same behind the org and tenant screens', () => {
    const org = resolvePreviewApi('/api/org/my-memberships') as { memberships: { organizationId: string; organization: { slug: string; name: string } }[] };
    const tenant = resolvePreviewApi('/api/sso/memberships') as { memberships: { tenant: { slug: string; name: string } }[] };
    expect(org.memberships).toHaveLength(1);
    expect(tenant.memberships).toHaveLength(1);
    expect(tenant.memberships[0].tenant.slug).toBe(org.memberships[0].organization.slug);
    expect(tenant.memberships[0].tenant.name).toBe(org.memberships[0].organization.name);
  });

  it("counts an organisation's programs from the participants it lists", () => {
    const orgId = (resolvePreviewApi('/api/org/my-memberships') as { memberships: { organizationId: string }[] }).memberships[0].organizationId;
    const programs = resolvePreviewApi(`/api/programs/organization/${orgId}`) as { id: string; currentParticipants: number; _count: { participants: number } }[];
    expect(programs.length).toBeGreaterThan(0);
    for (const program of programs) {
      const { participants } = resolvePreviewApi(`/api/programs/${program.id}/participants`) as { participants: { status: string }[] };
      expect(participants).toHaveLength(program._count.participants);
      expect(participants.filter((p) => ['accepted', 'active', 'completed'].includes(p.status))).toHaveLength(program.currentParticipants);
    }
  });
});
