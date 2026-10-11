import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * What the assistant reports after a page command is exactly what the
 * command's handler returns (`page-controls.ts`). So a handler that fires its
 * write and returns at once makes the card turn green, the audit trail file
 * "applied" and Undo appear before the server has answered - and on a failure
 * nothing ever says otherwise. A handler that asks "Are you sure?" and returns
 * nothing on "no" makes a deletion the reader refused read as done.
 *
 * On 2026-10-04, 110 of the 143 commands did one or the other. These checks
 * read the source of every page that offers commands and keep the three
 * shapes out:
 * - a bare `mutation.mutate(...)` in a command (use `await mutateAsync`);
 * - a `void handler(...)` in a command, which drops the handler's answer;
 * - a confirmation inside a command's reach that has no `CANCELLED` answer.
 */

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry) && !entry.includes('.test.')) out.push(full);
  }
  return out;
}

/**
 * The source with comments and string contents blanked to spaces, at the same
 * length, so brackets and words inside them can neither unbalance a scan nor
 * count as code. A quote that does not close on its own line is JSX text (an
 * apostrophe), so it blanks to the end of that line only.
 */
function mask(src: string): string {
  const out = src.split('');
  const blank = (from: number, to: number) => {
    for (let k = from; k < to; k++) if (out[k] !== '\n') out[k] = ' ';
  };
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '/' && next === '/') {
      const end = src.indexOf('\n', i);
      const to = end < 0 ? src.length : end;
      blank(i, to);
      i = to;
    } else if (c === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2);
      const to = end < 0 ? src.length : end + 2;
      blank(i, to);
      i = to - 1;
    } else if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      for (; j < src.length; j++) {
        if (src[j] === '\\') {
          j++;
          continue;
        }
        if (src[j] === c) break;
        if (c !== '`' && src[j] === '\n') break;
      }
      blank(i + 1, Math.min(j, src.length));
      i = j;
    }
  }
  return out.join('');
}

/** The balanced (...), {...} or [...] that opens at `i`, in masked source. */
function balanced(src: string, i: number): string {
  const open = src[i];
  const close = open === '(' ? ')' : open === '{' ? '}' : ']';
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === open) depth++;
    else if (c === close && --depth === 0) return src.slice(i, j + 1);
  }
  return src.slice(i);
}

/** Every `usePageControls([...])` array in a file. */
function controlArrays(src: string): string[] {
  const out: string[] = [];
  for (let at = src.indexOf('usePageControls(['); at >= 0; at = src.indexOf('usePageControls([', at + 1)) {
    out.push(balanced(src, src.indexOf('[', at)));
  }
  return out;
}

/** Every object literal in the file that declares a command (`writes: true`). */
function commandObjects(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/writes:\s*true/g)) {
    // Walk back to the `{` that opens the object this property belongs to.
    let depth = 0;
    for (let k = m.index ?? 0; k >= 0; k--) {
      const c = src[k];
      if (c === '}' || c === ')' || c === ']') depth++;
      else if (c === '(' || c === '[') depth--;
      else if (c === '{') {
        if (depth === 0) {
          out.push(balanced(src, k));
          break;
        }
        depth--;
      }
    }
  }
  return out;
}

/** A command's `run`, to the end of its object. */
function runOf(obj: string): string {
  const at = obj.search(/\brun:/);
  return at >= 0 ? obj.slice(at) : '';
}

/** The helper-built commands in a page's arrays: `rowCommand(..., (u) => ...)`. */
function helperCalls(src: string): string[] {
  return controlArrays(src).flatMap((arr) =>
    [...arr.matchAll(/\b\w+Command\(/g)].map((m) => balanced(arr, (m.index ?? 0) + m[0].length - 1)),
  );
}

/** The body of a named handler, or its expression when it has no block. */
function bodyOf(src: string, name: string): string | undefined {
  const decl = new RegExp(
    `(?:const|let)\\s+${name}\\b[^=]*=\\s*(?:useCallback\\(\\s*)?(?:async\\s*)?\\([^)]*\\)[^=]*=>\\s*|(?:async\\s+)?function\\s+${name}\\s*\\([^)]*\\)[^{]*`,
  ).exec(src);
  if (!decl) return undefined;
  const from = decl.index + decl[0].length;
  if (src[from] === '{') return balanced(src, from);
  const open = src.indexOf('{', from);
  return open >= 0 && !src.slice(from, open).trim() ? balanced(src, open) : src.slice(from, src.indexOf('\n', from));
}

const pages = walk('src')
  .map((f) => f.replace(/\\/g, '/'))
  .filter((f) => !f.endsWith('lib/page-controls.ts'))
  .map((file) => ({ file, raw: readFileSync(file, 'utf8') }))
  .filter(({ raw }) => raw.includes('usePageControls(['))
  // Every scan reads the masked text: a comment that says "void", or a label
  // with a bracket in it, is neither code nor structure.
  .map(({ file, raw }) => ({ file, src: mask(raw) }));

describe('page commands report how the write ended', () => {
  it('finds the pages it is meant to check', () => {
    expect(pages.length).toBeGreaterThan(40);
    const commands = pages.flatMap(({ src }) => commandObjects(src));
    expect(commands.length).toBeGreaterThan(100);
  });

  it('never fires a mutation and returns before it settles', () => {
    const offenders = pages.flatMap(({ file, src }) =>
      [...commandObjects(src).map(runOf), ...helperCalls(src)]
        .filter((text) => /\.mutate\(/.test(text))
        .map((text) => `${file}: ${text.replace(/\s+/g, ' ').slice(0, 100)}`),
    );
    expect(offenders).toEqual([]);
  });

  it('never drops a handler’s answer with `void`', () => {
    // Refreshing once the write has settled may stay unawaited; dropping the
    // handler that does the write may not.
    const DROPPED = /\bvoid\s+(?!refetch\(|refresh\w*\(|after\(|[\w.]*invalidateQueries\()[\w.]+(?:\?\.)?\(/;
    const offenders = pages.flatMap(({ file, src }) =>
      [...commandObjects(src).map(runOf), ...helperCalls(src)]
        .filter((text) => DROPPED.test(text))
        .map((text) => `${file}: ${text.replace(/\s+/g, ' ').slice(0, 100)}`),
    );
    expect(offenders).toEqual([]);
  });

  it('answers CANCELLED wherever a command can ask "Are you sure?"', () => {
    const ASKS = /\bconfirm\(/;
    const offenders: string[] = [];
    for (const { file, src } of pages) {
      const arrays = controlArrays(src).join('\n') + helperCalls(src).join('\n');
      // The question is asked inside the command itself.
      for (const run of commandObjects(src).map(runOf)) {
        if (ASKS.test(run) && !run.includes('CANCELLED')) offenders.push(`${file}: a command asks without CANCELLED`);
      }
      // A handler the commands call asks it.
      for (const m of src.matchAll(/(?:const|let)\s+(\w+)\s*(?::[^=\n]+)?=\s*(?:useCallback\(\s*)?async\b|async\s+function\s+(\w+)|\b(\w+):\s*async\s*\(/g)) {
        const name = m[1] ?? m[2] ?? m[3];
        if (!name || !new RegExp(`\\b${name}\\b`).test(arrays)) continue;
        const body = m[3] ? balanced(src, src.indexOf('{', m.index ?? 0)) : bodyOf(src, name);
        if (body && ASKS.test(body) && !body.includes('CANCELLED')) offenders.push(`${file}: ${name} asks without CANCELLED`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
