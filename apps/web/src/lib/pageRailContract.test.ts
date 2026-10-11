import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards the page rail's contract.
 *
 * The rail exists so a page can lead with what it is for, with its supporting
 * controls one gesture away. That only holds if every section is findable and
 * labelled: a collapsed rail is a column of icons, so a section with no Greek
 * label is unreadable to half the product's users, and two sections sharing an
 * id silently collapse into one because the panel is keyed by id.
 *
 * These are cheap invariants that a later edit cannot quietly break, which is
 * the point - the rail is going onto 45 pages, and reviewing each one by eye
 * is exactly the kind of check that stops happening after the third wave.
 */

/*
 * Both roots. A rail is declared where its data is: usually the route file,
 * sometimes the page's content component beside it, and sometimes a shared
 * component under src/components - /builder keeps its workspace there.
 * Checking only src/app left those rails unguarded.
 */
const RAIL_ROOTS = ['src/app', 'src/components'];
const GLYPH_SOURCE = 'src/components/icons/CfbGlyph.tsx';

/**
 * Every .tsx under src/app, not only page.tsx.
 *
 * A large page keeps its body in a content component beside the route file -
 * /dashboard/founder does - and that is where its rail is declared. Walking
 * only page.tsx meant those rails were never checked at all.
 */
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.tsx') && !entry.endsWith('.test.tsx')) out.push(full);
  }
  return out;
}

/**
 * The sections a page declares.
 *
 * Read from the source rather than by rendering: a page needs a session, a
 * query client and a router to render, and none of that is what is being
 * checked here. The shape is regular because `PageRailSection` makes it so.
 */
type ParsedSection = { id: string; glyph: string; labelEn: string; labelEl: string };

