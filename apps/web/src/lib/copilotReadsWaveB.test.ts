import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/lib/api';
import { AREA_READERS } from './copilot-reads';
import { detectAreaReads } from './copilot-planner';
import { translate } from './i18n/translate';

/**
 * Wave B: the eighteen reads added to the assistant, one per area it could
 * only open before.
 *
 * Each reader is driven with the shape its client function returns and with
 * the shapes that break careless code (an object where a list belongs, a
 * missing envelope). The planner half checks that an English and a Greek
 * question each reach the read, and that the two exclusions hold.
 */

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    listPrograms: vi.fn(),
    getMyPrograms: vi.fn(),
    listInvites: vi.fn(),
    getInviteStats: vi.fn(),
    getMyXP: vi.fn(),
    getMyBadges: vi.fn(),
    getVentureReadiness: vi.fn(),
    getAnalyticsOverview: vi.fn(),
    discoverMentors: vi.fn(),
    getMyReceivedMentorRequests: vi.fn(),
    getMySentMentorRequests: vi.fn(),
    listMentorBookings: vi.fn(),
    listMentorAvailability: vi.fn(),
    listMyMarketplaceServices: vi.fn(),
    listServiceInquiries: vi.fn(),
    listLearningResources: vi.fn(),
    listExpertReviews: vi.fn(),
    getUserOrganizations: vi.fn(),
    getOrgCohorts: vi.fn(),
    getOrgMembers: vi.fn(),
    getAdminStats: vi.fn(),
    listAdminReports: vi.fn(),
  };
});

const en = { t: (s: string, v?: Record<string, string | number>) => translate('en', s, v), locale: 'en' };
const el = { t: (s: string, v?: Record<string, string | number>) => translate('el', s, v), locale: 'el' };
const DAY = 86_400_000;
const iso = (days: number) => new Date(Date.now() + days * DAY).toISOString();
const m = <K extends keyof typeof api>(name: K) => vi.mocked(api[name] as (...args: never[]) => unknown);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('programmes', () => {
  const program = (over: Record<string, unknown>) => ({
    id: 'p1', slug: 'p1', title: 'Seed Accelerator', description: null, programType: 'accelerator', status: 'active',
    startDate: iso(10), endDate: iso(90), applicationDeadline: iso(5), capacity: 8, isRemote: false, location: 'Athens',
    industries: [], benefits: [], requirements: null, curriculum: null, settings: null, applicationCount: 3, participantCount: 5,
    organization: { id: 'o1', name: 'Aegean Venture Lab', slug: 'aegean', organizationType: 'accelerator' }, ...over,
  });

  it('lists only programmes still taking applications, with places left', async () => {
    m('listPrograms').mockResolvedValue({ programs: [program({}), program({ id: 'p2', title: 'Closed', applicationDeadline: iso(-2) })], total: 2 } as never);
    const result = await AREA_READERS.get_programs({}, en);
    expect(result.section).toContain('Seed Accelerator');
    expect(result.section).toContain('3 places left');
    expect(result.section).not.toContain('Closed');
    expect(result.actions[0].href).toBe('/programs');
  });

  it('says so when nothing is open, and survives a non-list', async () => {
    m('listPrograms').mockResolvedValue({ programs: {} } as never);
    const result = await AREA_READERS.get_programs({}, en);
    expect(result.section).toBe('No programme is taking applications right now.');
  });

  it('reads the reader’s own applications with their state, in Greek', async () => {
    m('getMyPrograms').mockResolvedValue({ programs: [program({ myStatus: 'applied' })] } as never);
    const result = await AREA_READERS.get_my_programs({}, el);
    expect(result.section).toContain('Τα προγράμματά σας:');
    expect(result.section).toContain('η αίτηση στάλθηκε');
  });
});

