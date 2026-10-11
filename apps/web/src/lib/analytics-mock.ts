/**
 * Mock analytics implementation - used when PostHog is not available
 * All events are logged to console for development
 */

type AnalyticsEvent = string;

interface AnalyticsProperties {
  [key: string]: unknown;
}

export const analytics = {
  track: (event: AnalyticsEvent, properties?: AnalyticsProperties) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics]', event, properties);
    }
  },
  identify: (userId: string, traits?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics] Identify', userId, traits);
    }
  },
  reset: () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics] Reset');
    }
  },
  setPersonProperties: (props: Record<string, unknown>) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics] Set person properties', props);
    }
  },
  group: (groupType: string, groupKey: string, groupProperties?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics] Group', groupType, groupKey, groupProperties);
    }
  },
  isFeatureEnabled: async (flag: string): Promise<boolean> => {
    console.log('[Analytics] Feature flag check', flag);
    return false;
  },
  getFeatureFlag: async (flag: string): Promise<string | boolean | undefined> => {
    console.log('[Analytics] Feature flag get', flag);
    return undefined;
  },
};
