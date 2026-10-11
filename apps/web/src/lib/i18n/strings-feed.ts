import type { BilingualPair } from './types';

/**
 * /feed — network updates. Live posts when the API returns them; otherwise
 * sample posts behind SampleDataNotice. Preferences are real (content types
 * and topics) even when the posts themselves are samples.
 */
export const FEED_STRINGS: Record<string, BilingualPair> = {
  preferences: { en: 'Feed preferences', el: 'Προτιμήσεις feed' },
  content_types: { en: 'Content types', el: 'Τύποι περιεχομένου' },
  topics: { en: 'Topics of interest', el: 'Θέματα ενδιαφέροντος' },
  type_update: { en: 'Update', el: 'Ενημέρωση' },
  type_milestone: { en: 'Milestone', el: 'Ορόσημο' },
  type_question: { en: 'Question', el: 'Ερώτηση' },
  type_announcement: { en: 'Announcement', el: 'Ανακοίνωση' },
  type_achievement: { en: 'Achievement', el: 'Επίτευγμα' },
};

export function feedEn(key: keyof typeof FEED_STRINGS): string {
  return FEED_STRINGS[key].en;
}

export function feedEl(key: keyof typeof FEED_STRINGS): string {
  return FEED_STRINGS[key].el;
}