describe('invitations, reputation, readiness and analytics', () => {
  it('counts invitations and lists who joined', async () => {
    m('listInvites').mockResolvedValue({ invites: [{ id: 'i1', email: 'a@x.example', message: null, status: 'accepted', createdAt: iso(-3), acceptedAt: iso(-1), expiresAt: null }], total: 1 } as never);
    m('getInviteStats').mockResolvedValue({ stats: { total: 5, pending: 2, accepted: 2, remaining: 45 } } as never);
    const result = await AREA_READERS.get_invites({}, en);
    expect(result.section).toContain('5 sent · 2 joined · 45 invitations left');
    expect(result.section).toContain('a@x.example');
    expect(result.section).toContain('joined');
  });

  it('reads the level, streak and newest badges first', async () => {
    m('getMyXP').mockResolvedValue({ userId: 'u', totalXp: 420, level: 3, levelLabel: 'Builder', xpToNextLevel: 80, levelProgress: 0.8, recentEvents: [], streak: { currentStreak: 6, longestStreak: 9, lastActiveDate: null } } as never);
    m('getMyBadges').mockResolvedValue([
      { id: 'b1', key: 'a', name: 'Older', description: 'first', category: 'x', rarity: 'common', iconName: null, xpReward: 5, awardedAt: '2026-01-01T00:00:00Z' },
      { id: 'b2', key: 'b', name: 'Newer', description: 'second', category: 'x', rarity: 'common', iconName: null, xpReward: 5, awardedAt: '2026-06-01T00:00:00Z' },
    ] as never);
    const result = await AREA_READERS.get_reputation({}, en);
    expect(result.section).toContain('Level 3 · 420 XP · 80 XP to the next level');
    expect(result.section).toContain('6-day activity streak');
    expect(result.section.indexOf('Newer')).toBeLessThan(result.section.indexOf('Older'));
  });

  it('names the weakest readiness dimension', async () => {
    m('getVentureReadiness').mockResolvedValue({
      overall: 61.4,
      dimensions: [{ key: 'team', label: 'Team', score: 80, weight: 1, href: '/x' }, { key: 'market', label: 'Market', score: 40, weight: 1, href: '/x' }],
      lowestDimension: { key: 'market', label: 'Market', score: 40, weight: 1, href: '/x' },
      signals: { boardCount: 0, totalNodes: 0, docCount: 0, connectionCount: 0, sessionCount: 0 },
    } as never);
    const result = await AREA_READERS.get_readiness({}, en);
    expect(result.section).toContain('Venture readiness: 61/100');
    expect(result.section).toContain('Weakest: Market (40/100)');
  });

  it('reports seven-day figures with the change against the week before', async () => {
    m('getAnalyticsOverview').mockResolvedValue({ metrics: { profileViews: 12, profileViewsChange: 20, newConnections: 3, newConnectionsChange: null, messagesSent: 7, messagesSentChange: -10 } } as never);
    const result = await AREA_READERS.get_analytics({}, en);
    expect(result.section).toContain('Profile views: 12 (+20% vs the week before)');
    expect(result.section).toContain('New connections: 3');
    expect(result.section).toContain('Messages sent: 7 (-10% vs the week before)');
  });
});

