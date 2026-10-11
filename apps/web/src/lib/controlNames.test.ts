import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every control has a name, checked from the source.
 *
 * The compiler already refuses two kinds of nameless control: a `<Button
 * size="icon">` without `aria-label` (button.tsx) and a `<SelectTrigger>`
 * without `aria-label` / `aria-labelledby` / `id` (select.tsx). Two kinds slip
 * past any type, because the defect is in the *children*, not the props:
 *
 * - a `<Button size="sm">` or raw `<button>` whose only child is an icon. The
 *   Button guard keys on `size`, and a raw element has no guard at all. A
 *   sweep of all 156 routes found 110 of these - a list/grid toggle, a tag's
 *   remove "x", a search's clear, a date picker's month arrows - each
 *   announced as a bare "button".
 * - a `<Switch>` / `<Checkbox>` beside a visible label that was never tied to
 *   it (`<p>Maintenance mode</p> <Switch />`): 14 of those.
 *
 * axe catches both, but only on the routes the e2e suite visits and only in
 * the state it renders; a row that exists only after a tag is added is never
 * scanned. This reads every file, whatever state renders it.
 *
 * A match needs one of: aria-label, aria-labelledby, title (axe accepts it as
 * a name), asChild (the child element is what gets named), or a props spread
 * (the name arrives from the caller, which this cannot see). Children that
 * render text - BilingualText, RelativeTime, a SelectValue - are not icons.
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

// JSX attribute run: plain characters, or a {...} expression up to two levels deep.
const ATTRS = String.raw`(?:[^>{}]|\{(?:[^{}]|\{[^{}]*\})*\})*`;
const ICON_ONLY = new RegExp(
  String.raw`<(Button|button)\b(${ATTRS})>\s*(?:\{/\*[\s\S]*?\*/\}\s*)?<([A-Z][A-Za-z0-9.]*)\b${ATTRS}/>\s*</\1>`,
  'g',
);
// The same, when the icon swaps with state: `{visible ? <Eye /> : <EyeOff />}`.
// The research canvas's layer visibility toggle was one, and the pattern above
// could not see it because its child is an expression, not an element.
const ICON_TERNARY = new RegExp(
  String.raw`<(Button|button)\b(${ATTRS})>\s*\{[^{}?]*\?\s*<([A-Z][A-Za-z0-9.]*)\b(?:[^>{}]|\{[^{}]*\})*/>\s*:\s*<([A-Z][A-Za-z0-9.]*)\b(?:[^>{}]|\{[^{}]*\})*/>\s*\}\s*</\1>`,
  'g',
);
const TOGGLE = new RegExp(String.raw`<(Switch|Checkbox)\b(${ATTRS})/?>`, 'g');

const NAMED = /aria-label|aria-labelledby|\btitle=|asChild|\.\.\./;
const NAMED_TOGGLE = /aria-label|aria-labelledby|\bid=|\.\.\./;
const TEXT_CHILD = /Text$|RelativeTime|Label|Value|Trans$|Say/;

const files = walk(SRC).map((path) => ({ path: path.replace(/\\/g, '/'), source: readFileSync(path, 'utf8') }));

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

describe('control names', () => {
  it('scans the source tree', () => {
    // A parser that stops matching would make both checks below pass vacuously.
    expect(files.length).toBeGreaterThan(300);
    const sample = '<button onClick={x} className="p-1"><X className="icon-sm" /></button>';
    expect(Array.from(sample.matchAll(ICON_ONLY)).length).toBe(1);
    const swap = '<button onClick={x} aria-pressed={on}>{on ? <Eye className="icon-sm" /> : <EyeOff className="icon-sm" />}</button>';
    expect(Array.from(swap.matchAll(ICON_TERNARY)).length).toBe(1);
  });

  it('names every button whose only child is an icon', () => {
    const offenders: string[] = [];
    for (const { path, source } of files) {
      for (const m of source.matchAll(ICON_ONLY)) {
        const [, tag, attrs, child] = m;
        if (TEXT_CHILD.test(child) || NAMED.test(attrs)) continue;
        offenders.push(`${path}:${lineOf(source, m.index ?? 0)} <${tag}> with only <${child} />`);
      }
      for (const m of source.matchAll(ICON_TERNARY)) {
        const [, tag, attrs, a, b] = m;
        if (TEXT_CHILD.test(a) || TEXT_CHILD.test(b) || NAMED.test(attrs)) continue;
        offenders.push(`${path}:${lineOf(source, m.index ?? 0)} <${tag}> with only <${a} /> or <${b} />`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('names every button whose only text hides at a breakpoint', () => {
    // `<Icon /><span className="hidden 2xl:inline">Capture</span>` is named on
    // a wide screen and anonymous everywhere else. axe found the research
    // canvas's Capture and Align menus this way at 1440px; the same shape was
    // on the builder's Share and the offline banner's Reload below 640px.
    const BUTTON_BODY = new RegExp(String.raw`<(Button|button)\b(${ATTRS})>([\s\S]*?)</\1>`, 'g');
    const HIDDEN_SPAN = /<span className="[^"]*\bhidden [a-z0-9]+:[a-z-]+[^"]*">[\s\S]*?<\/span>/g;
    const offenders: string[] = [];
    for (const { path, source } of files) {
      for (const m of source.matchAll(BUTTON_BODY)) {
        const [, tag, attrs, body] = m;
        if (NAMED.test(attrs)) continue;
        if (!/className="[^"]*\bhidden (?:xs|sm|md|lg|xl|2xl):(?:inline|block|flex|inline-flex)/.test(body)) continue;
        const visibleText = body
          .replace(HIDDEN_SPAN, '')
          .replace(/<[^>]+>/g, '')
          .replace(/\{[^}]*\}/g, '')
          .trim();
        if (visibleText) continue;
        offenders.push(`${path}:${lineOf(source, m.index ?? 0)} <${tag}> whose label hides at a breakpoint`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('names every switch and checkbox', () => {
    const offenders: string[] = [];
    for (const { path, source } of files) {
      // The primitives themselves forward props; their call sites are what is checked.
      if (path.includes('/components/ui/')) continue;
      for (const m of source.matchAll(TOGGLE)) {
        if (NAMED_TOGGLE.test(m[2])) continue;
        offenders.push(`${path}:${lineOf(source, m.index ?? 0)} <${m[1]}> with no name`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
