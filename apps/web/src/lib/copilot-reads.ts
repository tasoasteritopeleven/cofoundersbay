import type { ReadActionId } from '@cofounderbay/shared';
import {
  acceptsApplications,
  discoverMentors,
  getAdminStats,
  getAnalyticsOverview,
  getInviteStats,
  getMyBadges,
  getMyPrograms,
  getMyReceivedMentorRequests,
  getMySentMentorRequests,
  getMyXP,
  getOrgCohorts,
  getOrgMembers,
  getUserOrganizations,
  getVentureReadiness,
  listAdminReports,
  listExpertReviews,
  listInvites,
  listLearningResources,
  listMentorAvailability,
  listMentorBookings,
  listMyMarketplaceServices,
  listPrograms,
  listServiceInquiries,
  type AdminReportItem,
  type CohortItem,
  type ExpertReviewItem,
  type GamificationBadge,
  type InviteItem,
  type LearningResourceItem,
  type MentorAvailabilitySlot,
  type MentorBookingItem,
  type MentorProfileItem,
  type MentorRequestItem,
  type OrgMember,
  type OrgMembershipItem,
  type ProgramItem,
  type ServiceInquiryItem,
  type MarketplaceServiceItem,
  type VRSDimension,
  getEndorsementStats,
  getInvestorSummary,
  getMeProfile,
  getMilestoneSummary,
  getMyGroups,
  getPendingEndorsements,
  getUpcomingMentorshipSessions,
  listConnectionRequests,
  listEvents,
  listInvestorDeals,
  listJobs,
  listMessageConversations,
  listMilestones,
  listOpportunities,
  listResearchBoards,
  listShortlist,
  type ConnectionRequestItem,
  type ConversationSummary,
  type EndorsementItem,
  type EventItem,
  type GroupView,
  type InvestorDeal,
  type JobPostingView,
  type MentorshipSessionItem,
  type Milestone,
  type OpportunityItem,
  type ResearchBoard,
  type ShortlistItem,
  searchProfiles,
} from '@/lib/api';
import { getWorkspaces, type BuilderWorkspace } from '@/lib/builder-api';
import { listCommitmentCards, listCommitmentThreads, type CommitmentCard, type CommitmentThreadSummary } from '@/lib/commitments-api';
import { waitsOnMe } from '@/lib/commitments-next';
import { getMyUpdates, getUpdatesFeed, type FounderUpdate } from '@/lib/updates-api';
import { getIntroPaths, listIntros, type Intro } from '@/lib/intros-api';
import { INTRO_RELATION_COPY, INTRO_STATUS_COPY, SKILL_EVIDENCE_COPY } from '@cofounderbay/shared';
import { getEvidenceCandidates, getSkillEvidence } from '@/lib/skill-evidence-api';
import { getScout } from '@/lib/scout-api';
import type { CopilotAction, CopilotCitation } from '@/lib/copilot-types';
import type { TranslateVars } from '@/lib/i18n/translate';
import { ventureDimensionEl } from '@/lib/i18n/venture-dimensions';

/**
 * What the assistant can read about the product areas it used to be blind to.
 *
 * Before this module it could read four things — the graph summary, people,
 * matches and notifications. Asked "what events are coming up" or "which of my
 * milestones are overdue", the best it could do was offer to open the page.
 * Each reader here calls the same client function the area’s own screen calls,
 * so what the assistant says and what the page shows cannot disagree.
 *
 * The four older reads stay in `copilot-engine.ts`. Their results feed the
 * writes planned beside them in the same turn — a person found by
 * `search_people` is who `send_connection` connects to — and moving them would
 * mean threading that state through a boundary for no gain.
 *
 * Every sentence goes through `t`, and `copilotStrings.test.ts` scans this file
 * as well as the engine, so a reply cannot slide back into English-only.
 */

export type Translator = (source: string, vars?: TranslateVars) => string;

export type ReadContext = {
  t: Translator;
  /** The reader’s locale, for dates. Copy is already bound into `t`. */
  locale?: string;
};

export type ReadResult = {
  /** One block of prose, already in the reader’s language. */
  section: string;
  citations: CopilotCitation[];
  actions: CopilotAction[];
};

type Reader = (args: Record<string, string>, ctx: ReadContext) => Promise<ReadResult>;

/** The reads the engine has always owned; everything else is keyed here. */
type EngineReadId = 'get_graph' | 'search_people' | 'get_recommendations' | 'get_notifications';

export type AreaReadId = Exclude<ReadActionId, EngineReadId>;

/** How many items a reply lists. Past this a bullet list stops being an answer. */
const LIMIT = 5;

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Every list read guards with `Array.isArray`, not `?? []`.
 *
 * `?? []` guards nullishness and nothing else. The preview shim answers an
 * endpoint it does not model with a truthy grab-bag object, and a paginated
 * envelope is an object too — both pass `??` and throw on the first `.map`.
 * That exact failure crashed three admin pages before the guard was changed
 * there; the assistant should not rediscover it one read at a time.
 */
function asList<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

const LOCALE_TAG: Record<string, string> = { en: 'en-GB', el: 'el-GR' };

/**
 * A date and, where it matters, a time — in the reader’s own time zone.
 *
 * Elsewhere dates are pinned to UTC so a server render and a hydrating client
 * agree. That concern does not reach here: the engine runs in the browser in
 * response to a message, never during a render, and an event at 18:00 Athens
 * time shown as 15:00 would be a wrong answer rather than a consistent one.
 */
function formatWhen(iso: string | null | undefined, locale: string | undefined, withTime: boolean): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const tag = (locale && LOCALE_TAG[locale]) || locale || 'en-GB';
  try {
    return date.toLocaleString(tag, {
      day: 'numeric',
      month: 'short',
      ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    });
  } catch {
    return date.toISOString().slice(0, withTime ? 16 : 10).replace('T', ' ');
  }
}

/** A card that takes the reader to the area, so an answer always has a next step. */
function openArea(t: Translator, href: string, title: string, description: string): CopilotAction {
  return {
    id: newId('nav'),
    tool: 'navigate',
    title,
    description,
    confirmLabel: t('Open'),
    payload: { href },
    status: 'pending',
    href,
  };
}

const EVENT_MODE: Record<string, string> = {
  online: 'online',
  'in-person': 'in person',
  hybrid: 'hybrid',
};

const SESSION_MODE: Record<string, string> = {
  video: 'video call',
  in_person: 'in person',
  chat: 'chat',
};

/** Board stages in words, so a reply says "in due diligence", not "due_diligence". */
const PIPELINE_STAGE_LABEL: Record<string, string> = {
  discovered: 'watching',
  reviewing: 'under review',
  meeting: 'meeting booked',
  due_diligence: 'in due diligence',
  negotiating: 'negotiating',
  invested: 'invested',
  passed: 'passed',
};

const OPPORTUNITY_TYPE: Record<string, string> = {
  job: 'Job',
  cofounder: 'Co-founder',
  investment: 'Investment',
  partnership: 'Partnership',
  mentorship: 'Mentorship',
  other: 'Other',
};

/** Programme kinds and application states in words the reply can translate. */
const PROGRAM_TYPE: Record<string, string> = {
  accelerator: 'accelerator',
  incubator: 'incubator',
  bootcamp: 'bootcamp',
};

const APPLICATION_STATE: Record<string, string> = {
  applied: 'application sent',
  pending: 'application sent',
  accepted: 'accepted',
  active: 'taking part',
  completed: 'completed',
  rejected: 'not accepted',
  dropped: 'left the programme',
  withdrawn: 'withdrawn',
};

const INVITE_STATE: Record<string, string> = {
  pending: 'not joined yet',
  accepted: 'joined',
  expired: 'expired',
  cancelled: 'cancelled',
};

const REQUEST_STATE: Record<string, string> = {
  pending: 'waiting for an answer',
  accepted: 'accepted',
  declined: 'declined',
  cancelled: 'cancelled',
};

