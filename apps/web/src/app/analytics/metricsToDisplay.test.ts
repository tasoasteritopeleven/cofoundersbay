import { describe, expect, it } from 'vitest';
import { metricsToDisplay } from './metrics';
import { resolvePreviewApi } from '@/lib/preview-api';

/**
 * Regression cover for "Cannot read properties of undefined (reading
 * 'profileViews')" — the analytics page went down through the error boundary
 * whenever the API response lacked a `metrics` object.
 *
 * Two independent defences are locked here, because either alone would have
 * left the page breakable:
 *   1. the preview resolver answers analytics routes with the real shape
 *      (before, they fell through to a generic grab-bag with no `metrics`)
 *   2. `metricsToDisplay` tolerates a missing or partial payload, so any future
 *      shape drift renders zeros instead of taking the page down
 */

const LABELS = [
  'Profile Views',
  'New Connections',
  'Messages Sent',
  'Engagement Rate',
  'Search Appearances',
  'Activity Score',
];

describe('metricsToDisplay', () => {
  it('renders all six tiles when the payload is missing entirely', () => {
    const tiles = metricsToDisplay(undefined);
    expect(tiles.map((t) => t.label)).toEqual(LABELS);
    expect(tiles.every((t) => t.value === null && t.change === null)).toBe(true);
    expect(tiles.every((t) => t.changeType === 'neutral')).toBe(true);
  });

  it('tolerates null without throwing', () => {
    expect(() => metricsToDisplay(null)).not.toThrow();
    expect(metricsToDisplay(null)).toHaveLength(6);
  });

  it('keeps the fields the server did send and marks the rest unavailable', () => {
    const tiles = metricsToDisplay({ profileViews: 248, profileViewsChange: 12 });
    const views = tiles.find((t) => t.label === 'Profile Views')!;
    const messages = tiles.find((t) => t.label === 'Messages Sent')!;
    expect(views.value).toBe(248);
    expect(views.change).toBe(12);
    expect(views.changeType).toBe('increase');
    expect(messages.value).toBeNull();
    expect(messages.changeType).toBe('neutral');
  });

  it('derives trend direction from the change value', () => {
    const [up] = metricsToDisplay({ profileViewsChange: 5 });
    const [down] = metricsToDisplay({ profileViewsChange: -5 });
    const [flat] = metricsToDisplay({ profileViewsChange: 0 });
    expect(up!.changeType).toBe('increase');
    expect(down!.changeType).toBe('decrease');
    expect(flat!.changeType).toBe('neutral');
  });

  it('marks non-finite and non-numeric JSON values unavailable', () => {
    // A payload can legally carry these; NaN in particular would render as "NaN".
    const tiles = metricsToDisplay({
      profileViews: NaN,
      newConnections: null,
      messagesSent: '63',
      engagementRate: Infinity,
    } as never);
    expect(tiles.find((t) => t.label === 'Profile Views')!.value).toBeNull();
    expect(tiles.find((t) => t.label === 'New Connections')!.value).toBeNull();
    expect(tiles.find((t) => t.label === 'Messages Sent')!.value).toBeNull();
    expect(tiles.find((t) => t.label === 'Engagement Rate')!.value).toBeNull();
  });

  it('assigns every tile a tone, so none renders unstyled', () => {
    expect(metricsToDisplay(undefined).every((t) => Boolean(t.tone))).toBe(true);
  });
});

describe('preview analytics routes', () => {
  it('answers /api/analytics/overview with a payload that has metrics', () => {
    const res = resolvePreviewApi('/api/analytics/overview?period=7d') as {
      metrics?: Record<string, number>;
    };
    expect(res.metrics).toBeTruthy();
    expect(typeof res.metrics!.profileViews).toBe('number');
  });

  it('feeds the real page path without throwing', () => {
    const res = resolvePreviewApi('/api/analytics/overview') as { metrics?: never };
    expect(() => metricsToDisplay(res.metrics)).not.toThrow();
    expect(metricsToDisplay(res.metrics)[0]!.value).toBeGreaterThan(0);
  });

  it('returns the declared shape for each analytics sub-route', () => {
    expect(Array.isArray(resolvePreviewApi('/api/analytics/profile-views'))).toBe(true);
    expect(Array.isArray(resolvePreviewApi('/api/analytics/top-content'))).toBe(true);
    const engagement = resolvePreviewApi('/api/analytics/engagement') as Record<string, number>;
    expect(typeof engagement.connections).toBe('number');
    const weekly = resolvePreviewApi('/api/analytics/weekly-summary') as Record<string, unknown>;
    expect(typeof weekly.mostActiveDay).toBe('string');
  });
});
