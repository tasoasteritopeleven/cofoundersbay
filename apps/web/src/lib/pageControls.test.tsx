import { act, cleanup, render } from '@testing-library/react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import {
  currentPageControls,
  currentPageLists,
  LIST_ROW_CHARS,
  LIST_ROW_LIMIT,
  CANCELLED,
  resetPageControlsForTests,
  resetPageListsForTests,
  ROW_GONE,
  settle,
  usePageControls,
  usePageList,
  type PageControl,
  type PageControlRunResult,
} from './page-controls';
import { executeAction, getActionSpec, undoAction, undoAvailable } from './action-registry';
import { pageControlFor, pageListFor } from './copilot-planner';
import { runCopilotTurn } from './copilot-engine';

/**
 * A page's own controls, offered to the assistant.
 *
 * What is asserted: a mounted page's controls are listed without their
 * handlers; the two capabilities run only their own kind, so `writes` on the
 * confirm card is never wrong; a choice is checked against the control's
 * options; the handler that runs is the page's current one; and the engine
 * matches a request to the control and choice it names, in either language,
 * without pressing anything on a passing mention.
 */

const STATUS = [
  { value: 'all', labelEn: 'Any status', labelEl: 'Οποιαδήποτε κατάσταση' },
  { value: 'active', labelEn: 'Active', labelEl: 'Ενεργός' },
  { value: 'suspended', labelEn: 'Suspended', labelEl: 'Σε αναστολή' },
];

function Page({ onSuspend }: { onSuspend: (id?: string) => void }) {
  const [status, setStatus] = useState('all');
  usePageControls([
    { id: 'status_filter', labelEn: 'Status filter', labelEl: 'Φίλτρο κατάστασης', writes: false, options: STATUS, current: status, run: (v) => setStatus(v ?? 'all') },
    { id: 'export_csv', labelEn: 'Export users as CSV', labelEl: 'Εξαγωγή χρηστών σε CSV', writes: false, run: () => undefined },
    {
      id: 'suspend_user',
      labelEn: 'Suspend user',
      labelEl: 'Αναστολή χρήστη',
      writes: true,
      options: [
        { value: 'u1', labelEn: 'Mike Johnson', labelEl: 'Mike Johnson' },
        { value: 'u2', labelEn: 'Mike Chen', labelEl: 'Mike Chen' },
      ],
      run: onSuspend,
    },
  ]);
  return <p data-testid="status">{status}</p>;
}

afterEach(() => {
  cleanup();
  resetPageControlsForTests();
  resetPageListsForTests();
});

