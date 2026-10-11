import type { UserMetrics } from '@/lib/api';
import type { StatusTone } from '@/lib/semantic-colors';
import type { CfbGlyphName } from '@/components/icons/CfbGlyph';
import { analyticsEl } from '@/lib/i18n/strings-analytics';

export interface AnalyticsMetric {
  label: string;
  labelEl: string;
  value: number | null;
  change: number | null;
  changeType: 'increase' | 'decrease' | 'neutral';
  glyph: CfbGlyphName;
  tone: StatusTone;
}

export const METRIC_TONE: Record<string, StatusTone> = {
  'Profile Views': 'info',
  'New Connections': 'success',
  'Messages Sent': 'accent',
  'Engagement Rate': 'accent',
  'Search Appearances': 'warning',
  'Activity Score': 'info',
};

const METRIC_GLYPH: Record<string, CfbGlyphName> = {
  'Profile Views': 'profile',
  'New Connections': 'people',
  'Messages Sent': 'messages',
  'Engagement Rate': 'spark',
  'Search Appearances': 'search',
  'Activity Score': 'chart',
};

const METRIC_EL: Record<string, string> = {
  'Profile Views': analyticsEl('metric_views'),
  'New Connections': analyticsEl('metric_connections'),
  'Messages Sent': analyticsEl('metric_messages'),
  'Engagement Rate': analyticsEl('metric_engagement'),
  'Search Appearances': analyticsEl('metric_search'),
  'Activity Score': analyticsEl('metric_activity'),
};

/**
 * Builds the metric tiles from whatever the API actually returned.
 *
 * `UserMetrics` declares every field as required, but that is a compile-time
 * promise about a runtime payload — `apiRequest` casts the response without
 * validating it. When the shape disagreed (an unhandled preview route, a partial
 * payload, an older API), the previous version dereferenced `m.profileViews` and
 * took the whole page down through the error boundary.
 *
 * Accepting a partial input and defaulting each field keeps the page rendering:
 * a metric the server didn't send reads as 0 with a neutral trend, which is what
 * "no data for this period" should look like anyway.
 *
 * Lives outside `page.tsx` so it can be unit-tested — the App Router only allows
 * a fixed set of named exports from a page module.
 */
export function metricsToDisplay(m?: Partial<{ [K in keyof UserMetrics]: number | null }> | null): AnalyticsMetric[] {
  const changeType = (v: number | null): 'increase' | 'decrease' | 'neutral' =>
    v === null ? 'neutral' : v > 0 ? 'increase' : v < 0 ? 'decrease' : 'neutral';
  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

  const tile = (
    label: string,
    value: unknown,
    change: unknown,
  ): AnalyticsMetric => ({
    label,
    labelEl: METRIC_EL[label] ?? label,
    value: num(value),
    change: num(change),
    changeType: changeType(num(change)),
    glyph: METRIC_GLYPH[label] ?? 'chart',
    tone: METRIC_TONE[label] ?? 'neutral',
  });

  return [
    tile('Profile Views', m?.profileViews, m?.profileViewsChange),
    tile('New Connections', m?.newConnections, m?.newConnectionsChange),
    tile('Messages Sent', m?.messagesSent, m?.messagesSentChange),
    tile('Engagement Rate', m?.engagementRate, m?.engagementRateChange),
    tile('Search Appearances', m?.searchAppearances, m?.searchAppearancesChange),
    tile('Activity Score', m?.activityScore, m?.activityScoreChange),
  ];
}
