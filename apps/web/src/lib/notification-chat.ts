/**
 * Notifications from the conversation (docs §107.7-2, §110.5, §111).
 *
 * Two capabilities share these rules:
 * - `triage_notifications` marks read, in one confirmed card, every unread
 *   notification that needs nothing from the reader, and leaves the ones that
 *   wait on them; undo makes exactly those unread again.
 * - `set_notification_pref` turns a channel of a category on or off («σταμάτα
 *   τα email για εκδηλώσεις»), or sets the email digest, as Settings →
 *   Notifications does; undo puts back what each setting had.
 */
import { NOTIFICATION_CATEGORIES, type NotificationChannel } from '@/lib/notification-prefs';
import { fold } from '@/lib/composer-menu';
import { safeInternalPath } from '@/lib/return-to';

// ── Triage ───────────────────────────────────────────────────────────────────

/**
 * Kinds that wait on the reader: a request to answer, an invitation to
 * decide, a message to reply to, or a security event to look at. Matched by
 * the type's own words, so a new "…_request" or "…_invite" kind is kept too.
 */
const WAITING_TYPES = new Set([
  'message', 'direct', 'messages',
  'connection_request', 'intro_request', 'mentor_request', 'request',
  'organization_invite', 'workspace_review', 'commitment_update',
  'suspicious_activity', 'authorization_code', 'security',
]);
const WAITING_WORDS = ['request', 'invite', 'review', 'security', 'suspicious', 'authorization'];

export function waitsOnReader(notification: { type: string }): boolean {
  const type = notification.type.toLowerCase();
  return WAITING_TYPES.has(type) || WAITING_WORDS.some((word) => type.includes(word));
}

export function notificationNextAction(notification: { type: string; link: string | null }) {
  if (!waitsOnReader(notification)) return null;
  const href = safeInternalPath(notification.link);
  if (!href) return null;
  const type = notification.type.toLowerCase();
  if (type === 'message' || type === 'direct' || type === 'messages') {
    return { href, en: 'Open conversation', el: 'Άνοιγμα συνομιλίας' };
  }
  if (type.includes('request') || type.includes('invite')) {
    return { href, en: 'Review request', el: 'Εξέταση αιτήματος' };
  }
  return { href, en: 'Review details', el: 'Εξέταση λεπτομερειών' };
}

/** The unread ones split into what can be marked read and what waits on the reader. */
export function triageSplit<T extends { type: string; readAt: string | null }>(notifications: readonly T[]): { clear: T[]; keep: T[] } {
  const unread = notifications.filter((n) => !n.readAt);
  return {
    clear: unread.filter((n) => !waitsOnReader(n)),
    keep: unread.filter((n) => waitsOnReader(n)),
  };
}

/** What the assistant says when a triage has nothing to mark read. */
export const NOTHING_TO_TRIAGE = {
  allWaiting: {
    en: 'Nothing to mark read: every unread notification waits on you. Open Notifications to answer them.',
    el: 'Δεν υπάρχει κάτι να σημειωθεί ως αναγνωσμένο: κάθε αδιάβαστη ειδοποίηση σας περιμένει. Ανοίξτε τις Ειδοποιήσεις για να τις απαντήσετε.',
  },
  noneUnread: {
    en: 'Nothing is unread.',
    el: 'Δεν υπάρχει τίποτα αδιάβαστο.',
  },
} as const;

/** What a triage card does, with its numbers: «7 ως αναγνωσμένες · μένουν 2 που σας περιμένουν». */
export function triageTarget(counts: { clear: number; keep: number }, locale?: string): string {
  const el = locale === 'el';
  const clear = el
    ? `${counts.clear} ${counts.clear === 1 ? 'ως αναγνωσμένη' : 'ως αναγνωσμένες'}`
    : `${counts.clear} marked read`;
  if (!counts.keep) return clear;
  const keep = el
    ? `${counts.keep === 1 ? 'μένει 1 που σας περιμένει' : `μένουν ${counts.keep} που σας περιμένουν`}`
    : `${counts.keep} waiting on you ${counts.keep === 1 ? 'stays' : 'stay'}`;
  return `${clear} · ${keep}`;
}

// ── Preferences ──────────────────────────────────────────────────────────────

export const NOTIFICATION_CATEGORY_IDS = NOTIFICATION_CATEGORIES.map((c) => c.id);
export const NOTIFICATION_CHANNELS: readonly NotificationChannel[] = ['push', 'email', 'inApp'];
export const DIGEST_FREQUENCIES = ['daily', 'weekly', 'monthly', 'never'] as const;
export type DigestFrequency = (typeof DIGEST_FREQUENCIES)[number];

export const CHANNEL_COPY: Record<NotificationChannel, { en: string; el: string }> = {
  push: { en: 'push', el: 'push' },
  email: { en: 'email', el: 'email' },
  inApp: { en: 'in-app', el: 'στην εφαρμογή' },
};
export const DIGEST_COPY: Record<DigestFrequency, { en: string; el: string }> = {
  daily: { en: 'email digest daily', el: 'email σύνοψη καθημερινά' },
  weekly: { en: 'email digest weekly', el: 'email σύνοψη εβδομαδιαία' },
  monthly: { en: 'email digest monthly', el: 'email σύνοψη μηνιαία' },
  never: { en: 'no email digest', el: 'χωρίς email σύνοψη' },
};

