import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  archiveWorkspace,
  assessReadiness,
  createEvent,
  createInvestorDeal,
  createMilestone,
  deleteInvestorDeal,
  deleteMilestone,
  getInvestorDeal,
  getMeProfile,
  getMilestone,
  listEvents,
  listMilestones,
  respondToConnectionRequest,
  rsvpEvent,
  updateInvestorDeal,
  updateMilestone,
  updateProfile,
  withdrawConnectionRequest,
  getOrCreateDirectConversation,
  removeFromShortlist,
  saveToShortlist,
  sendConnectionRequest,
  updateReadinessCriterion,
} from '@/lib/api';
import { createWorkspace } from '@/lib/builder-api';
import { demoCriterionState } from '@/lib/readiness-demo';
import { ACTION_DECLARATIONS, listActionIds } from '@cofounderbay/shared';
import {
  canExecute,
  executeAction,
  getActionSpec,
  isUndoable,
  listActions,
  resolveRouteTarget,
  toToolCatalog,
  undoAction,
} from './action-registry';
import { detectNavigateHref } from './copilot-planner';
import { PAGE_REGISTRY } from './page-registry';

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  sendConnectionRequest: vi.fn(),
  getOrCreateDirectConversation: vi.fn(),
  saveToShortlist: vi.fn(),
  removeFromShortlist: vi.fn(),
  assessReadiness: vi.fn(),
  updateReadinessCriterion: vi.fn(),
  archiveWorkspace: vi.fn(),
  withdrawConnectionRequest: vi.fn(),
  createInvestorDeal: vi.fn(),
  deleteInvestorDeal: vi.fn(),
  getInvestorDeal: vi.fn(),
  updateInvestorDeal: vi.fn(),
  getMeProfile: vi.fn(),
  updateProfile: vi.fn(),
  respondToConnectionRequest: vi.fn(),
  createMilestone: vi.fn(),
  getMilestone: vi.fn(),
  listMilestones: vi.fn(),
  updateMilestone: vi.fn(),
  deleteMilestone: vi.fn(),
  listEvents: vi.fn(),
  createEvent: vi.fn(),
  rsvpEvent: vi.fn(),
}));
// Not a showcase unless a test says so: the executors take a different path
// in demo mode, and every case below states which one it is exercising.
const demo = { on: false };
vi.mock('@/lib/preview-demo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/preview-demo')>()),
  isPreviewDemo: () => demo.on,
}));
vi.mock('@/lib/builder-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/builder-api')>()),
  createWorkspace: vi.fn(),
}));

const sendConnection = vi.mocked(sendConnectionRequest);
const openThread = vi.mocked(getOrCreateDirectConversation);
const shortlist = vi.mocked(saveToShortlist);
const unshortlist = vi.mocked(removeFromShortlist);
const readReadiness = vi.mocked(assessReadiness);
const writeCriterion = vi.mocked(updateReadinessCriterion);
const makeWorkspace = vi.mocked(createWorkspace);
const archiveWorkspaceMock = vi.mocked(archiveWorkspace);
const withdrawConnection = vi.mocked(withdrawConnectionRequest);
const trackDeal = vi.mocked(createInvestorDeal);
const untrackDeal = vi.mocked(deleteInvestorDeal);
const readDeal = vi.mocked(getInvestorDeal);
const patchDeal = vi.mocked(updateInvestorDeal);
const readProfile = vi.mocked(getMeProfile);
const patchProfile = vi.mocked(updateProfile);
const answerRequest = vi.mocked(respondToConnectionRequest);
const makeMilestone = vi.mocked(createMilestone);
const readMilestone = vi.mocked(getMilestone);
const readMilestones = vi.mocked(listMilestones);
const patchMilestone = vi.mocked(updateMilestone);
const removeMilestone = vi.mocked(deleteMilestone);
const readEvents = vi.mocked(listEvents);
const makeEvent = vi.mocked(createEvent);
const setRsvp = vi.mocked(rsvpEvent);

/** One dimension carrying a single criterion, in the state asked for. */
function assessment(completed: boolean) {
  return {
    assessment: {
      overallScore: 10,
      overallMax: 20,
      lastAssessedAt: null,
      acceleratorReadiness: 50,
      investorReadiness: 40,
      dimensions: [
        {
          id: 'd1',
          workspaceId: 'ws-1',
          dimension: 'team',
          score: 5,
          maxScore: 10,
          assessedAt: '2026-01-01T00:00:00.000Z',
          recommendations: [],
          criteria: [{ id: 'c1', name: 'Two founders committed', completed, weight: 1 }],
        },
      ],
    },
  } as Awaited<ReturnType<typeof assessReadiness>>;
}

const TYPES_SOURCE = readFileSync('src/lib/copilot-types.ts', 'utf8');
const TOPIC_KEYS_SOURCE = readFileSync('src/hooks/useAIChat.ts', 'utf8');
const CAPABILITIES_PAGE_SOURCE = readFileSync('src/app/ai/capabilities/page.tsx', 'utf8');
const PLANNER_SOURCE = readFileSync('src/lib/copilot-planner.ts', 'utf8');

/** The alias table as it is actually written, so the test cannot drift from it. */
const ALIASES = [...PLANNER_SOURCE.matchAll(/\{\s*keys:\s*\[([^\]]*)\],\s*href:\s*'([^']+)'/g)].map(
  (match) => ({
    keys: [...match[1].matchAll(/'([^']+)'/g)].map((k) => k[1]),
    href: match[2],
  }),
);

beforeEach(() => {
  sendConnection.mockReset();
  openThread.mockReset();
  shortlist.mockReset();
  unshortlist.mockReset();
  readReadiness.mockReset();
  writeCriterion.mockReset();
  makeWorkspace.mockReset();
  archiveWorkspaceMock.mockReset();
  withdrawConnection.mockReset();
  trackDeal.mockReset();
  untrackDeal.mockReset();
  readDeal.mockReset();
  patchDeal.mockReset();
  readProfile.mockReset();
  patchProfile.mockReset();
  answerRequest.mockReset();
  makeMilestone.mockReset();
  readMilestone.mockReset();
  readMilestones.mockReset();
  patchMilestone.mockReset();
  removeMilestone.mockReset();
  readEvents.mockReset();
  makeEvent.mockReset();
  setRsvp.mockReset();
  localStorage.clear();
  sessionStorage.clear();
  demo.on = false;
});