describe('the page-control registry', () => {
  it('lists a mounted page’s controls without their handlers, and forgets them on unmount', () => {
    const view = render(<Page onSuspend={() => undefined} />);
    const listed = currentPageControls();
    expect(listed.map((c) => c.id)).toEqual(['status_filter', 'export_csv', 'suspend_user']);
    expect(listed.every((c) => !('run' in c))).toBe(true);
    expect(listed[0].current).toBe('all');
    view.unmount();
    expect(currentPageControls()).toEqual([]);
  });

  it('runs a view control through use_page_control and updates what it reports', async () => {
    const view = render(<Page onSuspend={() => undefined} />);
    await act(async () => {
      await expect(executeAction('use_page_control', { control: 'status_filter', value: 'suspended' })).resolves.toEqual({ ok: true });
    });
    expect(view.getByTestId('status').textContent).toBe('suspended');
    expect(currentPageControls()[0].current).toBe('suspended');
  });

  it('accepts an option by its label, as a model may name it', async () => {
    const view = render(<Page onSuspend={() => undefined} />);
    await act(async () => {
      await executeAction('use_page_control', { control: 'status_filter', value: 'Suspended' });
    });
    expect(view.getByTestId('status').textContent).toBe('suspended');
  });

  it('keeps the two kinds apart, so the confirm card’s warning is never wrong', async () => {
    const onSuspend = vi.fn();
    render(<Page onSuspend={onSuspend} />);
    expect(getActionSpec('use_page_control')?.writes).toBe(false);
    expect(getActionSpec('run_page_command')?.writes).toBe(true);

    const asView = await executeAction('use_page_control', { control: 'suspend_user', value: 'u1' });
    expect(asView.ok).toBe(false);
    expect(onSuspend).not.toHaveBeenCalled();

    const asCommand = await executeAction('run_page_command', { control: 'status_filter', value: 'active' });
    expect(asCommand.ok).toBe(false);

    await executeAction('run_page_command', { control: 'suspend_user', value: 'u1' });
    expect(onSuspend).toHaveBeenCalledWith('u1');
  });

  it('refuses a choice the control does not offer, and a control the page does not have', async () => {
    render(<Page onSuspend={() => undefined} />);
    await expect(executeAction('use_page_control', { control: 'status_filter', value: 'banned' })).resolves.toMatchObject({ ok: false });
    await expect(executeAction('use_page_control', { control: 'status_filter' })).resolves.toMatchObject({ ok: false });
    const missing = await executeAction('use_page_control', { control: 'nope' });
    expect(missing).toEqual({
      ok: false,
      error: 'This page has no "nope" control. It offers: Status filter, Export users as CSV.',
    });
  });

  it('runs the page’s current handler, not the one it registered with', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const view = render(<Page onSuspend={first} />);
    view.rerender(<Page onSuspend={second} />);
    await executeAction('run_page_command', { control: 'suspend_user', value: 'u2' });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('u2');
  });

  it('says why a control cannot run instead of running it', async () => {
    const run = vi.fn();
    const controls: PageControl[] = [
      { id: 'export_csv', labelEn: 'Export as CSV', labelEl: 'Εξαγωγή σε CSV', writes: false, unavailableEn: 'There is nothing to export.', run },
    ];
    function Empty() { usePageControls(controls); return null; }
    render(<Empty />);
    await expect(executeAction('use_page_control', { control: 'export_csv' })).resolves.toEqual({ ok: false, error: 'There is nothing to export.' });
    expect(run).not.toHaveBeenCalled();
  });
});

const LISTED = [
  { id: 'status_filter', label: 'Status filter', writes: false, options: [{ value: 'all', label: 'Any status' }, { value: 'suspended', label: 'Suspended' }] },
  { id: 'export_csv', label: 'Export users as CSV', writes: false },
  { id: 'suspend_user', label: 'Suspend user', writes: true, options: [{ value: 'u1', label: 'Mike Johnson' }, { value: 'u2', label: 'Mike Chen' }] },
];

describe('matching a request to a page control', () => {
  it('picks the control and the choice a request names', () => {
    expect(pageControlFor('show only suspended users', LISTED)).toMatchObject({ control: { id: 'status_filter' }, option: { value: 'suspended' } });
    expect(pageControlFor('suspend Mike Johnson', LISTED)).toMatchObject({ control: { id: 'suspend_user' }, option: { value: 'u1' } });
    expect(pageControlFor('export the users as csv', LISTED)).toMatchObject({ control: { id: 'export_csv' } });
  });

  it('needs every word of a row’s name, so "Mike" alone picks nobody', () => {
    expect(pageControlFor('suspend Mike', LISTED)).toBeUndefined();
  });

  it('understands Greek without accents getting in the way', () => {
    const greek = [{ id: 'status_filter', label: 'Φίλτρο κατάστασης', writes: false, options: [{ value: 'suspended', label: 'Σε αναστολή' }] }];
    expect(pageControlFor('δείξε μόνο όσους είναι σε αναστολη', greek)).toMatchObject({ option: { value: 'suspended' } });
  });

  it('never picks a command that writes from a row name alone', () => {
    // "show" is a verb of looking, and Mike Johnson is a row of the Suspend
    // command - but nothing in the message says suspend.
    expect(pageControlFor('show Mike Johnson', LISTED)).toBeUndefined();
  });

  it('does not press anything on a passing mention', () => {
    expect(pageControlFor('what does suspended mean?', LISTED)).toBeUndefined();
    expect(pageControlFor('users', LISTED)).toBeUndefined();
  });
});