const BOOKING_STATE: Record<string, string> = {
  requested: 'requested',
  confirmed: 'confirmed',
  completed: 'completed',
  cancelled: 'cancelled',
};

const INQUIRY_STATE: Record<string, string> = {
  open: 'waiting for a reply',
  in_discussion: 'in discussion',
  accepted: 'accepted',
  declined: 'declined',
  completed: 'completed',
  cancelled: 'cancelled',
};

const RESOURCE_TYPE: Record<string, string> = {
  article: 'article',
  video: 'video',
  course: 'course',
  template: 'template',
  tool: 'tool',
  book: 'book',
  podcast: 'podcast',
};

const DIFFICULTY: Record<string, string> = {
  beginner: 'beginner',
  intermediate: 'intermediate',
  advanced: 'advanced',
};

const REVIEW_STATE: Record<string, string> = {
  requested: 'requested',
  accepted: 'accepted',
  in_progress: 'in progress',
  submitted: 'submitted',
  declined: 'declined',
  expired: 'expired',
};

const REVIEW_TYPE: Record<string, string> = {
  pitch_deck: 'Pitch deck review',
  business_model: 'Business model review',
  financial_model: 'Financial model review',
  legal_structure: 'Legal structure review',
  market_analysis: 'Market analysis review',
  go_to_market: 'Go-to-market review',
  technical_architecture: 'Technical architecture review',
  product_strategy: 'Product strategy review',
  general: 'General review',
};

const REPORT_TYPE: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Harassment',
  fake: 'Fake account',
  inappropriate: 'Inappropriate content',
  other: 'Other',
};

/** A weekday (0 = Sunday) in the reader’s language, from the platform’s own calendar. */
function weekdayName(weekday: number, locale: string | undefined): string {
  const tag = (locale && LOCALE_TAG[locale]) || locale || 'en-GB';
  // 7 January 2024 was a Sunday.
  const date = new Date(Date.UTC(2024, 0, 7 + weekday, 12));
  try {
    return date.toLocaleDateString(tag, { weekday: 'long', timeZone: 'UTC' });
  } catch {
    return date.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
  }
}

/** The organisation the reader belongs to - the first membership, as /org/* screens use. */
async function myOrganisationSlug(): Promise<string | null> {
  const result = await getUserOrganizations().catch(() => null);
  const memberships = asList<OrgMembershipItem>(result?.memberships);
  return memberships[0]?.organization?.slug ?? null;
}