describe('action registry coverage', () => {
  it('carries an entry for every declared copilot tool', () => {
    const declared = [...listActionIds()];
    expect(declared.length).toBeGreaterThan(0);

    const missing = declared.filter((name) => !getActionSpec(name));
    expect(missing).toEqual([]);
  });

  it('marks every tool the app offers as a card a runnable mutation', () => {
    // `CopilotActionTool` is the subset the UI offers as a confirmable card,
    // and it is now `MutationActionId`. Each one has to be executable, or the
    // card confirms into nothing.
    const actionTools = listActions().filter((spec) => spec.kind === 'mutation').map((s) => s.id);
    expect(actionTools.length).toBeGreaterThan(0);

    const notRunnable = actionTools.filter((name) => !canExecute(name));
    expect(notRunnable).toEqual([]);
  });

  it('states a bilingual label, confirm label and reversal for every mutation', () => {
    const faults: string[] = [];

    for (const spec of listActions()) {
      for (const [field, pair] of [
        ['label', spec.label],
        ['description', spec.description],
      ] as const) {
        if (!pair.en.trim() || !pair.el.trim()) faults.push(`${spec.id}.${field} is not bilingual`);
        if (pair.en.trim() === pair.el.trim()) faults.push(`${spec.id}.${field} el duplicates en`);
      }

      if (spec.kind !== 'mutation') continue;

      // A mutation the user confirms has to say what the button does and what
      // taking it back involves. AGENTS.md is explicit that reversibility must
      // be stated from real API behaviour rather than assumed.
      if (!spec.confirmLabel?.en.trim() || !spec.confirmLabel?.el.trim()) {
        faults.push(`${spec.id} has no bilingual confirmLabel`);
      }
      if (!spec.reversal?.explanation.en.trim() || !spec.reversal?.explanation.el.trim()) {
        faults.push(`${spec.id} does not state how it is reversed`);
      }
    }

    expect(faults).toEqual([]);
  });

  it('derives its tool-name unions instead of restating them', () => {
    // These two unions were written out by hand and compared against the
    // declarations here, which caught drift only once a test ran. They are now
    // aliases of the derived ids, so a capability added to the shared package
    // is immediately representable and one removed stops compiling. This
    // asserts the derivation is still in place — re-hardcoding either union
    // would silently restore the drift this replaced.
    expect(TYPES_SOURCE).toMatch(/export type CopilotToolName = DeclaredActionId;/);
    expect(TYPES_SOURCE).toMatch(/export type CopilotActionTool = MutationActionId;/);

    const quotedNames = /export type Copilot(?:ToolName|ActionTool) =[^;]*'/;
    expect(TYPES_SOURCE).not.toMatch(quotedNames);
  });

  it('offers the three page capabilities the assistant needs to be more than a reader', () => {
    // Readiness could be read but not changed, Analytics could not be steered,
    // and a missing workspace was a dead end the assistant could only describe.
    for (const id of ['readiness_tick_criterion', 'analytics_set_period', 'workspace_create']) {
      const spec = getActionSpec(id);
      expect(spec, `${id} is not declared`).toBeDefined();
      expect(spec?.kind).toBe('mutation');
      expect(canExecute(id), `${id} has no executor`).toBe(true);
    }

    // Creating a workspace is reversible now that the outcome carries the id
    // it created: the undo archives that exact row rather than one by name.
    expect(isUndoable('workspace_create')).toBe(true);
    expect(isUndoable('canvas_command')).toBe(false);
    expect(isUndoable('readiness_tick_criterion')).toBe(true);
    expect(isUndoable('analytics_set_period')).toBe(true);
  });

  it('navigates only where the declaration says confirming should move the user', () => {
    // This used to be a pair of tool ids inside CopilotWorkspace.
    const navigates = listActions().filter((spec) => spec.navigatesOnSuccess).map((s) => s.id).sort();
    expect(navigates).toEqual(
      ['analytics_set_period', 'apply_to_program', 'canvas_command', 'create_event', 'create_milestone', 'draft_event', 'draft_founder_update', 'draft_milestone', 'draft_need_card', 'draft_profile', 'draft_project', 'draft_scout_brief', 'join_group', 'leave_group', 'navigate', 'readiness_tick_criterion', 'rsvp_event', 'send_invite', 'start_or_send_message', 'update_profile', 'workspace_create'],
    );

    // Saving to a shortlist reports where the result can be seen without
    // taking the user off the page they were reading.
    expect(getActionSpec('shortlist_add')?.navigatesOnSuccess).toBeFalsy();
    expect(getActionSpec('shortlist_remove')?.navigatesOnSuccess).toBeFalsy();
    expect(getActionSpec('send_connection')?.navigatesOnSuccess).toBeFalsy();
  });

  it('binds an executor to every declared mutation', () => {
    // The Record<MutationActionId, …> in action-registry makes this a compile
    // error too. Asserted here as well so the failure names the capability.
    const unbound = listActions()
      .filter((spec) => spec.kind === 'mutation' && !canExecute(spec.id))
      .map((spec) => spec.id);

    expect(unbound).toEqual([]);
  });

  it('backs every claim of reversibility with a working undo', () => {
    // The first version of this registry claimed send_connection could be
    // "withdrawn in Connections". ConnectionsController has no withdraw route
    // for the sender at all, so the claim was simply false. The union type now
    // makes `full`/`partial` require an undo function, and this asserts the
    // same thing at runtime plus its converse: a `none` must not smuggle one in.
    const faults: string[] = [];

    for (const spec of listActions()) {
      const reversal = spec.reversal;
      if (!reversal) continue;

      // The declaration states the claim; the app holds the implementation.
      // Comparing the two across the package boundary is the check that the
      // discriminated union used to perform inside a single object.
      const claimsReversible = reversal.kind !== 'none';

      if (isUndoable(spec.id) !== claimsReversible) {
        faults.push(
          `${spec.id}: declares kind="${reversal.kind}" but the app ${
            isUndoable(spec.id) ? 'binds' : 'binds no'
          } undo`,
        );
      }
    }

    expect(faults).toEqual([]);
  });

  it('states a reversal for every mutation that writes', () => {
    const silent = listActions().filter((spec) => spec.writes && !spec.reversal).map((s) => s.id);
    expect(silent).toEqual([]);
  });

  it('never marks a read tool as writing', () => {
    const wrong = listActions().filter((spec) => spec.kind === 'read' && spec.writes).map((s) => s.id);
    expect(wrong).toEqual([]);
  });
});