describe('an assistant turn on a page with controls', () => {
  const context = { route: '/admin/users', locale: 'en', controls: LISTED };

  it('proposes a view control as use_page_control, with the choice', async () => {
    const turn = await runCopilotTurn('show only suspended users', context, { tools: [] });
    const card = turn.actions.find((a) => a.tool === 'use_page_control');
    expect(card?.payload).toEqual({ control: 'status_filter', value: 'suspended', label: 'Status filter: Suspended' });
    expect(card?.confirmLabel).toBe('Apply');
  });

  it('proposes a command that writes as run_page_command', async () => {
    const turn = await runCopilotTurn('suspend Mike Chen', context, { tools: [] });
    const card = turn.actions.find((a) => a.tool === 'run_page_command');
    expect(card?.payload).toMatchObject({ control: 'suspend_user', value: 'u2' });
    expect(card?.confirmLabel).toBe('Run');
  });

  it('says a filter is already set rather than proposing it again', async () => {
    const turn = await runCopilotTurn('show only suspended users', { ...context, controls: [{ ...LISTED[0], current: 'suspended' }] }, { tools: [] });
    expect(turn.actions).toEqual([]);
    expect(turn.message).toContain('Status filter is already set to Suspended.');
  });

  it('answers a page request with the page alone, not a general briefing', async () => {
    // Planned by the engine itself (no tools passed): the planner would add a
    // graph read to a short turn; the page answered it, so none runs.
    const turn = await runCopilotTurn('show only suspended users', context);
    expect(turn.actions.some((a) => a.tool === 'use_page_control')).toBe(true);
    expect(turn.usedTools).not.toContain('get_graph');
  });

  it('names what it can use when asked about the page', async () => {
    const turn = await runCopilotTurn('what can I do on this page?', context, { tools: [] });
    expect(turn.message).toContain('You can ask me to use: Status filter, Export users as CSV, Suspend user.');
  });
});

/**
 * What a command's handler answers is what the assistant's card shows: the
 * write landed, the reader said no in the page's own confirmation, or it did
 * not go through - and the answer arrives only once the write has settled.
 */
describe('what a command reports', () => {
  const ROWS = [
    { value: 'r1', labelEn: 'Weekly digest', labelEl: 'Εβδομαδιαία σύνοψη' },
    { value: 'r2', labelEn: 'Welcome email', labelEl: 'Email καλωσορίσματος' },
  ];
  function Rules({ run, options = ROWS, undo }: {
    run: (v?: string) => PageControlRunResult | Promise<PageControlRunResult>;
    options?: PageControl['options'];
    undo?: PageControl['undo'];
  }) {
    usePageControls([{ id: 'delete_rule', labelEn: 'Delete rule', labelEl: 'Διαγραφή κανόνα', writes: true, options, undo, run }]);
    return null;
  }
  const command = (value?: string) => executeAction('run_page_command', { control: 'delete_rule', value });

  it('reports done when the handler answers nothing', async () => {
    render(<Rules run={() => undefined} />);
    await expect(command('r1')).resolves.toEqual({ ok: true });
  });

  it('reports cancelled - never done, never an error - when the reader declines', async () => {
    render(<Rules run={async () => CANCELLED} undo={(v) => ({ control: 'restore_rule', value: v })} />);
    const outcome = await command('r1');
    expect(outcome).toEqual({ ok: false, cancelled: true });
    // Nothing was written, so nothing can be taken back.
    expect(undoAvailable('run_page_command', outcome.undo)).toBe(false);
  });

  it('reports the handler’s reason when the write does not go through', async () => {
    render(<Rules run={async () => ({ error: 'The rule is in use.' })} />);
    await expect(command('r1')).resolves.toEqual({ ok: false, error: 'The rule is in use.' });
  });

  it('reports a thrown failure as a failure, with its message', async () => {
    render(<Rules run={async () => { throw new Error('Server unavailable'); }} />);
    await expect(command('r1')).resolves.toEqual({ ok: false, error: 'Server unavailable' });
  });

  it('turns a failure into an answer for handlers a button shares, instead of a rejection', async () => {
    await expect(settle(async () => { throw new Error('Offline'); })).resolves.toEqual({ error: 'Offline' });
    await expect(settle(async () => 'stored')).resolves.toBeUndefined();
    expect(ROW_GONE.error).toMatch(/no longer on this page/);
  });

  it('stays pending until the handler settles', async () => {
    let release!: () => void;
    render(<Rules run={() => new Promise<void>((resolve) => { release = resolve; })} />);
    let settled = false;
    const outcome = command('r1').then((o) => { settled = true; return o; });
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);
    release();
    await expect(outcome).resolves.toEqual({ ok: true });
  });

  it('refuses a command whose list is empty right now, instead of running it on nothing', async () => {
    const run = vi.fn();
    render(<Rules run={run} options={[]} />);
    await expect(command('anything')).resolves.toEqual({ ok: false, error: '"Delete rule" has nothing to act on right now.' });
    expect(run).not.toHaveBeenCalled();
  });

  it('still runs a command that takes no choice at all', async () => {
    const run = vi.fn();
    function MarkAll() {
      usePageControls([{ id: 'mark_all_read', labelEn: 'Mark all read', labelEl: 'Σήμανση όλων ως αναγνωσμένων', writes: true, run }]);
      return null;
    }
    render(<MarkAll />);
    await expect(executeAction('run_page_command', { control: 'mark_all_read' })).resolves.toEqual({ ok: true });
    expect(run).toHaveBeenCalledWith(undefined);
  });

  it('keeps the command standing when the reader declines its undo', async () => {
    render(<Rules run={async () => CANCELLED} />);
    await expect(undoAction('run_page_command', {}, { control: 'delete_rule', value: 'r1' })).resolves.toEqual({ ok: false, cancelled: true });
  });
});

