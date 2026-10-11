import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * No menu item that does nothing.
 *
 * A static sweep found 104 `<DropdownMenuItem>`s with no handler: they looked
 * exactly like the working items beside them, closed the menu when chosen,
 * and did nothing - "Resend Last" on a webhook, "Ban User" in the admin
 * directory, "Move to Next Stage" on a deal. Each is now one of:
 *
 * - wired: `onSelect` / `onClick` performs the action;
 * - a link: `asChild` around a `<Link>` or `<a>`;
 * - honestly unavailable: `disabled`, or `<UnavailableMenuItem>` (which is
 *   disabled and says why on a second line).
 *
 * This fails on a fourth kind - an item with none of those - wherever it is
 * written. A props spread counts as wired, because the handler arrives from
 * the caller and cannot be seen here.
 *
 * The same sweep, run over `<Button>`, found 103 buttons with no handler:
 * "Export" on the earnings page, "Add Service" on a provider's catalogue,
 * "Copy" beside an API key. A button is live when it has a handler, renders
 * a link (`asChild`), submits a form (`type="submit"`, `form=`, or any
 * untyped button inside a `<form>`), is `disabled`, spreads props, is the
 * child of a Radix `…Trigger` / `…Close` / `…Anchor` with `asChild` (which
 * supplies the handler), or is taken out of the tab order as a decorative
 * sample (`tabIndex={-1}`, used on the theme previews).
 */

const SRC = 'src';

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.tsx') && !entry.includes('.test.')) out.push(full);
  }
  return out;
}

const ATTRS = String.raw`(?:[^>{}]|\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})*`;
const ITEM = new RegExp(String.raw`<(DropdownMenuItem|ContextMenuItem|MenubarItem)\b(${ATTRS})>`, 'g');
const ACTS = /onClick|onSelect|asChild|disabled|\.\.\./;

const BUTTON = new RegExp(String.raw`<Button\b(${ATTRS})>`, 'g');
const BUTTON_ACTS =
  /onClick|onSelect|onPointerDown|onMouseDown|asChild|disabled|\.\.\.|form=|type=(?:"submit"|\{'submit'\})|tabIndex=\{-1\}/;
// A Radix trigger that hands its handler to the Button it wraps, optionally
// with a JSX comment between them.
const TRIGGER_BEFORE = new RegExp(
  String.raw`<[A-Z]\w*(?:Trigger|Close|Anchor)\b${ATTRS}\basChild\b${ATTRS}>\s*(?:\{\/\*[\s\S]*?\*\/\}\s*)?$`,
);

function insideForm(source: string, index: number): boolean {
  const before = source.slice(0, index);
  return before.lastIndexOf('<form') > before.lastIndexOf('</form>');
}

describe('dead controls', () => {
  const files = walk(SRC)
    .map((path) => path.replace(/\\/g, '/'))
    // The primitives define the item; their call sites are what is checked.
    .filter((path) => !path.includes('/components/ui/'))
    .map((path) => ({ path, source: readFileSync(path, 'utf8') }));

  it('reads the menus it is meant to check', () => {
    const total = files.reduce((n, f) => n + Array.from(f.source.matchAll(ITEM)).length, 0);
    // A floor that proves the scanner still finds menus, not a quota: 16 items
    // (the research board's capture and align menus) became rail buttons.
    expect(total).toBeGreaterThan(150);
  });

  it('gives every menu item an action, a link, or a stated reason it has none', () => {
    const offenders: string[] = [];
    for (const { path, source } of files) {
      for (const m of source.matchAll(ITEM)) {
        if (ACTS.test(m[2])) continue;
        const line = source.slice(0, m.index ?? 0).split('\n').length;
        offenders.push(`${path}:${line} <${m[1]}> does nothing when chosen`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('reads the buttons it is meant to check', () => {
    const total = files.reduce((n, f) => n + Array.from(f.source.matchAll(BUTTON)).length, 0);
    expect(total).toBeGreaterThan(1000);
  });

  it('gives every button an action, a link, a form to submit, or a reason it has none', () => {
    const offenders: string[] = [];
    for (const { path, source } of files) {
      for (const m of source.matchAll(BUTTON)) {
        const index = m.index ?? 0;
        if (BUTTON_ACTS.test(m[1])) continue;
        if (TRIGGER_BEFORE.test(source.slice(Math.max(0, index - 800), index))) continue;
        if (insideForm(source, index)) continue;
        const line = source.slice(0, index).split('\n').length;
        offenders.push(`${path}:${line} <Button> does nothing when pressed`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
