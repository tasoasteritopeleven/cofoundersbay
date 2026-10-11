import {
  getActionDeclaration,
  listDeclarations,
  toToolCatalog,
  isCanvasCommandOp,
  type ActionDeclaration,
  type ActionOutcome,
  type MutationActionId,
  type UndoableActionId,
} from '@cofounderbay/shared';
import {
  acceptsApplications,
  applyToProgram,
  cancelInvite,
  createEndorsement,
  createInvite,
  deleteEndorsement,
  getMyReceivedMentorRequests,
  joinGroup,
  leaveGroup,
  listGroups,
  getMyGroups,
  listPrograms,
  respondToMentorRequest,
  assessReadiness,
  pickReadinessDimensions,
  createEvent,
  createMilestone,
  deleteMilestone,
  getMeProfile,
  getMilestone,
  getOrCreateDirectConversation,
  listEvents,
  listMilestones,
  removeFromShortlist,
  respondToConnectionRequest,
  rsvpEvent,
  saveToShortlist,
  sendConnectionRequest,
  updateMilestone,
  updateProfile,
  updateReadinessCriterion,
  type MilestonePriority,
  type MilestoneStatus,
} from '@/lib/api';
import { createWorkspace } from '@/lib/builder-api';
import {
  closeCommitmentCard,
  expressCommitmentInterest,
  reopenCommitmentCard,
  withdrawCommitmentInterest,
} from '@/lib/commitments-api';
import {
  archiveWorkspace,
  createInvestorDeal,
  deleteInvestorDeal,
  getInvestorDeal,
  PIPELINE_STAGES,
  type PipelineStage,
  updateInvestorDeal,
  withdrawConnectionRequest,
} from '@/lib/api';
import { isPreviewDemo } from '@/lib/preview-demo';
import { demoCriterionState, toggleDemoCriterion } from '@/lib/readiness-demo';
import { PAGE_REGISTRY, getPageMeta } from '@/lib/page-registry';
import { runCanvasCommand } from '@/lib/canvas/canvas-command-bus';
import { currentRailSections, openCurrentRailSection } from '@/components/layout/PageRailContext';
import { runPageControl } from '@/lib/page-controls';
import { FORM_DRAFT_ROUTES, stashFormDraft, type FormDraftId } from '@/lib/form-draft';
import { followPerson, unfollowPerson } from '@/lib/updates-api';
import { requestIntro, withdrawIntro } from '@/lib/intros-api';
import { clearOpenTo, getMyOpenTo, setOpenTo } from '@/lib/open-to-api';
import { linkSkillEvidence, unlinkSkillEvidence } from '@/lib/skill-evidence-api';
import { runScout } from '@/lib/scout-api';
import { isLinkableEvidenceKind, isOpenToKind, type OpenToKind, type OpenToVisibility } from '@cofounderbay/shared';

/**
 * The web app's half of the capability contract.
 *
 * What each capability *is* — its bilingual copy, arguments, whether it writes
 * and whether it can be taken back — now lives in `@cofounderbay/shared`, so
 * the server can enforce the same list it offers a model instead of trusting
 * one assembled in the browser. What each capability *does* stays here,
 * because an executor closes over this app's API client and cannot cross a
 * package boundary as data.
 *
 * The binding is what keeps the two halves honest. `EXECUTORS` is keyed by
 * `MutationActionId` and `UNDOS` by `UndoableActionId`, both derived from the
 * declarations: declare a mutation and omit its executor, or claim `full`
 * reversibility and omit the undo, and this file stops compiling. That is the
 * same guarantee the discriminated union gave before the move, expressed
 * across the boundary rather than inside one object.
 */

export type { ActionOutcome };
export { toToolCatalog };

type Executor = (payload: Record<string, unknown>) => Promise<ActionOutcome>;

/**
 * An undo gets both halves: what was asked for, and what the action produced.
 *
 * The second is the one that matters for anything that creates a row. Before
 * it existed every create declared `reversal: none`, because the undo knew the
 * name it had been given and not the id that came back.
 */
type Undo = (
  payload: Record<string, unknown>,
  context: Record<string, unknown>,
) => Promise<ActionOutcome>;

function requireString(payload: Record<string, unknown>, key: string): string {
  const value = payload?.[key];
  return typeof value === 'string' ? value : '';
}

/**
 * The workspace the Readiness page itself works on.
 *
 * `/readiness` resolves its workspace from this one key and nothing else, so
 * reading the same key is what keeps a tool the assistant runs and a box the
 * user clicks pointed at the same scores. When it is empty the page shows its
 * "create or select a workspace" card — which is why `workspace_create` writes
 * the key back below, instead of leaving the user to select by hand what the
 * assistant just made for them.
 */
const WORKSPACE_KEY = 'cfb_default_workspace';

function currentWorkspaceId(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(WORKSPACE_KEY)?.trim() || '';
  } catch {
    return '';
  }
}

const READINESS_DIMENSIONS = ['team', 'market', 'product', 'business', 'funding', 'execution'];

/**
 * Writes one readiness criterion after checking it is not already there.
 *
 * The check is the reason `undo` is safe to offer. `undoAction` is handed the
 * original payload and never the outcome, so an undo can only set the
 * criterion to the opposite of what was asked. If the box had already been
 * ticked by the user, running the tool would be a no-op and *undoing* it would
 * clear something the assistant never set. Refusing the no-op closes that gap,
 * and costs one request the page makes on load anyway.
 */
