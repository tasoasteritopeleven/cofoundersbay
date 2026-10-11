/** Greek navigation labels, section titles, sidebar modes, and link tooltips. */

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar mode labels
// ─────────────────────────────────────────────────────────────────────────────

export const SIDEBAR_MODE_EL: Record<'work' | 'explore' | 'account', string> = {
  work: 'Εργασία',
  explore: 'Εξερεύνηση',
  account: 'Λογαριασμός',
};

/** What each mode holds, under its name in the switcher's tooltip. */
export const SIDEBAR_MODE_HINT: Record<'work' | 'explore' | 'account', { en: string; el: string }> = {
  work: {
    en: "Your role's dashboard and everyday tools",
    el: 'Ο πίνακας ελέγχου και τα καθημερινά εργαλεία του ρόλου σας',
  },
  explore: {
    en: 'People, communities, opportunities and learning',
    el: 'Άνθρωποι, κοινότητες, ευκαιρίες και μάθηση',
  },
  account: {
    en: 'Your profile, activity, settings and invitations',
    el: 'Το προφίλ, η δραστηριότητα, οι ρυθμίσεις και οι προσκλήσεις σας',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Section titles (keyed by English section name from nav-modes)
// ─────────────────────────────────────────────────────────────────────────────

export const NAV_SECTION_EL: Record<string, string> = {
  Activity: 'Δραστηριότητα',
  Build: 'Ανάπτυξη',
  Communicate: 'Επικοινωνία',
  Community: 'Κοινότητα',
  Config: 'Διαμόρφωση',
  Dashboard: 'Πίνακας ελέγχου',
  'Deal Flow': 'Ροή συμφωνιών',
  Discover: 'Ανακάλυψη',
  Fundraise: 'Χρηματοδότηση',
  Grow: 'Ανάπτυξη δικτύου',
  Learn: 'Μάθηση',
  Manage: 'Διαχείριση',
  Network: 'Δίκτυο',
  Opportunities: 'Ευκαιρίες',
  Overview: 'Επισκόπηση',
  People: 'Άτομα',
  Platform: 'Πλατφόρμα',
  Portfolio: 'Χαρτοφυλάκιο',
  Profile: 'Προφίλ',
  Programs: 'Προγράμματα',
  Reputation: 'Φήμη',
  Services: 'Υπηρεσίες',
  Sessions: 'Συνεδρίες',
  Settings: 'Ρυθμίσεις',
  'Users & Content': 'Χρήστες και περιεχόμενο',
  Workspace: 'Χώρος εργασίας',
};

// ─────────────────────────────────────────────────────────────────────────────
// Link labels (keyed by href from nav-modes)
// ─────────────────────────────────────────────────────────────────────────────

export const NAV_LABEL_EL: Record<string, string> = {
  '/ai': 'Βοηθός AI',
  '/achievements': 'Επιτεύγματα',
  '/activity': 'Δραστηριότητα',
  '/admin': 'Κέντρο διαχείρισης',
  '/admin/analytics': 'Συνολικά αναλυτικά',
  '/admin/audit-log': 'Αρχείο ελέγχου',
  '/admin/automations': 'Αυτοματισμοί',
  '/admin/billing': 'Τιμολόγηση',
  '/admin/communities': 'Κοινότητες',
  '/admin/domains': 'Τομείς',
  '/admin/feature-flags': 'Σημαίες λειτουργιών',
  '/admin/programs': 'Προγράμματα',
  '/admin/reports': 'Αναφορές',
  '/admin/sso': 'Ενιαία σύνδεση (SSO)',
  '/admin/taxonomy': 'Ταξινομία',
  '/admin/tenants': 'Οργανισμοί',
  '/admin/users': 'Χρήστες',
  '/analytics': 'Αναλυτικά',
  '/builder': 'Startup Builder',
  '/builder/applications': 'Αιτήσεις',
  '/builder/pitch-deck': 'Pitch deck',
  '/calendar': 'Ημερολόγιο',
  '/coaching': 'Coaching',
  '/compare': 'Σύγκριση προφίλ',
  '/connections': 'Συνδέσεις',
  '/dashboard': 'Επισκόπηση',
  '/dashboard/founder': 'Επισκόπηση',
  '/dashboard/investor': 'Επισκόπηση',
  '/dashboard/mentor': 'Επισκόπηση',
  '/dashboard/provider': 'Επισκόπηση',
  '/discover': 'Εξερεύνηση',
  '/endorsements': 'Συστάσεις',
  '/events': 'Εκδηλώσεις',
  '/expert-reviews': 'Αξιολογήσεις ειδικών',
  '/feed': 'Ροή',
  '/fundraising': 'Χρηματοδότηση',
  '/groups': 'Κοινότητες',
  '/help': 'Κέντρο βοήθειας',
  '/investor/analytics': 'Αναλυτικά συμφωνιών',
  '/investor/pipeline': 'Pipeline συμφωνιών',
  '/investor/portfolio': 'Χαρτοφυλάκιο',
  '/investor/scouting': 'Αναζήτηση startups',
  '/investor/watchlist': 'Υπό παρακολούθηση',
  '/investors': 'Επενδυτές',
  '/invite': 'Πρόσκληση φίλων',
  '/jobs': 'Θέσεις εργασίας',
  '/learning': 'Κέντρο μάθησης',
  '/marketplace': 'Υπηρεσίες',
  '/matches': 'Αντιστοιχίσεις',
  '/members': 'Μέλη',
  '/mentor/availability': 'Διαθεσιμότητα',
  '/mentor/earnings': 'Αποδοχές',
  '/mentor/mentees': 'Καθοδηγούμενοι',
  '/mentor/profile': 'Προφίλ μέντορα',
  '/mentor/requests': 'Αιτήματα',
  '/mentor/reviews': 'Αξιολογήσεις',
  '/mentor/sessions': 'Οι συνεδρίες μου',
  '/mentoring': 'Μέντορες',
  '/messages': 'Μηνύματα',
  '/milestones': 'Ορόσημα',
  '/notifications': 'Ειδοποιήσεις',
  '/opportunities': 'Ευκαιρίες',
  '/org/analytics': 'Αναλυτικά',
  '/org/applications': 'Αιτήσεις',
  '/org/cohorts': 'Κύκλοι',
  '/org/dashboard': 'Επισκόπηση',
  '/org/events': 'Εκδηλώσεις',
  '/org/members': 'Ομάδα',
  '/org/mentors': 'Δεξαμενή μεντόρων',
  '/org/programs': 'Προγράμματα',
  '/org/settings': 'Ρυθμίσεις',
  '/org/startups': 'Startups',
  '/profile': 'Το προφίλ μου',
  '/profile/edit': 'Επεξεργασία προφίλ',
  '/programs': 'Προγράμματα',
  '/projects': 'Έργα',
  '/commitments': 'Δεσμεύσεις',
  '/updates': 'Ενημερώσεις',
  '/intros': 'Συστάσεις γνωριμίας',
  '/scout': 'Ανιχνευτής συνιδρυτών',
  '/provider/analytics': 'Αναλυτικά παρόχου',
  '/provider/inquiries': 'Αιτήματα',
  '/provider/profile': 'Προφίλ παρόχου',
  '/provider/projects': 'Έργα πελατών',
  '/provider/reviews': 'Αξιολογήσεις',
  '/provider/services': 'Οι υπηρεσίες μου',
  '/readiness': 'Ετοιμότητα',
  '/recommendations': 'Για εσάς',
  '/referrals': 'Παραπομπές',
  '/reputation': 'Φήμη',
  '/research': 'Πίνακες έρευνας',
  '/saved-searches': 'Αποθηκευμένες αναζητήσεις',
  '/search': 'Αναζήτηση',
  '/settings': 'Γενικές',
  '/settings/billing': 'Τιμολόγηση',
  '/settings/data-export': 'Εξαγωγή δεδομένων',
  '/settings/notifications': 'Προτιμήσεις ειδοποιήσεων',
  '/shortlist': 'Αποθηκευμένα προφίλ',
  '/tenant/analytics': 'Αναλυτικά',
  '/tenant/api-keys': 'Κλειδιά API',
  '/tenant/automation': 'Αυτοματισμοί',
  '/tenant/billing': 'Τιμολόγηση',
  '/tenant/branding': 'Εταιρική ταυτότητα',
  '/tenant/dashboard': 'Επισκόπηση',
  '/tenant/domains': 'Τομείς',
  '/tenant/members': 'Μέλη',
  '/tenant/programs': 'Προγράμματα',
  '/tenant/settings': 'Ρυθμίσεις',
  '/tenant/sso': 'Ενιαία σύνδεση (SSO)',
  '/tenant/webhooks': 'Webhooks',
  '/admin/dashboard': 'Επισκόπηση πλατφόρμας',
  '/settings/ai': 'Προτιμήσεις AI',
  '/dashboard/incubator': 'Επισκόπηση',
};

// ─────────────────────────────────────────────────────────────────────────────
// Link tooltips (keyed by href from NAV_LINK_DESCRIPTIONS)
// ─────────────────────────────────────────────────────────────────────────────

export const NAV_DESCRIPTION_EL: Record<string, string> = {
  '/dashboard/founder':
    'Επισκόπηση της startup σας, ετοιμότητα και επόμενες ενέργειες',
  '/dashboard/mentor':
    'Συνεδρίες, αιτήματα και δραστηριότητα καθοδηγούμενων',
  '/dashboard/investor':
    'Βασικοί δείκτες ροής συμφωνιών και εικόνα χαρτοφυλακίου',
  '/dashboard/provider':
    'Υπηρεσίες, αιτήματα και εργασία με πελάτες',
  '/dashboard/incubator':
    'Κύκλοι, αιτήσεις και ορόσημα των startups σας',
  '/readiness':
    'Βαθμολογία ετοιμότητας για επενδυτές και συμβουλές βελτίωσης',
  '/analytics':
    'Οι δείκτες αλληλεπίδρασης και ανάπτυξής σας',
  '/builder':
    'Δομή ιδέας, ομάδας, αγοράς και traction',
  '/builder/pitch-deck':
    'Περιεχόμενο διαφανειών συνδεδεμένο με το Startup Builder',
  '/builder/applications':
    'Πρότυπα YC, Techstars, πανεπιστημίων και επιχορηγήσεων σε ένα σημείο',
  '/research':
    'Οπτικοί πίνακες έρευνας και στρατηγικής',
  '/milestones':
    'Στόχοι, υπεύθυνοι και προθεσμίες',
  '/projects':
    'Παράλληλα έργα και πρωτοβουλίες startup',
  '/commitments':
    'Κάρτες ανάγκης και κλίμακα ως τους συμφωνημένους όρους',
  '/updates':
    'Ενημερώσεις ιδρυτών που ακολουθείτε και όσες στέλνετε',
  '/intros':
    'Ζεστές συστάσεις μέσω κοινών γνωστών, με συναίνεση σε κάθε βήμα',
  '/scout':
    'Προτείνει συνιδρυτές για το σημείωμά σας· δεν στέλνει τίποτα',
  '/fundraising':
    'Pipeline επενδυτών και data room',
  '/ai':
    'Ο βοηθός σας: αντιστοιχίσεις, έρευνα, χρηματοδότηση. Οι αλλαγές γίνονται μόνο με την επιβεβαίωσή σας',
  '/messages':
    'Άμεσα μηνύματα και αιτήματα γνωριμίας',
  '/calendar':
    'Κλήσεις, συνεδρίες και εκδηλώσεις',
  '/mentor/sessions':
    'Προσεχείς και προηγούμενες συνεδρίες καθοδήγησης',
  '/mentor/requests':
    'Αποδοχή ή απόρριψη αιτημάτων καθοδήγησης',
  '/mentor/mentees':
    'Άτομα που καθοδηγείτε αυτή τη στιγμή',
  '/mentor/availability':
    'Πότε μπορούν να κλείσουν συνεδρία μαζί σας',
  '/mentor/profile':
    'Δημόσιο προφίλ μέντορα και ειδικότητες',
  '/mentor/earnings':
    'Πληρωμές συνεδριών και ιστορικό',
  '/mentor/reviews':
    'Σχόλια από τους καθοδηγούμενούς σας',
  '/investor/scouting':
    'Αναζήτηση startups κατά στάδιο και κλάδο',
  '/investor/pipeline':
    'Συμφωνίες από τη γνωριμία έως το κλείσιμο',
  '/investor/watchlist':
    'Startups που παρακολουθείτε',
  '/investor/portfolio':
    'Εταιρείες στις οποίες επενδύσατε',
  '/investor/analytics':
    'Δείκτες συμφωνιών και χαρτοφυλακίου',
  '/provider/services':
    'Οι υπηρεσίες που προσφέρετε στην πλατφόρμα',
  '/provider/inquiries':
    'Εισερχόμενα αιτήματα από ιδρυτές',
  '/provider/projects':
    'Ενεργές συνεργασίες με πελάτες',
  '/provider/reviews':
    'Ανατροφοδότηση πελατών για την εργασία σας',
  '/provider/profile':
    'Δημόσιο προφίλ παρόχου',
  '/provider/analytics':
    'Στατιστικά απόδοσης και μετατροπών',
  '/org/dashboard':
    'Προγράμματα, κύκλοι και χαρτοφυλάκιο',
  '/org/programs':
    'Διαχείριση προγραμμάτων θερμοκοιτίδας ή επιταχυντή',
  '/org/cohorts':
    'Ένταξη νέων κύκλων και η πρόοδός τους',
  '/org/applications':
    'Αξιολόγηση αιτήσεων startups',
  '/org/startups':
    'Εταιρείες χαρτοφυλακίου στα προγράμματά σας',
  '/org/mentors':
    'Μέντορες που συνεργάζονται με τον οργανισμό σας',
  '/org/events':
    'Εκδηλώσεις του οργανισμού και δηλώσεις συμμετοχής',
  '/org/members':
    'Λογαριασμοί ομάδας και προσωπικού',
  '/org/settings':
    'Διαμόρφωση οργανισμού',
  '/org/analytics':
    'Δείκτες προγραμμάτων και κύκλων',
  '/discover':
    'Περιήγηση σε μέλη με φίλτρα',
  '/matches':
    'Προτάσεις ταξινομημένες κατά συμβατότητα',
  '/recommendations':
    'Εξατομικευμένες προτάσεις για εσάς',
  '/members':
    'Πλήρης κατάλογος μελών',
  '/mentoring':
    'Βρείτε μέντορα και κλείστε συνεδρία',
  '/investors':
    'Κατάλογος angels και VCs',
  '/opportunities':
    'Θέσεις εργασίας και θέσεις συνιδρυτή',
  '/groups':
    'Κοινότητες και χώροι συζήτησης',
  '/events':
    'Εκδηλώσεις πλατφόρμας και κοινότητας',
  '/programs':
    'Επιταχυντές, επιχορηγήσεις και κύκλοι',
  '/connections':
    'Εκκρεμείς και ενεργές συνδέσεις',
  '/shortlist':
    'Προφίλ που αποθηκεύσατε',
  '/endorsements':
    'Δεξιότητες που επικυρώθηκαν από άλλους',
  '/matches/compare':
    'Σύγκριση δύο προφίλ παράλληλα',
  '/learning':
    'Μαθήματα και διαδρομές μάθησης',
  '/marketplace':
    'Υπηρεσίες νομικές, σχεδιασμού και ανάπτυξης',
  '/jobs':
    'Ανοιχτές θέσεις σε startups',
  '/help':
    'Οδηγοί και υποστήριξη',
  '/feed':
    'Δραστηριότητα από το δίκτυό σας',
  '/activity':
    'Οι πρόσφατες ενέργειές σας',
  '/achievements':
    'Εμβλήματα και πρόοδος XP',
  '/profile':
    'Πώς σας βλέπουν οι άλλοι',
  '/notifications':
    'Ειδοποιήσεις και ενημερώσεις',
  '/settings':
    'Λογαριασμός, απόρρητο και τιμολόγηση',
  '/invite':
    'Προσκαλέστε φίλους και αναπτύξτε το δίκτυο',
  '/admin':
    'Υγεία πλατφόρμας και εργαλεία διαχείρισης',
  '/admin/users':
    'Αναζήτηση και έλεγχος λογαριασμών',
  '/admin/user-management':
    'Μαζική διαχείριση χρηστών και επαλήθευση',
  '/admin/analytics':
    'Συνολικοί δείκτες της πλατφόρμας',
  '/admin/communities':
    'Εποπτεία κοινοτήτων',
  '/admin/reports':
    'Αναφορές χρηστών και επισημάνσεις',
  '/tenant/dashboard':
    'Επισκόπηση του οργανισμού σας (white-label)',
  '/tenant/branding':
    'Λογότυπο, χρώματα και κείμενο της αρχικής σελίδας',
  '/tenant/sso':
    'Ρύθμιση επιχειρησιακής σύνδεσης',
  '/tenant/domains':
    'Σύνδεση του δικού σας τομέα (domain)',
  '/tenant/members':
    'Χρήστες του οργανισμού σας',
  '/tenant/programs':
    'Προγράμματα του οργανισμού σας',
  '/admin/audit-log':
    'Ποιος άλλαξε τι και πότε',
  '/admin/automations':
    'Κανόνες που εκτελούνται χωρίς χειροκίνητο έλεγχο',
  '/admin/billing':
    'Έσοδα, τιμολόγια και συνδρομές',
  '/admin/dashboard':
    'Χρήστες, δραστηριότητα και ό,τι περιμένει εσάς',
  '/admin/domains':
    'Επαλήθευση και δρομολόγηση προσαρμοσμένων τομέων',
  '/admin/feature-flags':
    'Ενεργοποίηση ή απόσυρση λειτουργιών χωρίς νέα έκδοση',
  '/admin/programs':
    'Έγκριση, παύση ή έλεγχος προγραμμάτων',
  '/admin/sso':
    'Εταιρική σύνδεση (SSO) για οργανισμούς',
  '/admin/taxonomy':
    'Δεξιότητες, κλάδοι και στάδια που χρησιμοποιούν οι αντιστοιχίσεις',
  '/admin/tenants':
    'Δημιουργία, αναστολή και έλεγχος οργανισμών',
  '/coaching':
    'Κλείστε χρόνο με μέντορες',
  '/compare':
    'Σύγκριση προφίλ δίπλα-δίπλα',
  '/dashboard':
    'Ανοίγει τον πίνακα ελέγχου του ρόλου σας',
  '/expert-reviews':
    'Σχόλια ειδικών σε pitch, οικονομικά και στρατηγική',
  '/profile/edit':
    'Φωτογραφία, βιογραφικό, δεξιότητες και ορατότητα',
  '/referrals':
    'Ανταμοιβές όταν εγγράφονται φίλοι που προσκαλέσατε',
  '/reputation':
    'Η αξιοπιστία σας στην πλατφόρμα',
  '/saved-searches':
    'Αποθηκευμένα φίλτρα που σας ενημερώνουν για νέα αποτελέσματα',
  '/search':
    'Άτομα, θέσεις, εκδηλώσεις, προγράμματα και αναρτήσεις',
  '/settings/ai':
    'Το μοντέλο και ο βοηθός που σας απαντούν',
  '/settings/billing':
    'Το πακέτο σας και πού στέλνονται τα τιμολόγια',
  '/settings/data-export':
    'Λήψη του προφίλ, των μηνυμάτων και της δραστηριότητάς σας',
  '/settings/notifications':
    'Ποια email λαμβάνετε και πόσο συχνά',
  '/tenant/analytics':
    'Αύξηση μελών, συμμετοχή και προγράμματα',
  '/tenant/api-keys':
    'Περιορισμένη πρόσβαση για τα δικά σας εργαλεία',
  '/tenant/automation':
    'Εναύσματα, συνθήκες και ενέργειες',
  '/tenant/billing':
    'Πακέτο, θέσεις, τιμολόγια και πληρωμή',
  '/tenant/settings':
    'Πολιτική μελών και προτιμήσεις email',
  '/tenant/webhooks':
    'Αποστολή συμβάντων σε Slack, Zapier ή οποιοδήποτε endpoint',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function getNavLabelEl(href: string): string | undefined {
  return NAV_LABEL_EL[href];
}

export function getNavSectionEl(section: string): string | undefined {
  return NAV_SECTION_EL[section];
}

export function getNavDescriptionEl(href: string): string | undefined {
  return NAV_DESCRIPTION_EL[href];
}
