'use client';

import { useEffect, useId, useRef, useSyncExternalStore } from 'react';

/**
 * The page's own controls, offered to the assistant.
 *
 * The assistant reached 15 of the 104 API reads and 14 of the 167 writes the
 * pages make (round 12 measurement), because every capability was declared
 * and executed one at a time. Most of what a reader does on a page is not a
 * new capability at all - it is pressing a control the page already has:
 * narrow a list, change a period, export what is on screen, suspend a user.
 *
 * So a page registers those controls here, with the same handler its button
 * calls. The assistant sees them in the page context and proposes one; the
 * reader confirms; the page's handler runs - including any confirmation the
 * page itself asks for. Nothing here reaches an endpoint the page does not.
 *
 * Two kinds, kept apart because the confirm card warns only about writes:
 * a *view* control (`writes: false`) changes what the page shows; a *command*
 * (`writes: true`) changes stored data. `use_page_control` runs only the
 * first, `run_page_command` only the second, so neither declaration's
 * `writes` can be wrong about what it ran.
 */
export type PageControlOption = {
  value: string;
  labelEn: string;
  labelEl: string;
};

export type PageControl = {
  /** Stable within the page, e.g. `status_filter`. */
  id: string;
  labelEn: string;
  labelEl: string;
  /** True when running it changes stored data, not just the view. */
  writes: boolean;
  /**
   * The choices the control takes, when it takes one - a filter's values, a
   * period's windows, the rows a command can act on. Absent for a plain
   * button.
   */
  options?: readonly PageControlOption[];
  /** The option in effect now, so "is it already on suspended?" has an answer. */
  current?: string;
  /** Why it cannot run right now (nothing to export, sample rows). */
  unavailableEn?: string;
  unavailableEl?: string;
  /**
   * The page's own handler. Receives the chosen option's value.
   *
   * The assistant reports exactly what this returns, so a command keeps its
   * promise pending until the write settles (`await mutateAsync`, never a
   * bare `mutate`), and says when nothing was written:
   * - nothing at all: the write landed;
   * - `CANCELLED`: the reader said no in the page's own confirmation;
   * - `{ error }`: it did not go through - or throw, which reads the same.
   */
  run: (value?: string) => PageControlRunResult | Promise<PageControlRunResult>;
  /**
   * The verified opposite of a command, for Undo.
   *
   * Asked *before* the command runs, with the value it will run on, so the
   * page answers from the row's current state: suspending an active user is
   * undone by reactivating them; suspending a banned one is not undone by
   * anything here, and the answer is `undefined`. Name an opposite only when
   * it restores exactly what the command changed - read the endpoint first.
   * A removal that loses a note, or a leave that loses a role, has none.
   */
  undo?: (value?: string) => PageControlUndo | undefined;
};

/** The control that takes a command back, and the value to run it with. */
export type PageControlUndo = { control: string; value?: string };

/**
 * How a handler says that nothing was written.
 *
 * A destructive command asks the page's own "Are you sure?" after the reader
 * confirmed the assistant's card. Answering no used to come back as an
 * ordinary resolved promise, so the card turned green, the audit trail filed
 * "applied" and Undo was offered for a deletion that never happened.
 */
export type PageControlRunResult = void | { cancelled: true } | { error: string };

/** Returned by a handler when the reader declined its confirmation. */
export const CANCELLED: { cancelled: true } = Object.freeze({ cancelled: true as const });

/**
 * Returned when the row a command named has left the page between the choice
 * and the run - refreshed away, or acted on in another tab. Saying nothing
 * here would read as done.
 */
export const ROW_GONE: { error: string } = Object.freeze({ error: 'That item is no longer on this page.' });

export function isCancelledRun(result: unknown): result is { cancelled: true } {
  return typeof result === 'object' && result !== null && (result as { cancelled?: unknown }).cancelled === true;
}

function runError(result: unknown): string | undefined {
  if (typeof result !== 'object' || result === null) return undefined;
  const error = (result as { error?: unknown }).error;
  return typeof error === 'string' && error ? error : undefined;
}

/**
 * For a handler that a button and a command share: runs the write and turns a
 * failure into `{ error }` instead of a rejection. The button path drops the
 * promise, and a rejection nobody catches surfaces as a crash overlay - while
 * the command path needs the reason, so the card can say why nothing changed.
 */