async function writeCriterion(
  payload: Record<string, unknown>,
  completed: boolean,
): Promise<ActionOutcome> {
  const dimension = requireString(payload, 'dimension');
  if (!READINESS_DIMENSIONS.includes(dimension)) return { ok: false, error: 'Unknown readiness dimension' };

  const criterionId = requireString(payload, 'criterionId');
  if (!criterionId) return { ok: false, error: 'Missing criterion' };

  // The showcase keeps its own criteria and its own session overlay, and it is
  // the whole page a visitor without an account ever sees. Refusing here would
  // have made the assistant a narrator of a page it could not touch — and it
  // has no workspace to reach for, by design.
  if (isPreviewDemo()) {
    const current = demoCriterionState(dimension, criterionId);
    if (current === undefined) return { ok: false, error: 'That criterion is not part of this dimension' };
    if (current === completed) {
      return {
        ok: false,
        error: completed ? 'That criterion is already met' : 'That criterion is already clear',
      };
    }
    toggleDemoCriterion(dimension, criterionId, completed);
    notifyReadinessChanged();
    return { ok: true, href: '/readiness' };
  }

  const workspaceId = currentWorkspaceId();
  if (!workspaceId) {
    return { ok: false, error: 'No workspace selected. Create one first, then tick criteria.' };
  }

  const response = await assessReadiness({ workspaceId });
  const dimensions = pickReadinessDimensions(response);
  if (!dimensions) return { ok: false, error: 'Readiness assessment is unavailable' };
  const score = dimensions.find((entry) => entry.dimension === dimension);
  const criterion = score?.criteria?.find((entry) => entry.id === criterionId);
  if (!criterion) return { ok: false, error: 'That criterion is not part of this dimension' };
  if (criterion.completed === completed) {
    return {
      ok: false,
      error: completed ? 'That criterion is already met' : 'That criterion is already clear',
    };
  }

  await updateReadinessCriterion(workspaceId, { dimension, criterionId, completed });
  notifyReadinessChanged();
  return { ok: true, href: '/readiness' };
}

/**
 * Tells an open Readiness page that its scores are stale.
 *
 * The page owns its React Query cache and an executor cannot reach it, so
 * without this a criterion ticked from the assistant would be saved on the
 * server and invisible on screen until a manual refresh. The `cfb:` window
 * event is the convention the rest of the app already uses for this
 * (`cfb:login`, `cfb:api-online`, `cfb:sidebar-mode`).
 */
function notifyReadinessChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('cfb:readiness-updated'));
}