export function isDigest(value: unknown): value is DigestFrequency {
  return typeof value === 'string' && (DIGEST_FREQUENCIES as readonly string[]).includes(value);
}
export function isChannel(value: unknown): value is NotificationChannel {
  return typeof value === 'string' && (NOTIFICATION_CHANNELS as readonly string[]).includes(value);
}
export function categoryOf(id: unknown) {
  return typeof id === 'string' ? NOTIFICATION_CATEGORIES.find((c) => c.id === id) ?? null : null;
}

/** What a set_notification_pref card changes: «Εκδηλώσεις & συναντήσεις: email όχι». */
export function notificationPrefTarget(args: Record<string, unknown>, locale?: string): string {
  const pick = (copy: { en: string; el: string }) => (locale === 'el' ? copy.el : copy.en);
  if (isDigest(args.digest)) return pick(DIGEST_COPY[args.digest]);
  const category = categoryOf(args.category);
  if (!category || !isChannel(args.channel)) return '';
  const on = args.on === true || args.on === 'true';
  const state = locale === 'el' ? (on ? 'ναι' : 'όχι') : on ? 'on' : 'off';
  return `${locale === 'el' ? category.titleEl : category.titleEn}: ${pick(CHANNEL_COPY[args.channel])} ${state}`;
}

// ── What the reader said (the planner's path, for models without tools) ─────

const TRIAGE_PHRASES = [
  'triage my notifications', 'clear my notifications', 'clean up my notifications', 'tidy my notifications',
  'mark the rest read', 'mark the rest as read', 'mark the others read', 'mark everything else read',
  'διαλογη ειδοποιησεων', 'καθαρισε τις ειδοποιησεις', 'τακτοποιησε τις ειδοποιησεις',
  'σημανε τις υπολοιπες', 'σημειωσε τις υπολοιπες', 'τις υπολοιπες ως διαβασμενες', 'τις υπολοιπες ως αναγνωσμενες',
];

export function wantsTriage(message: string): boolean {
  const text = fold(message);
  return TRIAGE_PHRASES.some((phrase) => text.includes(fold(phrase)));
}

const CHANNEL_WORDS: Array<{ channel: NotificationChannel; keys: string[] }> = [
  { channel: 'email', keys: ['email', 'e-mail', 'emails', 'μειλ'] },
  { channel: 'push', keys: ['push', 'στο κινητο'] },
  { channel: 'inApp', keys: ['in-app', 'in app', 'στην εφαρμογη'] },
];
const CATEGORY_WORDS: Array<{ category: string; keys: string[] }> = [
  { category: 'messages', keys: ['message', 'μηνυμα'] },
  { category: 'connections', keys: ['connection', 'profile view', 'συνδεσ', 'προβολες προφιλ'] },
  { category: 'matches', keys: ['match', 'αντιστοιχισ'] },
  { category: 'projects', keys: ['project', 'role application', 'εργα ', 'εργων', 'εργο '] },
  { category: 'events', keys: ['event', 'meeting', 'εκδηλωσ', 'συναντησ'] },
  { category: 'security', keys: ['security', 'login alert', 'ασφαλει'] },
];
const OFF_WORDS = ['stop', 'turn off', 'disable', 'mute', 'no more', "don't send", 'do not send', 'σταματα', 'κλεισε', 'απενεργοποιησ', 'μη μου στελνεις', 'μην μου στελνεις', 'οχι αλλα', 'χωρις'];
const ON_WORDS = ['turn on', 'enable', 'start sending', 'send me', 'i want', 'ανοιξε', 'ενεργοποιησ', 'στελνε μου', 'θελω'];
const DIGEST_WORDS: Array<{ digest: DigestFrequency; keys: string[] }> = [
  { digest: 'never', keys: ['no digest', 'stop the digest', 'stop digest', 'σταματα τη συνοψη', 'χωρις συνοψη', 'καμια συνοψη'] },
  { digest: 'daily', keys: ['daily', 'every day', 'καθημεριν'] },
  { digest: 'weekly', keys: ['weekly', 'every week', 'εβδομαδιαι', 'καθε εβδομαδα'] },
  { digest: 'monthly', keys: ['monthly', 'every month', 'μηνιαι', 'καθε μηνα'] },
];

/**
 * The preference a sentence asks for, or nothing. It needs a channel, a
 * category and a verb ("stop event emails", «σταμάτα τα email για
 * εκδηλώσεις»), or the digest and a frequency; a sentence about something
 * else that happens to say "email" changes nothing.
 */
export function detectNotificationPref(message: string): Record<string, string> | undefined {
  const text = ` ${fold(message)} `;
  if (text.includes('digest') || text.includes('συνοψ')) {
    const hit = DIGEST_WORDS.find((d) => d.keys.some((key) => text.includes(fold(key))));
    if (hit) return { digest: hit.digest };
  }
  const channel = CHANNEL_WORDS.find((c) => c.keys.some((key) => text.includes(fold(key))))?.channel;
  const category = CATEGORY_WORDS.find((c) => c.keys.some((key) => text.includes(fold(key))))?.category;
  if (!channel || !category) return undefined;
  const off = OFF_WORDS.some((word) => text.includes(fold(word)));
  const on = !off && ON_WORDS.some((word) => text.includes(fold(word)));
  if (!off && !on) return undefined;
  return { category, channel, on: on ? 'true' : 'false' };
}