export const AREA_READERS: Record<AreaReadId, Reader> = {
  async get_investor_board(_args, { t, locale }) {
    // Both together: the summary says how the board is shaped, the list says
    // which companies it is shaped around, and neither answers alone.
    const [summary, page] = await Promise.all([
      getInvestorSummary(),
      listInvestorDeals({ limit: LIMIT }),
    ]);
    const deals = asList<InvestorDeal>(page?.deals).slice(0, LIMIT);
    const actions = [openArea(t, '/investor/pipeline', t('Open the deal board'), t('Every startup you track, at every stage.'))];

    const total = typeof summary?.totalDeals === 'number' ? summary.totalDeals : deals.length;
    if (total === 0) {
      return {
        section: t('Your board is empty. Add a startup from Scouting and it appears on the board, the watchlist and, once you invest, the portfolio.'),
        citations: [],
        actions,
      };
    }

    const headline = [
      t('{count} on your board', { count: total }),
      summary?.investments ? t('{count} invested', { count: summary.investments }) : '',
      summary?.returnPct != null ? t('{pct}% return so far', { pct: summary.returnPct }) : '',
    ].filter(Boolean).join(' · ');

    const citations: CopilotCitation[] = [];
    const lines = deals.map((deal) => {
      citations.push({ type: 'route', id: deal.id, label: deal.name, href: '/investor/pipeline' });
      const details = [
        t(PIPELINE_STAGE_LABEL[deal.pipelineStage] ?? 'tracking'),
        deal.industry ?? '',
        t('last moved {when}', { when: formatWhen(deal.lastActivityAt, locale, false) }),
      ].filter(Boolean);
      return `• **${deal.name}** — ${details.join(' · ')}`;
    });

    return { section: `${headline}\n${lines.join('\n')}`, citations, actions };
  },

  async get_events(args, { t, locale }) {
    const result = await listEvents({ scope: 'upcoming', limit: LIMIT, ...(args.q ? { q: args.q } : {}) });
    const events = asList<EventItem>(result?.events).slice(0, LIMIT);
    const actions = [openArea(t, '/events', t('Open events'), t('See every event and RSVP.'))];

    if (events.length === 0) {
      return { section: t('No upcoming events right now.'), citations: [], actions };
    }

    const citations: CopilotCitation[] = [];
    const lines = events.map((event) => {
      citations.push({ type: 'event', id: event.id, label: event.title, href: `/events/${event.id}` });
      const details = [
        formatWhen(event.startAt, locale, true),
        EVENT_MODE[event.mode] ? t(EVENT_MODE[event.mode]) : '',
        typeof event.attendeesCount === 'number' ? t('{count} attending', { count: event.attendeesCount }) : '',
        event.viewerRsvp === 'going'
          ? t('you are going')
          : event.viewerRsvp === 'interested'
            ? t('you are interested')
            : '',
      ].filter(Boolean);
      return `• **${event.title}** — ${details.join(' · ')}`;
    });

    return { section: `${t('Upcoming events:')}\n${lines.join('\n')}`, citations, actions };
  },

  async get_milestones(_args, { t, locale }) {
    // Both requests run together; the summary alone cannot say *which*
    // milestone is next, and the list alone cannot say how many are overdue.
    const [summary, list] = await Promise.all([
      getMilestoneSummary(),
      listMilestones({ limit: 50 }),
    ]);
    const actions = [openArea(t, '/milestones', t('Open milestones'), t('Track, reorder and complete them.'))];

    const total = typeof summary?.total === 'number' ? summary.total : 0;
    if (total === 0) {
      return {
        section: t(
          'No milestones yet. Two or three for the next month give the rest of the platform something to plan around.',
        ),
        citations: [],
        actions,
      };
    }

    const done = summary?.counts?.completed ?? 0;
    const rate = Math.round(typeof summary?.completionRate === 'number' ? summary.completionRate : (done / total) * 100);
    const parts = [
      t('{done} of {total} milestones complete ({rate}%).', { done, total, rate }),
      t('{overdue} overdue, {soon} due soon.', { overdue: summary?.overdue ?? 0, soon: summary?.dueSoon ?? 0 }),
    ];

    // Open ones only, soonest first; an undated milestone sorts last rather
    // than first, because "no deadline" is not "most urgent".
    const open = asList<Milestone>(list?.milestones)
      .filter((m) => m.status !== 'completed' && m.status !== 'cancelled')
      .sort((a, b) => (a.dueDate ? Date.parse(a.dueDate) : Infinity) - (b.dueDate ? Date.parse(b.dueDate) : Infinity))
      .slice(0, LIMIT);

    const citations: CopilotCitation[] = [];
    if (open.length) {
      const lines = open.map((m) => {
        citations.push({ type: 'milestone', id: m.id, label: m.title, href: '/milestones' });
        const details = [
          typeof m.progress === 'number' ? `${m.progress}%` : '',
          m.dueDate ? t('due {date}', { date: formatWhen(m.dueDate, locale, false) }) : '',
        ].filter(Boolean);
        return `• **${m.title}**${details.length ? ` — ${details.join(' · ')}` : ''}`;
      });
      parts.push(`${t('Next up:')}\n${lines.join('\n')}`);
    }

    return { section: parts.join(' '), citations, actions };
  },

  async get_jobs(_args, { t }) {
    const result = await listJobs({ limit: LIMIT });
    const jobs = asList<JobPostingView>(result?.jobs).slice(0, LIMIT);
    const actions = [openArea(t, '/jobs', t('Open jobs'), t('Browse and apply.'))];

    if (jobs.length === 0) {
      return { section: t('No open roles right now.'), citations: [], actions };
    }

    const citations: CopilotCitation[] = [];
    const lines = jobs.map((job) => {
      citations.push({ type: 'job', id: job.id, label: job.title, href: job.href ?? `/jobs/${job.id}` });
      const details = [
        job.creator?.displayName ? t('posted by {name}', { name: job.creator.displayName }) : '',
        job.location ?? '',
        job.isRemote ? t('remote') : '',
      ].filter(Boolean);
      return `• **${job.title}**${details.length ? ` — ${details.join(' · ')}` : ''}`;
    });

    return { section: `${t('Open roles:')}\n${lines.join('\n')}`, citations, actions };
  },

  async get_groups(_args, { t }) {
    const result = await getMyGroups();
    const groups = asList<GroupView>(result?.groups).slice(0, LIMIT);
    const actions = [openArea(t, '/groups', t('Open communities'), t('Join one or start your own.'))];

    if (groups.length === 0) {
      return { section: t('You are not in a community yet.'), citations: [], actions };
    }

    const citations: CopilotCitation[] = [];
    const lines = groups.map((group) => {
      citations.push({ type: 'group', id: group.id, label: group.name, href: `/groups/${group.id}` });
      return `• **${group.name}** — ${t('{members} members · {posts} posts', {
        members: group.memberCount ?? 0,
        posts: group.postCount ?? 0,
      })}`;
    });

    return { section: `${t('Your communities:')}\n${lines.join('\n')}`, citations, actions };
  },

  async get_endorsements(_args, { t }) {
    const [statsResult, pendingResult] = await Promise.all([getEndorsementStats(), getPendingEndorsements()]);
    const stats = statsResult?.stats;
    const pending = asList<EndorsementItem>(pendingResult?.endorsements);
    const actions = [openArea(t, '/endorsements', t('Open endorsements'), t('Approve, request or write one.'))];

    const parts = [
      t('Endorsements: {received} received, {given} given.', {
        received: stats?.total ?? 0,
        given: stats?.given ?? 0,
      }),
    ];

    const citations: CopilotCitation[] = [];
    if (pending.length === 0) {
      parts.push(t('Nothing is waiting for your approval.'));
    } else {
      const lines = pending.slice(0, LIMIT).map((item) => {
        citations.push({
          type: 'endorsement',
          id: item.id,
          label: item.fromUser?.displayName ?? item.id,
          href: '/endorsements',
        });
        const from = item.fromUser?.displayName ? t('from {name}', { name: item.fromUser.displayName }) : '';
        return `• ${[item.skill ? `**${item.skill}**` : '', from].filter(Boolean).join(' — ')}`;
      });
      parts.push(
        `${t('{count} waiting for your approval before they appear on your profile:', { count: pending.length })}\n${lines.join('\n')}`,
      );
    }

    return { section: parts.join(' '), citations, actions };
  },

  async get_opportunities(args, { t, locale }) {
    const result = await listOpportunities({ limit: LIMIT, ...(args.q ? { search: args.q } : {}) });
    const items = asList<OpportunityItem>(result?.opportunities)
      .filter((item) => item.isActive !== false)
      .slice(0, LIMIT);
    const actions = [openArea(t, '/opportunities', t('See all opportunities'), t('Filter by type and apply.'))];

    if (items.length === 0) {
      return { section: t('No open opportunities right now.'), citations: [], actions };
    }

    const citations: CopilotCitation[] = [];
    const lines = items.map((item) => {
      // There is no /opportunities/:id page; the list scrolls to the card.
      citations.push({ type: 'opportunity', id: item.id, label: item.title, href: `/opportunities#opportunity-${encodeURIComponent(item.id)}` });
      const details = [
        OPPORTUNITY_TYPE[item.type] ? t(OPPORTUNITY_TYPE[item.type]) : '',
        item.company ?? '',
        item.isRemote ? t('remote') : item.location ?? '',
        item.deadline ? t('due {date}', { date: formatWhen(item.deadline, locale, false) }) : '',
      ].filter(Boolean);
      return `• **${item.title}**${details.length ? ` — ${details.join(' · ')}` : ''}`;
    });

    return { section: `${t('Open opportunities:')}\n${lines.join('\n')}`, citations, actions };
  },

  async get_commitments(_args, { t }) {
    const [cards, threads] = await Promise.all([listCommitmentCards({ mine: true }), listCommitmentThreads('all')]);
    const mine = asList<CommitmentCard>(cards).filter((card) => card.isMine && card.outcome !== 'closed').slice(0, LIMIT);
    const actions = [openArea(t, '/commitments', t('Open commitments'), t('Need cards, responses and what waits on you.'))];
    const OUTCOME: Record<string, string> = { open: 'open', in_discussion: 'in discussion', agreed: 'agreed', closed: 'closed' };
    const STEP: Record<string, string> = { interest: 'interest', conversation: 'conversation', terms: 'terms', agreed: 'agreed', closed: 'closed' };
    const waiting = asList<CommitmentThreadSummary>(threads).filter(waitsOnMe);
    const responses = asList<CommitmentThreadSummary>(threads).filter((th) => th.role === 'candidate' && th.step !== 'closed').slice(0, LIMIT);

    if (mine.length === 0 && responses.length === 0) {
      return {
        section: t('You have no need cards or open responses yet. A need card is three sentences and an offer.'),
        citations: [],
        actions: [openArea(t, '/commitments/new', t('Write a need card'), t('About two minutes.')), ...actions],
      };
    }

    const citations: CopilotCitation[] = [];
    const parts: string[] = [];
    if (mine.length) {
      const lines = mine.map((card) => {
        citations.push({ type: 'opportunity', id: card.id, label: card.title, href: `/commitments/${card.id}` });
        const count = asList<CommitmentThreadSummary>(threads).filter((th) => th.cardId === card.id && th.role === 'owner' && th.step !== 'closed').length;
        return `• **${card.title}** — ${t(OUTCOME[card.outcome] ?? card.outcome)} · ${t('{count} responses', { count })}`;
      });
      parts.push(`${t('Your need cards:')}\n${lines.join('\n')}`);
    }
    if (responses.length) {
      const lines = responses.map((th) => {
        citations.push({ type: 'opportunity', id: th.cardId, label: th.cardTitle, href: `/commitments/${th.cardId}?thread=${th.id}` });
        return `• **${th.cardTitle}** — ${th.counterpart.displayName} · ${t(STEP[th.step] ?? th.step)}`;
      });
      parts.push(`${t('Your responses:')}\n${lines.join('\n')}`);
    }
    parts.push(waiting.length ? t('{count} steps wait on you.', { count: waiting.length }) : t('Nothing waits on you right now.'));
    return { section: parts.join('\n\n'), citations, actions };
  },

  async get_founder_updates(_args, { t }) {
    const [feed, mine] = await Promise.all([getUpdatesFeed(), getMyUpdates()]);
    const theirs = asList<FounderUpdate>(feed).slice(0, LIMIT);
    const own = asList<FounderUpdate>(mine).slice(0, 3);
    const actions = [openArea(t, '/updates', t('Open updates'), t('Updates from people you follow, and your own.'))];
    if (theirs.length === 0 && own.length === 0) {
      return {
        section: t('Nobody you follow has written an update yet, and you have not sent one. Follow founders from their profiles.'),
        citations: [],
        actions,
      };
    }
    const citations: CopilotCitation[] = [];
    const parts: string[] = [];
    if (theirs.length) {
      const lines = theirs.map((u) => {
        citations.push({ type: 'update', id: u.id, label: u.title, href: `/updates?update=${encodeURIComponent(u.id)}` });
        const figures = u.metrics.slice(0, 2).map((m) => `${m.label} ${m.value}`).join(' · ');
        return `• **${u.title}** — ${u.author.displayName}${figures ? ` · ${figures}` : ''}`;
      });
      parts.push(`${t('From people you follow:')}\n${lines.join('\n')}`);
    }
    if (own.length) {
      const lines = own.map((u) => `• **${u.title}** — ${t(u.visibility === 'public' ? 'public' : 'followers only')}`);
      parts.push(`${t('Your updates:')}\n${lines.join('\n')}`);
    }
    return { section: parts.join('\n\n'), citations, actions };
  },

  async get_intros(args, { t, locale }) {
    // Greek is in the shared copy; other locales read the English through the catalogue.
    const say = (c: { en: string; el: string }) => (locale === 'el' ? c.el : t(c.en));
    const lists = await listIntros();
    const actions = [openArea(t, '/intros', t('Open introductions'), t('Requests to forward, introductions for you, and the ones you asked for.'))];
    const citations: CopilotCitation[] = [];
    const parts: string[] = [];
    const cite = (i: Intro) => citations.push({ type: 'route', id: i.id, label: i.card?.title || i.target?.displayName || '', href: `/intros?intro=${encodeURIComponent(i.id)}` });

    const waiting = asList<Intro>(lists?.toForward).filter((i) => i.status === 'pending').slice(0, LIMIT);
    if (waiting.length) {
      waiting.forEach(cite);
      parts.push(`${t('Waiting for you to forward:')}\n${waiting.map((i) => `• **${i.requester.displayName}** → ${i.target.displayName} — ${i.card.title}`).join('\n')}`);
    }
    const forMe = asList<Intro>(lists?.received).filter((i) => i.status === 'forwarded').slice(0, LIMIT);
    if (forMe.length) {
      forMe.forEach(cite);
      parts.push(`${t('Introductions for you:')}\n${forMe.map((i) => `• **${i.requester.displayName}** (${t('via')} ${i.intermediary.displayName}) — ${i.card.title}`).join('\n')}`);
    }
    const mine = asList<Intro>(lists?.sent).slice(0, LIMIT);
    if (mine.length) {
      parts.push(`${t('You asked for:')}\n${mine.map((i) => `• **${i.target.displayName}** (${t('via')} ${i.intermediary.displayName}) — ${say(INTRO_STATUS_COPY[i.status])}`).join('\n')}`);
    }

    // "Who could introduce me to …": by id from a model, or by name from the rule planner.
    let targetId = typeof args?.targetId === 'string' ? args.targetId : '';
    if (!targetId && typeof args?.name === 'string' && args.name) {
      const found = await searchProfiles({ q: args.name, limit: 1 }).catch(() => null);
      targetId = found?.hits?.[0]?.userId ?? '';
    }
    if (targetId) {
      const route = await getIntroPaths(targetId);
      if (route.direct) parts.push(t('You already know them directly; no introduction is needed.'));
      else if (!route.paths.length) parts.push(t('Nobody you know on CoFounderBay knows them yet.'));
      else {
        const rel = (list: readonly (keyof typeof INTRO_RELATION_COPY)[]) => list.map((r) => say(INTRO_RELATION_COPY[r])).join(', ');
        parts.push(`${t('Who could introduce you:')}\n${route.paths.slice(0, LIMIT).map((p) => `• **${p.intermediary.displayName}** (id ${p.intermediary.id}) — ${rel(p.toRequester)} / ${rel(p.toTarget)}`).join('\n')}`);
        if (route.cards.length) parts.push(`${t('Your open need cards:')}\n${route.cards.slice(0, LIMIT).map((c) => `• ${c.title} (id ${c.id})`).join('\n')}`);
      }
    }

    if (!parts.length) {
      return { section: t('No introductions yet. Ask for one from the profile of someone you want to meet.'), citations: [], actions };
    }
    return { section: parts.join('\n\n'), citations, actions };
  },

  async get_skill_evidence(_args, { t, locale }) {
    const say = (c: { en: string; el: string }) => (locale === 'el' ? c.el : t(c.en));
    const me = await getMeProfile().catch(() => null);
    const userId = me?.profile?.userId ?? '';
    const [skills, candidates] = await Promise.all([userId ? getSkillEvidence(userId) : Promise.resolve([]), getEvidenceCandidates().catch(() => [])]);
    const actions = [openArea(t, '/profile', t('Open profile skills'), t('Skills with the work that shows them.'))];
    if (!skills.length) return { section: t('Add skills to your profile first; then link completed work to them.'), citations: [], actions };
    const lines = skills.slice(0, LIMIT * 2).map((s) => {
      const ev = s.evidence.length ? s.evidence.map((e) => `${say(SKILL_EVIDENCE_COPY[e.kind])}: ${e.label}`).join('; ') : t('no evidence linked yet');
      const ends = s.endorsements ? ` · ${t('{count} endorsements, {verified} from work done together', { count: s.endorsements, verified: s.verifiedEndorsements })}` : '';
      return `• **${s.name}** — ${ev}${ends}`;
    });
    const parts = [`${t('Your skills and their evidence:')}\n${lines.join('\n')}`];
    if (candidates.length) {
      parts.push(`${t('Completed work you can link:')}\n${candidates.slice(0, LIMIT * 2).map((c) => `• ${say(SKILL_EVIDENCE_COPY[c.kind])}: ${c.label} (${c.kind}, id ${c.refId})`).join('\n')}`);
    }
    return { section: parts.join('\n\n'), citations: [], actions };
  },

  async get_scout(_args, { t, locale }) {
    const say = (c: { en: string; el: string }) => (locale === 'el' ? c.el : t(c.en));
    const state = await getScout();
    const actions = [openArea(t, '/scout', t('Open the scout'), t('Your brief and the people it proposes. It never sends anything.'))];
    if (!state?.brief) return { section: t('No brief yet. Tell me who you are looking for and I will draft one.'), citations: [], actions };
    const brief = state.brief;
    const head = `${t('Brief:')} **${brief.role}**${brief.skills?.length ? ` — ${brief.skills.join(', ')}` : ''}${brief.place ? ` · ${brief.place}` : ''}`;
    const proposed = asList<{ id: string; status: string; score: number; reasons: Array<{ en: string; el: string }>; person: { id: string; displayName: string } }>(state.proposals)
      .filter((p) => p.status === 'proposed')
      .slice(0, LIMIT);
    if (!proposed.length) return { section: `${head}\n\n${t('Nobody proposed right now. The scout looks again tomorrow.')}`, citations: [], actions };
    const citations: CopilotCitation[] = proposed.map((p) => ({ type: 'person', id: p.person?.id ?? '', label: p.person?.displayName ?? '', href: `/profiles/${encodeURIComponent(p.person?.id ?? '')}` }));
    const lines = proposed.map((p) => `• **${p.person?.displayName ?? ''}** (${p.score}, id ${p.id}) — ${(p.reasons ?? []).map(say).join('; ')}`);
    return { section: `${head}\n\n${t('The scout proposes:')}\n${lines.join('\n')}`, citations, actions };
  },

  async get_mentorship_sessions(_args, { t, locale }) {
    const result = await getUpcomingMentorshipSessions();
    const sessions = asList<MentorshipSessionItem>(result?.sessions)
      .filter((s) => s.status === 'scheduled')
      .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt))
      .slice(0, LIMIT);
    const actions = [openArea(t, '/mentoring', t('Open mentoring'), t('Book a session or message a mentor.'))];

    if (sessions.length === 0) {
      return { section: t('No mentoring sessions scheduled.'), citations: [], actions };
    }

    const citations: CopilotCitation[] = [];
    const lines = sessions.map((session) => {
      const title = session.title?.trim() || t('Mentoring session');
      citations.push({ type: 'session', id: session.id, label: title, href: '/mentoring' });
      const details = [
        formatWhen(session.scheduledAt, locale, true),
        typeof session.duration === 'number' ? t('{minutes} min', { minutes: session.duration }) : '',
        session.meetingType && SESSION_MODE[session.meetingType] ? t(SESSION_MODE[session.meetingType]) : '',
      ].filter(Boolean);
      return `• **${title}** — ${details.join(' · ')}`;
    });

    return { section: `${t('Upcoming mentoring sessions:')}\n${lines.join('\n')}`, citations, actions };
  },

  async get_shortlist(_args, { t }) {
    const result = await listShortlist({ limit: 6 });
    const items = asList<ShortlistItem>(result?.items).slice(0, 6);
    const actions = [openArea(t, '/shortlist', t('Open saved profiles'), t('Compare and reach out.'))];

    if (items.length === 0) {
      return {
        section: t('Your shortlist is empty — ask me to save anyone I find for you.'),
        citations: [],
        actions,
      };
    }

    const citations: CopilotCitation[] = [];
    const lines = items.map((item) => {
      const name = item.profile?.displayName ?? item.userId;
      citations.push({ type: 'person', id: item.userId, label: name, href: `/profiles/${item.userId}` });
      const details = [item.profile?.headline ?? item.profile?.role ?? '', item.note ? t('note: {note}', { note: item.note }) : '']
        .filter(Boolean);
      return `• **${name}**${details.length ? ` — ${details.join(' · ')}` : ''}`;
    });

    return { section: `${t('Saved profiles:')}\n${lines.join('\n')}`, citations, actions };
  },

  async get_research_boards(_args, { t }) {
    const result = await listResearchBoards();
    const boards = asList<ResearchBoard>(result?.boards)
      .filter((board) => !board.isArchived)
      .slice(0, LIMIT);
    const actions = [openArea(t, '/research', t('Open research boards'), t('Open a board or start a new one.'))];

    if (boards.length === 0) {
      return { section: t('No research boards yet.'), citations: [], actions };
    }

    const citations: CopilotCitation[] = [];
    const lines = boards.map((board) => {
      citations.push({ type: 'research', id: board.id, label: board.title, href: `/research/${board.id}` });
      const details = [
        t('{count} nodes', { count: board.nodeCount ?? 0 }),
        board.isPinned ? t('pinned') : '',
      ].filter(Boolean);
      return `• **${board.title}** — ${details.join(' · ')}`;
    });

    return { section: `${t('Your research boards:')}\n${lines.join('\n')}`, citations, actions };
  },

  async get_builder_state(_args, { t }) {
    const result = await getWorkspaces({ limit: LIMIT, status: 'active' });
    const workspaces = asList<BuilderWorkspace>(result?.data).slice(0, LIMIT);
    const actions = [openArea(t, '/builder', t('Open Startup Builder'), t('Create or open a workspace.'))];

    if (workspaces.length === 0) {
      return {
        section: t('No Startup Builder workspace yet. Ask me to create one.'),
        citations: [],
        actions,
      };
    }

    const citations: CopilotCitation[] = [];
    const lines = workspaces.map((workspace) => {
      citations.push({ type: 'workspace', id: workspace.id, label: workspace.name, href: '/builder' });
      const details = [
        workspace.status ?? '',
        typeof workspace.documentCount === 'number' ? t('{count} documents', { count: workspace.documentCount }) : '',
        typeof workspace.overallReadiness === 'number' ? t('readiness {score}%', { score: workspace.overallReadiness }) : '',
      ].filter(Boolean);
      return `• **${workspace.name}**${details.length ? ` — ${details.join(' · ')}` : ''}`;
    });

    return { section: `${t('Your workspaces:')}\n${lines.join('\n')}`, citations, actions };
  },

  async get_profile(_args, { t }) {
    const result = await getMeProfile();
    const profile = result?.profile;
    if (!profile) {
      return {
        section: t('Your profile is not set up yet — finish onboarding and it becomes the page the network sees.'),
        citations: [],
        actions: [openArea(t, '/profile/edit', t('Set up your profile'), t('Name, headline and what you are looking for.'))],
      };
    }

    const actions = [
      openArea(t, '/profile', t('Open your profile'), t('See it the way the network does.')),
      openArea(t, '/profile/edit', t('Edit your profile'), t('Change your headline, bio or location.')),
    ];
    const citations: CopilotCitation[] = [
      { type: 'person', id: profile.userId ?? profile.id, label: profile.displayName, href: '/profile' },
    ];

    const lines = [`**${profile.displayName}**${profile.headline ? ` — ${profile.headline}` : ''}`];
    const bio = profile.bio?.trim();
    if (bio) lines.push(bio.length > 220 ? `${bio.slice(0, 220)}…` : bio);
    const details = [
      profile.location ?? '',
      asList<string>(profile.languages).join(', '),
      profile.role ? t('role: {role}', { role: profile.role }) : '',
    ].filter(Boolean);
    if (details.length) lines.push(details.join(' · '));
    const skills = asList<{ skillName?: string | null }>(profile.skills)
      .map((skill) => skill?.skillName)
      .filter((name): name is string => Boolean(name));
    if (skills.length) {
      lines.push(t('Skills: {list}.', { list: skills.slice(0, 6).join(', ') }));
    }

    return { section: lines.join('\n'), citations, actions };
  },

  async get_messages(_args, { t, locale }) {
    const result = await listMessageConversations();
    const conversations = asList<ConversationSummary>(result?.conversations)
      .slice()
      .sort((a, b) => Date.parse(b.updatedAt ?? '') - Date.parse(a.updatedAt ?? ''));
    const actions = [openArea(t, '/messages', t('Open messages'), t('Read and answer your threads.'))];

    if (conversations.length === 0) {
      return { section: t('No conversations yet.'), citations: [], actions };
    }

    const unread = conversations.reduce((sum, c) => sum + (c?.unreadCount ?? 0), 0);
    const parts = [
      t('{count} conversations', { count: conversations.length }),
      unread > 0 ? t('{count} unread', { count: unread }) : t('all read'),
    ];

    const citations: CopilotCitation[] = [];
    const lines = conversations.slice(0, LIMIT).map((convo) => {
      const name = convo?.recipient?.displayName ?? t('Conversation');
      citations.push({ type: 'conversation', id: convo.id, label: name, href: `/messages?c=${convo.id}` });
      const details = [
        convo?.lastMessage?.body
          ? `“${convo.lastMessage.body.length > 80 ? `${convo.lastMessage.body.slice(0, 80)}…` : convo.lastMessage.body}”`
          : '',
        convo?.unreadCount ? t('{count} unread', { count: convo.unreadCount }) : '',
        convo?.isPinned ? t('pinned') : '',
        formatWhen(convo?.updatedAt, locale, false),
      ].filter(Boolean);
      return `• **${name}**${details.length ? ` — ${details.join(' · ')}` : ''}`;
    });

    return { section: `${parts.join(' · ')}\n${lines.join('\n')}`, citations, actions };
  },

  async get_connections(_args, { t }) {
    // All three together: the size of the network, who is waiting on the user
    // and who the user is still waiting on. `received` is the only list the
    // user can act on, so it is also the one that produces action cards.
    const [acceptedResult, receivedResult, sentResult] = await Promise.all([
      listConnectionRequests({ type: 'accepted' }),
      listConnectionRequests({ type: 'received' }),
      listConnectionRequests({ type: 'sent' }),
    ]);
    const accepted = asList<ConnectionRequestItem>(acceptedResult?.connections);
    const received = asList<ConnectionRequestItem>(receivedResult?.connections)
      .filter((c) => c?.status === 'pending');
    const sent = asList<ConnectionRequestItem>(sentResult?.connections)
      .filter((c) => c?.status === 'pending');
    const actions = [openArea(t, '/connections', t('Open connections'), t('Answer requests and grow your network.'))];

    const parts = [
      t('{count} connections', { count: accepted.length }),
      received.length ? t('{count} requests waiting on you', { count: received.length }) : '',
      sent.length ? t('{count} sent, still pending', { count: sent.length }) : '',
    ].filter(Boolean);

    const citations: CopilotCitation[] = [];
    if (received.length === 0) {
      parts.push(t('No requests waiting for an answer.'));
    } else {
      const lines = received.slice(0, LIMIT).map((request) => {
        const person = request?.requester;
        const name = person?.displayName ?? request?.requesterId ?? t('Someone');
        citations.push({ type: 'person', id: person?.id ?? request.id, label: name, href: '/connections' });
        const details = [person?.headline ?? '', request?.message ? `“${request.message}”` : ''].filter(Boolean);
        // The request is actionable, so the answer carries the action too —
        // answering is exactly what the waiting list is for.
        actions.push({
          id: newId('conn'),
          tool: 'respond_to_connection',
          title: t('Accept {name}', { name }),
          description: person?.headline ?? t('Add them to your network.'),
          confirmLabel: t('Accept'),
          payload: { connectionId: request.id, decision: 'accepted' },
          status: 'pending',
        });
        return `• **${name}**${details.length ? ` — ${details.join(' · ')}` : ''}`;
      });
      parts.push(`${t('Waiting on you:')}\n${lines.join('\n')}`);
    }

    return { section: parts.join(' '), citations, actions };
  },

  // ── Wave B: eighteen more areas, each read through the client its page uses ──

  async get_programs(_args, { t, locale }) {
    const result = await listPrograms({ limit: 20 });
    const open = asList<ProgramItem>(result?.programs).filter((program) => acceptsApplications(program)).slice(0, LIMIT);
    const actions = [openArea(t, '/programs', t('Open programmes'), t('Browse programmes and apply.'))];
    if (open.length === 0) {
      return { section: t('No programme is taking applications right now.'), citations: [], actions };
    }
    const citations: CopilotCitation[] = [];
    const lines = open.map((program) => {
      citations.push({ type: 'route', id: program.id, label: program.title, href: `/programs/${program.id}` });
      const left = program.capacity != null ? Math.max(0, program.capacity - (program.participantCount ?? 0)) : null;
      const details = [
        program.organization?.name ?? '',
        t(PROGRAM_TYPE[program.programType] ?? 'programme'),
        program.applicationDeadline ? t('apply by {date}', { date: formatWhen(program.applicationDeadline, locale, false) }) : '',
        left != null ? t('{count} places left', { count: left }) : '',
      ].filter(Boolean);
      return `• **${program.title}** — ${details.join(' · ')}`;
    });
    return { section: `${t('Programmes taking applications:')}\n${lines.join('\n')}`, citations, actions };
  },

  async get_my_programs(_args, { t }) {
    const result = await getMyPrograms();
    const programs = asList<ProgramItem>(result?.programs).slice(0, LIMIT);
    const actions = [openArea(t, '/programs', t('Open programmes'), t('Browse programmes and apply.'))];
    if (programs.length === 0) {
      return { section: t('You have not applied to any programme yet.'), citations: [], actions };
    }
    const citations: CopilotCitation[] = [];
    const lines = programs.map((program) => {
      citations.push({ type: 'route', id: program.id, label: program.title, href: `/programs/${program.id}` });
      const details = [program.organization?.name ?? '', program.myStatus ? t(APPLICATION_STATE[program.myStatus] ?? program.myStatus) : ''].filter(Boolean);
      return `• **${program.title}**${details.length ? ` — ${details.join(' · ')}` : ''}`;
    });
    return { section: `${t('Your programmes:')}\n${lines.join('\n')}`, citations, actions };
  },

  async get_invites(_args, { t }) {
    const [page, statsResult] = await Promise.all([listInvites({ limit: LIMIT }), getInviteStats().catch(() => null)]);
    const invites = asList<InviteItem>(page?.invites).slice(0, LIMIT);
    const stats = statsResult?.stats;
    const actions = [openArea(t, '/referrals', t('Open invitations'), t('See who joined and invite more people.'))];
    if (invites.length === 0) {
      return { section: t('You have not invited anyone yet.'), citations: [], actions };
    }
    const headline = stats
      ? t('{sent} sent · {joined} joined · {left} invitations left', { sent: stats.total, joined: stats.accepted, left: stats.remaining })
      : '';
    const lines = invites.map((invite) => `• **${invite.email}** — ${t(INVITE_STATE[invite.status] ?? invite.status)}`);
    return { section: [headline, `${t('Recent invitations:')}\n${lines.join('\n')}`].filter(Boolean).join('\n'), citations: [], actions };
  },

  async get_reputation(_args, { t }) {
    const [xp, badges] = await Promise.all([getMyXP(), getMyBadges().catch(() => [])]);
    const recent = asList<GamificationBadge>(badges)
      .slice()
      .sort((a, b) => (b.awardedAt ?? '').localeCompare(a.awardedAt ?? ''))
      .slice(0, LIMIT);
    const actions = [openArea(t, '/reputation', t('Open reputation'), t('Your level, badges and XP history.'))];
    const parts = [
      t('Level {level} · {xp} XP · {next} XP to the next level', { level: xp?.level ?? 1, xp: xp?.totalXp ?? 0, next: xp?.xpToNextLevel ?? 0 }),
      xp?.streak?.currentStreak ? t('{days}-day activity streak', { days: xp.streak.currentStreak }) : '',
    ].filter(Boolean);
    const badgeBlock = recent.length
      ? `${t('Recent badges:')}\n${recent.map((badge) => `• **${badge.name}** — ${badge.description}`).join('\n')}`
      : t('No badges yet.');
    return { section: `${parts.join(' · ')}\n${badgeBlock}`, citations: [], actions };
  },

  async get_readiness(_args, { t, locale }) {
    const readiness = await getVentureReadiness();
    const dimensions = asList<VRSDimension>(readiness?.dimensions);
    const actions = [openArea(t, '/readiness', t('Open readiness'), t('See what raises each score.'))];
    if (typeof readiness?.overall !== 'number') {
      return { section: t('Your readiness score is not available yet.'), citations: [], actions };
    }
    // The endpoint labels dimensions in English; Greek comes from the map
    // every other readiness surface uses, keyed by the dimension's key.
    const label = (dimension: VRSDimension) => (locale === 'el' ? ventureDimensionEl(dimension.key, dimension.label) : dimension.label);
    const lines = dimensions.map((dimension) => `• **${label(dimension)}** — ${dimension.score}/100`);
    const weakest = readiness.lowestDimension;
    return {
      section: [
        t('Venture readiness: {score}/100', { score: Math.round(readiness.overall) }),
        lines.join('\n'),
        weakest ? t('Weakest: {label} ({score}/100). Start there.', { label: label(weakest), score: weakest.score }) : '',
      ].filter(Boolean).join('\n'),
      citations: [],
      actions,
    };
  },

  async get_analytics(_args, { t }) {
    const overview = await getAnalyticsOverview('7d', 3);
    const metrics = overview?.metrics;
    const actions = [openArea(t, '/analytics', t('Open analytics'), t('Charts over 7, 14, 30 or 90 days.'))];
    if (!metrics) {
      return { section: t('Your activity figures are not available yet.'), citations: [], actions };
    }
    const change = (value: number | null) =>
      value == null ? '' : ` (${t('{pct}% vs the week before', { pct: `${value > 0 ? '+' : ''}${Math.round(value)}` })})`;
    return {
      section: [
        t('Last 7 days:'),
        `• ${t('Profile views: {count}', { count: metrics.profileViews ?? 0 })}${change(metrics.profileViewsChange)}`,
        `• ${t('New connections: {count}', { count: metrics.newConnections ?? 0 })}${change(metrics.newConnectionsChange)}`,
        `• ${t('Messages sent: {count}', { count: metrics.messagesSent ?? 0 })}${change(metrics.messagesSentChange)}`,
      ].join('\n'),
      citations: [],
      actions,
    };
  },

  async get_mentors(_args, { t }) {
    const result = await discoverMentors({ limit: 20 });
    const mentors = asList<MentorProfileItem>(result?.mentors)
      .filter((mentor) => mentor.availabilityStatus !== 'unavailable')
      .sort((a, b) => (b.sessionCount ?? 0) - (a.sessionCount ?? 0))
      .slice(0, LIMIT);
    const actions = [openArea(t, '/coaching', t('Open the mentor directory'), t('Filter by expertise and book a session.'))];
    if (mentors.length === 0) {
      return { section: t('No mentors are taking sessions right now.'), citations: [], actions };
    }
    const citations: CopilotCitation[] = [];
    const lines = mentors.map((mentor) => {
      citations.push({ type: 'person', id: mentor.userId, label: mentor.displayName, href: `/profiles/${mentor.userId}` });
      const details = [
        mentor.headline ?? mentor.skills?.slice(0, 3).join(', ') ?? '',
        mentor.rating != null && mentor.reviewCount > 0 ? `${mentor.rating.toFixed(1)}★ (${mentor.reviewCount})` : '',
        mentor.isFree ? t('free') : mentor.hourlyRate ? t('{price} per hour', { price: `${mentor.currency ?? 'EUR'} ${mentor.hourlyRate}` }) : '',
      ].filter(Boolean);
      return `• **${mentor.displayName}** — ${details.join(' · ')}`;
    });
    return { section: `${t('Mentors taking sessions:')}\n${lines.join('\n')}`, citations, actions };
  },

  async get_mentor_requests(_args, { t, locale }) {
    const [received, sent] = await Promise.all([
      getMyReceivedMentorRequests().catch(() => null),
      getMySentMentorRequests().catch(() => null),
    ]);
    const waiting = asList<MentorRequestItem>(received?.requests).filter((request) => request.status === 'pending').slice(0, LIMIT);
    const asked = asList<MentorRequestItem>(sent?.requests).slice(0, LIMIT);
    const actions = [openArea(t, '/mentor/requests', t('Open mentoring requests'), t('Accept or decline requests.'))];
    if (waiting.length === 0 && asked.length === 0) {
      return { section: t('No mentoring requests.'), citations: [], actions };
    }
    const citations: CopilotCitation[] = [];
    const blocks: string[] = [];
    if (waiting.length) {
      blocks.push(`${t('Waiting for your answer:')}\n${waiting.map((request) => {
        const name = request.requester?.displayName ?? t('Someone');
        citations.push({ type: 'person', id: request.requester?.id ?? request.id, label: name, href: '/mentor/requests' });
        const details = [request.focusAreas?.slice(0, 3).join(', ') ?? '', t('asked {when}', { when: formatWhen(request.createdAt, locale, false) })].filter(Boolean);
        return `• **${name}** — ${details.join(' · ')}`;
      }).join('\n')}`);
    }
    if (asked.length) {
      blocks.push(`${t('Requests you sent:')}\n${asked.map((request) => {
        const name = request.mentor?.displayName ?? t('A mentor');
        return `• **${name}** — ${t(REQUEST_STATE[request.status] ?? request.status)}`;
      }).join('\n')}`);
    }
    return { section: blocks.join('\n'), citations, actions };
  },

  async get_bookings(_args, { t, locale }) {
    const result = await listMentorBookings('all');
    const now = Date.now();
    const bookings = asList<MentorBookingItem>(result?.bookings)
      .filter((booking) => booking.status !== 'cancelled' && Date.parse(booking.endAt ?? booking.startAt) >= now)
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
      .slice(0, LIMIT);
    const actions = [openArea(t, '/calendar', t('Open the calendar'), t('Every booking and event in one place.'))];
    if (bookings.length === 0) {
      return { section: t('No upcoming bookings.'), citations: [], actions };
    }
    const citations: CopilotCitation[] = [];
    const lines = bookings.map((booking) => {
      citations.push({ type: 'session', id: booking.id, label: booking.mentor?.displayName ?? booking.id, href: '/calendar' });
      const details = [
        t('{mentor} with {mentee}', { mentor: booking.mentor?.displayName ?? '—', mentee: booking.mentee?.displayName ?? '—' }),
        t(BOOKING_STATE[booking.status] ?? booking.status),
        SESSION_MODE[booking.meetingType] ? t(SESSION_MODE[booking.meetingType]) : '',
      ].filter(Boolean);
      return `• **${formatWhen(booking.startAt, locale, true)}** — ${details.join(' · ')}`;
    });
    return { section: `${t('Upcoming bookings:')}\n${lines.join('\n')}`, citations, actions };
  },

  async get_availability(_args, { t, locale }) {
    const result = await listMentorAvailability();
    const slots = asList<MentorAvailabilitySlot>(result?.slots)
      .slice()
      .sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));
    const actions = [openArea(t, '/mentor/availability', t('Open availability'), t('Set the hours mentees can book.'))];
    if (slots.length === 0) {
      return { section: t('No weekly hours are saved yet.'), citations: [], actions };
    }
    const zone = slots.find((slot) => slot.timezone)?.timezone ?? '';
    const lines = slots.map((slot) => `• **${weekdayName(slot.weekday, locale)}** ${slot.startTime}–${slot.endTime}`);
    return {
      section: `${zone ? t('Your weekly hours ({zone}):', { zone }) : t('Your weekly hours:')}\n${lines.join('\n')}`,
      citations: [],
      actions,
    };
  },

  async get_services(_args, { t }) {
    // The listings /provider/services and the provider dashboard show.
    const result = await listMyMarketplaceServices({ limit: LIMIT });
    const services = asList<MarketplaceServiceItem>(result?.services).slice(0, LIMIT);
    const actions = [openArea(t, '/provider/services', t('Open your services'), t('Edit, pause or add an offer.'))];
    if (services.length === 0) {
      return { section: t('You have no service offers yet.'), citations: [], actions };
    }
    const citations: CopilotCitation[] = [];
    const lines = services.map((service) => {
      citations.push({ type: 'route', id: service.id, label: service.title, href: '/provider/services' });
      const details = [
        t(service.category),
        service.pricing ?? '',
        service.isActive === false ? t('paused') : t('live'),
        service.isFeatured ? t('featured') : '',
      ].filter(Boolean);
      return `• **${service.title}** — ${details.join(' · ')}`;
    });
    return { section: `${t('Your service offers:')}\n${lines.join('\n')}`, citations, actions };
  },

  async get_inquiries(_args, { t, locale }) {
    const result = await listServiceInquiries({ side: 'provider', limit: LIMIT });
    const inquiries = asList<ServiceInquiryItem>(result?.inquiries).slice(0, LIMIT);
    const actions = [openArea(t, '/provider/inquiries', t('Open inquiries'), t('Reply, agree a scope or decline.'))];
    if (inquiries.length === 0) {
      return { section: t('No inquiries yet.'), citations: [], actions };
    }
    const citations: CopilotCitation[] = [];
    const lines = inquiries.map((inquiry) => {
      const name = inquiry.client?.displayName ?? t('A client');
      citations.push({ type: 'person', id: inquiry.client?.id ?? inquiry.id, label: name, href: '/provider/inquiries' });
      const details = [
        inquiry.offer?.title ?? '',
        t(INQUIRY_STATE[inquiry.status] ?? inquiry.status),
        inquiry.budgetEstimate != null ? t('budget {price}', { price: `${inquiry.currency ?? 'EUR'} ${inquiry.budgetEstimate}` }) : '',
        formatWhen(inquiry.createdAt, locale, false),
      ].filter(Boolean);
      return `• **${name}** — ${details.join(' · ')}`;
    });
    return { section: `${t('Recent inquiries:')}\n${lines.join('\n')}`, citations, actions };
  },

  async get_learning(_args, { t }) {
    const featured = await listLearningResources({ featured: true, limit: LIMIT });
    let resources = asList<LearningResourceItem>(featured?.resources);
    if (resources.length === 0) resources = asList<LearningResourceItem>((await listLearningResources({ limit: LIMIT }))?.resources);
    resources = resources.slice(0, LIMIT);
    const actions = [openArea(t, '/learning', t('Open the learning library'), t('Guides, videos and templates.'))];
    if (resources.length === 0) {
      return { section: t('No learning resources yet.'), citations: [], actions };
    }
    const citations: CopilotCitation[] = [];
    const lines = resources.map((resource) => {
      citations.push({ type: 'route', id: resource.id, label: resource.title, href: '/learning' });
      const details = [
        t(RESOURCE_TYPE[resource.type] ?? resource.type),
        t(DIFFICULTY[resource.difficulty] ?? resource.difficulty),
        resource.duration ? t('{minutes} min', { minutes: resource.duration }) : '',
        resource.author ?? '',
      ].filter(Boolean);
      return `• **${resource.title}** — ${details.join(' · ')}`;
    });
    return { section: `${t('Learning resources:')}\n${lines.join('\n')}`, citations, actions };
  },

  async get_expert_reviews(_args, { t, locale }) {
    const [mine, forMe] = await Promise.all([
      listExpertReviews({ side: 'requester', limit: LIMIT }).catch(() => null),
      listExpertReviews({ side: 'expert', limit: LIMIT }).catch(() => null),
    ]);
    const requested = asList<ExpertReviewItem>(mine?.reviews);
    const giving = asList<ExpertReviewItem>(forMe?.reviews);
    const actions = [openArea(t, '/expert-reviews', t('Open expert reviews'), t('Request a review or answer one.'))];
    if (requested.length === 0 && giving.length === 0) {
      return { section: t('No expert reviews yet.'), citations: [], actions };
    }
    const line = (review: ExpertReviewItem, who: string) => {
      const details = [
        who,
        t(REVIEW_STATE[review.status] ?? review.status),
        review.dueDate ? t('due {date}', { date: formatWhen(review.dueDate, locale, false) }) : '',
        review.scoreOverall != null ? t('score {score}', { score: review.scoreOverall }) : '',
      ].filter(Boolean);
      return `• **${t(REVIEW_TYPE[review.reviewType] ?? review.reviewType)}** — ${details.join(' · ')}`;
    };
    const blocks: string[] = [];
    if (requested.length) blocks.push(`${t('Reviews you requested:')}\n${requested.slice(0, LIMIT).map((r) => line(r, r.expert?.displayName ?? '')).join('\n')}`);
    if (giving.length) blocks.push(`${t('Reviews asked of you:')}\n${giving.slice(0, LIMIT).map((r) => line(r, r.requester?.displayName ?? '')).join('\n')}`);
    return { section: blocks.join('\n'), citations: [], actions };
  },

  async get_org_cohorts(_args, { t, locale }) {
    const slug = await myOrganisationSlug();
    const actions = [openArea(t, '/org/cohorts', t('Open cohorts'), t('Participants, matches and sessions per cohort.'))];
    if (!slug) return { section: t('You are not a member of an organisation.'), citations: [], actions };
    const result = await getOrgCohorts(slug, { limit: 20 });
    const cohorts = asList<CohortItem>(result?.cohorts).slice(0, LIMIT);
    if (cohorts.length === 0) {
      return { section: t('Your organisation has no cohorts yet.'), citations: [], actions };
    }
    const now = Date.now();
    const citations: CopilotCitation[] = [];
    const lines = cohorts.map((cohort) => {
      citations.push({ type: 'route', id: cohort.id, label: cohort.name, href: `/org/cohorts/${cohort.id}` });
      const start = cohort.startDate ? Date.parse(cohort.startDate) : null;
      const end = cohort.endDate ? Date.parse(cohort.endDate) : null;
      const state = start != null && start > now ? 'starting soon' : !cohort.isActive || (end != null && end < now) ? 'finished' : 'running';
      const details = [
        t(state),
        cohort.startDate ? `${formatWhen(cohort.startDate, locale, false)} – ${formatWhen(cohort.endDate, locale, false)}` : '',
        t('{count} members', { count: cohort._count?.members ?? 0 }),
      ].filter(Boolean);
      return `• **${cohort.name}** — ${details.join(' · ')}`;
    });
    return { section: `${t('Your organisation’s cohorts:')}\n${lines.join('\n')}`, citations, actions };
  },

  async get_org_members(_args, { t, locale }) {
    const slug = await myOrganisationSlug();
    const actions = [openArea(t, '/org/members', t('Open members'), t('Everyone in your organisation’s cohorts.'))];
    if (!slug) return { section: t('You are not a member of an organisation.'), citations: [], actions };
    const result = await getOrgMembers(slug, { limit: 100 });
    const all = asList<OrgMember>(result?.members);
    const members = all.slice().sort((a, b) => (b.joinedAt ?? '').localeCompare(a.joinedAt ?? '')).slice(0, LIMIT);
    if (members.length === 0) {
      return { section: t('Your organisation has no members yet.'), citations: [], actions };
    }
    const citations: CopilotCitation[] = [];
    const lines = members.map((member) => {
      citations.push({ type: 'person', id: member.id, label: member.displayName, href: `/profiles/${member.id}` });
      const details = [t(member.role), member.cohortName ?? '', t('joined {when}', { when: formatWhen(member.joinedAt, locale, false) })].filter(Boolean);
      return `• **${member.displayName}** — ${details.join(' · ')}`;
    });
    const total = typeof result?.total === 'number' ? result.total : all.length;
    return { section: `${t('{count} members; the newest:', { count: total })}\n${lines.join('\n')}`, citations, actions };
  },

  async get_platform_stats(_args, { t }) {
    const result = await getAdminStats();
    const stats = result?.stats;
    const actions = [openArea(t, '/admin/dashboard', t('Open the platform overview'), t('Figures, health and what needs attention.'))];
    if (!stats) {
      return { section: t('Platform figures are not available.'), citations: [], actions };
    }
    return {
      section: [
        t('{total} users · {fresh} new this week · {active} active this week', { total: stats.totalUsers ?? 0, fresh: stats.newUsersThisWeek ?? 0, active: stats.activeUsersThisWeek ?? 0 }),
        t('{connections} connections · {messages} messages · {events} events · {groups} groups · {jobs} jobs', {
          connections: stats.totalConnections ?? 0,
          messages: stats.totalMessages ?? 0,
          events: stats.totalEvents ?? 0,
          groups: stats.totalGroups ?? 0,
          jobs: stats.totalJobs ?? 0,
        }),
        t('{count} reports waiting for review', { count: stats.pendingReports ?? 0 }),
      ].join('\n'),
      citations: [],
      actions,
    };
  },

  async get_moderation_queue(_args, { t, locale }) {
    const result = await listAdminReports({ status: 'pending', limit: 50 });
    const reports = asList<AdminReportItem>(result?.reports)
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, LIMIT);
    const actions = [openArea(t, '/admin/reports', t('Open reports'), t('Resolve or dismiss each report.'))];
    if (reports.length === 0) {
      return { section: t('The moderation queue is empty.'), citations: [], actions };
    }
    const lines = reports.map((report) => {
      const who = report.reported?.name ?? report.reported?.email ?? t('Someone');
      return `• **${t(REPORT_TYPE[report.type] ?? report.type)}** — ${who}: ${report.reason} · ${formatWhen(report.createdAt, locale, false)}`;
    });
    return { section: `${t('Oldest open reports:')}\n${lines.join('\n')}`, citations: [], actions };
  },
};

export function isAreaRead(name: string): name is AreaReadId {
  return Object.prototype.hasOwnProperty.call(AREA_READERS, name);
}
