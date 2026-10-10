import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Facts are text, states are pills. A card's descriptive facts - skills,
 * sectors, stages, topics, tags, expertise - render through `FactLine`
 * (one muted, dot-separated line). A `<Badge>` drawn in a loop is kept only
 * where it is a control or a state, listed here with the reason. On
 * 2026-10-09 a phone met up to eight such pills on one investor card and a
 * need card read as a wall (`.probes/card_type.mjs`).
 */
const ALLOWED: Record<string, string> = {
  'src/app/profile/edit/page.tsx': 'removable tag chips in a form (each carries its remove button)',
  'src/app/projects/create/page.tsx': 'removable role chips in a form',
  'src/components/feed/CreatePost.tsx': 'removable tag chips while composing',
  'src/components/discover/SearchFilters.tsx': 'active filters, each removable',
  'src/components/builder/MVPPlanner.tsx': 'removable goal chips in the planner',
  'src/components/research/NodeTagsEditor.tsx': 'removable tags on a canvas node, in its editor',
  'src/app/investor/scouting/page.tsx': 'active filters, each removable',
  'src/app/tenant/api-keys/page.tsx': 'API scopes are identifiers, read as tokens',
  'src/app/tenant/webhooks/page.tsx': 'webhook event names are identifiers, read as tokens',
  'src/app/org/analytics/page.tsx': 'a programme taking applications is a state',
  'src/app/matches/[userId]/page.tsx': 'the match explanation highlights what two people share',
  'src/app/themes/alliance/page.tsx': 'a preview of a third-party theme, drawn as that theme draws it',
};

// On Windows join() gives backslashes while ALLOWED keys are forward-slash
// relative paths — normalise once so the lookup and the read both work.
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name) ? [path.replace(/\\/g, '/')] : [];
  });
}

describe('facts are text, states are pills', () => {
  const all = [...files('src/app'), ...files('src/components')];

  it('draws no Badge in a loop outside the reasoned list', () => {
    const offenders = all.filter((file) => /<Badge\s+key=/.test(readFileSync(file, 'utf8')) && !ALLOWED[file]);
    expect(offenders).toEqual([]);
  });

  it('keeps the list honest: every allowed file still draws one', () => {
    const stale = Object.keys(ALLOWED).filter((file) => !/<Badge\s+key=/.test(readFileSync(file, 'utf8')));
    expect(stale).toEqual([]);
  });

  it('draws no static SkillChip in a loop (a chip without onClick or removable is a fact)', () => {
    const offenders = all.filter((file) => /<SkillChip\s+key=[^>]*\/>/.test(readFileSync(file, 'utf8')) && !/<SkillChip\s+key=[^>]*(onClick|removable)/.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('draws no tinted tag span in a loop', () => {
    const TAG = /\.map\([^)]*\)\s*=>\s*\(?\s*<span[^>]*className="[^"]*(?:rounded-(?:full|md))[^"]*bg-(?:secondary|muted)[^"]*px-2[^"]*"/;
    const offenders = all.filter((file) => TAG.test(readFileSync(file, 'utf8').replace(/\n\s*/g, ' ')));
    expect(offenders).toEqual([]);
  });
});
