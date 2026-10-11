import { describe, expect, it, vi } from 'vitest';
import { OPEN_TO_BOOST, openToBoost, openToShownTo, readOpenTo, seekerWants, type OpenToSignal } from '@cofounderbay/shared';
import { OpenToService } from './open-to.service';

const NOW = Date.parse('2026-10-07T09:00:00Z');
const DAY = 86_400_000;
const signal = (over: Partial<OpenToSignal> = {}): OpenToSignal => ({ kinds: ['cofounder'], visibility: 'nobody', note: null, expiresAt: new Date(NOW + 30 * DAY).toISOString(), ...over });

describe('open-to rules', () => {
  it('needs at least one kind, keeps the canonical order, and refuses contact details and promises', () => {
    expect(readOpenTo({ kinds: ['mentor', 'cofounder', 'mentor', 'astronaut'], visibility: 'verified', note: ' Fintech, Athens ' })).toEqual({
      ok: true,
      value: { kinds: ['cofounder', 'mentor'], visibility: 'verified', note: 'Fintech, Athens' },
    });
    expect(readOpenTo({ kinds: [] })).toEqual({ ok: false, problems: ['kinds'] });
    expect(readOpenTo({ kinds: ['angel'], note: 'Email me at a@b.co' })).toMatchObject({ ok: false, problems: ['contact'] });
    expect(readOpenTo({ kinds: ['angel'], note: 'Guaranteed 3x return' })).toMatchObject({ ok: false, problems: ['promise'] });
    // An unknown visibility falls back to the most private one.
    expect(readOpenTo({ kinds: ['angel'], visibility: 'public' })).toMatchObject({ ok: true, value: { visibility: 'nobody' } });
  });

  it('shows the signal only as far as its visibility allows, and never once it lapsed', () => {
    const viewer = { isOwner: false, verified: false };
    expect(openToShownTo(signal({ visibility: 'nobody' }), viewer, NOW)).toEqual([]);
    expect(openToShownTo(signal({ visibility: 'verified' }), viewer, NOW)).toEqual([]);
    expect(openToShownTo(signal({ visibility: 'verified' }), { ...viewer, verified: true }, NOW)).toEqual(['cofounder']);
    expect(openToShownTo(signal({ visibility: 'everyone' }), viewer, NOW)).toEqual(['cofounder']);
    expect(openToShownTo(signal({ visibility: 'everyone', expiresAt: new Date(NOW - DAY).toISOString() }), viewer, NOW)).toEqual([]);
    expect(openToShownTo(signal({ visibility: 'nobody' }), { isOwner: true, verified: false }, NOW)).toEqual(['cofounder']);
  });

  it('lifts a candidate by at most the boost, in proportion to what the seeker wants', () => {
    expect(seekerWants(['investor', 'advisor'])).toEqual(['angel', 'advisor']);
    expect(seekerWants([], 'founder')).toEqual(['cofounder', 'advisor']);
    expect(openToBoost(signal({ kinds: ['cofounder', 'advisor'] }), ['cofounder', 'advisor'], NOW)).toBeCloseTo(OPEN_TO_BOOST);
    expect(openToBoost(signal({ kinds: ['cofounder'] }), ['cofounder', 'advisor'], NOW)).toBeCloseTo(OPEN_TO_BOOST / 2);
    expect(openToBoost(signal({ kinds: ['mentor'] }), ['cofounder'], NOW)).toBe(0);
    expect(openToBoost(signal({ expiresAt: new Date(NOW - 1).toISOString() }), ['cofounder'], NOW)).toBe(0);
  });
});

function setup() {
  const rows = new Map<string, any>();
  const prisma = {
    openToSignal: {
      findUnique: vi.fn(async ({ where }: any) => rows.get(where.userId) ?? null),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const row = rows.has(where.userId) ? { ...rows.get(where.userId), ...update } : { ...create };
        rows.set(where.userId, row);
        return row;
      }),
      deleteMany: vi.fn(async ({ where }: any) => void rows.delete(where.userId)),
      findMany: vi.fn(async ({ where }: any) => [...rows.values()].filter((r) => where.userId.in.includes(r.userId) && r.expiresAt > where.expiresAt.gt)),
    },
  };
  const verification = { isVerified: vi.fn(async (id: string) => id === 'verified-viewer') };
  return { service: new OpenToService(prisma as never, verification as never), verification };
}

describe('OpenToService', () => {
  it('saves a signal for 90 days and refuses an empty one in both languages', async () => {
    const { service } = setup();
    const saved = await service.set('elena', { kinds: ['cofounder'], visibility: 'verified' }, NOW);
    expect(saved).toMatchObject({ active: true, signal: { kinds: ['cofounder'], visibility: 'verified', expiresAt: new Date(NOW + 90 * DAY).toISOString() } });
    const err = await service.set('elena', { kinds: [] }, NOW).catch((e) => e);
    expect(err.getResponse().error.details).toMatchObject({ reason: 'open_to_invalid', problems: ['kinds'], messageEl: expect.stringContaining('Επιλέξτε') });
  });

  it('answers another person only with what they may see, asking about verification only when it matters', async () => {
    const { service, verification } = setup();
    await service.set('elena', { kinds: ['angel'], visibility: 'nobody' }, NOW);
    expect(await service.forViewer('marcus', 'elena', NOW)).toEqual({ kinds: [] });
    expect(verification.isVerified).not.toHaveBeenCalled();
    await service.set('elena', { kinds: ['angel'], visibility: 'verified' }, NOW);
    expect(await service.forViewer('marcus', 'elena', NOW)).toEqual({ kinds: [] });
    expect(await service.forViewer('verified-viewer', 'elena', NOW)).toEqual({ kinds: ['angel'] });
    expect(await service.forViewer('elena', 'elena', NOW)).toEqual({ kinds: ['angel'] });
  });

  it('leaves lapsed signals out of ranking, and clears on request', async () => {
    const { service } = setup();
    await service.set('elena', { kinds: ['cofounder'] }, NOW - 100 * DAY);
    await service.set('sofia', { kinds: ['advisor'] }, NOW);
    expect([...(await service.activeSignals(['elena', 'sofia'], NOW)).keys()]).toEqual(['sofia']);
    expect(await service.clear('sofia')).toEqual({ signal: null, active: false });
    expect((await service.mine('sofia', NOW)).signal).toBeNull();
  });
});
