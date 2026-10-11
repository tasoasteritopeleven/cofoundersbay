import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { QUERY_ROOTS, queryKeys } from './query-keys';

/**
 * Every query key comes from the factory, and every write reaches a reader.
 *
 * `query-keys.ts` explains the history: 115 first segments for ~60 resources,
 * and three writes invalidating keys nothing read - restoring a canvas
 * version refreshed `['board', id]` while the canvas read
 * `['research-board', id]`, so the restored board kept its old contents.
 *
 * What this checks, statically over `src`:
 *  1. no array-literal key outside `query-keys.ts` (`queryKey: [...]`, a
 *     client method called with `[...]`, `const queryKey = [...]`);
 *  2. every root is one of `QUERY_ROOTS` (the type already says so; this
 *     keeps the list and the call sites from drifting in comments or casts);
 *  3. every key a write targets - invalidate, cancel, refetch, remove, set,
 *     and a server-side `seed` - can match at least one key a query reads.
 *     A variable in a key matches anything; a literal must be equal.
 */

const SRC = join(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== 'node_modules') walk(full, out);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const FILES = walk(SRC).filter((f) => !f.endsWith('query-keys.ts'));
const rel = (f: string) => relative(SRC, f).replace(/\\/g, '/');

/** `a, 'b', fn(c, d), e` -> top-level arguments. */
function splitArgs(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = '';
  for (const ch of text) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') quote = ch;
    else if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) {
      out.push(current.trim());
      current = '';
    } else current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

/** The balanced `(...)` starting at `open`; returns the inside. */
function balanced(source: string, open: number): string {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '(') depth++;
    else if (source[i] === ')' && --depth === 0) return source.slice(open + 1, i);
  }
  return '';
}

type Token = string | null; // null: a variable, matches anything
type Key = { tokens: Token[]; where: string };

function tokensOfQk(args: string): Token[] {
  return splitArgs(args).map((a) => (/^'[^']*'$/.test(a) ? a.slice(1, -1) : null));
}

/** `queryKeys.x`, `queryKeys.x(...)`, `queryKeys.a.b()` resolved against the real factory. */
function tokensOfFactory(expr: string): Token[] | undefined {
  const path = expr.replace(/^queryKeys\./, '').split('.');
  let value: unknown = queryKeys;
  for (const part of path) {
    const name = part.replace(/\(.*$/, '');
    value = (value as Record<string, unknown>)?.[name];
    if (part.includes('(') && typeof value === 'function') value = (value as (...a: string[]) => unknown)('\u0000');
  }
  if (!Array.isArray(value)) return undefined;
  return value.map((v) => (v === '\u0000' ? null : (v as string)));
}

const WRITE = /(invalidateQueries|cancelQueries|refetchQueries|removeQueries|resetQueries)\(\{\s*queryKey:\s*$/;

const reads: Key[] = [];
const writes: Key[] = [];
const literals: string[] = [];

for (const file of FILES) {
  const source = readFileSync(file, 'utf8');
  const where = rel(file);

  for (const m of source.matchAll(/queryKey:\s*\[|(?:setQueryData|getQueryData|invalidateQueries|cancelQueries|refetchQueries|removeQueries|prefetchQuery|fetchQuery|ensureQueryData)\(\s*\[|\bconst [a-zA-Z]*[qQ]ueryKey\s*=\s*\[/g)) {
    literals.push(`${where}: ${source.slice(m.index, m.index + 60).split('\n')[0]}`);
  }

  // Keys in `queryKey:` position - a read, unless the object belongs to a write.
  for (const m of source.matchAll(/queryKey:\s*(qk\(|queryKeys\.[\w.]+(?:\([^)]*\))?)/g)) {
    const before = source.slice(Math.max(0, m.index - 60), m.index + 'queryKey:'.length);
    const tokens = m[1].startsWith('qk(')
      ? tokensOfQk(balanced(source, m.index + m[0].length - 1))
      : tokensOfFactory(m[1]);
    if (!tokens) continue;
    (WRITE.test(before) ? writes : reads).push({ tokens, where });
  }
  // setQueryData / seed with a key argument: a write that needs a reader.
  for (const m of source.matchAll(/(?:setQueryData|\bseed)\(\s*(qk\(|queryKeys\.[\w.]+(?:\([^)]*\))?)/g)) {
    const tokens = m[1].startsWith('qk(')
      ? tokensOfQk(balanced(source, m.index + m[0].length - 1))
      : tokensOfFactory(m[1]);
    if (tokens) writes.push({ tokens, where });
  }
  // A key held in a variable and read with `useQuery({ queryKey, ... })`.
  for (const m of source.matchAll(/const ([a-zA-Z]*[kK]ey) = (qk\()/g)) {
    if (new RegExp(`useQuery\\(\\{\\s*queryKey(?::\\s*${m[1]})?\\s*,`).test(source) || source.includes(`queryKey: ${m[1]},`)) {
      reads.push({ tokens: tokensOfQk(balanced(source, m.index + m[0].length - 1)), where });
    }
  }
}

/** A write key can reach a read key when every position either side names agrees. */
function reaches(write: Token[], read: Token[]): boolean {
  if (read.length < write.length) return false;
  return write.every((w, i) => w === null || read[i] === null || w === read[i]);
}

/*
 * Writes with no reader on purpose. Each needs a reason.
 */
const NO_READER: Record<string, string> = {
  // DashboardPoll is not mounted anywhere; nothing reads the active poll.
  'polls/active': 'unmounted component',
};

describe('query keys', () => {
  it('finds the keys it is meant to check', () => {
    expect(reads.length).toBeGreaterThan(250);
    expect(writes.length).toBeGreaterThan(150);
  });

  it('are built with the factory, never as array literals', () => {
    expect(literals).toEqual([]);
  });

  it('use only the declared roots', () => {
    const roots = new Set<string>(QUERY_ROOTS);
    const unknown = [...reads, ...writes].filter((k) => typeof k.tokens[0] === 'string' && !roots.has(k.tokens[0] as string));
    expect(unknown.map((k) => `${k.where}: ${k.tokens.join('/')}`)).toEqual([]);
  });

  it('every write can reach a query that reads it', () => {
    const orphans = writes
      .filter((w) => !reads.some((r) => reaches(w.tokens, r.tokens)))
      .filter((w) => !NO_READER[w.tokens.filter((t) => t !== null).join('/')])
      .map((w) => `${w.where}: ${w.tokens.map((t) => t ?? '*').join('/')}`);
    expect([...new Set(orphans)]).toEqual([]);
  });
});