function internalRoute(value: string): string | null {
  const href = value.trim();
  if (!href.startsWith('/') || href.startsWith('//') || href.includes('\\')) return null;
  if (/[\u0000-\u001f\u007f]/.test(href)) return null;

  try {
    const base = 'https://cofounderbay.invalid';
    const url = new URL(href, base);
    if (url.origin !== base) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/** Exhaustive over every declared mutation. Adding one without an arm fails to compile. */
const EXECUTORS: Record<MutationActionId, Executor> = {
  navigate: async (payload) => {
    const requested = requireString(payload, 'href');
    if (!requested) return { ok: true, href: '/dashboard' };
    const href = internalRoute(requested);
    return href
      ? { ok: true, href }
      : { ok: false, error: 'Only internal CoFounderBay routes can be opened' };
  },

  // A page's own controls (`usePageControls`). The registry refuses the
  // wrong kind, so a view control never runs as a write or the reverse.
  use_page_control: async (payload) => {
    const control = requireString(payload, 'control');
    if (!control) return { ok: false, error: 'Missing control' };
    return runPageControl(control, requireString(payload, 'value') || undefined, false);
  },

  run_page_command: async (payload) => {
    const control = requireString(payload, 'control');
    if (!control) return { ok: false, error: 'Missing command' };
    return runPageControl(control, requireString(payload, 'value') || undefined, true);
  },

  open_rail_section: async (payload) => {
    const section = requireString(payload, 'section');
    if (!section) return { ok: false, error: 'Missing section' };
    if (openCurrentRailSection(section)) return { ok: true };
    // The page changed, or the model named a section this page does not have.
    // Saying which exist lets the reader pick instead of seeing nothing open.
    const available = currentRailSections().map((s) => s.labelEn);
    return {
      ok: false,
      error: available.length
        ? `This page has no "${section}" section. Its tools are: ${available.join(', ')}.`
        : 'This page has no tools panel.',
    };
  },

  shortlist_add: async (payload) => {
    const userId = requireString(payload, 'userId');
    if (!userId) return { ok: false, error: 'Missing user' };
    await saveToShortlist(userId);
    return { ok: true, href: '/shortlist' };
  },

  shortlist_remove: async (payload) => {
    const userId = requireString(payload, 'userId');
    if (!userId) return { ok: false, error: 'Missing user' };
    await removeFromShortlist(userId);
    return { ok: true, href: '/shortlist' };
  },

  send_connection: async (payload) => {
    const receiverId = requireString(payload, 'receiverId');
    if (!receiverId) return { ok: false, error: 'Missing receiver' };
    const message = typeof payload?.message === 'string' ? payload.message : undefined;
    const sent = await sendConnectionRequest({ receiverId, message });
    // The id is what makes this reversible: the undo withdraws this exact
    // request rather than looking one up by the pair of people. Read rather
    // than destructured, because `apiRequest` casts without checking and a
    // response without a connection must not turn a sent intro into an error.
    const connectionId = sent?.connection?.id;
    return connectionId ? { ok: true, undo: { connectionId } } : { ok: true };
  },

  start_or_send_message: async (payload) => {
    const userId = requireString(payload, 'userId');
    if (!userId) return { ok: false, error: 'Missing user' };
    const { conversationId } = await getOrCreateDirectConversation(userId);
    return { ok: true, href: `/messages?c=${conversationId}` };
  },

  readiness_tick_criterion: async (payload) =>
    writeCriterion(payload, payload?.completed !== false),

  analytics_set_period: async (payload) => {
    const period = requireString(payload, 'period');
    if (!ANALYTICS_PERIODS.includes(period)) return { ok: false, error: 'Unknown period' };
    return { ok: true, href: `/analytics?period=${period}` };
  },

  workspace_create: async (payload) => {
    // The showcase has readiness without a workspace, and no account to hang
    // one on. Saying so is truer than reaching for an endpoint that will
    // refuse the request, or than reporting success for nothing.
    if (isPreviewDemo()) {
      return { ok: false, error: 'The demo showcase already has a workspace. Sign in to create your own.' };
    }

    const name = requireString(payload, 'name').trim();
    if (!name) return { ok: false, error: 'Missing workspace name' };
    // The API caps the name at 100 characters and rejects the whole request
    // over it, which would read to the user as the assistant failing rather
    // than as a name being too long.
    if (name.length > 100) return { ok: false, error: 'Workspace name is too long (100 characters)' };

    const description = requireString(payload, 'description').trim() || undefined;
    const startupName = requireString(payload, 'startupName').trim() || undefined;
    const workspace = await createWorkspace({ name, description, startupName });
    if (!workspace?.id) return { ok: false, error: 'Workspace was not created' };

    // Selecting it is the half that makes this useful: `/readiness` reads this
    // key alone, so a workspace created and left unselected would leave the
    // page showing the same empty card it showed before.
    try {
      window.localStorage.setItem(WORKSPACE_KEY, workspace.id);
    } catch {
      // A blocked storage write is not a failed creation — the workspace
      // exists, and Builder can select it. Saying `ok` here and sending the
      // user to Builder is truer than reporting the write as failed.
      return { ok: true, href: '/builder', undo: { workspaceId: workspace.id } };
    }
    notifyReadinessChanged();
    return { ok: true, href: '/readiness', undo: { workspaceId: workspace.id } };
  },

  investor_track_startup: async (payload) => {
    const name = requireString(payload, 'name').trim();
    if (!name) return { ok: false, error: 'Missing startup name' };
    const industry = requireString(payload, 'industry').trim() || undefined;
    const notes = requireString(payload, 'notes').trim() || undefined;

    const created = await createInvestorDeal({ name, industry, notes });
    const dealId = created?.deal?.id;
    return dealId
      ? { ok: true, href: '/investor/watchlist', undo: { dealId } }
      : { ok: true, href: '/investor/watchlist' };
  },

  investor_move_stage: async (payload) => {
    const dealId = requireString(payload, 'dealId');
    if (!dealId) return { ok: false, error: 'Missing deal' };
    const pipelineStage = requireString(payload, 'pipelineStage');
    if (!PIPELINE_STAGES.includes(pipelineStage as PipelineStage)) {
      return { ok: false, error: 'Unknown pipeline stage' };
    }

    // Read first so the undo knows where it came from. The payload says where
    // it was asked to go and never where it was.
    const before = await getInvestorDeal(dealId);
    const fromStage = before?.deal?.pipelineStage;
    if (fromStage === pipelineStage) {
      return { ok: false, error: 'That deal is already at that stage' };
    }

    await updateInvestorDeal(dealId, { pipelineStage: pipelineStage as PipelineStage });
    return {
      ok: true,
      href: '/investor/pipeline',
      ...(fromStage ? { undo: { dealId, fromStage } } : {}),
    };
  },

  canvas_command: async (payload) => {
    const op = requireString(payload, 'op');
    if (!isCanvasCommandOp(op)) return { ok: false, error: 'Unknown canvas command' };
    return runCanvasCommand(op, payload);
  },

  update_profile: async (payload) => {
    // Only the fields the declaration offers; anything else in the payload is
    // dropped here rather than sent to an endpoint that would reject it.
    const patch: Record<string, string> = {};
    for (const key of ['headline', 'bio', 'location', 'timezone'] as const) {
      const value = requireString(payload, key).trim();
      if (value) patch[key] = value;
    }
    if (Object.keys(patch).length === 0) return { ok: false, error: 'Nothing to update' };

    if (isPreviewDemo()) {
      return { ok: false, error: 'The demo profile cannot be changed. Sign in to edit yours.' };
    }

    // Read first: the undo restores exactly these values, including fields
    // that were empty — a null restores as an empty string, which both the
    // schema and the page treat the same way.
    const { profile } = await getMeProfile();
    const prior: Record<string, string> = {};
    for (const key of Object.keys(patch)) {
      const value = profile?.[key as keyof typeof profile];
      prior[key] = typeof value === 'string' ? value : '';
    }

    await updateProfile(patch);
    return { ok: true, href: '/profile', undo: { prior } };
  },

  respond_to_connection: async (payload) => {
    const connectionId = requireString(payload, 'connectionId');
    if (!connectionId) return { ok: false, error: 'Missing request' };
    const decision = requireString(payload, 'decision');
    if (decision !== 'accepted' && decision !== 'declined') {
      return { ok: false, error: 'Unknown decision' };
    }
    await respondToConnectionRequest(connectionId, decision);
    return { ok: true, href: '/connections' };
  },

  create_milestone: async (payload) => {
    const title = requireString(payload, 'title').trim();
    if (!title) return { ok: false, error: 'Missing milestone title' };
    if (isPreviewDemo()) {
      return { ok: false, error: 'Demo milestones are fixed. Sign in to create your own.' };
    }

    const description = requireString(payload, 'description').trim() || undefined;
    const dueDate = requireString(payload, 'dueDate').trim() || undefined;
    const priority = requireString(payload, 'priority');
    const created = await createMilestone({
      title,
      ...(description ? { description } : {}),
      ...(dueDate ? { dueDate } : {}),
      ...(MILESTONE_PRIORITIES.includes(priority as MilestonePriority)
        ? { priority: priority as MilestonePriority }
        : {}),
    });
    return created?.id
      ? { ok: true, href: '/milestones', undo: { milestoneId: created.id } }
      : { ok: true, href: '/milestones' };
  },

  update_milestone_status: async (payload) => {
    const status = requireString(payload, 'status');
    if (!MILESTONE_STATUSES.includes(status as MilestoneStatus)) {
      return { ok: false, error: 'Unknown status' };
    }

    const milestoneId = await resolveMilestoneId(payload);
    if (!milestoneId) return { ok: false, error: 'Missing milestone' };

    // Read first — the undo needs the status it had, which the payload cannot
    // carry. Same no-op guard as the criteria writer: flipping a status that
    // is already set would leave an undo for a change that never happened.
    const before = await getMilestone(milestoneId);
    const fromStatus = before?.status;
    if (fromStatus === status) {
      return { ok: false, error: 'That milestone is already in that state' };
    }

    await updateMilestone(milestoneId, { status: status as MilestoneStatus });
    return {
      ok: true,
      href: '/milestones',
      ...(fromStatus ? { undo: { milestoneId, fromStatus } } : {}),
    };
  },

  rsvp_event: async (payload) => {
    const status = requireString(payload, 'status');
    if (!RSVP_STATUSES.includes(status)) return { ok: false, error: 'Unknown RSVP' };

    // The upcoming list carries both the id the title resolves to and the
    // RSVP the undo restores, so one read serves both halves.
    const list = await listEvents({ scope: 'upcoming', limit: 50 });
    const events = Array.isArray(list?.events) ? list.events : [];

    let eventId = requireString(payload, 'eventId');
    let priorStatus: string | null = null;
    if (eventId) {
      priorStatus = events.find((event) => event?.id === eventId)?.viewerRsvp ?? null;
    } else {
      const title = requireString(payload, 'eventTitle').trim().toLowerCase();
      if (!title) return { ok: false, error: 'Missing event' };
      const found = events.find((event) => event?.title?.toLowerCase() === title);
      if (!found) return { ok: false, error: 'No upcoming event with that title' };
      eventId = found.id;
      priorStatus = found.viewerRsvp ?? null;
    }
    if (priorStatus === status) {
      return { ok: false, error: 'You are already marked that way' };
    }

    await rsvpEvent(eventId, status as 'going' | 'interested' | 'not_going');
    return {
      ok: true,
      href: `/events/${eventId}`,
      undo: { eventId, priorStatus },
    };
  },

  create_event: async (payload) => {
    const title = requireString(payload, 'title').trim();
    if (!title) return { ok: false, error: 'Missing event title' };
    const startAt = requireString(payload, 'startAt').trim();
    if (!startAt || Number.isNaN(Date.parse(startAt))) {
      return { ok: false, error: 'Missing or invalid start time' };
    }

    const type = requireString(payload, 'type');
    const endAt = requireString(payload, 'endAt').trim();
    const description = requireString(payload, 'description').trim();
    const location = requireString(payload, 'location').trim();
    const created = await createEvent({
      title,
      startAt,
      ...(EVENT_TYPES.includes(type) ? { type: type as 'meetup' | 'webinar' | 'workshop' | 'demo_day' | 'networking' | 'other' } : {}),
      ...(description ? { description } : {}),
      ...(location ? { location } : {}),
      ...(payload?.isOnline === true ? { isOnline: true } : {}),
      ...(endAt && !Number.isNaN(Date.parse(endAt)) ? { endAt } : {}),
    });
    const eventId = created?.event?.id;
    return { ok: true, href: eventId ? `/events/${eventId}` : '/events' };
  },

  // ── Wave C ───────────────────────────────────────────────────────────────

  join_group: async (payload) => {
    const groupId = await resolveGroupId(payload, 'any');
    if (!groupId) return { ok: false, error: 'No group with that name' };
    await joinGroup(groupId);
    return { ok: true, href: `/groups/${groupId}`, undo: { groupId } };
  },

  leave_group: async (payload) => {
    const groupId = await resolveGroupId(payload, 'mine');
    if (!groupId) return { ok: false, error: 'You are not in a group with that name' };
    await leaveGroup(groupId);
    return { ok: true, href: `/groups/${groupId}` };
  },

  apply_to_program: async (payload) => {
    let programId = requireString(payload, 'programId');
    const list = await listPrograms({ limit: 50 });
    const programs = Array.isArray(list?.programs) ? list.programs : [];
    if (!programId) {
      const title = requireString(payload, 'programTitle').trim().toLowerCase();
      if (!title) return { ok: false, error: 'Missing programme' };
      programId = byName(programs, (p) => p?.title, title)?.id ?? '';
      if (!programId) return { ok: false, error: 'No single programme matches that title' };
    }
    const program = programs.find((p) => p?.id === programId);
    // The page refuses a closed programme before the API does; so does this.
    if (program && !acceptsApplications(program)) return { ok: false, error: 'This programme is not taking applications' };
    const coverNote = requireString(payload, 'coverNote').trim();
    await applyToProgram(programId, coverNote ? { coverNote } : undefined);
    return { ok: true, href: `/programs/${programId}` };
  },

  send_invite: async (payload) => {
    const email = requireString(payload, 'email').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Missing or invalid email address' };
    const message = requireString(payload, 'message').trim();
    const created = await createInvite({ email, ...(message ? { message } : {}) });
    const inviteId = created?.invite?.id;
    return { ok: true, href: '/referrals', ...(inviteId ? { undo: { inviteId } } : {}) };
  },

  write_endorsement: async (payload) => {
    const toUserId = requireString(payload, 'userId');
    const content = requireString(payload, 'content').trim();
    if (!toUserId) return { ok: false, error: 'Missing person' };
    if (!content) return { ok: false, error: 'Missing endorsement text' };
    const skill = requireString(payload, 'skill').trim();
    const created = await createEndorsement({ toUserId, content, ...(skill ? { skill } : {}) });
    const endorsementId = created?.endorsement?.id;
    return { ok: true, href: `/profiles/${toUserId}`, ...(endorsementId ? { undo: { endorsementId } } : {}) };
  },

  respond_to_mentor_request: async (payload) => {
    const decision = requireString(payload, 'decision');
    if (decision !== 'accept' && decision !== 'decline') return { ok: false, error: 'Unknown decision' };
    let requestId = requireString(payload, 'requestId');
    if (!requestId) {
      const name = requireString(payload, 'requesterName').trim().toLowerCase();
      if (!name) return { ok: false, error: 'Missing request' };
      const received = await getMyReceivedMentorRequests();
      const pending = (Array.isArray(received?.requests) ? received.requests : []).filter((r) => r?.status === 'pending');
      const matches = pending.filter((r) => r?.requester?.displayName?.toLowerCase().includes(name));
      // Two people who share a first name are a question, not a guess.
      if (matches.length !== 1) return { ok: false, error: matches.length ? 'More than one request matches that name' : 'No pending request from that person' };
      requestId = matches[0].id;
    }
    await respondToMentorRequest(requestId, { accept: decision === 'accept' });
    return { ok: true, href: '/mentor/requests' };
  },

  // ── Wave D: forms as proposals ───────────────────────────────────────────
  // Each stashes the fields for its form and opens it; the form fills itself
  // and the person submits. Nothing here calls a write endpoint.
  draft_milestone: async (payload) => openDraft('milestone', payload, ['title', 'description', 'dueDate', 'category', 'priority', 'notes'], 'title'),
  draft_event: async (payload) => openDraft('event', payload, ['title', 'description', 'type', 'startAt', 'endAt', 'location', 'isOnline'], 'title'),
  draft_project: async (payload) => openDraft('project', payload, ['name', 'tagline', 'description', 'industry', 'location', 'website'], 'name'),
  draft_profile: async (payload) => openDraft('profile', payload, ['headline', 'bio', 'displayName', 'location', 'websiteUrl', 'linkedinUrl'], null),
  draft_need_card: async (payload) =>
    openDraft(
      'need_card',
      payload,
      ['kind', 'title', 'exists', 'goal', 'missing', 'offerRole', 'offerEquity', 'offerHours', 'offerScope', 'category', 'place', 'stage', 'commitment'],
      null,
    ),
  draft_founder_update: async (payload) => openDraft('founder_update', payload, ['title', 'body', 'visibility'], null),
  draft_scout_brief: async (payload) => openDraft('scout_brief', payload, ['role', 'skills', 'place', 'commitment', 'stage', 'note'], 'role'),
  // Adds proposals to the founder's own list; contacts nobody (declared none).
  run_scout: async () => {
    await runScout();
    return { ok: true, href: '/scout' };
  },

  // ── Introductions and "Open to" ──────────────────────────────────────────
  // The intro id comes back so the undo withdraws exactly this request.
  request_intro: async (payload) => {
    const targetId = requireString(payload, 'targetId');
    const intermediaryId = requireString(payload, 'intermediaryId');
    const cardId = requireString(payload, 'cardId');
    if (!targetId || !intermediaryId || !cardId) return { ok: false, error: 'Missing the person, the intermediary or the need card' };
    const intro = await requestIntro({ targetId, intermediaryId, cardId, note: requireString(payload, 'note').trim() });
    return { ok: true, href: `/intros?intro=${encodeURIComponent(intro.id)}`, ...(intro.id ? { undo: { introId: intro.id } } : {}) };
  },
  // What was there before travels with the outcome, so Undo restores it.
  set_open_to: async (payload) => {
    const kinds = requireString(payload, 'kinds').split(/[\s,]+/).filter(isOpenToKind) as OpenToKind[];
    if (!kinds.length) return { ok: false, error: 'Choose at least one: cofounder, advisor, angel or mentor' };
    const visibility = (['nobody', 'verified', 'everyone'] as const).find((v) => v === payload?.visibility) ?? 'nobody';
    const before = await getMyOpenTo();
    await setOpenTo({ kinds, visibility, note: requireString(payload, 'note').trim() || null });
    const prev = before.signal;
    return { ok: true, href: '/settings#open-to', undo: prev ? { kinds: prev.kinds.join(','), visibility: prev.visibility, note: prev.note ?? '' } : { cleared: true } };
  },

  // The new row's id comes back so the undo removes exactly this link.
  link_skill_evidence: async (payload) => {
    const skillName = requireString(payload, 'skillName').trim();
    const kind = payload?.kind;
    const refId = requireString(payload, 'refId');
    if (!skillName || !isLinkableEvidenceKind(kind) || !refId) return { ok: false, error: 'Missing the skill or the item' };
    const linked = await linkSkillEvidence({ skillName, kind, refId });
    return { ok: true, href: '/profile', ...(linked.id ? { undo: { evidenceId: linked.id } } : {}) };
  },

  // ── Following ────────────────────────────────────────────────────────────
  follow_person: async (payload) => {
    const userId = requireString(payload, 'userId');
    if (!userId) return { ok: false, error: 'Missing user' };
    await followPerson(userId);
    return { ok: true, href: '/updates' };
  },

  // ── Commitments ──────────────────────────────────────────────────────────
  // The thread id comes back so the undo withdraws exactly this interest.
  express_interest: async (payload) => {
    const cardId = requireString(payload, 'cardId');
    if (!cardId) return { ok: false, error: 'Missing need card' };
    const { threadId } = await expressCommitmentInterest(cardId, requireString(payload, 'note').trim());
    return { ok: true, href: `/commitments/${encodeURIComponent(cardId)}`, ...(threadId ? { undo: { threadId } } : {}) };
  },

  close_need_card: async (payload) => {
    const cardId = requireString(payload, 'cardId');
    if (!cardId) return { ok: false, error: 'Missing need card' };
    await closeCommitmentCard(cardId, requireString(payload, 'reason') === 'filled' ? 'filled' : 'withdrawn');
    return { ok: true, href: `/commitments/${encodeURIComponent(cardId)}`, undo: { cardId } };
  },
};

/** Copies the declared fields (and only those) into a draft and opens its form. */
async function openDraft(
  id: FormDraftId,
  payload: Record<string, unknown>,
  keys: readonly string[],
  required: string | null,
): Promise<ActionOutcome> {
  const fields: Record<string, string | boolean> = {};
  for (const key of keys) {
    const value = payload?.[key];
    if (typeof value === 'string' && value.trim()) fields[key] = value.trim();
    else if (typeof value === 'boolean') fields[key] = value;
  }
  if (required && !fields[required]) return { ok: false, error: `Missing ${required}` };
  if (Object.keys(fields).length === 0) return { ok: false, error: 'Nothing to fill in' };
  stashFormDraft(id, fields);
  return { ok: true, href: FORM_DRAFT_ROUTES[id] };
}

/**
 * A group by id, or by exact name. Leaving looks only at the groups the
 * reader is in; joining looks at every group they can see.
 */
async function resolveGroupId(payload: Record<string, unknown>, scope: 'any' | 'mine'): Promise<string> {
  const id = requireString(payload, 'groupId');
  if (id) return id;
  const name = requireString(payload, 'groupName').trim().toLowerCase();
  if (!name) return '';
  const groups = scope === 'mine'
    ? (await getMyGroups())?.groups
    : (await listGroups({ search: name, limit: 20 }))?.groups;
  return byName(Array.isArray(groups) ? groups : [], (g) => g?.name, name)?.id ?? '';
}

/**
 * The one row whose name is the text, or else the one row whose name contains
 * it. Two partial matches are a question for the person, not a guess.
 */
function byName<T>(rows: readonly T[], nameOf: (row: T) => string | undefined, text: string): T | undefined {
  const wanted = text.trim().toLowerCase();
  if (!wanted) return undefined;
  const exact = rows.find((row) => nameOf(row)?.toLowerCase() === wanted);
  if (exact) return exact;
  const partial = rows.filter((row) => nameOf(row)?.toLowerCase().includes(wanted));
  return partial.length === 1 ? partial[0] : undefined;
}

const ANALYTICS_PERIODS = ['7d', '14d', '30d', '90d'];
const MILESTONE_STATUSES = ['todo', 'in_progress', 'blocked', 'completed', 'cancelled'];
const MILESTONE_PRIORITIES = ['low', 'medium', 'high'];
const RSVP_STATUSES = ['going', 'interested', 'not_going'];
const EVENT_TYPES = ['meetup', 'webinar', 'workshop', 'demo_day', 'networking', 'other'];

/**
 * A milestone by id, or by exact title when that is what the model had.
 *
 * The read tools cite milestones by id, so a model that read first names the
 * id. A model acting on "mark the pitch deck done" only has the words, and
 * resolving them here is what keeps that call from inventing an id.
 */
async function resolveMilestoneId(payload: Record<string, unknown>): Promise<string> {
  const id = requireString(payload, 'milestoneId');
  if (id) return id;
  const title = requireString(payload, 'title').trim().toLowerCase();
  if (!title) return '';
  const list = await listMilestones({ limit: 50 });
  const milestones = Array.isArray(list?.milestones) ? list.milestones : [];
  return milestones.find((m) => m?.title?.toLowerCase() === title)?.id ?? '';
}

/**
 * Exhaustive over every declaration that claims `full` or `partial`
 * reversibility. `start_or_send_message` is still absent on purpose: a sent
 * message is read the moment it lands and a direct conversation cannot be
 * deleted, so there is nothing honest to reverse.
 */
const UNDOS: Record<UndoableActionId, Undo> = {
  // The page named the opposite before the command ran, from the row's state
  // at that moment; the executor handed it over as the outcome's `undo`. No
  // opposite, no undo - `undoAvailable` keeps the button off such a card.
  run_page_command: async (_payload, context) => {
    const control = typeof context.control === 'string' ? context.control : '';
    if (!control) return { ok: false, error: 'Not reversible' };
    const value = typeof context.value === 'string' ? context.value : undefined;
    return runPageControl(control, value, true, { undoing: true });
  },

  shortlist_add: async (payload) => {
    const userId = requireString(payload, 'userId');
    if (!userId) return { ok: false, error: 'Missing user' };
    await removeFromShortlist(userId);
    return { ok: true, href: '/shortlist' };
  },

  shortlist_remove: async (payload) => {
    const userId = requireString(payload, 'userId');
    if (!userId) return { ok: false, error: 'Missing user' };
    await saveToShortlist(userId);
    return { ok: true, href: '/shortlist' };
  },

  // Sets the criterion back to where it was. `writeCriterion` refuses a no-op
  // on the way in, so the box this clears is always one the assistant ticked,
  // and it refuses again here if the user has since changed it by hand.
  readiness_tick_criterion: async (payload) =>
    writeCriterion(payload, payload?.completed === false),

  // Returns the page to the window it opens on. Declared `partial` for exactly
  // this reason: the payload says which window was asked for, never which one
  // was open before.
  analytics_set_period: async () => ({ ok: true, href: '/analytics' }),

  /**
   * Archives the workspace this action created, by the id the executor handed
   * back — never by name, which could match one the user already had.
   *
   * Also clears the selection, because `workspace_create` set it: leaving an
   * archived workspace selected would send /readiness to a workspace that is
   * no longer in the list.
   */
  /**
   * Withdraws the request that was just sent, by its id.
   *
   * Honest about its limit, and the declaration says so: the recipient was
   * notified the moment it was sent, so withdrawing removes the pending
   * request from their list but cannot unsee the notification. It refuses
   * once they have answered — `withdrawRequest` returns a conflict, which
   * surfaces here as the error rather than as a silent no-op.
   */
  send_connection: async (_payload, context) => {
    const connectionId = requireString(context, 'connectionId');
    if (!connectionId) return { ok: false, error: 'No request to withdraw' };
    await withdrawConnectionRequest(connectionId);
    return { ok: true, href: '/connections' };
  },

  /** Removes the row it created, by the id the executor handed back. */
  investor_track_startup: async (_payload, context) => {
    const dealId = requireString(context, 'dealId');
    if (!dealId) return { ok: false, error: 'No deal to remove' };
    await deleteInvestorDeal(dealId);
    return { ok: true, href: '/investor/watchlist' };
  },

  /** Returns the deal to the stage it was actually in, not to a default. */
  investor_move_stage: async (_payload, context) => {
    const dealId = requireString(context, 'dealId');
    const fromStage = requireString(context, 'fromStage');
    if (!dealId || !fromStage) return { ok: false, error: 'No previous stage to return to' };
    await updateInvestorDeal(dealId, { pipelineStage: fromStage as PipelineStage });
    return { ok: true, href: '/investor/pipeline' };
  },

  workspace_create: async (_payload, context) => {
    const workspaceId = requireString(context, 'workspaceId');
    if (!workspaceId) return { ok: false, error: 'No workspace to archive' };

    await archiveWorkspace(workspaceId);
    try {
      if (window.localStorage.getItem(WORKSPACE_KEY) === workspaceId) {
        window.localStorage.removeItem(WORKSPACE_KEY);
      }
    } catch {
      // A blocked storage read is not a failed archive. The workspace is
      // away; Builder will pick another the next time it loads.
    }
    notifyReadinessChanged();
    return { ok: true, href: '/builder' };
  },

  /** Writes back the values the executor read before patching. */
  update_profile: async (_payload, context) => {
    const prior = context?.prior;
    if (!prior || typeof prior !== 'object') {
      return { ok: false, error: 'No previous values to restore' };
    }
    const patch: Record<string, string> = {};
    for (const [key, value] of Object.entries(prior)) {
      patch[key] = typeof value === 'string' ? value : '';
    }
    if (Object.keys(patch).length === 0) {
      return { ok: false, error: 'No previous values to restore' };
    }
    await updateProfile(patch);
    return { ok: true, href: '/profile' };
  },

  /** Deletes the milestone it created, by the id the executor handed back. */
  create_milestone: async (_payload, context) => {
    const milestoneId = requireString(context, 'milestoneId');
    if (!milestoneId) return { ok: false, error: 'No milestone to remove' };
    await deleteMilestone(milestoneId);
    return { ok: true, href: '/milestones' };
  },

  /** Restores the status the milestone actually had, not a default. */
  update_milestone_status: async (_payload, context) => {
    const milestoneId = requireString(context, 'milestoneId');
    const fromStatus = requireString(context, 'fromStatus');
    if (!milestoneId || !MILESTONE_STATUSES.includes(fromStatus as MilestoneStatus)) {
      return { ok: false, error: 'No previous status to restore' };
    }
    await updateMilestone(milestoneId, { status: fromStatus as MilestoneStatus });
    return { ok: true, href: '/milestones' };
  },

  /**
   * Restores the RSVP read before the change, or `not_going` when there was
   * none — the route only upserts, which is why the declaration says partial.
   */
  rsvp_event: async (_payload, context) => {
    const eventId = requireString(context, 'eventId');
    if (!eventId) return { ok: false, error: 'No event to update' };
    const prior = requireString(context, 'priorStatus');
    const status = RSVP_STATUSES.includes(prior) ? prior : 'not_going';
    await rsvpEvent(eventId, status as 'going' | 'interested' | 'not_going');
    return { ok: true, href: `/events/${eventId}` };
  },

  /** Leaves the group the executor joined; the join automation's effects stay (declared partial). */
  join_group: async (_payload, context) => {
    const groupId = requireString(context, 'groupId');
    if (!groupId) return { ok: false, error: 'No group to leave' };
    await leaveGroup(groupId);
    return { ok: true, href: `/groups/${groupId}` };
  },

  /** Cancels the invitation it created; the email already went out (declared partial). */
  send_invite: async (_payload, context) => {
    const inviteId = requireString(context, 'inviteId');
    if (!inviteId) return { ok: false, error: 'No invitation to cancel' };
    await cancelInvite(inviteId);
    return { ok: true, href: '/referrals' };
  },

  /**
   * Withdraws the interest it sent, by the thread id the executor handed back.
   * The author was notified on arrival (declared partial), and the API refuses
   * once they have answered - that refusal is what the card shows.
   */
  express_interest: async (_payload, context) => {
    const threadId = requireString(context, 'threadId');
    if (!threadId) return { ok: false, error: 'No interest to withdraw' };
    await withdrawCommitmentInterest(threadId);
    return { ok: true, href: '/commitments' };
  },

  /** Removes the link it made; nothing else changed (declared full). */
  link_skill_evidence: async (_payload, context) => {
    const evidenceId = requireString(context, 'evidenceId');
    if (!evidenceId) return { ok: false, error: 'No link to remove' };
    await unlinkSkillEvidence(evidenceId);
    return { ok: true, href: '/profile' };
  },

  /** Withdraws the request it sent while it is still pending; the intermediary was notified (declared partial). */
  request_intro: async (_payload, context) => {
    const introId = requireString(context, 'introId');
    if (!introId) return { ok: false, error: 'No introduction to withdraw' };
    await withdrawIntro(introId);
    return { ok: true, href: '/intros?tab=sent' };
  },

  /** Puts back the previous signal (its 90 days restart), or clears it if there was none (declared partial). */
  set_open_to: async (_payload, context) => {
    if (context?.cleared === true) {
      await clearOpenTo();
      return { ok: true, href: '/settings#open-to' };
    }
    const kinds = requireString(context, 'kinds').split(',').filter(isOpenToKind) as OpenToKind[];
    if (!kinds.length) return { ok: false, error: 'Nothing to put back' };
    const visibility = (requireString(context, 'visibility') || 'nobody') as OpenToVisibility;
    await setOpenTo({ kinds, visibility, note: requireString(context, 'note') || null });
    return { ok: true, href: '/settings#open-to' };
  },

  /** Stops following; the "someone new follows you" notice already went (declared partial). */
  follow_person: async (payload) => {
    const userId = requireString(payload, 'userId');
    if (!userId) return { ok: false, error: 'Missing user' };
    await unfollowPerson(userId);
    return { ok: true, href: '/updates' };
  },

  /** Reopens the card it closed; the threads were never touched (declared full). */
  close_need_card: async (payload, context) => {
    const cardId = requireString(context, 'cardId') || requireString(payload, 'cardId');
    if (!cardId) return { ok: false, error: 'No card to reopen' };
    await reopenCommitmentCard(cardId);
    return { ok: true, href: `/commitments/${encodeURIComponent(cardId)}` };
  },

  /** Deletes the endorsement it wrote; the recipient was already notified (declared partial). */
  write_endorsement: async (_payload, context) => {
    const endorsementId = requireString(context, 'endorsementId');
    if (!endorsementId) return { ok: false, error: 'No endorsement to delete' };
    await deleteEndorsement(endorsementId);
    return { ok: true };
  },
};

export function listActions(): readonly ActionDeclaration[] {
  return listDeclarations();
}

export function getActionSpec(id: string): ActionDeclaration | undefined {
  return getActionDeclaration(id);
}

/** True when confirming this action performs work in this app. */
export function canExecute(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(EXECUTORS, id);
}

/** True when the action declares an undo the UI can actually offer. */
export function isUndoable(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(UNDOS, id);
}

/**
 * Whether this particular run can be taken back.
 *
 * Every other capability is reversible or not as a whole. A page command is
 * reversible only when its page named a verified opposite for the row it ran
 * on, which arrives as the outcome's `undo`; without it the card offers no
 * Undo rather than one that fails.
 */
export function undoAvailable(id: string, context: Record<string, unknown> | undefined): boolean {
  if (!isUndoable(id)) return false;
  if (id === 'run_page_command') return typeof context?.control === 'string' && context.control.length > 0;
  return true;
}

/**
 * Runs a declared action. Returns `Unsupported action` for a read tool or an
 * unknown id, the way the hand-written chain this replaced did — the read
 * tools are executed inside `runCopilotTurn`, which composes their prose
 * answer, so they have nothing to run here.
 */
export async function executeAction(
  id: string,
  payload: Record<string, unknown>,
): Promise<ActionOutcome> {
  const execute = (EXECUTORS as Record<string, Executor | undefined>)[id];
  if (!execute) return { ok: false, error: 'Unsupported action' };

  try {
    return await execute(payload);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Action failed' };
  }
}

/**
 * Takes back an action that declared it could be taken back.
 *
 * Refuses anything else rather than attempting a best-effort guess, because
 * the cases that declare `none` are exactly the ones where a guess would do
 * damage: archiving a conversation the assistant may not have created would
 * remove something the user already had.
 *
 * `context` is what the action itself produced — the id of a row it created,
 * typically. It is empty for actions that produced nothing, and an undo that
 * needs it says so rather than guessing from the payload.
 */
export async function undoAction(
  id: string,
  payload: Record<string, unknown>,
  context: Record<string, unknown> = {},
): Promise<ActionOutcome> {
  const undo = (UNDOS as Record<string, Undo | undefined>)[id];
  if (!undo) return { ok: false, error: 'Not reversible' };

  try {
    return await undo(payload, context);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Undo failed' };
  }
}

export type RouteTarget = { href: string; label: string; labelEl?: string };

/**
 * Resolves a destination for `navigate` against the whole page registry.
 *
 * `copilot-planner` matches 18 hand-written aliases, so 137 of the product's
 * 155 routes were unreachable by name even though `PAGE_REGISTRY` already
 * carries a bilingual title and description for every one of them. This reads
 * that registry instead of a second list, and the planner consults it only
 * after its own aliases miss, so every phrase that resolved before still
 * resolves to the same route.
 *
 * Longest title first, so "founder dashboard" is not captured by "dashboard".
 *
 * Resolution goes through `getPageMeta` rather than reading `PAGE_REGISTRY`
 * entries directly: only 2 of the ~100 entries spell `titleEl` inline, and the
 * other Greek titles live in `strings-pages.ts` and are merged in by that
 * function. Reading the raw array made every Greek phrase unresolvable.
 */
export function resolveRouteTarget(message: string): RouteTarget | undefined {
  const haystack = message.toLowerCase();

  const candidates = PAGE_REGISTRY.map((page) => getPageMeta(page.path) ?? page)
    .filter((page) => page.status !== 'scaffold')
    .flatMap((page) => {
      const names: Array<{ name: string; label: string; labelEl?: string }> = [
        { name: page.title.toLowerCase(), label: page.title, labelEl: page.titleEl },
      ];
      if (page.titleEl) {
        names.push({ name: page.titleEl.toLowerCase(), label: page.title, labelEl: page.titleEl });
      }
      return names.map((entry) => ({ ...entry, href: page.path }));
    })
    // A dynamic segment cannot be navigated to without an id, so it is not a
    // destination the assistant can offer from a phrase alone.
    .filter((entry) => !entry.href.includes('[') && entry.name.length >= 4)
    .sort((a, b) => b.name.length - a.name.length);

  const hit = candidates.find((entry) => haystack.includes(entry.name));
  return hit ? { href: hit.href, label: hit.label, labelEl: hit.labelEl } : undefined;
}
