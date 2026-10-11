import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * An icon-only Button must name itself.
 *
 * A sighted reader learns "bookmark" from the glyph, but a screen reader
 * reads nothing when the control's only child is an svg. The system scan
 * found 842 icon-only controls across the app — all already named — and this
 * test keeps it that way: a `<Button>` whose rendered children carry no
 * visible or sr-only text must declare `aria-label` (or `title`, which the
 * tooltip convention already provides) at the call site.
 *
 * A props spread (`{...buttonProps}`) counts as named — the label arrives
 * from the caller, same as the dead-controls test treats handlers.
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
// <Button ...> inner </Button> — buttons never nest, so a lazy match is safe.
const BUTTON = new RegExp(String.raw`<Button\b(${ATTRS})>([\s\S]*?)</Button>`, 'g');
const NAMED = /aria-label|aria-labelledby|title=|\.\.\./;
// Something a reader can see or hear: an element, an expression, or a word.
const HAS_CONTENT = /<(?:span|BilingualText|StatusText|RelativeTime)\b|[a-zA-Z\u0370-\u03FF0-9][^<>/{}]|\{[^}/]|<(?:p|em|strong|b|i|u|kbd)\b/;

const files = walk(SRC)
  .map((path) => path.replace(/\\/g, '/'))
  .filter((path) => !path.includes('/components/ui/'))
  .map((path) => ({ path, source: readFileSync(path, 'utf8') }));

describe('icon-only controls', () => {
  it('names every Button whose children carry no text', () => {
    const offenders: string[] = [];
    for (const { path, source } of files) {
      for (const m of source.matchAll(BUTTON)) {
        const [, attrs, inner] = m;
        if (HAS_CONTENT.test(inner)) continue; // has a label of some kind
        if (NAMED.test(attrs) || NAMED.test(inner)) continue;
        const line = source.slice(0, m.index).split('\n').length;
        offenders.push(`${path}:${line}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