describe('undo through a verified opposite', () => {
  type Row = { id: string; name: string; status: 'active' | 'suspended' | 'banned' };
  function Users({ onChange }: { onChange: (id: string, status: Row['status']) => void }) {
    const [rows, setRows] = useState<Row[]>([
      { id: 'u1', name: 'Mike Johnson', status: 'active' },
      { id: 'u2', name: 'Mike Chen', status: 'banned' },
    ]);
    const set = (id: string, status: Row['status']) => {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      onChange(id, status);
    };
    const opts = (list: Row[]) => list.map((r) => ({ value: r.id, labelEn: r.name, labelEl: r.name }));
    usePageControls([
      {
        id: 'suspend_user',
        labelEn: 'Suspend user',
        labelEl: 'Αναστολή χρήστη',
        writes: true,
        options: opts(rows.filter((r) => r.status !== 'suspended')),
        // Only an active user comes back by reactivating; a banned one does not.
        undo: (v) => (rows.find((r) => r.id === v)?.status === 'active' ? { control: 'reactivate_user', value: v } : undefined),
        run: (v) => { if (v) set(v, 'suspended'); },
      },
      {
        id: 'reactivate_user',
        labelEn: 'Reactivate user',
        labelEl: 'Επανενεργοποίηση χρήστη',
        writes: true,
        options: opts(rows.filter((r) => r.status !== 'active')),
        run: (v) => { if (v) set(v, 'active'); },
      },
    ]);
    return <p data-testid="rows">{rows.map((r) => `${r.id}:${r.status}`).join(' ')}</p>;
  }

  it('hands back the opposite the page named from the row before it changed, and runs it', async () => {
    const changes: string[] = [];
    const view = render(<Users onChange={(id, st) => changes.push(`${id}:${st}`)} />);
    let outcome: Awaited<ReturnType<typeof executeAction>> | undefined;
    await act(async () => {
      outcome = await executeAction('run_page_command', { control: 'suspend_user', value: 'u1' });
    });
    expect(outcome).toEqual({ ok: true, undo: { control: 'reactivate_user', value: 'u1' } });
    expect(undoAvailable('run_page_command', outcome?.undo)).toBe(true);
    await act(async () => {
      await expect(undoAction('run_page_command', {}, outcome?.undo ?? {})).resolves.toEqual({ ok: true });
    });
    expect(view.getByTestId('rows').textContent).toBe('u1:active u2:banned');
    expect(changes).toEqual(['u1:suspended', 'u1:active']);
  });

  it('offers no undo where the opposite would not restore the row', async () => {
    render(<Users onChange={() => undefined} />);
    let outcome: Awaited<ReturnType<typeof executeAction>> | undefined;
    await act(async () => {
      outcome = await executeAction('run_page_command', { control: 'suspend_user', value: 'u2' });
    });
    // Mike Chen was banned: reactivating would make him active, not banned.
    expect(outcome).toEqual({ ok: true });
    expect(undoAvailable('run_page_command', outcome?.undo)).toBe(false);
    await expect(undoAction('run_page_command', {}, {})).resolves.toEqual({ ok: false, error: 'Not reversible' });
  });

  it('says a command can be undone in what the assistant sees, without the handler', () => {
    render(<Users onChange={() => undefined} />);
    const listed = currentPageControls();
    expect(listed.find((c) => c.id === 'suspend_user')).toMatchObject({ undoable: true });
    expect(listed.find((c) => c.id === 'reactivate_user')?.undoable).toBeUndefined();
    expect(listed.every((c) => !('undo' in c))).toBe(true);
  });
});