export async function settle(write: () => Promise<unknown>): Promise<PageControlRunResult> {
  try {
    await write();
  } catch (err) {
    return { error: err instanceof Error && err.message ? err.message : 'The change could not be saved.' };
  }
}

/** What leaves the page: everything but the handlers, and whether it can be undone. */
export type PageControlSummary = Omit<PageControl, 'run' | 'undo'> & { undoable?: boolean };

type Entry = { controls: PageControl[] };

const owners = new Map<string, Entry>();
const listeners = new Set<() => void>();
let snapshot: readonly PageControlSummary[] = [];
let snapshotKey = '[]';

function summarise(): PageControlSummary[] {
  const out: PageControlSummary[] = [];
  const seen = new Set<string>();
  for (const { controls } of owners.values()) {
    for (const { run: _run, undo, ...rest } of controls) {
      // First registration wins: two components on one page offering the same
      // id would otherwise make the assistant's choice ambiguous.
      if (seen.has(rest.id)) continue;
      seen.add(rest.id);
      out.push(undo ? { ...rest, undoable: true } : rest);
    }
  }
  return out;
}

function publish(): void {
  const next = summarise();
  const key = JSON.stringify(next);
  if (key === snapshotKey) return;
  snapshotKey = key;
  snapshot = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => snapshot;
const EMPTY: readonly PageControlSummary[] = [];
const getServerSnapshot = () => EMPTY;

/** The controls on screen now, for code outside React (executors). */
export function currentPageControls(): readonly PageControlSummary[] {
  return snapshot;
}

/** The controls on screen now, re-rendering when they change. */
export function usePageControlList(): readonly PageControlSummary[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Offer these controls for as long as the calling component is mounted.
 *
 * Pass the array inline: handlers are read from a ref at run time, so a
 * control always runs the page's current closure, and only a change to what
 * the assistant can see (labels, options, current value) republishes.
 */
export function usePageControls(controls: PageControl[]): void {
  const owner = useId();
  const latest = useRef(controls);
  latest.current = controls;

  const key = JSON.stringify(controls.map(({ run: _run, undo, ...rest }) => (undo ? { ...rest, undoable: true } : rest)));
  useEffect(() => {
    owners.set(owner, {
      // Each run reads the newest handler, never the one from registration;
      // the same for the undo, which must answer from the rows as they are.
      controls: latest.current.map((c) => ({
        ...c,
        run: async (value?: string) => {
          const current = latest.current.find((x) => x.id === c.id);
          if (!current) throw new Error(`The page command "${c.id}" is no longer available.`);
          // Handed back, not swallowed: "the reader said no" and "it failed"
          // travel in the result, and dropping it made both read as success.
          return current.run(value);
        },
        undo: c.undo ? (value?: string) => latest.current.find((x) => x.id === c.id)?.undo?.(value) : undefined,
      })),
    });
    publish();
  }, [owner, key]);

  useEffect(
    () => () => {
      owners.delete(owner);
      publish();
    },
    [owner],
  );
}

export type PageControlOutcome =
  | { ok: true; undo?: PageControlUndo }
  | { ok: false; error: string; cancelled?: undefined }
  // Not a failure - the reader declined - but never success either, so a
  // caller that only checks `ok` still does not claim the write.
  | { ok: false; cancelled: true; error?: undefined };

/** What the handler's result means for the assistant's card. */
function outcomeOf(result: PageControlRunResult, undo?: PageControlUndo): PageControlOutcome {
  if (isCancelledRun(result)) return { ok: false, cancelled: true };
  const error = runError(result);
  if (error) return { ok: false, error };
  return undo ? { ok: true, undo } : { ok: true };
}

/**
 * Run a control by id. The executors' single entry point.
 *
 * Refuses rather than guesses: an unknown id, a value that is not one of the
 * control's options, a control that says it cannot run, or the wrong kind for
 * the capability that asked (`expectWrites`) all return an error naming what
 * is available, so the reader sees why nothing happened.
 */
export async function runPageControl(
  id: string,
  value: string | undefined,
  expectWrites: boolean,
  options: { undoing?: boolean } = {},
): Promise<PageControlOutcome> {
  let control: PageControl | undefined;
  for (const { controls } of owners.values()) {
    control = controls.find((c) => c.id === id);
    if (control) break;
  }
  const available = snapshot.filter((c) => c.writes === expectWrites).map((c) => c.labelEn);
  if (!control) {
    return {
      ok: false,
      error: available.length
        ? `This page has no "${id}" control. It offers: ${available.join(', ')}.`
        : expectWrites
          ? 'This page offers no commands to run.'
          : 'This page offers no controls to use.',
    };
  }
  if (control.writes !== expectWrites) {
    return {
      ok: false,
      error: control.writes
        ? `"${control.labelEn}" changes stored data, so it runs as a command, not a view control.`
        : `"${control.labelEn}" only changes the view, so it runs as a view control, not a command.`,
    };
  }
  if (control.unavailableEn) return { ok: false, error: control.unavailableEn };
  // An undo runs the opposite on the row the command just changed. That row
  // may not be among the opposite's choices yet - the list refreshes after
  // the write lands - so the choice is taken as given; the page's handler
  // still looks the row up and does nothing if it is gone.
  if (options.undoing && value) {
    // A declined confirmation inside the opposite keeps the card as it was:
    // the command still stands, and Undo is still on offer.
    return outcomeOf(await control.run(value));
  }
  if (control.options) {
    // An empty list is not "takes no choice": it is a list with nothing in it
    // right now - no active rules, no open reports. Running anyway handed the
    // handler a value it could not find, which did nothing and reported done.
    if (control.options.length === 0) {
      return { ok: false, error: `"${control.labelEn}" has nothing to act on right now.` };
    }
    if (!value) return { ok: false, error: `"${control.labelEn}" needs a choice: ${control.options.map((o) => o.labelEn).join(', ')}.` };
    // A model may name the option rather than its value; both are accepted.
    const asked = value.toLowerCase();
    const match =
      control.options.find((o) => o.value === value) ??
      control.options.find((o) => o.labelEn.toLowerCase() === asked || o.labelEl.toLowerCase() === asked);
    if (!match) {
      return { ok: false, error: `"${value}" is not one of ${control.labelEn}'s choices: ${control.options.map((o) => o.labelEn).join(', ')}.` };
    }
    value = match.value;
  }
  // Asked before the handler runs: afterwards the row already shows the new
  // state, and the page could no longer say what to restore.
  const undo = control.writes ? control.undo?.(value) : undefined;
  return outcomeOf(await control.run(value), undo);
}

/** For tests: forget every registration. */
export function resetPageControlsForTests(): void {
  owners.clear();
  publish();
}

/**
 * The common case: a filter, period or sort the page already keeps as
 * `{ value, en, el }` options and a state setter. Returns a view control that
 * reports the choice in effect.
 */
type OptionShape =
  | { value: string; en: string; el: string }
  | { key: string; labelEn: string; labelEl: string };

export function choiceControl(
  id: string,
  labelEn: string,
  labelEl: string,
  // Both shapes the pages already keep their options in.
  options: readonly OptionShape[],
  current: string,
  set: (value: string) => void,
): PageControl {
  return {
    id,
    labelEn,
    labelEl,
    writes: false,
    options: options.map((o) =>
      'key' in o ? { value: o.key, labelEn: o.labelEn, labelEl: o.labelEl } : { value: o.value, labelEn: o.en, labelEl: o.el },
    ),
    current,
    run: (value) => {
      if (value !== undefined) set(value);
    },
  };
}

/**
 * A command's choices from the rows on screen, one per row.
 *
 * Labels are what a reader says ("like Elena Papadopoulos's post"), so they
 * are short - a name, not a sentence - and a repeated label gets a number
 * ("Elena Papadopoulos (2)") so every choice stays distinct.
 */
export function rowOptions<T>(
  rows: readonly T[],
  id: (row: T) => string,
  labelEn: (row: T) => string,
  labelEl: (row: T) => string = labelEn,
): PageControlOption[] {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const en = labelEn(row);
    const n = (seen.get(en) ?? 0) + 1;
    seen.set(en, n);
    const suffix = n > 1 ? ` (${n})` : '';
    return { value: id(row), labelEn: `${en}${suffix}`, labelEl: `${labelEl(row)}${suffix}` };
  });
}