function parseRailSections(source: string): ParsedSection[] {
  const start = source.indexOf('const rail: PageRailSection[]');
  if (start === -1) return [];
  const slice = source.slice(start);
  const sections: ParsedSection[] = [];
  const idRe = /id:\s*'([^']+)',\s*\n\s*glyph:\s*'([^']+)',\s*\n\s*labelEn:\s*'([^']*)',\s*\n\s*labelEl:\s*'([^']*)'/g;
  let match: RegExpExecArray | null;
  while ((match = idRe.exec(slice)) !== null) {
    sections.push({ id: match[1], glyph: match[2], labelEn: match[3], labelEl: match[4] });
  }
  return sections;
}

/**
 * The rail block and the rest of the page, as two strings.
 *
 * The rail is a `const rail: PageRailSection[] = [ ... ];` literal; its end is
 * the first `];` at the declaration's indentation. Everything else - header
 * actions, toolbar, the column - is "the page". A control is identified by
 * the label it shows: a catalogue key (`researchEn('fit_nodes')`), a literal
 * bilingual prop (`en="Refresh"`), or a StatCard label (`label="Total Users"`).
 * Icons and handlers are deliberately not compared: two controls with the same
 * label are the same control to the reader, whatever they are wired to.
 */
function splitRail(source: string): { rail: string; page: string } {
  const start = source.indexOf('const rail: PageRailSection[]');
  if (start === -1) return { rail: '', page: source };
  const lineStart = source.lastIndexOf(String.fromCharCode(10), start) + 1;
  const indent = source.slice(lineStart, start);
  const endMarker = String.fromCharCode(10) + indent + '];';
  const end = source.indexOf(endMarker, start);
  const rail = source.slice(start, end === -1 ? undefined : end + endMarker.length);
  return { rail, page: source.slice(0, start) + source.slice(end === -1 ? source.length : end + endMarker.length) };
}

/**
 * `usePageControls([...])` describes the page's controls to the assistant -
 * the same labels, deliberately, because it is the same control. It renders
 * nothing, so it is neither "the column" nor "the rail" and is left out of
 * both before labels are compared.
 */
function withoutControlRegistrations(source: string): string {
  let out = source;
  for (;;) {
    const start = out.indexOf('usePageControls([');
    if (start === -1) return out;
    // The call sits at component level, so it closes at two-space indent.
    const end = out.indexOf('\n  ]);', start);
    if (end === -1) return out;
    out = out.slice(0, start) + out.slice(end + 6);
  }
}

/**
 * Text that names something rather than being a control: headings, table
 * column headers (<TableHead>, or a div row marked `data-column-headers`),
 * and dialogs. A dialog is its own surface - neither the
 * column nor the rail - and its fields set what the dialog is for (the role
 * of the person being invited), not the list the rail filters. A heading
 * names the group under it. Labels in these are words, and once the pages
 * became bilingual they arrive as `en=` props like every control's, so they
 * are dropped before labels are compared. The state check below does not
 * read labels, so a real second binding is still caught there.
 *
 * Applied to both sides, which it was not at first. A rail section's card
 * carries a <CardTitle> naming what is in it, and /dashboard/founder names
 * that card after the thing it lists - "Top matches", "Milestones" - which is
 * also what the column's metric tile for the same subject is called. One is a
 * heading, the other a tile: stripping headings from the column but not from
 * the rail reported the pair as a duplicated control. A heading is a heading
 * wherever it sits, so the same text is dropped from both before comparing.
 */
function withoutNonControlText(source: string): string {
  return source
    .replace(/<Dialog[\s>][\s\S]*?<\/Dialog>/g, '')
    .replace(/<(h[1-6]|CardTitle|TableHead|DialogTitle)\b[^>]*>[\s\S]*?<\/\1>/g, '')
    // A list laid out with divs marks its header row `data-column-headers`:
    // the cells name columns, like <TableHead>, and hold no control.
    .replace(/<div data-column-headers[^>]*>[\s\S]*?\n(\s*)<\/div>/g, '');
}

function controlLabels(source: string): Set<string> {
  const out = new Set<string>();
  for (const m of source.matchAll(/[a-zA-Z]+En\('([a-z0-9_]+)'\)/g)) out.add(`key:${m[1]}`);
  for (const m of source.matchAll(/[\s{(]en=\{?["'`]([^"'`{}]{2,60})["'`]/g)) out.add(`en:${m[1].trim()}`);
  for (const m of source.matchAll(/[\s{(]label=["']([^"']{2,60})["']/g)) out.add(`en:${m[1].trim()}`);
  return out;
}

/**
 * Labels a page may legitimately show in both places: headings that name a
 * group rather than a control, and state words that are text, not buttons.
 * Keep this list short and explain each entry; it is the escape hatch, not
 * the rule.
 */
const SHARED_TEXT_ALLOWLIST = new Set<string>([
  // Exceptions earn their place: each is text, not a second control.
  'key:enter_url', // the prompt() question behind Add Node -> link
  'key:share_link', // a toast message naming what just happened
  // The canvas right-click menu places these at the clicked point; the rail's
  // Insert section places them at the viewport centre. Same label, different
  // behaviour - a spatial command surface, not a duplicate.
  'key:add_sticky',
  'key:create_group',
  // /research/[boardId]: the rail's Insert section uploads at the viewport
  // centre; the canvas right-click menu uploads at the clicked point.
  'key:upload',
  // /projects: the rail's Filters section owns the standing clear control; the
  // column's EmptyState shows the same words only when a filtered list came
  // back empty - recovery copy inside an empty state, not a second toolbar.
  'key:clear_filters',
  // /readiness: the rail's Next steps owns the standing Builder shortcut;
  // the column shows the same words only inside the "no workspace connected"
  // warning, which renders only when there is none - the remedy for that
  // warning, not a second shortcut.
  'key:open_builder',
  // /readiness: this scan reads the file, not the render branch. The page
  // has an early return for "no workspace yet" that renders its own shell
  // with no rail at all, and offers the same Ask-AI button there. A reader
  // never sees both, because they are different screens.
  'key:ask_ai_plan',
  // /analytics: the rail's "Where to go next" holds the standing shortcut
  // strip. The column names the same two destinations only inside the
  // "this dropped" alert, which renders only when a metric actually
  // declined and points at the one that did - a remedy, not a shortcut.
  'key:open_profile',
  'key:open_messages',
  // Same page: "reply faster" is the rail item's subtitle, and in the
  // column it is the button under the average-response-time figure it
  // belongs to. Descriptive text beside a number, not a second button.
  'key:reply_faster',
  // /research: "items" is a unit, not a control - the rail's summary tile
  // counts them and every board card is labelled in the same word.
  'key:items',
  // /research: the rail's Continue tile falls back to "use a template"
  // only when there is no board to continue - the other branch of a
  // ternary, never rendered beside the header button that owns the action.
  'key:use_template',
  // /activity: the rail's type filter names the same kinds the feed rows
  // badge. The badge is a label on a row, not a second filter.
  'key:type_connection',
  'key:type_message',
  'key:type_match',
  'key:type_milestone',
  'key:type_achievement',
  'key:type_event',
  'key:type_endorsement',
  'key:type_job',
  'key:type_system',
  'key:type_invite',
  // /activity: the rail's Shortcuts owns the standing events link; the
  // Events tab shows the same words only inside the empty state — recovery
  // copy, not a second shortcut.
  'key:browse_events',
  // /dashboard/founder: both of these are sentences, in both places. The rail's
  // milestone card closes with a footnote line - "all complete", or "add your
  // first one" when there is nothing yet - and the column's milestones metric
  // tile carries the same sentence as its caption under the count. Neither is a
  // button; the control for milestones is the tile and the card's Manage link,
  // which are named differently and appear once each.
  'key:milestones_all_complete',
  'key:add_first_milestone',
  // /messages: the rail's Shortcuts owns the standing destinations; the column
  // names them only inside the "no pending intro requests" empty state, which
  // renders only when there is nothing to answer - recovery copy, not a second
  // pair of shortcuts. (That empty state exists in both panes of the two-pane
  // layout; the list pane's copy is md:hidden so only one pair is ever drawn.)
  'key:find_people',
  'key:browse_matches',
  // /readiness: the two tracks the whole page scores. In the column they are
  // the progression chart's series names and the swatches in its legend; in the
  // rail they label the two figures on each history entry ("Accelerator 72% ·
  // Investor 65%"). An axis name, not a control - and naming the same track
  // differently in the two places would make the page contradict itself.
  'key:accelerator',
  'key:investor',
]);

const pages = RAIL_ROOTS.flatMap(walk)
  .map((path) => ({ path: path.replace(/\\/g, '/'), source: readFileSync(path, 'utf8') }))
  .filter((page) => page.source.includes('const rail: PageRailSection[]'));

const knownGlyphs = (() => {
  const source = readFileSync(GLYPH_SOURCE, 'utf8');
  const block = source.slice(
    source.indexOf('CFB_GLYPH_NAMES'),
    source.indexOf('export type CfbGlyphName'),
  );
  return new Set(Array.from(block.matchAll(/'([a-z0-9-]+)'/g)).map((m) => m[1]));
})();

describe('page rail contract', () => {
  it('finds the pages that declare a rail', () => {
    // A failing count here means the parser drifted from the shape pages use,
    // and every assertion below would pass vacuously.
    expect(pages.length).toBeGreaterThan(0);
    for (const page of pages) {
      expect(parseRailSections(page.source).length, page.path).toBeGreaterThan(0);
    }
  });

  it('gives every section a unique id', () => {
    const offenders: string[] = [];
    for (const page of pages) {
      const ids = parseRailSections(page.source).map((s) => s.id);
      const seen = new Set<string>();
      for (const id of ids) {
        // The open panel is looked up by id; a duplicate makes one section
        // unreachable and the other appear twice in the strip.
        if (seen.has(id)) offenders.push(`${page.path}: duplicate section id "${id}"`);
        seen.add(id);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('labels every section in both languages', () => {
    const offenders: string[] = [];
    for (const page of pages) {
      for (const section of parseRailSections(page.source)) {
        if (!section.labelEn.trim()) offenders.push(`${page.path}: "${section.id}" has no English label`);
        if (!section.labelEl.trim()) offenders.push(`${page.path}: "${section.id}" has no Greek label`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('names a glyph the icon set actually has', () => {
    const offenders: string[] = [];
    for (const page of pages) {
      for (const section of parseRailSections(page.source)) {
        // An unknown name falls back to a generic icon, so the strip becomes a
        // column of identical shapes - which is the one thing it cannot be.
        if (!knownGlyphs.has(section.glyph)) {
          offenders.push(`${page.path}: "${section.id}" uses unknown glyph "${section.glyph}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('puts each control in the column or the rail, never both', () => {
    // A control that appears in both is not "one gesture away" - it is
    // furniture. Worse, it teaches the reader the rail is a copy, and they
    // stop looking there. The rule that lets the column be calm is that
    // moving a control to the rail *moves* it.
    const offenders: string[] = [];
    for (const page of pages) {
      const { rail, page: rest } = splitRail(page.source);
      const inRail = controlLabels(withoutNonControlText(rail));
      const inPage = controlLabels(withoutNonControlText(withoutControlRegistrations(rest)));
      for (const label of inRail) {
        if (inPage.has(label) && !SHARED_TEXT_ALLOWLIST.has(label)) {
          offenders.push(`${page.path}: "${label.slice(label.indexOf(':') + 1)}" is in the rail and in the page`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('binds each piece of state to a control in the column or the rail, never both', () => {
    // The label check above misses the common way a control gets duplicated:
    // a rail "Status" section of pressed buttons beside a column <Select> with
    // "All Status" / "Active" items. Different words, same control, because
    // both drive `statusFilter`. So compare state as well as words.
    //
    // A rail control *shows* its state (`aria-pressed={statusFilter === o}`,
    // `aria-checked`, `checked`, `value`). The column duplicates it when it
    // binds a control to the same state: `value={statusFilter}` or
    // `onValueChange={setStatusFilter}`. A rail button that only *calls* a
    // setter as a side effect (coaching jumps to the tab its filter affects)
    // shows nothing, so it is not counted.
    const offenders: string[] = [];
    for (const page of pages) {
      const { rail, page: rest } = splitRail(page.source);
      const setters = new Map(
        Array.from(page.source.matchAll(/const \[(\w+), (set\w+)\] = useState/g)).map((m) => [m[1], m[2]]),
      );
      const shown = new Set<string>();
      for (const m of rail.matchAll(/(?:aria-pressed|aria-checked|checked|pressed|value)=\{([^}]*)\}/g)) {
        for (const id of m[1].match(/\b\w+\b/g) ?? []) if (setters.has(id)) shown.add(id);
      }
      const bound = new Set<string>();
      for (const m of rest.matchAll(/\b(?:value|checked|pressed)=\{(\w+)\}/g)) if (setters.has(m[1])) bound.add(m[1]);
      for (const m of rest.matchAll(/on(?:ValueChange|CheckedChange|PressedChange|Change)=\{(set\w+)\}/g)) {
        for (const [state, setter] of setters) if (setter === m[1]) bound.add(state);
      }
      for (const state of shown) {
        if (bound.has(state)) offenders.push(`${page.path}: "${state}" has a control in the rail and in the page`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps the rail off pages that have nothing to put in it', () => {
    const offenders: string[] = [];
    for (const page of pages) {
      // One section is a panel, not a rail: it costs a 52px strip and a click
      // to reach what a single inline control would have shown for free.
      if (parseRailSections(page.source).length < 2) {
        offenders.push(`${page.path}: a rail needs at least two sections`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
