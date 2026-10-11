import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/lib/api';
import { getActionDeclaration } from '@cofounderbay/shared';
import { executeAction, undoAction } from './action-registry';
import { planCopilotTools, detectEmail, detectGroupName, detectProgramTitle, detectRequesterName } from './copilot-planner';

/**
 * Wave C: six writes, each reversal read from its controller before it was
 * declared.
 *
 *   join_group        partial - leave deletes the membership; join automation stays
 *   leave_group       none    - rejoining is a new membership without the old role
 *   apply_to_program  none    - the programmes API has no withdraw
 *   send_invite       partial - cancel voids the link; the email already went
 *   write_endorsement partial - delete removes it; the recipient was notified
 *   respond_to_mentor none    - a request is answered once
 *
 * The executors are run against mocked clients: which endpoint, with what,
 * and what the undo is handed. The planner half checks both languages.
 */

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    joinGroup: vi.fn(),
    leaveGroup: vi.fn(),
    listGroups: vi.fn(),
    getMyGroups: vi.fn(),
    listPrograms: vi.fn(),
    applyToProgram: vi.fn(),
    createInvite: vi.fn(),
    cancelInvite: vi.fn(),
    createEndorsement: vi.fn(),
    deleteEndorsement: vi.fn(),
    getMyReceivedMentorRequests: vi.fn(),
    respondToMentorRequest: vi.fn(),
  };
});

const m = <K extends keyof typeof api>(name: K) => vi.mocked(api[name] as (...args: never[]) => unknown);
const iso = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the declared reversals', () => {
  it('says what the controllers allow', () => {
    expect(getActionDeclaration('join_group')?.reversal?.kind).toBe('partial');
    expect(getActionDeclaration('leave_group')?.reversal?.kind).toBe('none');
    expect(getActionDeclaration('apply_to_program')?.reversal?.kind).toBe('none');
    expect(getActionDeclaration('send_invite')?.reversal?.kind).toBe('partial');
    expect(getActionDeclaration('write_endorsement')?.reversal?.kind).toBe('partial');
    expect(getActionDeclaration('respond_to_mentor_request')?.reversal?.kind).toBe('none');
  });
});

describe('groups', () => {
  it('joins by name, preferring the exact match, and undoes by leaving that group', async () => {
    m('listGroups').mockResolvedValue({ groups: [{ id: 'g2', name: 'Athens Founders Club' }, { id: 'g1', name: 'Athens Founders' }], total: 2, hasMore: false } as never);
    const outcome = await executeAction('join_group', { groupName: 'athens founders' });
    expect(api.joinGroup).toHaveBeenCalledWith('g1');
    expect(outcome).toMatchObject({ ok: true, href: '/groups/g1', undo: { groupId: 'g1' } });

    const undone = await undoAction('join_group', { groupName: 'athens founders' }, outcome.undo ?? {});
    expect(api.leaveGroup).toHaveBeenCalledWith('g1');
    expect(undone.ok).toBe(true);
  });

  it('refuses two partial matches rather than guessing', async () => {
    m('listGroups').mockResolvedValue({ groups: [{ id: 'a', name: 'Athens Founders' }, { id: 'b', name: 'Athens Founders Club' }], total: 2, hasMore: false } as never);
    const outcome = await executeAction('join_group', { groupName: 'athens' });
    expect(outcome.ok).toBe(false);
    expect(api.joinGroup).not.toHaveBeenCalled();
  });

  it('leaves only a group the reader is in', async () => {
    m('getMyGroups').mockResolvedValue({ groups: [{ id: 'g9', name: 'Climate Builders', memberRole: 'member', joinedAt: iso(-3) }] } as never);
    expect((await executeAction('leave_group', { groupName: 'Athens Founders' })).ok).toBe(false);
    const outcome = await executeAction('leave_group', { groupName: 'Climate Builders' });
    expect(api.leaveGroup).toHaveBeenCalledWith('g9');
    expect(outcome.undo).toBeUndefined();
  });
});

describe('programmes', () => {
  const program = (id: string, title: string, deadline: number) => ({ id, title, status: 'upcoming', applicationDeadline: iso(deadline) });

  it('applies with the note, by a unique partial title', async () => {
    m('listPrograms').mockResolvedValue({ programs: [program('p1', 'Pre-seed Bootcamp · Spring 2027', 20), program('p2', 'Seed Accelerator', 20)], total: 2 } as never);
    const outcome = await executeAction('apply_to_program', { programTitle: 'pre-seed bootcamp', coverNote: 'We sell to hotels.' });
    expect(api.applyToProgram).toHaveBeenCalledWith('p1', { coverNote: 'We sell to hotels.' });
    expect(outcome).toMatchObject({ ok: true, href: '/programs/p1' });
  });

  it('refuses a programme whose deadline has passed, as the page does', async () => {
    m('listPrograms').mockResolvedValue({ programs: [program('p3', 'Closed Cohort', -1)], total: 1 } as never);
    const outcome = await executeAction('apply_to_program', { programId: 'p3' });
    expect(outcome.ok).toBe(false);
    expect(api.applyToProgram).not.toHaveBeenCalled();
  });
});

