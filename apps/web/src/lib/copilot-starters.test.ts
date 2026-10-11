import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  COPILOT_PRODUCT_LINKS,
  COPILOT_STARTERS,
  copilotStartersFor,
} from './copilot-starters';

const EMPTY_STATE_SOURCE = readFileSync(
  join(__dirname, '..', 'components', 'ai', 'CopilotEmptyState.tsx'),
  'utf8',
);
const WORKSPACE_SOURCE = readFileSync(
  join(__dirname, '..', 'components', 'ai', 'CopilotWorkspace.tsx'),
  'utf8',
);

const STALE = /Sequoia|Sarah Chen|Horizon Capital|Klaus Weber|Emma Williams|TechCrunch|Product Hunt|San Francisco|\$3M|1,000\+|\$5K|\$50K MRR|\$3M ARR/;

describe('copilot empty-state lockstep', () => {
  it('keeps Harbor reads as two groups without invented traction', () => {
    const { reads, writes } = copilotStartersFor('page');
    expect(reads.map((row) => row.en)).toEqual([
      'What should I do next?',
      'Show my best matches',
      'Find a technical cofounder in Athens',
      'How is my fundraising going?',
    ]);
    expect(writes.map((row) => row.en)).toEqual([
      'Save Elena to my shortlist',
      'Remove Elena from my shortlist',
      'Connect with Elena',
    ]);
    expect(COPILOT_STARTERS.some((row) => STALE.test(`${row.en} ${row.el}`))).toBe(false);
    expect(reads.some((row) => row.en.toLowerCase().includes('notification'))).toBe(false);
  });

  it('keeps the popup compact: no wrapping research/calendar pile, no remove-Elena', () => {
    const page = copilotStartersFor('page');
    const popup = copilotStartersFor('popup');
    expect(popup.reads.map((row) => row.en)).toEqual(page.reads.map((row) => row.en));
    expect(popup.writes.length).toBeLessThan(page.writes.length);
    expect(popup.writes.some((row) => row.en.startsWith('Remove'))).toBe(false);
    expect(popup.reads.map((row) => row.en)).toEqual([
      'What should I do next?',
      'Show my best matches',
      'Find a technical cofounder in Athens',
      'How is my fundraising going?',
    ]);
  });

  it('links into Work surfaces the assistant actually reads', () => {
    expect(COPILOT_PRODUCT_LINKS.map((link) => link.href)).toEqual([
      '/matches',
      '/messages',
      '/fundraising',
      '/research',
      '/calendar',
      '/builder',
      '/builder/applications',
    ]);
  });

  it('renders starters as full-width rows that fill the pane, not a centred island', () => {
    expect(EMPTY_STATE_SOURCE).toContain('md:grid-cols-2');
    expect(EMPTY_STATE_SOURCE).toContain('md:divide-x');
    expect(EMPTY_STATE_SOURCE).toContain('w-full');
    expect(EMPTY_STATE_SOURCE).toContain('type-caption');
    expect(EMPTY_STATE_SOURCE).toContain('type-ui');
    expect(EMPTY_STATE_SOURCE).toContain('type-support');
    expect(EMPTY_STATE_SOURCE).toContain('mt-auto');
    expect(EMPTY_STATE_SOURCE).not.toContain('Writes wait');
    expect(EMPTY_STATE_SOURCE).not.toContain('flex-wrap');
    expect(EMPTY_STATE_SOURCE).not.toContain('rounded-full');
    expect(EMPTY_STATE_SOURCE).not.toContain('justify-center');
    expect(EMPTY_STATE_SOURCE).not.toContain('mx-auto');
    expect(EMPTY_STATE_SOURCE).not.toContain('max-w-3xl');
    expect(EMPTY_STATE_SOURCE).not.toContain('type-kicker');
    expect(EMPTY_STATE_SOURCE).not.toContain('type-plus-1');
    expect(EMPTY_STATE_SOURCE).not.toContain('type-plus-once');
    expect(EMPTY_STATE_SOURCE).not.toContain('type-minus-half');
    expect(EMPTY_STATE_SOURCE).not.toContain('type-plus-quarter');
    expect(EMPTY_STATE_SOURCE).not.toContain('type-plus-2');
    expect(WORKSPACE_SOURCE).toContain('CopilotEmptyState');
    expect(WORKSPACE_SOURCE).toContain('COPILOT_PRODUCT_LINKS');
    expect(WORKSPACE_SOURCE).toContain('type-identity');
    expect(WORKSPACE_SOURCE).toContain('type-support');
    expect(WORKSPACE_SOURCE).toContain('I can read');
    expect(WORKSPACE_SOURCE).toContain('Changes wait for your confirmation.');
    expect(WORKSPACE_SOURCE).not.toContain('type-plus-1');
    expect(WORKSPACE_SOURCE).not.toContain('type-plus-once');
    expect(WORKSPACE_SOURCE).not.toContain('type-plus-2');
    expect(WORKSPACE_SOURCE).not.toContain('flex-wrap gap-2');
  });
});
