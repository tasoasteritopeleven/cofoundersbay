import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Copy that every person reads must not carry the showcase's facts.
 *
 * Harbor, its $750K seed and the Athens Tech Angels' $375K are the demo
 * workspace. They belong in the preview fixtures and in code paths gated on the
 * showcase. They leaked, more than once, into surfaces that describe the
 * product to everyone: /fundraising told every founder to "Track Harbor's $750K
 * seed", /ai introduced itself as "the Harbor copilot", the sidebar hint for
 * /ai named the seed, and the help panel said the assistant reads Harbor's
 * round. Worse than the copy, the fundraising page briefed the assistant with
 * Harbor's round when a founder asked it to write to their *own* investor.
 *
 * The files below are read by every user, signed in or not, demo or live, so
 * none of them may name the showcase at all. Example phrasings with an example
 * person are fine elsewhere (/ai/capabilities uses "Save Elena to my shortlist"
 * and says it is an example); naming the demo company or its money here is not.
 */

const SRC = join(__dirname, '..');

/** Every person reads these; nothing in them is gated on the showcase. */
const UNIVERSAL_COPY = [
  'lib/page-registry.ts',
  'lib/i18n/strings-pages.ts',
  'lib/nav-descriptions.ts',
  'components/common/PageContextualHelp.tsx',
  // The /ai page's own introduction, shown to every user.
  'components/ai/CopilotEmptyState.tsx',
];

/** The showcase's identifying facts. */
const SHOWCASE_FACTS = [/\bHarbor\b/, /\$750K/, /Athens Tech Angels/, /\$375K/];

describe('showcase facts stay in the showcase', () => {
  it('keeps universal page copy free of the demo workspace', () => {
    const offenders: string[] = [];
    for (const rel of UNIVERSAL_COPY) {
      const lines = readFileSync(join(SRC, rel), 'utf8').split('\n');
      lines.forEach((line, i) => {
        // A comment may name the showcase to explain why it is absent.
        const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
        for (const fact of SHOWCASE_FACTS) {
          if (fact.test(code)) offenders.push(`${rel}:${i + 1}  ${line.trim().slice(0, 90)}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it('gates every assistant brief that states the demo round', () => {
    // A prompt naming Harbor's round is legitimate only behind the showcase
    // flag. In the fundraising page the per-lead brief once ignored it.
    const src = readFileSync(join(SRC, 'app/fundraising/page.tsx'), 'utf8');
    const fn = src.slice(src.indexOf('function leadAskPrompt'), src.indexOf('function LeadName'));
    expect(fn).toMatch(/harborLive\s*\?/);
    expect(fn.split('?')[2] ?? '').not.toMatch(/Harbor|\$750K|Athens Tech/);
  });
});
