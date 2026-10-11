import type { BilingualPair } from './types';

/**
 * Profile page — bilingual EN + EL.
 * English (canonical) is never removed; Greek is additive.
 */
export const PROFILE_STRINGS: Record<string, BilingualPair> = {
  // ── Page header ──
  page_title: { en: 'My Profile', el: 'Το προφίλ μου' },
  page_description: {
    en: 'This is exactly how others see you. Keep skills, headline, and bio current \u2014 it powers matches and search.',
    el: 'Αυτό ακριβώς βλέπουν οι άλλοι. Διατηρείτε δεξιότητες, headline και βιογραφικό ενημερωμένα \u2014 τροφοδοτούν αντιστοιχίσεις και αναζήτηση.',
  },

  // ── Profile completion card ──
  profile_completion: { en: 'Profile completion', el: 'Ολοκλήρωση προφίλ' },
  display_name: { en: 'Display name', el: 'Εμφανιζόμενο όνομα' },
  headline: { en: 'Headline', el: 'Επικεφαλίδα' },
  bio: { en: 'Bio', el: 'Βιογραφικό' },
  three_plus_skills: { en: '3+ skills', el: '3+ δεξιότητες' },
  location: { en: 'Location', el: 'Τοποθεσία' },
  avatar: { en: 'Avatar', el: 'Εικόνα προφίλ' },
  complete_profile: { en: 'Complete profile', el: 'Συμπλήρωση προφίλ' },

  // ── Verification card ──
  verification: { en: 'Verification', el: 'Επαλήθευση' },
  email_verified: { en: 'Email verified', el: 'Email επαληθευμένο' },
  linkedin_connected: { en: 'LinkedIn connected', el: 'LinkedIn συνδεδεμένο' },
  github_connected: { en: 'GitHub connected', el: 'GitHub συνδεδεμένο' },
  identity_verified: { en: 'Identity verified', el: 'Ταυτότητα επαληθευμένη' },
  not_connected: { en: 'Not connected', el: 'Μη συνδεδεμένο' },

  // ── Action buttons ──
  share_profile: { en: 'Share Profile', el: 'Κοινοποίηση προφίλ' },
  edit_profile: { en: 'Edit Profile', el: 'Επεξεργασία προφίλ' },
  copy_link: { en: 'Copy Link', el: 'Αντιγραφή συνδέσμου' },
  settings: { en: 'Settings', el: 'Ρυθμίσεις' },
  link_copied: { en: 'Link copied!', el: 'Ο σύνδεσμος αντιγράφηκε!' },
  link_copied_desc: {
    en: 'Your profile link is in your clipboard.',
    el: 'Ο σύνδεσμος του προφίλ σας βρίσκεται στο πρόχειρο.',
  },

  // ── About section ──
  about: { en: 'About', el: 'Σχετικά' },
  no_headline_set: { en: 'No headline set', el: 'Δεν έχει οριστεί επικεφαλίδα' },
  bio_empty_hint: {
    en: 'Your bio is empty. Tell the community about yourself!',
    el: 'Το βιογραφικό σας είναι κενό. Πείτε στην κοινότητα για εσάς!',
  },
  add_bio: { en: 'Add Bio', el: 'Προσθήκη βιογραφικού' },
  ai_coaching_label: {
    en: 'Get AI coaching tips for your profile',
    el: 'Λάβετε συμβουλές AI για το προφίλ σας',
  },

  // ── Status badges ──
  open_to_work: { en: 'Open to work', el: 'Ανοιχτός/ή σε προτάσεις' },
  verified_member: { en: 'Verified Member', el: 'Επαληθευμένο μέλος' },
  joined: { en: 'Joined', el: 'Εγγραφή' },

  // ── Role details section ──
  details_suffix: { en: 'Details', el: 'Λεπτομέρειες' },
  startup_stage: { en: 'Startup stage', el: 'Στάδιο startup' },
  commitment: { en: 'Commitment', el: 'Δέσμευση' },
  looking_for: { en: 'Looking for', el: 'Αναζήτηση' },
  industries: { en: 'Industries', el: 'Κλάδοι' },
  expertise_areas: { en: 'Expertise areas', el: 'Τομείς ειδίκευσης' },
  availability: { en: 'Availability', el: 'Διαθεσιμότητα' },
  meeting_preference: { en: 'Meeting preference', el: 'Προτίμηση συνάντησης' },
  rate: { en: 'Rate', el: 'Χρέωση' },
  investment_focus: { en: 'Investment focus', el: 'Επενδυτική εστίαση' },
  investment_stages: { en: 'Investment stages', el: 'Στάδια επένδυσης' },
  check_size: { en: 'Check size', el: 'Ύψος επένδυσης' },
  geography: { en: 'Geography', el: 'Γεωγραφία' },
  organization_type: { en: 'Organization type', el: 'Τύπος οργανισμού' },
  programs: { en: 'Programs', el: 'Προγράμματα' },
  links: { en: 'Links', el: 'Σύνδεσμοι' },
  website: { en: 'Website', el: 'Ιστότοπος' },
  linkedin: { en: 'LinkedIn', el: 'LinkedIn' },
  github: { en: 'GitHub', el: 'GitHub' },
  twitter_x: { en: 'Twitter/X', el: 'Twitter/X' },

  // ── What I'm Looking For ──
  what_looking_for: { en: "What I'm Looking For", el: 'Τι αναζητώ' },
  compensation: { en: 'Compensation', el: 'Αμοιβή' },

  // ── Skills section ──
  top_skills: { en: 'Top Skills & Proficiency', el: 'Κορυφαίες δεξιότητες & επάρκεια' },
  add: { en: 'Add', el: 'Προσθήκη' },
  show_all_skills: { en: 'Show all', el: 'Εμφάνιση όλων' },
  skills_suffix: { en: 'skills', el: 'δεξιότητες' },

  // ── Skill levels ──
  expert: { en: 'Expert', el: 'Ειδήμων' },
  intermediate: { en: 'Intermediate', el: 'Μέτριο επίπεδο' },
  beginner: { en: 'Beginner', el: 'Αρχάριος' },

  // ── Portfolio section ──
  portfolio_showcase: { en: 'Portfolio & Showcase', el: 'Χαρτοφυλάκιο & Προβολή' },
  showcase_title: { en: 'Showcase your best work', el: 'Προβάλετε την καλύτερή σας δουλειά' },
  showcase_desc: {
    en: 'Add projects, startups, publications, or key achievements to stand out.',
    el: 'Προσθέστε έργα, startups, δημοσιεύσεις ή βασικά επιτεύγματα για να ξεχωρίσετε.',
  },
  add_first_item: { en: 'Add First Item', el: 'Προσθήκη πρώτου στοιχείου' },

  // ── Empty profile prompt ──
  profile_bare_title: { en: 'Your profile is looking bare', el: 'Το προφίλ σας φαίνεται κενό' },
  profile_bare_desc: {
    en: 'Profiles with bios and role details receive 4x more connection requests. Take 2 minutes to fill it out!',
    el: 'Τα προφίλ με βιογραφικό και ρόλο λαμβάνουν 4x περισσότερα αιτήματα σύνδεσης. Αφιερώστε 2 λεπτά!',
  },
  complete_profile_now: { en: 'Complete Profile Now', el: 'Ολοκλήρωση προφίλ τώρα' },

  // ── Activity & Reputation ──
  activity_reputation: { en: 'Activity & Reputation', el: 'Δραστηριότητα & Φήμη' },
  connections: { en: 'Connections', el: 'Συνδέσεις' },
  endorsements: { en: 'Endorsements', el: 'Προσυπογραφές' },
  posts: { en: 'Posts', el: 'Δημοσιεύσεις' },
  achievements: { en: 'Achievements', el: 'Επιτεύγματα' },
  view_reputation: { en: 'View Reputation Dashboard', el: 'Προβολή πίνακα φήμης' },

  // ── Activity Graph ──
  activity_graph: { en: 'Activity Graph', el: 'Γράφημα δραστηριότητας' },

  // ── Loading state ──
  preparing_profile: { en: 'Preparing your profile...', el: 'Προετοιμασία του προφίλ σας...' },

  // ── Role names ──
  founder: { en: 'Founder', el: 'Ιδρυτής' },
  mentor: { en: 'Mentor', el: 'Μέντορας' },
  investor: { en: 'Investor', el: 'Επενδυτής' },
  org: { en: 'Organization', el: 'Οργανισμός' },
};

export function profileEn(key: keyof typeof PROFILE_STRINGS): string {
  return PROFILE_STRINGS[key].en;
}

export function profileEl(key: keyof typeof PROFILE_STRINGS): string {
  return PROFILE_STRINGS[key].el;
}