describe('mentoring', () => {
  it('lists bookable mentors, most booked first, without the unavailable', async () => {
    const mentor = (id: string, sessions: number, status: string) => ({ id, userId: `u-${id}`, displayName: `Mentor ${id}`, headline: 'Advisor', skills: [], availabilityStatus: status, isFree: false, hourlyRate: 90, currency: 'EUR', sessionCount: sessions, rating: 4.8, reviewCount: 4 });
    m('discoverMentors').mockResolvedValue({ mentors: [mentor('a', 2, 'available'), mentor('b', 9, 'limited'), mentor('c', 20, 'unavailable')], total: 3 } as never);
    const result = await AREA_READERS.get_mentors({}, en);
    expect(result.section.indexOf('Mentor b')).toBeLessThan(result.section.indexOf('Mentor a'));
    expect(result.section).not.toContain('Mentor c');
    expect(result.section).toContain('EUR 90 per hour');
  });

  it('separates requests waiting on the reader from the ones they sent', async () => {
    const request = (status: string, who: string) => ({ id: who, requesterId: who, mentorId: 'm', message: '', goals: null, focusAreas: ['Pricing'], preferredFormat: null, status, createdAt: iso(-2), updatedAt: iso(-2), requester: { id: who, displayName: who, headline: null, avatarUrl: null, role: 'founder' }, mentor: { id: 'm', displayName: 'Sarah', headline: null, avatarUrl: null } });
    m('getMyReceivedMentorRequests').mockResolvedValue({ requests: [request('pending', 'Sofia'), request('accepted', 'Old')] } as never);
    m('getMySentMentorRequests').mockResolvedValue({ requests: [request('declined', 'Me')] } as never);
    const result = await AREA_READERS.get_mentor_requests({}, en);
    expect(result.section).toContain('Waiting for your answer:');
    expect(result.section).toContain('Sofia');
    expect(result.section).not.toContain('Old');
    expect(result.section).toContain('Sarah** — declined');
  });

  it('lists upcoming bookings soonest first and drops cancelled and past ones', async () => {
    const booking = (id: string, days: number, status: string) => ({ id, mentorId: 'm', menteeId: 'e', startAt: iso(days), endAt: iso(days + 0.04), timezone: null, meetingType: 'video', meetingUrl: null, notes: null, status, priceCents: null, currency: null, mentor: { id: 'm', displayName: 'Sarah', avatarUrl: null }, mentee: { id: 'e', displayName: `E${id}`, avatarUrl: null } });
    m('listMentorBookings').mockResolvedValue({ bookings: [booking('2', 5, 'confirmed'), booking('1', 1, 'requested'), booking('x', 2, 'cancelled'), booking('p', -3, 'completed')] } as never);
    const result = await AREA_READERS.get_bookings({}, en);
    expect(result.section.indexOf('E1')).toBeLessThan(result.section.indexOf('E2'));
    expect(result.section).not.toContain('Ex');
    expect(result.section).not.toContain('Ep');
  });

  it('reads the saved weekly hours with weekday names in the reader’s language', async () => {
    m('listMentorAvailability').mockResolvedValue({ slots: [{ id: 's', mentorId: 'm', weekday: 2, startTime: '10:00', endTime: '13:00', timezone: 'Europe/Athens' }] } as never);
    const english = await AREA_READERS.get_availability({}, en);
    expect(english.section).toContain('Your weekly hours (Europe/Athens):');
    expect(english.section).toContain('Tuesday');
    const greek = await AREA_READERS.get_availability({}, el);
    expect(greek.section).toContain('Τρίτη');
  });
});