describe('model tool catalogue', () => {
  it('derives one well-formed entry per registry action', () => {
    const catalog = toToolCatalog();
    expect(catalog).toHaveLength(ACTION_DECLARATIONS.length);

    const faults: string[] = [];
    for (const entry of catalog) {
      const spec = getActionSpec(entry.function.name);
      if (!spec) {
        faults.push(`${entry.function.name} is not in the registry`);
        continue;
      }
      if (entry.type !== 'function') faults.push(`${spec.id} is not declared as a function`);
      if (!entry.function.description.trim()) faults.push(`${spec.id} has an empty description`);

      const properties = Object.keys(entry.function.parameters.properties);
      expect(properties.sort()).toEqual(spec.params.map((p) => p.name).sort());

      // A required name the properties do not define would make the model emit
      // an argument the executor cannot read.
      const orphanRequired = entry.function.parameters.required.filter((n) => !properties.includes(n));
      if (orphanRequired.length) faults.push(`${spec.id} requires undefined args: ${orphanRequired.join(', ')}`);
    }

    expect(faults).toEqual([]);
  });

  it('exposes each tool name exactly once', () => {
    const names = toToolCatalog().map((entry) => entry.function.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('executing registry actions', () => {
  it('navigates to the requested href and falls back to the dashboard', async () => {
    await expect(executeAction('navigate', { href: '/matches' })).resolves.toEqual({
      ok: true,
      href: '/matches',
    });
    await expect(executeAction('navigate', {})).resolves.toEqual({ ok: true, href: '/dashboard' });
  });

  it('refuses external, protocol-relative and backslash navigation targets', async () => {
    for (const href of ['javascript:alert(1)', 'https://example.com', '//example.com', '/\\example.com']) {
      await expect(executeAction('navigate', { href })).resolves.toEqual({
        ok: false,
        error: 'Only internal CoFounderBay routes can be opened',
      });
    }
    await expect(executeAction('navigate', { href: '/matches?role=founder#top' })).resolves.toEqual({
      ok: true,
      href: '/matches?role=founder#top',
    });
  });

  it('parks a canvas command and opens Research when no board is listening', async () => {
    await expect(executeAction('canvas_command', { op: 'not-a-step' })).resolves.toEqual({
      ok: false,
      error: 'Unknown canvas command',
    });
    await expect(executeAction('canvas_command', { op: 'add_note', title: 'Pricing' })).resolves.toEqual({
      ok: true,
      href: '/research',
    });
    await expect(
      executeAction('canvas_command', { op: 'fit_view', boardId: 'board-gtm' }),
    ).resolves.toEqual({ ok: true, href: '/research/board-gtm' });
  });

  it('hands a canvas command to the open board instead of only navigating', async () => {
    const { registerCanvasCommandHandler } = await import('@/lib/canvas/canvas-command-bus');
    const unsub = registerCanvasCommandHandler(async (req) => ({
      ok: true,
      href: `/research/live?op=${req.op}`,
    }));
    try {
      await expect(executeAction('canvas_command', { op: 'align', align: 'left' })).resolves.toEqual({
        ok: true,
        href: '/research/live?op=align',
      });
    } finally {
      unsub();
    }
  });

  it('saves to the shortlist and reports where it landed', async () => {
    await expect(executeAction('shortlist_add', { userId: 'u1' })).resolves.toEqual({
      ok: true,
      href: '/shortlist',
    });
    expect(shortlist).toHaveBeenCalledExactlyOnceWith('u1');
  });

  it('takes a profile off the shortlist the same way it put it on', async () => {
    await expect(executeAction('shortlist_remove', { userId: 'u1' })).resolves.toEqual({
      ok: true,
      href: '/shortlist',
    });
    expect(unshortlist).toHaveBeenCalledExactlyOnceWith('u1');
  });

  it('sends a connection with the optional note preserved, and keeps the id for the undo', async () => {
    sendConnection.mockResolvedValue({
      connection: { id: 'conn-7' },
    } as Awaited<ReturnType<typeof sendConnectionRequest>>);

    await expect(
      executeAction('send_connection', { receiverId: 'u2', message: 'hello' }),
    ).resolves.toEqual({ ok: true, undo: { connectionId: 'conn-7' } });
    expect(sendConnection).toHaveBeenCalledExactlyOnceWith({ receiverId: 'u2', message: 'hello' });
  });

  it('still reports a sent intro when the response carries no connection', async () => {
    // `apiRequest` casts without checking, so a thinner response must not turn
    // a request that was actually sent into an error the user sees.
    await expect(
      executeAction('send_connection', { receiverId: 'u2' }),
    ).resolves.toEqual({ ok: true });
  });

  it('drops a non-string note rather than sending it', async () => {
    await executeAction('send_connection', { receiverId: 'u2', message: 42 });
    expect(sendConnection).toHaveBeenCalledExactlyOnceWith({ receiverId: 'u2', message: undefined });
  });

  it('opens a thread and returns the conversation it resolved', async () => {
    openThread.mockResolvedValue({ conversationId: 'c9' } as Awaited<ReturnType<typeof getOrCreateDirectConversation>>);
    await expect(executeAction('start_or_send_message', { userId: 'u3' })).resolves.toEqual({
      ok: true,
      href: '/messages?c=c9',
    });
    expect(openThread).toHaveBeenCalledExactlyOnceWith('u3');
  });

  it('refuses a mutation with no subject, without calling the API', async () => {
    await expect(executeAction('shortlist_add', {})).resolves.toEqual({
      ok: false,
      error: 'Missing user',
    });
    await expect(executeAction('shortlist_remove', {})).resolves.toEqual({
      ok: false,
      error: 'Missing user',
    });
    await expect(executeAction('send_connection', {})).resolves.toEqual({
      ok: false,
      error: 'Missing receiver',
    });
    await expect(executeAction('start_or_send_message', {})).resolves.toEqual({
      ok: false,
      error: 'Missing user',
    });

    expect(shortlist).not.toHaveBeenCalled();
    expect(unshortlist).not.toHaveBeenCalled();
    expect(sendConnection).not.toHaveBeenCalled();
    expect(openThread).not.toHaveBeenCalled();
  });

  it('reports a read tool and an unknown id as unsupported', async () => {
    await expect(executeAction('get_graph', {})).resolves.toEqual({
      ok: false,
      error: 'Unsupported action',
    });
    await expect(executeAction('definitely_not_a_tool', {})).resolves.toEqual({
      ok: false,
      error: 'Unsupported action',
    });
  });

  it('ticks a readiness criterion on the workspace the page itself uses', async () => {
    localStorage.setItem('cfb_default_workspace', 'ws-1');
    readReadiness.mockResolvedValue(assessment(false));

    await expect(
      executeAction('readiness_tick_criterion', { dimension: 'team', criterionId: 'c1', completed: true }),
    ).resolves.toEqual({ ok: true, href: '/readiness' });

    expect(readReadiness).toHaveBeenCalledExactlyOnceWith({ workspaceId: 'ws-1' });
    expect(writeCriterion).toHaveBeenCalledExactlyOnceWith('ws-1', {
      dimension: 'team',
      criterionId: 'c1',
      completed: true,
    });
  });

  it('refuses to tick a criterion that is already met, so the undo cannot clear it', async () => {
    // Without this the tool would be a silent no-op and its undo would clear a
    // box the user ticked themselves — the undo is handed the payload, not the
    // state that was there before.
    localStorage.setItem('cfb_default_workspace', 'ws-1');
    readReadiness.mockResolvedValue(assessment(true));

    await expect(
      executeAction('readiness_tick_criterion', { dimension: 'team', criterionId: 'c1', completed: true }),
    ).resolves.toEqual({ ok: false, error: 'That criterion is already met' });
    expect(writeCriterion).not.toHaveBeenCalled();
  });

  it('refuses an unknown dimension or criterion without writing anything', async () => {
    localStorage.setItem('cfb_default_workspace', 'ws-1');
    readReadiness.mockResolvedValue(assessment(false));

    await expect(
      executeAction('readiness_tick_criterion', { dimension: 'vibes', criterionId: 'c1', completed: true }),
    ).resolves.toEqual({ ok: false, error: 'Unknown readiness dimension' });
    expect(readReadiness).not.toHaveBeenCalled();

    await expect(
      executeAction('readiness_tick_criterion', { dimension: 'team', criterionId: 'nope', completed: true }),
    ).resolves.toEqual({ ok: false, error: 'That criterion is not part of this dimension' });
    expect(writeCriterion).not.toHaveBeenCalled();
  });

  it('says a workspace is needed rather than guessing one', async () => {
    await expect(
      executeAction('readiness_tick_criterion', { dimension: 'team', criterionId: 'c1', completed: true }),
    ).resolves.toEqual({
      ok: false,
      error: 'No workspace selected. Create one first, then tick criteria.',
    });
    expect(readReadiness).not.toHaveBeenCalled();
  });

  it('creates a workspace and selects it, which is what unblocks Readiness', async () => {
    makeWorkspace.mockResolvedValue({ id: 'ws-new', name: 'Helios' } as Awaited<ReturnType<typeof createWorkspace>>);

    await expect(
      executeAction('workspace_create', { name: '  Helios  ', description: 'Solar ops' }),
      // The id comes back on the outcome so the undo can archive this exact
      // workspace instead of guessing by name.
    ).resolves.toEqual({ ok: true, href: '/readiness', undo: { workspaceId: 'ws-new' } });

    expect(makeWorkspace).toHaveBeenCalledExactlyOnceWith({
      name: 'Helios',
      description: 'Solar ops',
      startupName: undefined,
    });
    // Creating one and leaving it unselected would leave the page showing the
    // same empty card it showed before.
    expect(localStorage.getItem('cfb_default_workspace')).toBe('ws-new');
  });

  it('tracks a startup and keeps the id it created for the undo', async () => {
    trackDeal.mockResolvedValue({ deal: { id: 'deal-9' } } as Awaited<ReturnType<typeof createInvestorDeal>>);

    await expect(
      executeAction('investor_track_startup', { name: '  NeuralFlow  ', industry: 'AI/ML' }),
    ).resolves.toEqual({ ok: true, href: '/investor/watchlist', undo: { dealId: 'deal-9' } });

    expect(trackDeal).toHaveBeenCalledExactlyOnceWith({
      name: 'NeuralFlow',
      industry: 'AI/ML',
      notes: undefined,
    });
  });

  it('reads where a deal was before moving it, so the undo has somewhere to go', async () => {
    readDeal.mockResolvedValue({
      deal: { id: 'deal-9', pipelineStage: 'reviewing' },
    } as Awaited<ReturnType<typeof getInvestorDeal>>);

    await expect(
      executeAction('investor_move_stage', { dealId: 'deal-9', pipelineStage: 'due_diligence' }),
    ).resolves.toEqual({
      ok: true,
      href: '/investor/pipeline',
      undo: { dealId: 'deal-9', fromStage: 'reviewing' },
    });

    expect(patchDeal).toHaveBeenCalledExactlyOnceWith('deal-9', { pipelineStage: 'due_diligence' });
  });

  it('refuses a move to the stage the deal is already in, before writing', async () => {
    // Without this the undo would offer to "return" the deal to where it still
    // is, and the board would record a stage change that never happened.
    readDeal.mockResolvedValue({
      deal: { id: 'deal-9', pipelineStage: 'meeting' },
    } as Awaited<ReturnType<typeof getInvestorDeal>>);

    await expect(
      executeAction('investor_move_stage', { dealId: 'deal-9', pipelineStage: 'meeting' }),
    ).resolves.toEqual({ ok: false, error: 'That deal is already at that stage' });
    expect(patchDeal).not.toHaveBeenCalled();
  });

  it('refuses an unknown pipeline stage before reaching the API', async () => {
    await expect(
      executeAction('investor_move_stage', { dealId: 'deal-9', pipelineStage: 'nope' }),
    ).resolves.toEqual({ ok: false, error: 'Unknown pipeline stage' });
    expect(readDeal).not.toHaveBeenCalled();
  });

  it('refuses a nameless or over-long workspace before reaching the API', async () => {
    await expect(executeAction('workspace_create', { name: '   ' })).resolves.toEqual({
      ok: false,
      error: 'Missing workspace name',
    });
    await expect(executeAction('workspace_create', { name: 'x'.repeat(101) })).resolves.toEqual({
      ok: false,
      error: 'Workspace name is too long (100 characters)',
    });
    expect(makeWorkspace).not.toHaveBeenCalled();
  });

  it('turns an analytics window into a linkable address and rejects any other', async () => {
    await expect(executeAction('analytics_set_period', { period: '30d' })).resolves.toEqual({
      ok: true,
      href: '/analytics?period=30d',
    });
    await expect(executeAction('analytics_set_period', { period: 'all-time' })).resolves.toEqual({
      ok: false,
      error: 'Unknown period',
    });
  });

  it('ticks a showcase criterion in the session rather than refusing it', async () => {
    // The demo is the only readiness page a visitor without an account sees.
    // It has no workspace by design, so an executor that demanded one made the
    // assistant a narrator of a page it could not touch.
    demo.on = true;

    await expect(
      executeAction('readiness_tick_criterion', { dimension: 'market', criterionId: 'm3', completed: true }),
    ).resolves.toEqual({ ok: true, href: '/readiness' });

    // Written to the session, and nothing was asked of the API.
    expect(demoCriterionState('market', 'm3')).toBe(true);
    expect(readReadiness).not.toHaveBeenCalled();
    expect(writeCriterion).not.toHaveBeenCalled();
  });

  it('applies the same no-op and unknown-criterion refusals to the showcase', async () => {
    demo.on = true;

    // 'm1' ships already met in the seed.
    await expect(
      executeAction('readiness_tick_criterion', { dimension: 'market', criterionId: 'm1', completed: true }),
    ).resolves.toEqual({ ok: false, error: 'That criterion is already met' });

    await expect(
      executeAction('readiness_tick_criterion', { dimension: 'market', criterionId: 'zzz', completed: true }),
    ).resolves.toEqual({ ok: false, error: 'That criterion is not part of this dimension' });
  });

  it('undoes a showcase tick back to the seed', async () => {
    demo.on = true;
    await executeAction('readiness_tick_criterion', { dimension: 'market', criterionId: 'm3', completed: true });

    await expect(
      undoAction('readiness_tick_criterion', { dimension: 'market', criterionId: 'm3', completed: true }),
    ).resolves.toEqual({ ok: true, href: '/readiness' });
    expect(demoCriterionState('market', 'm3')).toBe(false);
  });

  it('says the showcase needs no workspace instead of calling an endpoint that will refuse', async () => {
    demo.on = true;
    await expect(executeAction('workspace_create', { name: 'Helios' })).resolves.toEqual({
      ok: false,
      error: 'The demo showcase already has a workspace. Sign in to create your own.',
    });
    expect(makeWorkspace).not.toHaveBeenCalled();
  });

  it('surfaces a failing API call as an error instead of throwing', async () => {
    shortlist.mockRejectedValue(new Error('rate limited'));
    await expect(executeAction('shortlist_add', { userId: 'u1' })).resolves.toEqual({
      ok: false,
      error: 'rate limited',
    });
  });
});

describe('undoing registry actions', () => {
  it('takes a shortlist entry back off the list', async () => {
    await expect(undoAction('shortlist_add', { userId: 'u1' })).resolves.toEqual({
      ok: true,
      href: '/shortlist',
    });
    expect(unshortlist).toHaveBeenCalledExactlyOnceWith('u1');
  });

  it('puts a removed shortlist entry back on', async () => {
    await expect(undoAction('shortlist_remove', { userId: 'u1' })).resolves.toEqual({
      ok: true,
      href: '/shortlist',
    });
    expect(shortlist).toHaveBeenCalledExactlyOnceWith('u1');
  });

  it('withdraws the intro it sent, by the id the send returned', async () => {
    await expect(
      undoAction('send_connection', { receiverId: 'u2' }, { connectionId: 'conn-7' }),
    ).resolves.toEqual({ ok: true, href: '/connections' });

    expect(withdrawConnection).toHaveBeenCalledExactlyOnceWith('conn-7');
    // Never the receiver's PATCH, which would be rejected as Forbidden.
    expect(sendConnection).not.toHaveBeenCalled();
  });

  it('refuses to withdraw an intro whose id it never saw', async () => {
    // Looking the request up by the pair of people would be a guess: the two
    // may have had an earlier request between them.
    await expect(undoAction('send_connection', { receiverId: 'u2' })).resolves.toEqual({
      ok: false,
      error: 'No request to withdraw',
    });
    expect(withdrawConnection).not.toHaveBeenCalled();
  });

  it('refuses to undo opening a thread rather than archiving the user’s own', async () => {
    // getOrCreateDirectConversation returns the same shape whether it created
    // the thread or found one, so an undo cannot tell those apart.
    await expect(undoAction('start_or_send_message', { userId: 'u3' })).resolves.toEqual({
      ok: false,
      error: 'Not reversible',
    });
    expect(openThread).not.toHaveBeenCalled();
  });

  it('puts a readiness criterion back, and refuses if the user changed it first', async () => {
    localStorage.setItem('cfb_default_workspace', 'ws-1');
    readReadiness.mockResolvedValue(assessment(true));

    await expect(
      undoAction('readiness_tick_criterion', { dimension: 'team', criterionId: 'c1', completed: true }),
    ).resolves.toEqual({ ok: true, href: '/readiness' });
    expect(writeCriterion).toHaveBeenCalledExactlyOnceWith('ws-1', {
      dimension: 'team',
      criterionId: 'c1',
      completed: false,
    });

    // The user has since cleared it by hand: the undo has nothing to take back.
    writeCriterion.mockClear();
    readReadiness.mockResolvedValue(assessment(false));
    await expect(
      undoAction('readiness_tick_criterion', { dimension: 'team', criterionId: 'c1', completed: true }),
    ).resolves.toEqual({ ok: false, error: 'That criterion is already clear' });
    expect(writeCriterion).not.toHaveBeenCalled();
  });

  it('returns the analytics page to the window it opens on', async () => {
    await expect(undoAction('analytics_set_period', { period: '90d' })).resolves.toEqual({
      ok: true,
      href: '/analytics',
    });
  });

  it('removes the deal it created, by id', async () => {
    await expect(
      undoAction('investor_track_startup', { name: 'NeuralFlow' }, { dealId: 'deal-9' }),
    ).resolves.toEqual({ ok: true, href: '/investor/watchlist' });
    expect(untrackDeal).toHaveBeenCalledExactlyOnceWith('deal-9');
  });

  it('returns a moved deal to the stage it actually came from', async () => {
    await expect(
      undoAction(
        'investor_move_stage',
        { dealId: 'deal-9', pipelineStage: 'due_diligence' },
        { dealId: 'deal-9', fromStage: 'reviewing' },
      ),
    ).resolves.toEqual({ ok: true, href: '/investor/pipeline' });
    expect(patchDeal).toHaveBeenCalledExactlyOnceWith('deal-9', { pipelineStage: 'reviewing' });
  });

  it('refuses to undo a move whose previous stage it never saw', async () => {
    await expect(
      undoAction('investor_move_stage', { dealId: 'deal-9', pipelineStage: 'invested' }),
    ).resolves.toEqual({ ok: false, error: 'No previous stage to return to' });
    expect(patchDeal).not.toHaveBeenCalled();
  });

  it('archives the workspace it created, by id, and clears the selection', async () => {
    window.localStorage.setItem('cfb_default_workspace', 'ws-new');

    await expect(
      undoAction('workspace_create', { name: 'Helios' }, { workspaceId: 'ws-new' }),
    ).resolves.toEqual({ ok: true, href: '/builder' });

    expect(archiveWorkspaceMock).toHaveBeenCalledWith('ws-new');
    // Leaving an archived workspace selected would send /readiness to one that
    // is no longer in the list.
    expect(window.localStorage.getItem('cfb_default_workspace')).toBeNull();
  });

  it('leaves a different selected workspace alone when it archives', async () => {
    window.localStorage.setItem('cfb_default_workspace', 'ws-mine');

    await expect(
      undoAction('workspace_create', { name: 'Helios' }, { workspaceId: 'ws-new' }),
    ).resolves.toEqual({ ok: true, href: '/builder' });

    expect(archiveWorkspaceMock).toHaveBeenCalledWith('ws-new');
    expect(window.localStorage.getItem('cfb_default_workspace')).toBe('ws-mine');
  });

  it('refuses to archive when the outcome carried no id, rather than guessing by name', async () => {
    await expect(undoAction('workspace_create', { name: 'Helios' })).resolves.toEqual({
      ok: false,
      error: 'No workspace to archive',
    });
    expect(archiveWorkspaceMock).not.toHaveBeenCalled();
  });

  it('refuses an unknown id and a read tool', async () => {
    await expect(undoAction('get_graph', {})).resolves.toEqual({
      ok: false,
      error: 'Not reversible',
    });
    await expect(undoAction('nope', {})).resolves.toEqual({
      ok: false,
      error: 'Not reversible',
    });
  });

  it('requires a subject and reports a failing undo instead of throwing', async () => {
    await expect(undoAction('shortlist_add', {})).resolves.toEqual({
      ok: false,
      error: 'Missing user',
    });
    expect(unshortlist).not.toHaveBeenCalled();

    unshortlist.mockRejectedValue(new Error('offline'));
    await expect(undoAction('shortlist_add', { userId: 'u1' })).resolves.toEqual({
      ok: false,
      error: 'offline',
    });
  });

  it('makes every mutation say what it makes stale', () => {
    // The app used to decide this at the call site, in a chain of
    // `if (tool === …)` that covered four of the nine mutations: ticking a
    // readiness criterion or creating a workspace refreshed nothing, so a page
    // open beside the chat kept showing the state from before.
    // `listActions()` rather than `ACTION_DECLARATIONS`: the const assertion
    // gives each entry its own literal type, which omits optional fields the
    // read declarations do not carry.
    const missing = listActions()
      .filter((spec) => spec.kind === 'mutation')
      .filter((spec) => !Array.isArray(spec.invalidates))
      .map((spec) => spec.id);

    expect(missing, 'mutations with no `invalidates`').toEqual([]);
  });

  it('binds every declared invalidation topic to real query keys', () => {
    // `TOPIC_KEYS` is a Record over the topic union, so a topic with no entry
    // fails to compile. This catches the other direction: a topic declared on
    // a capability that nobody bound, which would refresh nothing in silence.
    const declared = new Set(
      listActions().flatMap((spec) => [...(spec.invalidates ?? [])]),
    );
    for (const topic of declared) {
      expect(TOPIC_KEYS_SOURCE, `${topic} has no query keys bound to it`).toContain(`  ${topic}:`);
    }
    expect(declared.size).toBeGreaterThan(0);
  });

  it('gives every capability a sample ask on the capabilities page', () => {
    // The page is generated from the contract, but the example beside each
    // capability is hand-written: a new capability with no example renders as
    // a card that cannot tell you how to use it.
    const missing = [...listActionIds()].filter(
      (id) => !CAPABILITIES_PAGE_SOURCE.includes(`  ${id}: {`),
    );
    expect(missing, 'capabilities with no sample ask').toEqual([]);
  });

  it('reports exactly which tools can be taken back', () => {
    expect(isUndoable('shortlist_add')).toBe(true);
    expect(isUndoable('shortlist_remove')).toBe(true);
    expect(isUndoable('send_connection')).toBe(true);
    expect(isUndoable('workspace_create')).toBe(true);
    expect(isUndoable('start_or_send_message')).toBe(false);
    expect(isUndoable('navigate')).toBe(false);
    expect(isUndoable('get_graph')).toBe(false);
  });
});

describe('route resolution', () => {
  it('keeps every existing alias resolving to exactly the route it did before', () => {
    expect(ALIASES.length).toBeGreaterThanOrEqual(18);
    const regressions: string[] = [];

    for (const alias of ALIASES) {
      for (const key of alias.keys) {
        const message = `open ${key}`;
        // Replicates the planner's own first-match-wins semantics, so a key
        // that a earlier alias already claimed is judged against that alias.
        const expected = ALIASES.find((candidate) =>
          candidate.keys.some((k) => message.toLowerCase().includes(k)),
        );
        const resolved = detectNavigateHref(message);

        if (!resolved) regressions.push(`"${message}" no longer resolves`);
        else if (resolved.href !== expected?.href) {
          regressions.push(`"${message}" resolved to ${resolved.href}, expected ${expected?.href}`);
        }
      }
    }

    expect(regressions).toEqual([]);
  });

  it('reaches pages the alias table never covered', () => {
    // The aliases know 18 destinations; these are real routes carrying a
    // PAGE_REGISTRY title that no alias key matches.
    expect(resolveRouteTarget('open the pitch deck')?.href).toBe('/builder/pitch-deck');
    expect(resolveRouteTarget('take me to program applications')?.href).toBe('/builder/applications');

    // And the planner returns them too, not just the resolver.
    expect(detectNavigateHref('take me to program applications')?.href).toBe('/builder/applications');
  });

  it('still prefers an alias over a more specific registry title', () => {
    // 'pitch' is an alias key for /builder, so "pitch deck" keeps resolving to
    // /builder through the planner even though the resolver alone would reach
    // /builder/pitch-deck. Aliases are consulted first precisely so no phrase
    // changes destination, and this records that trade rather than hiding it.
    expect(detectNavigateHref('open the pitch deck')?.href).toBe('/builder');
  });

  it('resolves Greek titles as well as English ones', () => {
    const byGreek = resolveRouteTarget('άνοιξε τα ορόσημα');
    expect(byGreek?.href).toBe('/milestones');
  });

  it('never offers a route that needs an id', () => {
    const dynamic: string[] = [];
    for (const phrase of ['open profile', 'open match', 'open project', 'open conversation']) {
      const target = resolveRouteTarget(phrase);
      if (target?.href.includes('[')) dynamic.push(`${phrase} -> ${target.href}`);
    }
    expect(dynamic).toEqual([]);
  });

  it('reaches far more destinations by name than the alias table did', () => {
    // Asking for each registered page by its own title is the closest thing to
    // a coverage measure for "can the assistant get the user there by name".
    const reachable = new Set<string>();
    for (const page of PAGE_REGISTRY) {
      if (page.path.includes('[')) continue;
      const resolved = resolveRouteTarget(`open ${page.title}`);
      if (resolved) reachable.add(resolved.href);
    }

    const aliasRoutes = new Set(ALIASES.map((alias) => alias.href));
    expect(aliasRoutes.size).toBeLessThanOrEqual(18);
    expect(reachable.size).toBeGreaterThan(aliasRoutes.size * 3);
  });

  it('returns nothing rather than guessing', () => {
    expect(resolveRouteTarget('qqqq zzzz not a page at all')).toBeUndefined();
    expect(detectNavigateHref('what should I do next')).toBeUndefined();
  });
});

describe('profile writes', () => {
  it('patches only the declared fields and keeps the previous values for the undo', async () => {
    readProfile.mockResolvedValue({
      profile: {
        id: 'p1',
        userId: 'u1',
        displayName: 'Alex',
        headline: 'Old headline',
        bio: null,
        location: 'Athens',
        timezone: 'Europe/Athens',
        languages: null,
        avatarUrl: null,
        rolePayload: null,
        visibilityRules: null,
        role: 'founder',
        skills: [],
        createdAt: '',
        updatedAt: '',
      },
      hasCompletedOnboarding: true,
    });
    patchProfile.mockResolvedValue({} as Awaited<ReturnType<typeof updateProfile>>);

    const outcome = await executeAction('update_profile', {
      headline: 'New headline',
      location: 'Berlin',
      // Not a declared field — dropped, never sent.
      email: 'nobody@example.com',
    });

    expect(outcome.ok).toBe(true);
    expect(patchProfile).toHaveBeenCalledWith({ headline: 'New headline', location: 'Berlin' });
    expect(outcome.undo).toEqual({ prior: { headline: 'Old headline', location: 'Athens' } });
  });

  it('writes the read-back values back on undo, including empty fields', async () => {
    patchProfile.mockResolvedValue({} as Awaited<ReturnType<typeof updateProfile>>);
    const undone = await undoAction('update_profile', {}, { prior: { headline: 'Old', bio: '' } });
    expect(undone.ok).toBe(true);
    expect(patchProfile).toHaveBeenCalledWith({ headline: 'Old', bio: '' });
  });

  it('refuses an empty payload and a demo profile before reaching the API', async () => {
    expect((await executeAction('update_profile', {})).ok).toBe(false);
    demo.on = true;
    expect((await executeAction('update_profile', { headline: 'x' })).ok).toBe(false);
    expect(patchProfile).not.toHaveBeenCalled();
  });
});

describe('connection writes', () => {
  it('answers a pending request with the decision asked for', async () => {
    answerRequest.mockResolvedValue({ connection: { id: 'c1' } } as Awaited<ReturnType<typeof respondToConnectionRequest>>);
    const outcome = await executeAction('respond_to_connection', { connectionId: 'c1', decision: 'accepted' });
    expect(outcome.ok).toBe(true);
    expect(answerRequest).toHaveBeenCalledWith('c1', 'accepted');
  });

  it('refuses an unknown decision and cannot be undone', async () => {
    expect((await executeAction('respond_to_connection', { connectionId: 'c1', decision: 'maybe' })).ok).toBe(false);
    expect(answerRequest).not.toHaveBeenCalled();
    expect(isUndoable('respond_to_connection')).toBe(false);
    expect((await undoAction('respond_to_connection', { connectionId: 'c1' })).ok).toBe(false);
  });
});

describe('milestone writes', () => {
  it('creates a milestone and keeps the id it made for the undo', async () => {
    makeMilestone.mockResolvedValue({ id: 'm1' } as Awaited<ReturnType<typeof createMilestone>>);
    const outcome = await executeAction('create_milestone', {
      title: 'Close pre-seed',
      dueDate: '2026-06-01',
      priority: 'high',
      // Not a declared priority value — dropped, not sent.
      notes: 'ignored field is fine to drop',
    });
    expect(outcome.ok).toBe(true);
    expect(outcome.undo).toEqual({ milestoneId: 'm1' });
    expect(makeMilestone).toHaveBeenCalledWith({
      title: 'Close pre-seed',
      dueDate: '2026-06-01',
      priority: 'high',
    });

    removeMilestone.mockResolvedValue({ ok: true });
    expect((await undoAction('create_milestone', {}, outcome.undo)).ok).toBe(true);
    expect(removeMilestone).toHaveBeenCalledWith('m1');
  });

  it('refuses a titleless milestone before reaching the API', async () => {
    expect((await executeAction('create_milestone', {})).ok).toBe(false);
    expect(makeMilestone).not.toHaveBeenCalled();
  });

  it('reads the milestone before moving it, so the undo restores where it was', async () => {
    readMilestone.mockResolvedValue({ id: 'm1', status: 'todo' } as Awaited<ReturnType<typeof getMilestone>>);
    patchMilestone.mockResolvedValue({ id: 'm1', status: 'completed' } as Awaited<ReturnType<typeof updateMilestone>>);

    const outcome = await executeAction('update_milestone_status', { milestoneId: 'm1', status: 'completed' });
    expect(outcome.ok).toBe(true);
    expect(patchMilestone).toHaveBeenCalledWith('m1', { status: 'completed' });
    expect(outcome.undo).toEqual({ milestoneId: 'm1', fromStatus: 'todo' });

    patchMilestone.mockResolvedValue({ id: 'm1', status: 'todo' } as Awaited<ReturnType<typeof updateMilestone>>);
    expect((await undoAction('update_milestone_status', {}, outcome.undo)).ok).toBe(true);
    expect(patchMilestone).toHaveBeenLastCalledWith('m1', { status: 'todo' });
  });

  it('resolves a milestone by exact title when the id is not known', async () => {
    readMilestones.mockResolvedValue({
      milestones: [{ id: 'm9', title: 'Ship MVP', status: 'in_progress' }],
      nextCursor: null,
      total: 1,
    } as Awaited<ReturnType<typeof listMilestones>>);
    readMilestone.mockResolvedValue({ id: 'm9', status: 'in_progress' } as Awaited<ReturnType<typeof getMilestone>>);
    patchMilestone.mockResolvedValue({ id: 'm9', status: 'completed' } as Awaited<ReturnType<typeof updateMilestone>>);

    const outcome = await executeAction('update_milestone_status', { title: 'Ship MVP', status: 'completed' });
    expect(outcome.ok).toBe(true);
    expect(patchMilestone).toHaveBeenCalledWith('m9', { status: 'completed' });
  });

  it('refuses a no-op status and an unknown milestone without writing', async () => {
    readMilestone.mockResolvedValue({ id: 'm1', status: 'completed' } as Awaited<ReturnType<typeof getMilestone>>);
    expect((await executeAction('update_milestone_status', { milestoneId: 'm1', status: 'completed' })).ok).toBe(false);

    readMilestones.mockResolvedValue({ milestones: [], nextCursor: null, total: 0 } as Awaited<ReturnType<typeof listMilestones>>);
    expect((await executeAction('update_milestone_status', { title: 'Nope', status: 'completed' })).ok).toBe(false);
    expect(patchMilestone).not.toHaveBeenCalled();
  });
});

describe('event writes', () => {
  it('sets an RSVP by id and keeps the status it replaced for the undo', async () => {
    readEvents.mockResolvedValue({
      events: [{ id: 'e1', title: 'Demo Day', viewerRsvp: 'interested' }],
    } as Awaited<ReturnType<typeof listEvents>>);
    setRsvp.mockResolvedValue({ ok: true, status: 'going' });

    const outcome = await executeAction('rsvp_event', { eventId: 'e1', status: 'going' });
    expect(outcome.ok).toBe(true);
    expect(setRsvp).toHaveBeenCalledWith('e1', 'going');
    expect(outcome.undo).toEqual({ eventId: 'e1', priorStatus: 'interested' });

    setRsvp.mockResolvedValue({ ok: true, status: 'interested' });
    expect((await undoAction('rsvp_event', {}, outcome.undo)).ok).toBe(true);
    expect(setRsvp).toHaveBeenLastCalledWith('e1', 'interested');
  });

  it('resolves an event by exact title and falls back to not_going when there was no RSVP', async () => {
    readEvents.mockResolvedValue({
      events: [{ id: 'e2', title: 'Founder Meetup', viewerRsvp: null }],
    } as Awaited<ReturnType<typeof listEvents>>);
    setRsvp.mockResolvedValue({ ok: true, status: 'going' });

    const outcome = await executeAction('rsvp_event', { eventTitle: 'Founder Meetup', status: 'going' });
    expect(outcome.ok).toBe(true);
    expect(setRsvp).toHaveBeenCalledWith('e2', 'going');

    setRsvp.mockResolvedValue({ ok: true, status: 'not_going' });
    expect((await undoAction('rsvp_event', {}, outcome.undo)).ok).toBe(true);
    expect(setRsvp).toHaveBeenLastCalledWith('e2', 'not_going');
  });

  it('refuses a repeated RSVP and an unknown event without writing', async () => {
    readEvents.mockResolvedValue({
      events: [{ id: 'e1', title: 'Demo Day', viewerRsvp: 'going' }],
    } as Awaited<ReturnType<typeof listEvents>>);
    expect((await executeAction('rsvp_event', { eventId: 'e1', status: 'going' })).ok).toBe(false);
    expect((await executeAction('rsvp_event', { eventTitle: 'No such thing', status: 'going' })).ok).toBe(false);
    expect(setRsvp).not.toHaveBeenCalled();
  });

  it('publishes an event and links to it, with no undo because none exists', async () => {
    makeEvent.mockResolvedValue({ event: { id: 'e9' } } as Awaited<ReturnType<typeof createEvent>>);
    const outcome = await executeAction('create_event', {
      title: 'Pitch Night',
      startAt: '2026-07-01T18:00:00+03:00',
      type: 'demo_day',
      isOnline: true,
    });
    expect(outcome.ok).toBe(true);
    expect(outcome.href).toBe('/events/e9');
    expect(makeEvent).toHaveBeenCalledWith({
      title: 'Pitch Night',
      startAt: '2026-07-01T18:00:00+03:00',
      type: 'demo_day',
      isOnline: true,
    });
    expect(isUndoable('create_event')).toBe(false);
  });

  it('refuses a titleless or undated event before reaching the API', async () => {
    expect((await executeAction('create_event', { startAt: '2026-07-01T18:00:00Z' })).ok).toBe(false);
    expect((await executeAction('create_event', { title: 'X', startAt: 'not a date' })).ok).toBe(false);
    expect(makeEvent).not.toHaveBeenCalled();
  });
});
