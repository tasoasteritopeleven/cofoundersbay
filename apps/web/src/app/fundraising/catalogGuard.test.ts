import { describe, expect, it } from 'vitest';
import {
  FUNDRAISING_SEED_DOCS,
  FUNDRAISING_SEED_LEADS,
  FUNDRAISING_SEED_ROUND,
  fundraisingPipelineStats,
  fundraisingRoundView,
} from '@/lib/fundraising-demo';

describe('fundraising catalogue lockstep', () => {
  const stats = fundraisingPipelineStats(FUNDRAISING_SEED_LEADS);
  const round = fundraisingRoundView(FUNDRAISING_SEED_LEADS);
  const blob = JSON.stringify({
    round: FUNDRAISING_SEED_ROUND,
    leads: FUNDRAISING_SEED_LEADS,
    docs: FUNDRAISING_SEED_DOCS,
  });

  it('keeps pipeline counts internally consistent', () => {
    expect(FUNDRAISING_SEED_LEADS).toHaveLength(3);
    expect(stats.total).toBe(3);
    expect(stats.active).toBe(2);
    expect(stats.committed).toBe(1);
    expect(stats.conversion).toBe(33);
    expect(FUNDRAISING_SEED_LEADS.map((l) => l.id)).toEqual(['ata', 'athens-network', 'remaining-close']);
  });

  it('never shows a round investor count that disagrees with committed leads', () => {
    expect(round.investors).toBe(stats.committed);
    expect(round.raised).toBe(375_000);
    expect(round.target).toBe(750_000);
    expect(Math.round((round.raised / round.target) * 100)).toBe(50);
    expect(round.leadInvestor).toBe('Athens Tech Angels');
    expect(round.name).toBe('Harbor $750K seed');
    expect(round.valuation).toBeUndefined();
    expect(FUNDRAISING_SEED_LEADS.find((l) => l.status === 'committed')?.checkSize).toContain('200K');
  });

  it('keeps the data room list at 10 documents for the Data Room tab badge', () => {
    expect(FUNDRAISING_SEED_DOCS).toHaveLength(10);
    expect(FUNDRAISING_SEED_DOCS.filter((d) => d.isRequired)).toHaveLength(5);
    expect(FUNDRAISING_SEED_DOCS.filter((d) => d.isRequired && (d.status === 'ready' || d.status === 'shared'))).toHaveLength(2);
  });

  it('refuses leftover invented investors, valuation, and traction', () => {
    expect(blob).not.toContain('Sarah Chen');
    expect(blob).not.toContain('Sequoia');
    expect(blob).not.toContain('Horizon Capital');
    expect(blob).not.toContain('Klaus Weber');
    expect(blob).not.toContain('Emma Williams');
    expect(blob).not.toContain('Customer Contracts');
    expect(blob).not.toContain('3_000_000');
    expect(blob).not.toContain('3000000');
  });
});