describe('providers, learning and expert reviews', () => {
  it('lists the listings /provider/services shows, with pricing and state', async () => {
    m('listMyMarketplaceServices').mockResolvedValue({ services: [
      { id: 's1', title: 'Pricing sprint', category: 'consulting', pricing: 'From €900', isActive: true, isFeatured: true },
      { id: 's2', title: 'Old offer', category: 'legal', pricing: null, isActive: false, isFeatured: false },
    ], total: 2, hasMore: false } as never);
    const result = await AREA_READERS.get_services({}, en);
    expect(result.section).toContain('Pricing sprint** — consulting · From €900 · live · featured');
    expect(result.section).toContain('Old offer** — legal · paused');
    const greek = await AREA_READERS.get_services({}, el);
    expect(greek.section).toContain('συμβουλευτική');
  });

  it('lists inquiries with the offer, state and budget', async () => {
    m('listServiceInquiries').mockResolvedValue({ inquiries: [{ id: 'q', status: 'open', message: '', budgetEstimate: 1500, currency: 'EUR', createdAt: iso(-1), offer: { id: 'o', title: 'Pricing sprint', category: 'x' }, client: { id: 'c', displayName: 'Meltemi', avatarUrl: null }, provider: { id: 'p', displayName: 'Me', avatarUrl: null } }], total: 1 } as never);
    const result = await AREA_READERS.get_inquiries({}, en);
    expect(result.section).toContain('Meltemi');
    expect(result.section).toContain('waiting for a reply');
    expect(result.section).toContain('budget EUR 1500');
  });

  it('falls back from featured to any learning resources', async () => {
    m('listLearningResources')
      .mockResolvedValueOnce({ resources: [], total: 0, hasMore: false } as never)
      .mockResolvedValueOnce({ resources: [{ id: 'l', title: 'Pricing 101', type: 'course', difficulty: 'beginner', duration: 45, author: 'Ada' }], total: 1, hasMore: false } as never);
    const result = await AREA_READERS.get_learning({}, en);
    expect(result.section).toContain('Pricing 101');
    expect(result.section).toContain('45 min');
  });

  it('reads reviews on both sides', async () => {
    const review = (status: string) => ({ id: status, reviewType: 'pitch_deck', status, dueDate: null, scoreOverall: 7, requester: { displayName: 'Founder' }, expert: { displayName: 'Expert' } });
    m('listExpertReviews').mockResolvedValueOnce({ reviews: [review('submitted')], total: 1 } as never).mockResolvedValueOnce({ reviews: [review('requested')], total: 1 } as never);
    const result = await AREA_READERS.get_expert_reviews({}, en);
    expect(result.section).toContain('Reviews you requested:');
    expect(result.section).toContain('Reviews asked of you:');
    expect(result.section).toContain('Pitch deck review');
    expect(result.section).toContain('score 7');
  });
});

describe('organisations and platform administration', () => {
  it('says the reader belongs to no organisation rather than failing', async () => {
    m('getUserOrganizations').mockResolvedValue({ memberships: [] } as never);
    const result = await AREA_READERS.get_org_cohorts({}, en);
    expect(result.section).toBe('You are not a member of an organisation.');
    expect(api.getOrgCohorts).not.toHaveBeenCalled();
  });

  it('reads the first organisation’s cohorts with their state', async () => {
    m('getUserOrganizations').mockResolvedValue({ memberships: [{ id: 'm', organizationId: 'o', role: 'admin', organization: { id: 'o', name: 'Aegean', slug: 'aegean-lab', avatarUrl: null } }] } as never);
    m('getOrgCohorts').mockResolvedValue({ cohorts: [{ id: 'c1', name: 'Autumn 2026 cohort', startDate: iso(-18), endDate: iso(66), isActive: true, _count: { members: 9 } }], total: 1 } as never);
    const result = await AREA_READERS.get_org_cohorts({}, en);
    expect(api.getOrgCohorts).toHaveBeenCalledWith('aegean-lab', expect.anything());
    expect(result.section).toContain('Autumn 2026 cohort');
    expect(result.section).toContain('running');
    expect(result.section).toContain('9 members');
  });

  it('lists the newest organisation members first', async () => {
    m('getUserOrganizations').mockResolvedValue({ memberships: [{ id: 'm', organizationId: 'o', role: 'admin', organization: { id: 'o', name: 'Aegean', slug: 'aegean-lab', avatarUrl: null } }] } as never);
    m('getOrgMembers').mockResolvedValue({ members: [
      { id: 'a', displayName: 'Older', role: 'founder', cohortName: 'Spring', joinedAt: iso(-200) },
      { id: 'b', displayName: 'Newer', role: 'mentor', cohortName: 'Autumn', joinedAt: iso(-3) },
    ], total: 2 } as never);
    const result = await AREA_READERS.get_org_members({}, en);
    expect(result.section).toContain('2 members; the newest:');
    expect(result.section.indexOf('Newer')).toBeLessThan(result.section.indexOf('Older'));
  });

  it('reads platform figures and the oldest open reports', async () => {
    m('getAdminStats').mockResolvedValue({ stats: { totalUsers: 120, newUsersThisWeek: 8, activeUsersThisWeek: 40, totalConnections: 300, totalMessages: 900, totalEvents: 12, totalGroups: 6, totalJobs: 9, pendingReports: 2 } } as never);
    const stats = await AREA_READERS.get_platform_stats({}, en);
    expect(stats.section).toContain('120 users · 8 new this week · 40 active this week');
    expect(stats.section).toContain('2 reports waiting for review');

    m('listAdminReports').mockResolvedValue({ reports: [
      { id: 'r2', type: 'spam', status: 'pending', reason: 'links', createdAt: '2026-09-20T00:00:00Z', reported: { id: 'x', email: 'x@y', name: 'Newer case' } },
      { id: 'r1', type: 'fake', status: 'pending', reason: 'stolen photo', createdAt: '2026-09-01T00:00:00Z', reported: { id: 'y', email: 'y@y', name: 'Older case' } },
    ] } as never);
    const queue = await AREA_READERS.get_moderation_queue({}, en);
    expect(queue.section.indexOf('Older case')).toBeLessThan(queue.section.indexOf('Newer case'));
    expect(queue.section).toContain('Fake account');
  });
});

