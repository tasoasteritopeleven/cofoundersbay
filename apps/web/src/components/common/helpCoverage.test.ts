import { describe, expect, it } from 'vitest';
import { PAGE_REGISTRY } from '@/lib/page-registry';
import { HELP_CONTENT } from '@/components/common/PageContextualHelp';

/**
 * Locks the contextual-help contract so the two halves cannot drift apart again.
 *
 * The wiring has three independent parts — a registry entry, curated copy, and
 * the page opting in via `showHelp` — and each has silently fallen out of step
 * before: seven admin screens shipped with copy that never rendered because they
 * never opted in, and every body was English-only on an otherwise bilingual
 * platform. These assertions fail loudly instead.
 */

const helpEntries = PAGE_REGISTRY.filter((p) => p.helpId);

describe('contextual help coverage', () => {
  it('gives every registry helpId a Greek heading', () => {
    const missing = helpEntries.filter((p) => !p.helpTitleEl).map((p) => p.path);
    expect(missing).toEqual([]);
  });

  it('gives every curated entry both languages', () => {
    const incomplete = Object.entries(HELP_CONTENT)
      .filter(([, copy]) => !copy.en || !copy.el)
      .map(([id]) => id);
    expect(incomplete).toEqual([]);
  });

  it('has no curated copy keyed to an id no route declares', () => {
    const declared = new Set(helpEntries.map((p) => p.helpId));
    const orphans = Object.keys(HELP_CONTENT).filter((id) => !declared.has(id));
    expect(orphans).toEqual([]);
  });

  it('keeps every declared helpId paired with a heading', () => {
    const untitled = helpEntries.filter((p) => !p.helpTitle).map((p) => p.path);
    expect(untitled).toEqual([]);
  });

  it('covers the routes the June audit named critical for explainability', () => {
    // builder / discover / fundraising / settings were Phase B's explicit list.
    for (const path of ['/builder', '/discover', '/fundraising', '/settings']) {
      const entry = PAGE_REGISTRY.find((p) => p.path === path);
      expect(entry?.helpId, `${path} should declare help`).toBeTruthy();
      expect(HELP_CONTENT[entry!.helpId!], `${path} should have curated copy`).toBeTruthy();
    }
  });
});
