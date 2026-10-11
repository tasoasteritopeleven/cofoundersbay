'use client';

import { useSyncExternalStore } from 'react';

/**
 * The reader's notification choices, in one place.
 *
 * There were two: /settings kept six switches under `notifPrefs` in this
 * browser, which nothing read, and /settings/notifications kept a second,
 * per-type set of push / email / in-app switches in component state, which
 * reset on every visit - only the email digest reached the server
 * (`PATCH /notifications/preferences` stores `digestFrequency` and nothing
 * else). The two pages disagreed about what the reader had chosen, and
 * neither said where its choices went.
 *
 * Now both read and write this store: the per-type channels, quiet hours and
 * the automation switches, kept on this device, and the digest, kept on the
 * account by the page that saves it. The pages say which is which. Nothing
 * on the server reads the device choices yet, and the copy says so rather
 * than implying delivery follows them.
 */

export type NotificationChannel = 'push' | 'email' | 'inApp';
export type ChannelSet = Record<NotificationChannel, boolean>;

export type NotificationSettingDef = {
  id: string;
  labelEn: string;
  labelEl: string;
  descriptionEn: string;
  descriptionEl: string;
  defaults: ChannelSet;
};

export type NotificationCategoryDef = {
  id: 'messages' | 'connections' | 'matches' | 'projects' | 'events' | 'security';
  titleEn: string;
  titleEl: string;
  descriptionEn: string;
  descriptionEl: string;
  settings: NotificationSettingDef[];
};

const ALL: ChannelSet = { push: true, email: true, inApp: true };

export const NOTIFICATION_CATEGORIES: NotificationCategoryDef[] = [
  {
    id: 'messages',
    titleEn: 'Messages',
    titleEl: 'Μηνύματα',
    descriptionEn: 'Direct messages and conversation requests',
    descriptionEl: 'Άμεσα μηνύματα και αιτήματα συνομιλίας',
    settings: [
      { id: 'new_message', labelEn: 'New messages', labelEl: 'Νέα μηνύματα', descriptionEn: 'When someone sends you a message', descriptionEl: 'Όταν κάποιος σας στέλνει μήνυμα', defaults: ALL },
      { id: 'message_request', labelEn: 'Message requests', labelEl: 'Αιτήματα μηνυμάτων', descriptionEn: 'When someone you are not connected with writes to you', descriptionEl: 'Όταν σας γράφει κάποιος με τον οποίο δεν είστε συνδεδεμένοι', defaults: ALL },
    ],
  },
  {
    id: 'connections',
    titleEn: 'Connections',
    titleEl: 'Συνδέσεις',
    descriptionEn: 'Requests, acceptances and profile views',
    descriptionEl: 'Αιτήματα, αποδοχές και προβολές προφίλ',
    settings: [
      { id: 'connection_request', labelEn: 'Connection requests', labelEl: 'Αιτήματα σύνδεσης', descriptionEn: 'When someone wants to connect', descriptionEl: 'Όταν κάποιος θέλει να συνδεθεί μαζί σας', defaults: ALL },
      { id: 'connection_accepted', labelEn: 'Accepted requests', labelEl: 'Αποδεκτά αιτήματα', descriptionEn: 'When someone accepts your request', descriptionEl: 'Όταν κάποιος αποδέχεται το αίτημά σας', defaults: { push: true, email: false, inApp: true } },
      { id: 'profile_view', labelEn: 'Profile views', labelEl: 'Προβολές προφίλ', descriptionEn: 'When someone views your profile', descriptionEl: 'Όταν κάποιος βλέπει το προφίλ σας', defaults: { push: false, email: false, inApp: true } },
    ],
  },
  {
    id: 'matches',
    titleEn: 'Matches',
    titleEl: 'Αντιστοιχίσεις',
    descriptionEn: 'New matches and changes to existing ones',
    descriptionEl: 'Νέες αντιστοιχίσεις και αλλαγές στις υπάρχουσες',
    settings: [
      { id: 'new_match', labelEn: 'New matches', labelEl: 'Νέες αντιστοιχίσεις', descriptionEn: 'When a strong match appears', descriptionEl: 'Όταν εμφανίζεται ισχυρή αντιστοίχιση', defaults: ALL },
      { id: 'match_update', labelEn: 'Match updates', labelEl: 'Ενημερώσεις αντιστοιχίσεων', descriptionEn: 'When a match updates their profile', descriptionEl: 'Όταν μια αντιστοίχιση ενημερώνει το προφίλ της', defaults: { push: false, email: false, inApp: true } },
    ],
  },
  {
    id: 'projects',
    titleEn: 'Projects',
    titleEl: 'Έργα',
    descriptionEn: 'Invitations, updates and applications',
    descriptionEl: 'Προσκλήσεις, ενημερώσεις και αιτήσεις',
    settings: [
      { id: 'project_invite', labelEn: 'Project invitations', labelEl: 'Προσκλήσεις σε έργα', descriptionEn: 'When you are invited to a project', descriptionEl: 'Όταν σας προσκαλούν σε έργο', defaults: ALL },
      { id: 'project_update', labelEn: 'Project updates', labelEl: 'Ενημερώσεις έργων', descriptionEn: 'Changes in projects you are part of', descriptionEl: 'Αλλαγές σε έργα στα οποία συμμετέχετε', defaults: { push: true, email: false, inApp: true } },
      { id: 'role_application', labelEn: 'Role applications', labelEl: 'Αιτήσεις για ρόλους', descriptionEn: 'When someone applies to your project', descriptionEl: 'Όταν κάποιος κάνει αίτηση στο έργο σας', defaults: ALL },
    ],
  },
  {
    id: 'events',
    titleEn: 'Events & meetings',
    titleEl: 'Εκδηλώσεις & συναντήσεις',
    descriptionEn: 'Reminders, meeting requests and changes',
    descriptionEl: 'Υπενθυμίσεις, αιτήματα συναντήσεων και αλλαγές',
    settings: [
      { id: 'event_reminder', labelEn: 'Event reminders', labelEl: 'Υπενθυμίσεις εκδηλώσεων', descriptionEn: 'Before scheduled events', descriptionEl: 'Πριν από προγραμματισμένες εκδηλώσεις', defaults: ALL },
      { id: 'meeting_request', labelEn: 'Meeting requests', labelEl: 'Αιτήματα συναντήσεων', descriptionEn: 'When someone wants to schedule a call', descriptionEl: 'Όταν κάποιος θέλει να κλείσει κλήση', defaults: ALL },
      { id: 'event_update', labelEn: 'Event changes', labelEl: 'Αλλαγές εκδηλώσεων', descriptionEn: 'When an event is rescheduled or cancelled', descriptionEl: 'Όταν μια εκδήλωση μετατίθεται ή ακυρώνεται', defaults: ALL },
    ],
  },
  {
    id: 'security',
    titleEn: 'Security & account',
    titleEl: 'Ασφάλεια & λογαριασμός',
    descriptionEn: 'Sign-ins and password changes',
    descriptionEl: 'Συνδέσεις και αλλαγές κωδικού',
    settings: [
      { id: 'login_alert', labelEn: 'Sign-in alerts', labelEl: 'Ειδοποιήσεις σύνδεσης', descriptionEn: 'When your account is used from a new device', descriptionEl: 'Όταν ο λογαριασμός σας χρησιμοποιείται από νέα συσκευή', defaults: ALL },
      { id: 'password_change', labelEn: 'Password changes', labelEl: 'Αλλαγές κωδικού', descriptionEn: 'When your password is changed', descriptionEl: 'Όταν αλλάζει ο κωδικός σας', defaults: ALL },
    ],
  },
];

