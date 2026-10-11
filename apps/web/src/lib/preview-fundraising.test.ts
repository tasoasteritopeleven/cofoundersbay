import { describe, expect, it } from 'vitest';
import {
  FUNDRAISING_SEED_DOCS,
  FUNDRAISING_SEED_LEADS,
  FUNDRAISING_SEED_ROUND,
  coerceFundraisingOverlay,
  emptyFundraisingOverlay,
  isStaleHarborFundraisingSeed,
  resolveFundraisingDocs,
  resolveFundraisingLeads,
} from './fundraising-demo';

describe('preview fundraising', () => {
  it('refuses leftover generic investors on the Harbor seed', () => {
    expect(isStaleHarborFundraisingSeed(JSON.stringify({
      name: 'Sarah Chen',
      firm: 'Sequoia Capital',
    }))).toBe(true);
    expect(isStaleHarborFundraisingSeed(JSON.stringify({
      round: FUNDRAISING_SEED_ROUND,
      leads: FUNDRAISING_SEED_LEADS,
      docs: FUNDRAISING_SEED_DOCS,
    }))).toBe(false);
  });

  it('drops leftover status keys from invented seed ids', () => {
    const listed = resolveFundraisingLeads({
      created: [],
      status: { l1: 'dd', ata: 'passed' },
      docsStatus: {},
      docsUpdated: {},
    });
    expect(listed.find((l) => l.id === 'ata')?.status).toBe('passed');
    expect(listed.some((l) => l.id === 'l1')).toBe(false);
    expect(listed).toHaveLength(3);
  });

  it('keeps a user-created contact next to Harbor without aliasing seed ids', () => {
    const extra = {
      id: 'l-test-extra',
      name: 'Local angel in Athens',
      type: 'Angel',
      stage: 'Pre-Seed / Seed',
      checkSize: '$25K–$50K',
      status: 'prospect' as const,
      isVerified: false,
    };
    const listed = resolveFundraisingLeads({
      created: [extra],
      status: {},
      docsStatus: {},
      docsUpdated: {},
    });
    expect(listed[0]?.id).toBe('l-test-extra');
    expect(listed.some((l) => l.id === 'ata' && l.name === 'Athens Tech Angels')).toBe(true);
    expect(listed.filter((l) => l.id === extra.id)).toHaveLength(1);
    expect(coerceFundraisingOverlay({
      created: [{ ...extra, id: 'ata' }],
      status: { l5: 'meeting' },
    }).created).toEqual([]);
  });

  it('marks a data-room upload ready in the overlay without inventing files', () => {
    const after = resolveFundraisingDocs({
      created: [],
      status: {},
      docsStatus: { d3: 'ready' },
      docsUpdated: { d3: '2026-09-04T12:00:00.000Z' },
    });
    expect(after.find((d) => d.id === 'd3')?.status).toBe('ready');
    expect(after.find((d) => d.id === 'd3')?.lastUpdated).toBe('2026-09-04T12:00:00.000Z');
    expect(after.find((d) => d.id === 'd1')?.status).toBe('ready');
    expect(emptyFundraisingOverlay().created).toEqual([]);
  });
});