describe('what a page’s lists show', () => {
  function Deals({ rows, total }: { rows?: string[]; total?: number }) {
    usePageList([{ id: 'deals', labelEn: 'Deals', labelEl: 'Συμφωνίες', rows, total }]);
    return null;
  }

  it('publishes nothing while a list is loading, and an empty list once it has loaded', () => {
    const view = render(<Deals />);
    expect(currentPageLists()).toEqual([]);
    view.rerender(<Deals rows={[]} />);
    expect(currentPageLists()).toEqual([{ id: 'deals', labelEn: 'Deals', labelEl: 'Συμφωνίες', shown: 0, rows: [] }]);
    view.unmount();
    expect(currentPageLists()).toEqual([]);
  });

  it('caps the rows it carries and says how many are on screen and in all', () => {
    const rows = Array.from({ length: 30 }, (_, i) => `Deal ${i + 1} · ${'x'.repeat(200)}`);
    render(<Deals rows={rows} total={48} />);
    const [list] = currentPageLists();
    expect(list.shown).toBe(30);
    expect(list.total).toBe(48);
    expect(list.rows).toHaveLength(LIST_ROW_LIMIT);
    expect(list.rows.every((r) => r.length <= LIST_ROW_CHARS)).toBe(true);
  });

  it('matches a question about a list by its name or by pointing at it, never a command', () => {
    const lists = [{ id: 'users', label: 'Users' }, { id: 'invites', label: 'Pending invites' }];
    expect(pageListFor('which users are suspended?', lists)?.id).toBe('users');
    expect(pageListFor('how many pending invites are there', lists)?.id).toBe('invites');
    expect(pageListFor('what is in this list?', lists)?.id).toBe('users');
    expect(pageListFor('ποιοι είναι εδώ;', lists)?.id).toBe('users');
    expect(pageListFor('suspend Mike Chen', lists)).toBeUndefined();
    expect(pageListFor('what does suspended mean?', lists)).toBeUndefined();
  });

  it('answers from the rows on screen, with the count and what lies beyond them', async () => {
    const context = {
      route: '/investor/pipeline',
      locale: 'en',
      lists: [{ id: 'deals', label: 'Deals', shown: 16, total: 40, rows: Array.from({ length: 15 }, (_, i) => `Startup ${i + 1} · Due diligence`) }],
    };
    const turn = await runCopilotTurn('which deals are in due diligence?', context);
    expect(turn.message).toContain('Deals: 16 on screen of 40.');
    expect(turn.message).toContain('- Startup 1 · Due diligence');
    expect(turn.message).toContain('…and 1 more on screen.');
    expect(turn.usedTools).not.toContain('get_graph');
  });

  it('names each list with its count when asked about the page', async () => {
    const context = { route: '/admin/users', locale: 'en', lists: [{ id: 'users', label: 'Users', shown: 3, rows: ['a', 'b', 'c'] }] };
    const turn = await runCopilotTurn('what am I looking at?', context, { tools: [] });
    expect(turn.message).toContain('Users: 3 on screen.');
  });

  it('says so when the rows are samples', async () => {
    const context = { route: '/data-room/x', locale: 'en', lists: [{ id: 'docs', label: 'Documents', shown: 1, rows: ['Deck.pdf'], sample: true }] };
    const turn = await runCopilotTurn('which documents are here?', context, { tools: [] });
    expect(turn.message).toContain('These rows are sample data, not your account.');
  });
});

