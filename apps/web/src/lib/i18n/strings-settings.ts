import type { BilingualPair } from './types';

/**
 * Settings pages — bilingual EN + EL.
 */
export const SETTINGS_STRINGS: Record<string, BilingualPair> = {
  // ── Notifications page ──
  notifications_title: { en: 'Notification Preferences', el: 'Προτιμήσεις ειδοποιήσεων' },
  notifications_desc: {
    en: 'Control how and when you receive alerts.',
    el: 'Ελέγξτε πώς και πότε λαμβάνετε ειδοποιήσεις.',
  },
  save_preferences: { en: 'Save preferences', el: 'Αποθήκευση προτιμήσεων' },
  saving: { en: 'Saving...', el: 'Αποθήκευση...' },
  back_to_settings: { en: 'Back to settings', el: 'Επιστροφή στις ρυθμίσεις' },
  push: { en: 'Push', el: 'Push' },
  email: { en: 'Email', el: 'Email' },
  in_app: { en: 'In-app', el: 'Εντός εφαρμογής' },

  // ── Billing page ──
  billing_title: { en: 'Billing & Plan', el: 'Χρέωση & Πλάνο' },
  billing_desc: {
    en: 'Manage your subscription, invoices, and payment method.',
    el: 'Διαχειριστείτε τη συνδρομή, τα τιμολόγια και τη μέθοδο πληρωμής σας.',
  },
  current_plan: { en: 'Current Plan', el: 'Τρέχον πλάνο' },
  upgrade: { en: 'Upgrade', el: 'Αναβάθμιση' },
  manage_plan: { en: 'Manage Plan', el: 'Διαχείριση πλάνου' },
  payment_method: { en: 'Payment Method', el: 'Μέθοδος πληρωμής' },
  invoices: { en: 'Invoices', el: 'Τιμολόγια' },

  // ── AI settings page ──
  ai_title: { en: 'AI Settings', el: 'Ρυθμίσεις AI' },
  ai_desc: {
    en: 'Configure how AI assists you across the platform.',
    el: 'Ρυθμίστε πώς σας βοηθάει η τεχνητή νοημοσύνη στην πλατφόρμα.',
  },

  // ── Data export page ──
  data_export_title: { en: 'Data Export', el: 'Εξαγωγή δεδομένων' },
  data_export_desc: {
    en: 'Download or export your personal data.',
    el: 'Κατεβάστε ή εξάγετε τα προσωπικά σας δεδομένα.',
  },
  export_data: { en: 'Export Data', el: 'Εξαγωγή δεδομένων' },
  request_export: { en: 'Request Export', el: 'Αίτημα εξαγωγής' },

  // ── Common labels ──
  settings: { en: 'Settings', el: 'Ρυθμίσεις' },
  general: { en: 'General', el: 'Γενικά' },
  notifications: { en: 'Notifications', el: 'Ειδοποιήσεις' },
  billing: { en: 'Billing', el: 'Χρέωση' },
  privacy: { en: 'Privacy', el: 'Ιδιωτικότητα' },
  security: { en: 'Security', el: 'Ασφάλεια' },
  account: { en: 'Account', el: 'Λογαριασμός' },
  appearance: { en: 'Appearance', el: 'Εμφάνιση' },
  language: { en: 'Language', el: 'Γλώσσα' },
  enabled: { en: 'Enabled', el: 'Ενεργοποιημένο' },
  disabled: { en: 'Disabled', el: 'Απενεργοποιημένο' },
};

export function settingsEn(key: keyof typeof SETTINGS_STRINGS): string {
  return SETTINGS_STRINGS[key].en;
}

export function settingsEl(key: keyof typeof SETTINGS_STRINGS): string {
  return SETTINGS_STRINGS[key].el;
}
