import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Nothing the product shows a person about themselves or about someone else
 * may be invented.
 *
 * The app had eight of these at once: a presence dot that was
 * `Math.random() > 0.55`, a "contribution score" bar, a year-long activity
 * heatmap, venture readiness generated per criterion behind a fake two-second
 * "analysing" delay, a compatibility radar whose five axes were one score
 * nudged by fixed percentages, and match badges on /mentoring, /shortlist and
 * /compare. Each rendered a different number on every pass, disagreed with the
 * same figure elsewhere in the app, and broke hydration for good measure.
 *
 * `Math.random()` is legitimate for exactly two jobs — generating an id, and
 * scattering nodes so freshly dropped ones do not stack. Both are listed here
 * with the reason. A new file reaching for it is almost certainly inventing a
 * fact, so this test fails until it is either fixed or added with a reason.
 */

const SRC = join(__dirname, '..');

const ALLOWED: Record<string, string> = {
  'app/messages/page.tsx': 'optimistic message id before the server assigns one',
  'components/canvas/ResearchCanvas.tsx': 'client-side node id',
  'components/chat/UnifiedChatPopup.tsx': 'optimistic message id',
  'components/research/CanvasCopilotPanel.tsx': 'scatters imported nodes so they do not stack',
  'components/research/FlowDiagramNode.tsx': 'scatters new diagram nodes',
  'components/ui/toast.tsx': 'id for a transient toast',
  'hooks/useRealtimeMessages.ts': 'optimistic message id',
  'lib/copilot-engine.ts': 'id for an assistant card',
  'lib/copilot-reads.ts': 'id for an assistant card',
  'lib/demo/commitments-world.ts': 'token for a demo public card link',
  'lib/feed-demo.ts': 'local post id',
  'lib/preview-api.ts': 'demo comment id',
};

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== 'node_modules') sourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Lines that only mention `Math.random()` in prose do not count. */
function usesRandomInCode(text: string): boolean {
  return text
    .split('\n')
    .some((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return false;
      return line.includes('Math.random()');
    });
}

describe('no fabricated data', () => {
  it('keeps Math.random() to id generation and node scatter', () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => usesRandomInCode(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC, file).replaceAll('\\', '/'))
      .filter((rel) => !(rel in ALLOWED));

    expect(offenders).toEqual([]);
  });

  it('lists a reason for every file that is allowed to use it', () => {
    for (const [file, reason] of Object.entries(ALLOWED)) {
      expect(reason.length, `${file} needs a reason`).toBeGreaterThan(10);
    }
  });
});