describe('pages that offer controls', () => {
  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) out.push(...walk(full));
      else if (entry.endsWith('.tsx') && !entry.includes('.test.')) out.push(full);
    }
    return out;
  }
  const users = walk('src').filter((f) => {
    const s = readFileSync(f, 'utf8');
    return s.includes('usePageControls([') || s.includes('usePageList([');
  });

  it('finds the pages it is meant to check', () => {
    expect(users.length).toBeGreaterThan(10);
  });

  it('calls usePageControls and usePageList before any early return, so hook order is stable', () => {
    // A component-level `return` before the hook changes how many hooks run
    // between renders (loading → loaded), which React rejects at runtime.
    // Lint would catch it; lint does not run here (AGENTS.md), so this does.
    const offenders: string[] = [];
    for (const file of users) {
      const s = readFileSync(file, 'utf8');
      let from = 0;
      for (;;) {
        const i = [s.indexOf('usePageControls([', from), s.indexOf('usePageList([', from)].filter((n) => n !== -1).sort((a, b) => a - b)[0] ?? -1;
        if (i === -1) break;
        from = i + 1;
        const start = Math.max(s.lastIndexOf('export default function', i), s.lastIndexOf('\nfunction ', i), s.lastIndexOf('\nexport function ', i));
        const before = s.slice(start, i);
        // Both shapes: `if (x) return ...` on one line, and a component-level
        // `if (x) {` whose next line returns - the second is what slipped
        // through on /mentor/earnings (React #310 in the live sweep).
        if (/\n {2}(?:if \([^\n]*\)\s*)?return\b/.test(before) || /\n {2}if \([^\n]*\)\s*\{\s*\n\s*return\b/.test(before)) {
          offenders.push(file);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('publishes what its list shows, unless it has no list', () => {
    // A command whose choices are the rows on screen can be asked for by
    // name only if the assistant can also answer "which ones are there?".
    // So a page with controls publishes its list; the pages below show
    // figures rather than rows and describe those in their snapshot.
    const NO_LIST: Record<string, string> = {
      'src/app/analytics/page.tsx': 'charts and totals, published as the page snapshot',
      'src/app/investor/analytics/page.tsx': 'KPI tiles and charts, published as the page snapshot',
      'src/app/provider/analytics/page.tsx': 'charts and totals for one period',
      'src/app/readiness/page.tsx': 'a score and its dimensions, published as the page snapshot',
      'src/app/settings/page.tsx': 'switches and forms; nothing is listed',
      'src/app/settings/notifications/page.tsx': 'switches per notification type; nothing is listed',
      'src/app/settings/ai/page.tsx': 'a preferences form; nothing is listed',
      'src/app/projects/[projectId]/page.tsx': 'one project, not a list',
      'src/app/admin/analytics/page.tsx': 'platform totals and role charts, published as the page snapshot',
      'src/app/events/[id]/page.tsx': 'one event, not a list',
      'src/app/programs/[id]/page.tsx': 'one programme, not a list',
      'src/app/startups/[id]/page.tsx': 'one deal: its stage and star, not a list',
      'src/app/profiles/[userId]/ProfileContent.tsx': 'one person\'s profile, not a list',
      'src/app/matches/[userId]/page.tsx': 'one pairing\'s compatibility, not a list',
    };
    const missing = users.filter((f) => {
      const s = readFileSync(f, 'utf8');
      return s.includes('usePageControls([') && !s.includes('usePageList([') && !NO_LIST[f.replace(/\\/g, '/')];
    });
    expect(missing).toEqual([]);
  });

  it('reaches every row-menu action, or says why not', () => {
    // Step 2: an action in a row's menu is also a command. A file whose menu
    // items have handlers either registers controls itself, is covered by the
    // page that mounts it, or is listed here with the reason it is not a
    // list row the assistant should press.
    const COVERED_BY: Record<string, string> = {
      'src/components/messaging/ConversationList.tsx': 'src/app/messages/page.tsx',
      'src/components/messaging/ChatWindow.tsx': 'src/app/messages/page.tsx',
    };
    const EXEMPT: Record<string, string> = {
      'src/app/research/[boardId]/page.tsx': 'the canvas; board work is the canvas_command capability',
      'src/components/research/BoardExport.tsx': 'an export-format menu inside the canvas',
      'src/components/research/BoardSettingsPanel.tsx': 'canvas settings, not a list',
      'src/components/builder/BranchPanel.tsx': 'builder branch tools, reached through the builder capabilities',
      'src/components/social/ShareButton.tsx': 'share targets that leave the app',
      'src/components/common/ThemeToggle.tsx': 'app chrome',
      'src/components/layout/UserMenu.tsx': 'app chrome',
      'src/components/layout/TopBar.tsx': 'app chrome',
      'src/components/messaging/ConversationValidation.tsx': 'the open chat\'s validation tools (mode, export, hash), not a list row',
      'src/components/discover/ProfileCard.tsx': 'the card owns its share and report dialogs; connect, message and save are /discover commands',
      'src/components/feed/PostCard.tsx': 'not mounted (/feed and /groups/[groupId] render their own)',
      'src/app/messages/components/EnhancedMessageThread.tsx': 'not mounted',
      'src/components/messages/MessageThread.tsx': 'not mounted',
      'src/app/matches/[userId]/page.tsx': "one match's detail page: copy its link, open the profile",
      'src/components/builder/BuilderWorkspace.tsx': 'the builder workspace, reached through the builder capabilities',
      'src/components/research/CanvasBranchSelector.tsx': 'canvas branch picker',
      'src/components/common/LanguagePreferenceToggle.tsx': 'app chrome',
      'src/components/common/LanguageSwitcher.tsx': 'app chrome',
      'src/components/theme/ThemeSwitcher.tsx': 'app chrome',
    };
    const menuFiles = walk('src').filter((f) => /DropdownMenuItem[^>]*on(Click|Select)=/.test(readFileSync(f, 'utf8')));
    const uncovered = menuFiles
      .map((f) => f.replace(/\\/g, '/'))
      .filter((f) => !readFileSync(f, 'utf8').includes('usePageControls(['))
      .filter((f) => !EXEMPT[f])
      .filter((f) => !(COVERED_BY[f] && readFileSync(COVERED_BY[f], 'utf8').includes('usePageControls([')));
    expect(uncovered).toEqual([]);
    expect(menuFiles.length).toBeGreaterThan(40);
  });

  it('names an undo only by a command the same page offers', () => {
    // An undo runs another control on the same page by its id. A typo, or a
    // control that was renamed, would leave a card whose Undo fails - so
    // every literal target must be an id the page registers. Template ids
    // (`move_to_${stage}`) are checked by the page's own tests.
    const broken: string[] = [];
    for (const file of users) {
      const src = readFileSync(file, 'utf8');
      if (!src.includes('undo:')) continue;
      const ids = new Set([...src.matchAll(/\bid: '([a-z_]+)'/g)].map((m) => m[1]));
      for (const m of src.matchAll(/undo:[^\n]*?control: '([a-z_]+)'/g)) {
        if (!ids.has(m[1])) broken.push(`${file}: ${m[1]}`);
      }
      for (const m of src.matchAll(/\? \{ control: '([a-z_]+)'/g)) {
        if (!ids.has(m[1])) broken.push(`${file}: ${m[1]}`);
      }
    }
    expect(broken).toEqual([]);
  });
});