describe('planning the new reads', () => {
  const cases: Array<[string, string]> = [
    ['Which programmes are taking applications?', 'get_programs'],
    ['Ποια προγράμματα δέχονται αιτήσεις;', 'get_programs'],
    ['Where do my applications stand?', 'get_my_programs'],
    ['Who have I invited?', 'get_invites'],
    ['Ποιους έχω προσκαλέσει;', 'get_invites'],
    ['Which badges do I have?', 'get_reputation'],
    ['Τι σήματα έχω;', 'get_reputation'],
    ['Τι εμβλήματα έχω;', 'get_reputation'],
    ['Έχω συστάσεις σε αναμονή;', 'get_endorsements'],
    ['Έχω αιτήματα καθοδήγησης σε αναμονή;', 'get_mentor_requests'],
    ['What is my readiness score?', 'get_readiness'],
    ['Ποια είναι η ετοιμότητά μου;', 'get_readiness'],
    ['How many profile views did I get?', 'get_analytics'],
    ['Πόσες προβολές είχα;', 'get_analytics'],
    ['Which mentors are available?', 'get_mentors'],
    ['Any mentoring requests?', 'get_mentor_requests'],
    ['What bookings do I have?', 'get_bookings'],
    ['Ποιες κρατήσεις έχω;', 'get_bookings'],
    ['What are my weekly hours?', 'get_availability'],
    ['Show my service offers', 'get_services'],
    ['Any new inquiries?', 'get_inquiries'],
    ['Suggest a course', 'get_learning'],
    ['Where are my expert reviews?', 'get_expert_reviews'],
    ['Which cohorts are running?', 'get_org_cohorts'],
    ['Ποιες κοόρτες τρέχουν;', 'get_org_cohorts'],
    ['Ποιοι κύκλοι τρέχουν;', 'get_org_cohorts'],
    ['Who are the newest organisation members?', 'get_org_members'],
    ['How many users does the platform have?', 'get_platform_stats'],
    ['What is in the moderation queue?', 'get_moderation_queue'],
    ['Τι υπάρχει στην ουρά ελέγχου;', 'get_moderation_queue'],
  ];
  it.each(cases)('%s → %s', (message, tool) => {
    expect(detectAreaReads(message)).toContain(tool);
  });

  it('reads the reader’s own programmes, not the open list, when asked about theirs', () => {
    const reads = detectAreaReads('How are my programme applications going?');
    expect(reads).toContain('get_my_programs');
    expect(reads).not.toContain('get_programs');
  });

  it('leaves a named analytics window to analytics_set_period', () => {
    expect(detectAreaReads('Show my analytics for the last 30 days')).not.toContain('get_analytics');
    expect(detectAreaReads('Show my analytics')).toContain('get_analytics');
  });

  it('does not read programmes for a programming job', () => {
    expect(detectAreaReads('Any programming jobs?')).not.toContain('get_programs');
  });
});
