import type { BilingualPair } from './types';

/**
 * /invite — sending someone an invitation to the platform, and seeing what
 * happened to the ones already sent.
 *
 * «Πρόσκληση» throughout: it is the ordinary Greek word and it is what the
 * recipient receives. The placeholder message is written in the first person,
 * because that is who sends it — a founder writing to someone they know, not
 * the product writing on their behalf.
 */
export const INVITE_STRINGS: Record<string, BilingualPair> = {
  // ── The three counters ──
  stat_sent: { en: 'Sent', el: 'Στάλθηκαν' },
  stat_joined: { en: 'Joined', el: 'Εγγράφηκαν' },
  stat_joined_hint: { en: 'Accepted your invite', el: 'Δέχτηκαν την πρόσκλησή σας' },
  stat_active: { en: 'Active', el: 'Ενεργοί' },
  stat_active_hint: { en: 'Verified, with a first real step', el: 'Επαληθευμένοι, με ένα πρώτο βήμα' },
  stat_remaining: { en: 'Remaining', el: 'Απομένουν' },
  stat_remaining_hint: { en: 'Invites left', el: 'Προσκλήσεις που σας μένουν' },

  // ── The form ──
  form_title: { en: 'Send an Invitation', el: 'Στείλτε πρόσκληση' },
  form_description: {
    en: 'Invite someone to join CoFounderBay and expand your network.',
    el: 'Προσκαλέστε κάποιον στο CoFounderBay και μεγαλώστε το δίκτυό σας.',
  },
  quota_spent: {
    en: "You've used all your invites for now. They refresh periodically.",
    el: 'Εξαντλήσατε τις προσκλήσεις σας προς το παρόν. Ανανεώνονται περιοδικά.',
  },
  email_label: { en: 'Email address', el: 'Διεύθυνση email' },
  message_label: { en: 'Personal message (optional)', el: 'Προσωπικό μήνυμα (προαιρετικό)' },
  message_placeholder: {
    en: "Hey! I've been using CoFounderBay to find collaborators — thought you'd find it useful too…",
    el: 'Γεια! Χρησιμοποιώ το CoFounderBay για να βρω συνεργάτες — σκέφτηκα ότι θα σου φανεί χρήσιμο…',
  },
  send: { en: 'Send Invitation', el: 'Αποστολή πρόσκλησης' },
  sending: { en: 'Sending…', el: 'Αποστολή…' },
  copy_link: { en: 'Copy link', el: 'Αντιγραφή συνδέσμου' },
  copied: { en: 'Copied!', el: 'Αντιγράφηκε!' },

  // ── What the toasts say ──
  sent_title: { en: 'Invitation sent!', el: 'Η πρόσκληση στάλθηκε!' },
  sent_body: {
    en: '{email} will receive an invite to join CoFounderBay.',
    el: 'Ο/Η {email} θα λάβει πρόσκληση για το CoFounderBay.',
  },
  send_failed: { en: 'Could not send invite', el: 'Η πρόσκληση δεν στάλθηκε' },
  cancel_failed: { en: 'Could not cancel', el: 'Η ακύρωση δεν έγινε' },
  cancelled_title: { en: 'Invite cancelled', el: 'Η πρόσκληση ακυρώθηκε' },
  cancelled_body: { en: 'The invitation has been revoked.', el: 'Η πρόσκληση ανακλήθηκε.' },
  try_again: { en: 'Please try again', el: 'Δοκιμάστε ξανά' },

  // ── History ──
  history_title: { en: 'Invite History', el: 'Ιστορικό προσκλήσεων' },
  sent_on: { en: 'Sent {date}', el: 'Στάλθηκε {date}' },
  joined_on: { en: 'Joined {date}', el: 'Εγγράφηκε {date}' },
  cancel_invite: { en: 'Cancel invite', el: 'Ακύρωση πρόσκλησης' },
  empty_title: { en: 'No invitations yet', el: 'Καμία πρόσκληση ακόμη' },
  empty_hint: {
    en: 'Invite co-founders, mentors, or investors to grow your network.',
    el: 'Προσκαλέστε συνιδρυτές, μέντορες ή επενδυτές για να μεγαλώσετε το δίκτυό σας.',
  },

  // ── Statuses ──
  status_pending: { en: 'Pending', el: 'Σε εκκρεμότητα' },
  status_accepted: { en: 'Accepted', el: 'Έγινε δεκτή' },
  status_expired: { en: 'Expired', el: 'Έληξε' },
  status_cancelled: { en: 'Cancelled', el: 'Ακυρώθηκε' },
};

export function inviteEn(key: keyof typeof INVITE_STRINGS): string {
  return INVITE_STRINGS[key].en;
}

export function inviteEl(key: keyof typeof INVITE_STRINGS): string {
  return INVITE_STRINGS[key].el;
}
