import { describe, expect, it } from 'vitest';
import { acceptsApplications, toProgramItem } from './api';

/**
 * The program endpoints answer with Prisma rows, not the `ProgramItem` the
 * pages read. `apiRequest` casts without checking, so the mismatch showed as
 * "Untitled" cards, 0/8 seats and an Apply button that never appeared, with
 * no error anywhere. What is asserted: a controller row becomes a complete
 * `ProgramItem`; a row already in that shape passes through; and the Apply
 * rule is the API's own (upcoming or running, before the deadline).
 */

const row = {
  id: 'p1',
  name: 'Seed Accelerator · Autumn 2026',
  slug: 'seed-autumn-2026',
  description: 'Twelve weeks.',
  programType: 'accelerator',
  status: 'active',
  startDate: '2026-09-07T09:00:00.000Z',
  endDate: '2026-11-30T18:00:00.000Z',
  applicationDeadline: null,
  capacity: 8,
  currentParticipants: 5,
  benefits: ['€50K for 7% equity'],
  settings: { industries: ['FinTech'], location: 'Athens, Greece', isRemote: false },
  organization: { id: 'o1', name: 'Aegean Venture Lab', logoUrl: null, type: 'accelerator' },
  _count: { participants: 7 },
  createdAt: '2026-06-01T10:00:00.000Z',
  updatedAt: '2026-09-24T10:00:00.000Z',
};

describe('toProgramItem', () => {
  it('reads a controller row: name, counts, settings and organisation type', () => {
    const p = toProgramItem(row);
    expect(p.title).toBe('Seed Accelerator · Autumn 2026');
    expect(p.participantCount).toBe(5);
    expect(p.applicationCount).toBe(7);
    expect(p.industries).toEqual(['FinTech']);
    expect(p.location).toBe('Athens, Greece');
    expect(p.isRemote).toBe(false);
    expect(p.benefits).toEqual(['€50K for 7% equity']);
    expect(p.organization.organizationType).toBe('accelerator');
  });

  it('passes a row already in ProgramItem form through', () => {
    const once = toProgramItem(row);
    expect(toProgramItem(once)).toEqual(once);
  });

  it('never leaves a field the pages read undefined', () => {
    const p = toProgramItem({ id: 'bare' });
    expect(p.title).toBe('Untitled program');
    expect(p.industries).toEqual([]);
    expect(p.benefits).toEqual([]);
    expect(p.participantCount).toBe(0);
    expect(p.organization.name).toBe('');
  });
});

describe('acceptsApplications', () => {
  const now = Date.parse('2026-09-25T12:00:00.000Z');
  it('takes applications while upcoming or running and before the deadline', () => {
    expect(acceptsApplications({ status: 'upcoming', applicationDeadline: '2026-10-16T23:00:00.000Z' }, now)).toBe(true);
    expect(acceptsApplications({ status: 'active', applicationDeadline: null }, now)).toBe(true);
  });
  it('refuses once the deadline has passed or the program is not open', () => {
    expect(acceptsApplications({ status: 'active', applicationDeadline: '2026-08-01T00:00:00.000Z' }, now)).toBe(false);
    expect(acceptsApplications({ status: 'completed', applicationDeadline: null }, now)).toBe(false);
    expect(acceptsApplications({ status: 'draft', applicationDeadline: null }, now)).toBe(false);
    // "open" was the page's word; no program has ever had that status.
    expect(acceptsApplications({ status: 'open', applicationDeadline: null }, now)).toBe(false);
  });
});
