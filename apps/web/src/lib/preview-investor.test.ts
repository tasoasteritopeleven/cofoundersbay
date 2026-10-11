import { describe, expect, it } from 'vitest';
import { resolvePreviewApi } from './preview-api';

/**
 * The watchlist, the pipeline board and the portfolio are three filters over
 * one row. These assert that they cannot drift apart — the failure the model
 * exists to prevent is a startup sitting at "invested" on the board and being
 * absent from the portfolio, which is exactly what three separate piles of
 * invented data produced before.
 */

type Deal = {
  id: string;
  pipelineStage: string;
  starred: boolean;
  investedCents: number | null;
  currentValueCents: number | null;
  lastActivityAt: string;
};
type Page = { deals: Deal[]; total: number; hasMore: boolean };
type Summary = {
  stageCounts: Record<string, number>;
  totalDeals: number;
  investments: number;
  deployedCents: number;
  currentValueCents: number;
  returnPct: number | null;
};

const all = () => resolvePreviewApi('/api/investor/deals?limit=100') as Page;

describe('preview investor board', () => {
  it('serves the whole board, newest activity first', () => {
    const page = all();
    expect(page.deals.length).toBeGreaterThan(0);
    expect(page.total).toBe(page.deals.length);
    expect(page.hasMore).toBe(false);

    const times = page.deals.map((d) => d.lastActivityAt);
    expect(times).toEqual([...times].sort((a, b) => b.localeCompare(a)));
  });

  it('gives the portfolio exactly the deals the board calls invested', () => {
    const invested = resolvePreviewApi('/api/investor/deals?pipelineStage=invested') as Page;
    const fromBoard = all().deals.filter((d) => d.pipelineStage === 'invested');

    expect(invested.deals.length).toBeGreaterThan(0);
    expect(invested.deals.map((d) => d.id).sort()).toEqual(fromBoard.map((d) => d.id).sort());
    // An invested deal carries the money; one that is not, does not.
    expect(invested.deals.every((d) => d.investedCents != null)).toBe(true);
  });

  it('gives the watchlist exactly the deals the board calls discovered', () => {
    const watched = resolvePreviewApi('/api/investor/deals?pipelineStage=discovered') as Page;
    const fromBoard = all().deals.filter((d) => d.pipelineStage === 'discovered');

    expect(watched.deals.length).toBeGreaterThan(0);
    expect(watched.deals.map((d) => d.id).sort()).toEqual(fromBoard.map((d) => d.id).sort());
  });

  it('summarises the same rows the board lists', () => {
    const summary = resolvePreviewApi('/api/investor/summary') as Summary;
    const deals = all().deals;

    expect(summary.totalDeals).toBe(deals.length);
    for (const [stage, count] of Object.entries(summary.stageCounts)) {
      expect(deals.filter((d) => d.pipelineStage === stage)).toHaveLength(count);
    }

    const invested = deals.filter((d) => d.pipelineStage === 'invested');
    expect(summary.investments).toBe(invested.length);
    expect(summary.deployedCents).toBe(
      invested.reduce((sum, d) => sum + (d.investedCents ?? 0), 0),
    );
    // The return is arithmetic over those same two sums, not a stated figure.
    expect(summary.returnPct).toBe(
      Math.round(
        ((summary.currentValueCents - summary.deployedCents) / summary.deployedCents) * 100,
      ),
    );
  });

  it('narrows by starred and by search the way the real endpoint does', () => {
    const starred = resolvePreviewApi('/api/investor/deals?starred=true') as Page;
    expect(starred.deals.length).toBeGreaterThan(0);
    expect(starred.deals.every((d) => d.starred)).toBe(true);
    expect(starred.deals.length).toBeLessThan(all().deals.length);

    const searched = resolvePreviewApi('/api/investor/deals?search=harbor') as Page;
    expect(searched.deals).toHaveLength(1);
  });

  it('draws the activity feed from the deals themselves', () => {
    const { activity } = resolvePreviewApi('/api/investor/activity?limit=20') as {
      activity: Array<{ dealId: string; createdAt: string }>;
    };
    const ids = new Set(all().deals.map((d) => d.id));

    expect(activity.length).toBeGreaterThan(0);
    expect(activity.every((event) => ids.has(event.dealId))).toBe(true);
    const times = activity.map((e) => e.createdAt);
    expect(times).toEqual([...times].sort((a, b) => b.localeCompare(a)));
  });
});