export const AUTOMATION_KEYS = [
  'automation_onboarding',
  'automation_matching',
  'automation_mentorship',
  'automation_community',
  'automation_billing',
  'automation_reengagement',
] as const;
export type AutomationKey = (typeof AUTOMATION_KEYS)[number];

export type DeviceNotificationPrefs = {
  /** Only the settings the reader changed; the rest follow their defaults. */
  channels: Record<string, ChannelSet>;
  quietHours: { enabled: boolean; start: string; end: string };
  automation: Record<AutomationKey, boolean>;
};

const STORE_KEY = 'cfb_notification_prefs';
/** Where the automation switches lived before; read once, then folded in. */
const LEGACY_AUTOMATION_KEY = 'cfb_automation_notif_prefs';

const DEFAULTS: DeviceNotificationPrefs = {
  channels: {},
  quietHours: { enabled: false, start: '22:00', end: '08:00' },
  automation: {
    automation_onboarding: true,
    automation_matching: true,
    automation_mentorship: true,
    automation_community: true,
    automation_billing: true,
    automation_reengagement: false,
  },
};

let cache: DeviceNotificationPrefs | null = null;
const listeners = new Set<() => void>();

function load(): DeviceNotificationPrefs {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DeviceNotificationPrefs>;
      return {
        channels: parsed.channels ?? {},
        quietHours: { ...DEFAULTS.quietHours, ...(parsed.quietHours ?? {}) },
        automation: { ...DEFAULTS.automation, ...(parsed.automation ?? {}) },
      };
    }
    const legacy = window.localStorage.getItem(LEGACY_AUTOMATION_KEY);
    return legacy ? { ...DEFAULTS, automation: { ...DEFAULTS.automation, ...JSON.parse(legacy) } } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function getSnapshot(): DeviceNotificationPrefs {
  if (!cache) cache = load();
  return cache;
}

function getServerSnapshot(): DeviceNotificationPrefs {
  return DEFAULTS;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORE_KEY) {
      cache = load();
      listener();
    }
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}

export function updateNotificationPrefs(update: (prev: DeviceNotificationPrefs) => DeviceNotificationPrefs): void {
  const next = update(getSnapshot());
  cache = next;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch {
    /* private mode: the choice holds for this visit */
  }
  for (const listener of listeners) listener();
}

export function useNotificationPrefs(): DeviceNotificationPrefs {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** A setting's channels: the reader's choice, or its default. */
export function channelsOf(prefs: DeviceNotificationPrefs, setting: NotificationSettingDef): ChannelSet {
  return prefs.channels[setting.id] ?? setting.defaults;
}

export function setChannel(settingIds: readonly string[], channel: NotificationChannel, value: boolean): void {
  updateNotificationPrefs((prev) => {
    const channels = { ...prev.channels };
    for (const id of settingIds) {
      const def = NOTIFICATION_CATEGORIES.flatMap((c) => c.settings).find((s) => s.id === id);
      if (!def) continue;
      channels[id] = { ...(prev.channels[id] ?? def.defaults), [channel]: value };
    }
    return { ...prev, channels };
  });
}

/** Whether every setting in a category has this channel on. */
export function categoryChannelOn(prefs: DeviceNotificationPrefs, category: NotificationCategoryDef, channel: NotificationChannel): boolean {
  return category.settings.every((s) => channelsOf(prefs, s)[channel]);
}

/** For tests. */
export function resetNotificationPrefsForTests(): void {
  cache = null;
}