describe('invitations and endorsements', () => {
  it('invites a valid address and cancels exactly that invitation', async () => {
    m('createInvite').mockResolvedValue({ invite: { id: 'inv-7' } } as never);
    expect((await executeAction('send_invite', { email: 'not an address' })).ok).toBe(false);
    const outcome = await executeAction('send_invite', { email: 'maria@example.com', message: 'Join us' });
    expect(api.createInvite).toHaveBeenCalledWith({ email: 'maria@example.com', message: 'Join us' });
    expect(outcome.undo).toEqual({ inviteId: 'inv-7' });
    await undoAction('send_invite', {}, outcome.undo ?? {});
    expect(api.cancelInvite).toHaveBeenCalledWith('inv-7');
  });

  it('writes an endorsement and deletes the one it wrote', async () => {
    m('createEndorsement').mockResolvedValue({ endorsement: { id: 'end-3' } } as never);
    expect((await executeAction('write_endorsement', { userId: 'u1' })).ok).toBe(false);
    const outcome = await executeAction('write_endorsement', { userId: 'u1', content: 'Sharp on pricing.', skill: 'Pricing' });
    expect(api.createEndorsement).toHaveBeenCalledWith({ toUserId: 'u1', content: 'Sharp on pricing.', skill: 'Pricing' });
    await undoAction('write_endorsement', {}, outcome.undo ?? {});
    expect(api.deleteEndorsement).toHaveBeenCalledWith('end-3');
  });
});

describe('mentoring requests', () => {
  const request = (id: string, name: string, status = 'pending') => ({ id, status, requester: { id: `u-${id}`, displayName: name } });

  it('answers the one pending request from that person', async () => {
    m('getMyReceivedMentorRequests').mockResolvedValue({ requests: [request('r1', 'Sofia Alexiou'), request('r2', 'Yannis Petrou'), request('r3', 'Sofia Old', 'accepted')] } as never);
    const outcome = await executeAction('respond_to_mentor_request', { decision: 'accept', requesterName: 'Sofia' });
    expect(api.respondToMentorRequest).toHaveBeenCalledWith('r1', { accept: true });
    expect(outcome.ok).toBe(true);
  });

  it('asks rather than guesses when two pending requests share the name', async () => {
    m('getMyReceivedMentorRequests').mockResolvedValue({ requests: [request('r1', 'Maria Georgiou'), request('r2', 'Maria Papas')] } as never);
    const outcome = await executeAction('respond_to_mentor_request', { decision: 'decline', requesterName: 'Maria' });
    expect(outcome.ok).toBe(false);
    expect(api.respondToMentorRequest).not.toHaveBeenCalled();
  });
});

describe('planning the writes', () => {
  const names = (message: string) => planCopilotTools(message).map((t) => t.name);
  const args = (message: string, tool: string) => planCopilotTools(message).find((t) => t.name === tool)?.args;

  it.each([
    ['Join the Athens Founders group', 'join_group', { groupName: 'Athens Founders' }],
    ['Γράψε με στην ομάδα Athens Founders', 'join_group', { groupName: 'Athens Founders' }],
    ['Leave the Climate Builders group', 'leave_group', { groupName: 'Climate Builders' }],
    ['Βγάλε με από την ομάδα Climate Builders', 'leave_group', { groupName: 'Climate Builders' }],
    ['Apply to the Pre-seed Bootcamp', 'apply_to_program', { programTitle: 'Pre-seed Bootcamp' }],
    ['Κάνε αίτηση στο πρόγραμμα Pre-seed Bootcamp', 'apply_to_program', { programTitle: 'Pre-seed Bootcamp' }],
    ['Invite maria@example.com to CoFounderBay', 'send_invite', { email: 'maria@example.com' }],
    ['Προσκάλεσε τη maria@example.com', 'send_invite', { email: 'maria@example.com' }],
    ['Accept Sofia’s mentoring request', 'respond_to_mentor_request', { decision: 'accept', requesterName: 'Sofia' }],
    ['Απόρριψε το αίτημα mentoring της Μαρίας', 'respond_to_mentor_request', { decision: 'decline', requesterName: 'Μαρίας' }],
  ])('%s → %s', (message, tool, expected) => {
    expect(names(message)).toContain(tool);
    expect(args(message, tool)).toMatchObject(expected);
  });

  it('does not also read the area a write names', () => {
    expect(names('Join the Athens Founders group')).not.toContain('get_groups');
    expect(names('Invite maria@example.com')).not.toContain('get_invites');
    expect(names('Accept Sofia’s mentoring request')).not.toContain('get_mentor_requests');
  });

  it('still reads when there is no write verb', () => {
    expect(names('Which groups am I in?')).toContain('get_groups');
    expect(names('Who have I invited?')).toContain('get_invites');
    expect(names('Who have I invited?')).not.toContain('send_invite');
  });

  it('extracts the target the same way on its own', () => {
    expect(detectEmail('please invite <ana@x.example>, thanks')).toBe('ana@x.example');
    expect(detectGroupName('join “Women in Fintech”')).toBe('Women in Fintech');
    expect(detectProgramTitle('apply for the Climate & Energy Track programme')).toBe('Climate & Energy Track');
    expect(detectRequesterName('decline Giorgos Vlachos’s mentor request please')).toBe('Giorgos Vlachos');
  });
});