/**
 * What a list on the page shows, offered to the assistant.
 *
 * The controls told the assistant what it could press and nothing about what
 * the reader was looking at: on /admin/users it could filter to suspended
 * users but not say who they were, and "which deals are in due diligence?"
 * on the pipeline had no answer short of a new read capability per page.
 *
 * A page publishes its visible rows here as one short line each - the words
 * already on screen, never a second copy of the record. The packet carries at
 * most `LIST_ROW_LIMIT` rows of at most `LIST_ROW_CHARS` characters per list,
 * with the count shown and, when the page knows it, the total behind it, so
 * "12 of 48" is said rather than implied to be everything. Anything the
 * assistant needs in full it still reads through a declared capability.
 */
export const LIST_ROW_LIMIT = 15;
export const LIST_ROW_CHARS = 110;

export type PageListSummary = {
  id: string;
  labelEn: string;
  labelEl: string;
  /** Rows on screen now. */
  shown: number;
  /** Everything the list holds, when the page knows it (a server total). */
  total?: number;
  /** The first rows on screen, one line each, in screen order. */
  rows: string[];
  /** The rows are sample data, not the reader's account. */
  sample?: boolean;
};

const listOwners = new Map<string, PageListSummary[]>();
const listListeners = new Set<() => void>();
let listSnapshot: readonly PageListSummary[] = [];
let listSnapshotKey = '[]';

