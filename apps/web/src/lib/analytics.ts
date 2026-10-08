/**
 * Analytics — PostHog integration (with fallback to mock)
 *
 * All product events flow through this file so tracking calls are
 * colocated, typed, and easy to audit.  Every call is wrapped in a
 * try/catch so that a PostHog outage never affects the product.
 *
 * Nothing is sent, and PostHog is never loaded, until the visitor has said
 * yes to analytics in the cookie banner (`lib/cookie-consent.ts`). Before
 * this gate the banner's "Essential only" changed nothing: PostHog started
 * on the first event whenever a key was configured.
 *
 * Usage:
 *   import { analytics } from '@/lib/analytics';
 *   analytics.track('match_viewed', { matchScore: 87, matchRole: 'founder' });
 */

import { analyticsAllowed, COOKIE_CONSENT_EVENT, type CookiePreferences } from './cookie-consent';

// Try to import PostHog, fall back to mock if not available
let _ph: typeof import('posthog-js').default | null = null;
let _useMock = false;

// A withdrawn consent stops capture at once, in this tab, without a reload.
if (typeof window !== 'undefined') {
  window.addEventListener(COOKIE_CONSENT_EVENT, (event) => {
    const prefs = (event as CustomEvent<CookiePreferences>).detail;
    try {
      if (!_ph) return;
      if (prefs?.analytics) _ph.opt_in_capturing();
      else _ph.opt_out_capturing();
    } catch { /* never throw */ }
  });
}

async function getPostHog() {
  if (_useMock) return null;
  if (typeof window === 'undefined') return null;
  if (!analyticsAllowed()) return null;
  if (_ph) return _ph;
  try {
    const { default: posthog } = await import('posthog-js');
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';
    if (!key) {
      _useMock = true;
      return null;
    }
    if (!posthog.__loaded) {
      posthog.init(key, {
        api_host: host,
        person_profiles: 'identified_only',
        capture_pageview: false, // We send these manually via usePageView
        capture_pageleave: true,
        autocapture: false,
        disable_session_recording: process.env.NODE_ENV !== 'production',
        loaded: (ph) => { _ph = ph as unknown as typeof import('posthog-js').default; },
      });
    }
    _ph = posthog;
    return posthog;
  } catch {
    _useMock = true;
    return null;
  }
}

// ─── Typed event catalogue ────────────────────────────────────────────────────

export type AnalyticsEvent =
  // Auth
  | { event: 'user_registered'; properties: { role: string } }
  | { event: 'user_logged_in'; properties: { method: 'email' | 'oauth' | 'sso' } }
  | { event: 'user_logged_out'; properties?: Record<string, unknown> }
  // Onboarding
  | { event: 'onboarding_started'; properties: { role?: string } }
  | { event: 'onboarding_step_completed'; properties: { step: string; step_index: number } }
  | { event: 'onboarding_completed'; properties: { role: string; skills_count: number } }
  | { event: 'onboarding_abandoned'; properties: { step: string; step_index: number } }
  // Profile
  | { event: 'profile_viewed'; properties: { profile_id: string; role: string; is_own: boolean } }
  | { event: 'profile_updated'; properties: { fields_changed: string[] } }
  | { event: 'avatar_uploaded'; properties?: Record<string, unknown> }
  // Matching
  | { event: 'match_viewed'; properties: { match_id: string; match_score: number; match_role: string } }
  | { event: 'match_connected'; properties: { match_id: string; match_score: number } }
  | { event: 'match_dismissed'; properties: { match_id: string; match_score: number } }
  | { event: 'recommendations_viewed'; properties: { count: number } }
  // Connections
  | { event: 'connection_request_sent'; properties: { target_id: string; target_role: string } }
  | { event: 'connection_request_accepted'; properties: { requester_id: string } }
  | { event: 'connection_request_declined'; properties: { requester_id: string } }
  // Messaging
  | { event: 'conversation_started'; properties: { recipient_id: string } }
  | { event: 'message_sent'; properties: { conversation_id: string; has_attachment: boolean } }
  // Mentoring
  | { event: 'mentor_profile_viewed'; properties: { mentor_id: string } }
  | { event: 'mentoring_session_booked'; properties: { mentor_id: string; session_type: string } }
  | { event: 'video_call_started'; properties: { room_id: string; call_type: 'mentoring' | 'intro' | 'collaboration' } }
  | { event: 'video_call_ended'; properties: { room_id: string; duration_seconds: number } }
  | { event: 'video_call_error'; properties: { room_id: string; error: string } }
  // Groups
  | { event: 'group_joined'; properties: { group_id: string; group_name: string } }
  | { event: 'group_post_created'; properties: { group_id: string } }
  // Events
  | { event: 'event_rsvp'; properties: { event_id: string; event_type: string; status: 'going' | 'interested' | 'not_going' } }
  // Builder
  | { event: 'pitch_deck_created'; properties?: Record<string, unknown> }
  | { event: 'pitch_deck_shared'; properties: { pitch_id: string } }
  | { event: 'data_room_created'; properties: { room_id: string } }
  | { event: 'data_room_document_uploaded'; properties: { room_id: string; file_type: string } }
  // Search
  | { event: 'search_performed'; properties: { query: string; filters_used: string[]; result_count: number } }
  | { event: 'saved_search_created'; properties: { name: string } }
  // Page views
  | { event: 'page_viewed'; properties: { path: string; title?: string; referrer?: string } }
  // Tenant management
  | { event: 'tenant_branding_updated'; properties: { tenant_id: string; has_logo: boolean; has_favicon: boolean; has_custom_colors: boolean } }
  | { event: 'tenant_bulk_activate'; properties: { count: number } }
  | { event: 'tenant_bulk_suspend'; properties: { count: number } }
  | { event: 'tenant_bulk_delete'; properties: { count: number } }
  | { event: 'tenant_export_csv'; properties: { count: number } }
  // Feature flags (A/B)
  | { event: 'feature_flag_evaluated'; properties: { flag: string; variant: string } }
  // First-run tours
  | { event: 'tour_started'; properties: { tour: string; steps: number } }
  | { event: 'tour_completed'; properties: { tour: string; steps: number } }
  | { event: 'tour_skipped'; properties: { tour: string; step_index: number } };

// ─── Public API ────────────────────────────────────────────────────────────────

async function track<E extends AnalyticsEvent['event']>(
  event: E,
  properties?: Extract<AnalyticsEvent, { event: E }>['properties'],
) {
  try {
    const ph = await getPostHog();
    if (ph) {
      ph.capture(event, properties ?? {});
    } else if (_useMock && analyticsAllowed()) {
      // Fall back to mock
      const { analytics: mockAnalytics } = await import('./analytics-mock');
      mockAnalytics.track(event, properties);
    }
  } catch { /* never throw */ }
}

async function identify(userId: string, traits?: Record<string, unknown>) {
  try {
    const ph = await getPostHog();
    ph?.identify(userId, traits);
  } catch { /* never throw */ }
}

async function reset() {
  try {
    const ph = await getPostHog();
    ph?.reset();
  } catch { /* never throw */ }
}

async function setPersonProperties(props: Record<string, unknown>) {
  try {
    const ph = await getPostHog();
    ph?.people?.set(props);
  } catch { /* never throw */ }
}

async function group(groupType: string, groupKey: string, groupProperties?: Record<string, unknown>) {
  try {
    const ph = await getPostHog();
    ph?.group(groupType, groupKey, groupProperties);
  } catch { /* never throw */ }
}

async function isFeatureEnabled(flag: string): Promise<boolean> {
  try {
    const ph = await getPostHog();
    return !!ph?.isFeatureEnabled(flag);
  } catch { return false; }
}

async function getFeatureFlag(flag: string): Promise<string | boolean | undefined> {
  try {
    const ph = await getPostHog();
    return ph?.getFeatureFlag(flag);
  } catch { return undefined; }
}

export const analytics = {
  track,
  identify,
  reset,
  setPersonProperties,
  group,
  isFeatureEnabled,
  getFeatureFlag,
};