function publishLists(): void {
  const next: PageListSummary[] = [];
  const seen = new Set<string>();
  for (const lists of listOwners.values()) {
    for (const list of lists) {
      if (seen.has(list.id)) continue;
      seen.add(list.id);
      next.push(list);
    }
  }
  const key = JSON.stringify(next);
  if (key === listSnapshotKey) return;
  listSnapshotKey = key;
  listSnapshot = next;
  for (const listener of listListeners) listener();
}

function subscribeLists(listener: () => void): () => void {
  listListeners.add(listener);
  return () => listListeners.delete(listener);
}

const getListSnapshot = () => listSnapshot;
const NO_LISTS: readonly PageListSummary[] = [];
const getServerListSnapshot = () => NO_LISTS;

/** The lists on screen now, re-rendering when they change. */
export function usePageListSummaries(): readonly PageListSummary[] {
  return useSyncExternalStore(subscribeLists, getListSnapshot, getServerListSnapshot);
}

/** The lists on screen now, for code outside React. */
export function currentPageLists(): readonly PageListSummary[] {
  return listSnapshot;
}

function oneLine(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > LIST_ROW_CHARS ? `${flat.slice(0, LIST_ROW_CHARS - 1)}…` : flat;
}

export type PageList = {
  id: string;
  labelEn: string;
  labelEl: string;
  /**
   * One line per row on screen, in screen order - after the page's own filter
   * and sort - from what the row shows: name, status, the figure beside it.
   * `undefined` while the list is loading.
   */
  rows: readonly string[] | undefined;
  total?: number;
  sample?: boolean;
};

/**
 * Publish these lists for as long as the calling component is mounted.
 *
 * Pass `rows: undefined` while the list is loading: the assistant reading an
 * empty list mid-load would tell the reader they have nothing. A list that has
 * loaded and holds nothing is published with `rows: []`, which is an answer.
 */
export function usePageList(lists: readonly PageList[]): void {
  const owner = useId();
  const summaries: PageListSummary[] = [];
  for (const list of lists) {
    if (!list.rows) continue;
    summaries.push({
      id: list.id,
      labelEn: list.labelEn,
      labelEl: list.labelEl,
      shown: list.rows.length,
      ...(list.total !== undefined && list.total !== list.rows.length ? { total: list.total } : {}),
      rows: list.rows.slice(0, LIST_ROW_LIMIT).map(oneLine),
      ...(list.sample ? { sample: true } : {}),
    });
  }
  const key = JSON.stringify(summaries);
  useEffect(() => {
    listOwners.set(owner, JSON.parse(key) as PageListSummary[]);
    publishLists();
  }, [owner, key]);
  useEffect(
    () => () => {
      listOwners.delete(owner);
      publishLists();
    },
    [owner],
  );
}

/** For tests: forget every published list. */
export function resetPageListsForTests(): void {
  listOwners.clear();
  publishLists();
}
