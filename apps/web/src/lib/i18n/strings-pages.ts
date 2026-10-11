import type { PageMetaEl } from './types';

/** Greek page titles and descriptions keyed by route path. */
export const PAGE_META_EL: Record<string, PageMetaEl> = {
  // ── Public ──
  '/': {
    title: 'Αρχική',
    description:
      'Το landing του CoFounderBay — εύρεση συνιδρυτών, μεντόρων και επενδυτών.',
    section: 'Δημόσιο',
  },
  '/pricing': {
    title: 'Τιμολόγηση',
    description: 'Σχέδια για founders, μέντορες, οργανισμούς και επιχειρήσεις.',
    section: 'Δημόσιο',
  },
  '/login': {
    title: 'Σύνδεση',
    description:
      'Πρόσβαση στον χώρο εργασίας μέσω email, Google, LinkedIn ή SSO.',
    section: 'Αυθεντικοποίηση',
  },
  '/register': {
    title: 'Δημιουργία λογαριασμού',
    description: 'Εγγραφή ως founder, μέντορας, επενδυτής ή οργανισμός.',
    section: 'Αυθεντικοποίηση',
  },
  '/onboarding': {
    title: 'Καλώς ήρθατε στο CoFounderBay',
    description:
      'Ρύθμιση 3 λεπτών ώστε η αντιστοίχιση, η αναζήτηση και οι προτάσεις να λειτουργούν αποτελεσματικά για εσάς.',
    section: 'Αυθεντικοποίηση',
  },

  // ── Founder work ──
  '/dashboard/founder': {
    title: 'Πίνακας ελέγχου ιδρυτή',
    description:
      'Το κέντρο ελέγχου της startup σας — ετοιμότητα, αντιστοιχίσεις και επόμενες ενέργειες.',
    section: 'Εργασία',
  },
  '/readiness': {
    title: 'Βαθμολογία ετοιμότητας',
    description:
      'Αξιολόγηση της ετοιμότητας του startup σε 6 βασικές διαστάσεις και προτεραιότητες βελτίωσης.',
    section: 'Εργασία',
  },
  '/analytics': {
    title: 'Αναλυτικά',
    description:
      'Παρακολούθηση απόδοσης προφίλ και ανάπτυξης δικτύου — προβολές, συνδέσεις και αφοσίωση.',
    section: 'Εργασία',
  },
  '/builder': {
    title: 'Startup Builder',
    description:
      'Δομή ιδέας, ομάδας, αγοράς, traction και pitch — σε έναν ενοποιημένο χώρο εργασίας.',
    section: 'Εργασία',
  },
  '/builder/pitch-deck': {
    title: 'Pitch deck',
    description:
      'Διαφάνειες συνδεδεμένες με τα δεδομένα του Builder. Η ολοκλήρωση μετρά περιεχόμενο, όχι κενά πρότυπα.',
    section: 'Εργασία',
  },
  '/builder/applications': {
    title: 'Αιτήσεις προγράμματος',
    description:
      'Προετοιμάστε αιτήσεις επιταχυντών και επιχορηγήσεων από τον χώρο εργασίας Builder. Ελέγξτε τα προσχέδια AI και αποθηκεύστε τις απαντήσεις σας.',
    section: 'Εργασία',
  },
  '/research': {
    title: 'Πίνακες έρευνας',
    description:
      'Οπτικές επιφάνειες για έρευνα αγοράς, προϊόντος και ανταγωνισμού. Τα πρότυπα γεμίζουν έναν πίνακα· ο καμβάς κρατά σημειώσεις, αρχεία και συνδέσμους.',
    section: 'Εργασία',
  },
  '/milestones': {
    title: 'Ορόσημα',
    description:
      'Μεμονωμένοι στόχοι με υπεύθυνο και ημερομηνία. Η ολοκλήρωση τροφοδοτεί την Ετοιμότητα και τις ενημερώσεις επενδυτών.',
    section: 'Εργασία',
  },
  '/milestones/new': {
    title: 'Νέο ορόσημο',
    description: 'Ορίστε ένα ορόσημο — τι σημαίνει «ολοκληρώθηκε», ποιος το αναλαμβάνει και πότε λήγει.',
    section: 'Εργασία',
  },
  '/projects': {
    title: 'Έργα',
    description:
      'Ανακαλύψτε έργα, ενταχθείτε σε ομάδα ή δημοσιεύστε ένα με ανοιχτούς ρόλους. Η δουλειά εδώ κάθεται δίπλα στα Ορόσημα και τον Builder.',
    section: 'Εργασία',
  },
  '/scout': {
    title: 'Ανιχνευτής συνιδρυτών',
    description: 'Γράψτε ποιον ψάχνετε και ο ανιχνευτής προτείνει πρόσωπα με τους λόγους του και ένα πρώτο σημείωμα. Δεν στέλνει τίποτα και δεν ειδοποιεί κανέναν.',
    section: 'Εργασία',
  },
  '/intros': {
    title: 'Συστάσεις γνωριμίας',
    description: 'Ζητήστε σύσταση μέσω κάποιου που γνωρίζετε και οι δύο. Ο ενδιάμεσος αποφασίζει αν θα την προωθήσει· η αποδοχή απαντά στην κάρτα ανάγκης σας.',
    section: 'Δίκτυο',
  },
  '/updates': {
    title: 'Ενημερώσεις',
    description: 'Ενημερώσεις από ιδρυτές που ακολουθείτε, και όσες στέλνετε εσείς σε όσους σας ακολουθούν ή δημόσια, με σύνδεσμο για το LinkedIn.',
    section: 'Δίκτυο',
  },
  '/commitments': {
    title: 'Δεσμεύσεις',
    description: 'Κάρτες ανάγκης και η κλίμακα από το ενδιαφέρον ως τους συμφωνημένους όρους: προστατευμένη πρώτη συζήτηση, χωριστές επιβεβαιώσεις, όροι σε εκδόσεις.',
    section: 'Εργασία',
  },
  '/commitments/new': {
    title: 'Νέα κάρτα ανάγκης',
    description: 'Τρεις προτάσεις και μια προσφορά, σε περίπου δύο λεπτά. Κατηγορία, τόπος, στάδιο και δέσμευση είναι αυτά με τα οποία φιλτράρουν οι άλλοι.',
    section: 'Εργασία',
  },
  '/projects/create': {
    title: 'Δημιουργία έργου',
    description: 'Ονομάστε την ιδέα, επιλέξτε στάδιο και καταγράψτε τους ρόλους που λείπουν — μετά δημοσιεύστε.',
    section: 'Εργασία',
  },
  '/fundraising': {
    title: 'Χρηματοδότηση',
    description:
      'Παρακολουθήστε τον γύρο χρηματοδότησης, οργανώστε τις συζητήσεις με επενδυτές και τα έγγραφα για τον έλεγχο δέουσας επιμέλειας.',
    section: 'Εργασία',
  },

  // ── Discovery ──
  '/matches': {
    title: 'Αντιστοιχίσεις',
    description:
      'Αντιστοιχίσεις συνιδρυτών και ομάδων με βάση τη συμβατότητα του προφίλ σας, κατάταξη AI.',
    section: 'Εξερεύνηση',
  },
  '/matches/compare': {
    title: 'Σύγκριση προφίλ',
    description:
      'Παράλληλη σύγκριση δεξιοτήτων, στάδιου και συμβατότητας.',
    section: 'Εξερεύνηση',
  },
  '/discover': {
    title: 'Εξερεύνηση',
    description:
      'Ανακάλυψη founders, μεντόρων, επενδυτών και μελών ομάδας με φίλτρα ρόλου, δεξιοτήτων και τοποθεσίας.',
    section: 'Εξερεύνηση',
  },
  '/recommendations': {
    title: 'Για εσάς',
    description:
      'Εξατομικευμένες προτάσεις βάσει του προφίλ και της δραστηριότητάς σας.',
    section: 'Εξερεύνηση',
  },
  '/search': {
    title: 'Αναζήτηση',
    description:
      'Εύρεση ατόμων, θέσεων εργασίας, εκδηλώσεων, προγραμμάτων και δημοσιεύσεων.',
    section: 'Εξερεύνηση',
  },
  '/connections': {
    title: 'Συνδέσεις',
    description:
      'Διαχείριση εκκρεμών αιτημάτων και ενεργών επαγγελματικών σχέσεων.',
    section: 'Δίκτυο',
  },
  '/shortlist': {
    title: 'Αποθηκευμένα προφίλ',
    description: 'Προφίλ που αποθηκεύσατε για μελλοντική επικοινωνία.',
    section: 'Δίκτυο',
  },
  '/messages': {
    title: 'Μηνύματα',
    description:
      'Πλήρης θυρίδα για συνομιλίες και αιτήματα γνωριμίας. Το νέο μήνυμα ανοίγει επιλογή σύνδεσης· το AI συντάσσει από το νήμα.',
    section: 'Επικοινωνία',
  },
  '/calendar': {
    title: 'Ημερολόγιο',
    description: 'Συνεδρίες, κλήσεις και εκδηλώσεις σε μία χρονολογική ακολουθία.',
    section: 'Επικοινωνία',
  },

  // ── Mentor ──
  '/dashboard/mentor': {
    title: 'Πίνακας ελέγχου μέντορα',
    description:
      'Συνεδρίες, αιτήματα, αποδοχές και επισκόπηση καθοδηγούμενων.',
    section: 'Εργασία',
  },
  '/mentor/sessions': {
    title: 'Οι συνεδρίες μου',
    description: 'Προγραμματισμένες και προηγούμενες συνεδρίες καθοδήγησης.',
    section: 'Εργασία',
  },
  '/mentor/requests': {
    title: 'Αιτήματα καθοδηγούμενων',
    description: 'Αποδοχή ή απόρριψη νέων αιτημάτων καθοδήγησης.',
    section: 'Εργασία',
  },
  '/mentoring': {
    title: 'Εύρεση μεντόρων',
    description:
      'Κατάλογος μεντόρων — φιλτράρισμα κατά εξειδίκευση και διαθεσιμότητα.',
    section: 'Εξερεύνηση',
  },

  // ── Investor ──
  '/dashboard/investor': {
    title: 'Πίνακας ελέγχου επενδυτή',
    description:
      'KPIs ροής deals, στιγμιότυπο pipeline και watchlist.',
    section: 'Εργασία',
  },
  '/investor/scouting': {
    title: 'Αναζήτηση startups',
    description:
      'Αναζήτηση και φιλτράρισμα startups κατά στάδιο, κλάδο και traction.',
    section: 'Εργασία',
  },
  '/investor/pipeline': {
    title: 'Pipeline',
    description:
      'Kanban deals από την εισαγωγή έως το term sheet.',
    section: 'Εργασία',
  },
  '/investors': {
    title: 'Κατάλογος επενδυτών',
    description:
      'Ανακάλυψη angels, VCs και syndicates στην πλατφόρμα.',
    section: 'Εξερεύνηση',
  },

  // ── Provider ──
  '/dashboard/provider': {
    title: 'Πίνακας ελέγχου παρόχου',
    description: 'Υπηρεσίες, αιτήματα και ενεργά έργα πελατών.',
    section: 'Εργασία',
  },
  '/marketplace': {
    title: 'Marketplace υπηρεσιών',
    description:
      'Περιήγηση σε παρόχους νομικών, σχεδιασμού, growth και operations.',
    section: 'Πόροι',
  },

  // ── Organization ──
  '/org/dashboard': {
    title: 'Πίνακας ελέγχου οργανισμού',
    description: 'Προγράμματα, cohorts και υγεία χαρτοφυλακίου.',
    section: 'Εργασία',
  },
  '/org/programs': {
    title: 'Προγράμματα',
    description:
      'Δημιουργία, εκτέλεση και αξιολόγηση προγραμμάτων accelerator, bootcamp και incubator.',
    section: 'Εργασία',
  },
  '/org/applications': {
    title: 'Αιτήσεις',
    description:
      'Αξιολόγηση και βαθμολόγηση αιτήσεων startups σε όλα τα ανοιχτά προγράμματα.',
    section: 'Εργασία',
  },
  '/org/cohorts': {
    title: 'Cohorts',
    description:
      'Διαχείριση cohorts προγράμματος, κάλυψης μεντόρων και προόδου συμμετεχόντων.',
    section: 'Εργασία',
  },
  '/org/startups': {
    title: 'Startups χαρτοφυλακίου',
    description: 'Startups σε ενεργά προγράμματα και αποφοιτήσαντες.',
    section: 'Εργασία',
  },
  '/org/members': {
    title: 'Μέλη ομάδας',
    description:
      'Πρόσκληση και διαχείριση δικαιωμάτων εκτέλεσης προγραμμάτων, αξιολόγησης αιτήσεων και ρυθμίσεων.',
    section: 'Εργασία',
  },
  '/org/mentors': {
    title: 'Δεξαμενή μεντόρων',
    description:
      'Μέντορες διαθέσιμοι για τα cohorts σας. Πρόσκληση μέσω email ή onboarding από τον κατάλογο.',
    section: 'Εργασία',
  },
  '/org/events': {
    title: 'Εκδηλώσεις οργανισμού',
    description:
      'Demo days, office hours, εργαστήρια και pitch nights για τα cohorts σας.',
    section: 'Εργασία',
  },
  '/org/analytics': {
    title: 'Αναλυτικά οργανισμού',
    description:
      'Υγεία cohorts, αντίκτυπος προγραμμάτων, funnel αιτήσεων και ανάπτυξη μελών.',
    section: 'Εργασία',
  },
  '/org/settings': {
    title: 'Ρυθμίσεις οργανισμού',
    description:
      'Προφίλ, branding, ομάδα, δικαιώματα και τιμολόγηση του οργανισμού.',
    section: 'Εργασία',
  },

  // ── Tenant admin ──
  '/tenant/dashboard': {
    title: 'Πίνακας ελέγχου tenant',
    description:
      'Επισκόπηση white-label κοινότητας και βασικών μετρικών.',
    section: 'Tenant',
  },
  '/tenant/branding': {
    title: 'Branding',
    description:
      'Προσαρμογή χρωμάτων, λογοτύπων, γραμματοσειρών και κειμένου landing. Εργασία σε draft, δημοσίευση για εφαρμογή σε όλο τον tenant.',
    section: 'Tenant',
  },
  '/tenant/sso': {
    title: 'SSO / Αυθεντικοποίηση',
    description:
      'Ρύθμιση SAML, OIDC ή Google Workspace SSO. Προαιρετικοί κανόνες αντιστοίχισης claims IdP σε ρόλους.',
    section: 'Tenant',
  },
  '/tenant/domains': {
    title: 'Διαχείριση domain',
    description:
      'Προσθήκη subdomain ή σύνδεση custom domain. Το SSL προμηθεύεται αυτόματα μετά την επαλήθευση DNS.',
    section: 'Tenant',
  },
  '/tenant/members': {
    title: 'Μέλη tenant',
    description:
      'Πρόσκληση, ανάθεση ρόλων και αφαίρεση μελών του χώρου εργασίας.',
    section: 'Tenant',
  },
  '/tenant/programs': {
    title: 'Προγράμματα tenant',
    description:
      'Χώροι εργασίας με προγράμματα ενεργοποιούν αιτήσεις, cohorts και δομημένη καθοδήγηση.',
    section: 'Tenant',
  },
  '/tenant/automation': {
    title: 'Αυτοματισμός',
    description:
      'Ροές εργασίας βάσει εκδηλώσεων: triggers, conditions και actions για τον χώρο εργασίας.',
    section: 'Tenant',
  },
  '/tenant/webhooks': {
    title: 'Webhooks',
    description:
      'Αποστολή εκδηλώσεων σε πραγματικό χρόνο σε Zapier, Slack ή οποιοδήποτε HTTPS endpoint.',
    section: 'Tenant',
  },
  '/tenant/api-keys': {
    title: 'API Keys',
    description:
      'Πρόσβαση προγραμματιστικής διεπαφής με συγκεκριμένα δικαιώματα. Περιοδική ανανέωση.',
    section: 'Tenant',
  },
  '/tenant/billing': {
    title: 'Τιμολόγηση οργανισμού',
    description:
      'Σχέδιο, θέσεις, τιμολόγια και μέθοδοι πληρωμής του χώρου εργασίας.',
    section: 'Tenant',
  },
  '/tenant/analytics': {
    title: 'Αναλυτικά tenant',
    description:
      'Ανάπτυξη μελών, engagement και δραστηριότητα προγραμμάτων του χώρου εργασίας.',
    section: 'Tenant',
  },
  '/tenant/settings': {
    title: 'Ρυθμίσεις οργανισμού',
    description:
      'Γενικές ρυθμίσεις χώρου εργασίας: πολιτική συμμετοχής, ειδοποιήσεις και προτιμήσεις email.',
    section: 'Tenant',
  },

  // ── Platform admin ──
  '/admin': {
    title: 'Κονσόλα διαχείρισης',
    description:
      'Ουρά ελέγχου, χρήστες, περιεχόμενο, κύκλοι και τα λειτουργικά εργαλεία της πλατφόρμας.',
    section: 'Διαχείριση',
  },
  '/admin/users': {
    title: 'Χρήστες',
    description: 'Αναζήτηση και διαχείριση λογαριασμών πλατφόρμας.',
    section: 'Διαχείριση',
  },
  '/admin/user-management': {
    title: 'Διαχείριση χρηστών',
    description:
      'Εξειδικευμένα φίλτρα, μαζικές ενέργειες και έλεγχοι επαλήθευσης.',
    section: 'Διαχείριση',
  },
  '/admin/analytics': {
    title: 'Παγκόσμια αναλυτικά',
    description:
      'Μετρικές ανάπτυξης, engagement και οικονομικών της πλατφόρμας.',
    section: 'Διαχείριση',
  },
  '/admin/content-moderation': {
    title: 'Μέτρηση περιεχομένου',
    description:
      'Αξιολόγηση σημειωμένων δημοσιεύσεων, προφίλ και πολυμέσων.',
    section: 'Διαχείριση',
  },
  '/admin/security-monitoring': {
    title: 'Παρακολούθηση ασφάλειας',
    description:
      'Εκδηλώσεις αυθεντικοποίησης, ανωμαλίες και αρχεία ελέγχου.',
    section: 'Διαχείριση',
  },
  '/admin/community-management': {
    title: 'Διαχείριση κοινότητας',
    description:
      'Επιθεώρηση υγείας κοινότητας, ανάπτυξης και σημειωμένου περιεχομένου.',
    section: 'Διαχείριση',
  },
  '/admin/mentorship-management': {
    title: 'Διαχείριση καθοδήγησης',
    description:
      'Έγκριση μεντόρων, αξιολόγηση προσόντων και παρακολούθηση ποιότητας συνεδριών.',
    section: 'Διαχείριση',
  },
  '/admin/system-settings': {
    title: 'Ρυθμίσεις συστήματος',
    description:
      'Πλατφορμικοί διακόπτες συντήρησης, εγγραφής και email.',
    section: 'Διαχείριση',
  },
  '/admin/dashboard': {
    title: 'Επισκόπηση πλατφόρμας',
    description: 'Χρήστες, δραστηριότητα, ό,τι περιμένει διαχειριστή και υγεία του API.',
    section: 'Διαχείριση',
  },
  '/admin/audit-log': {
    title: 'Αρχείο ελέγχου',
    description: 'Αμετάβλητο ιστορικό διαχειριστικών ενεργειών — ποιος άλλαξε τι και πότε.',
    section: 'Διαχείριση',
  },
  '/admin/automations': {
    title: 'Κανόνες αυτοματισμού',
    description: 'Κανόνες ενεργοποίησης-ενέργειας που εκτελούνται χωρίς χειροκίνητο έλεγχο.',
    section: 'Διαχείριση',
  },
  '/admin/billing': {
    title: 'Διαχείριση χρεώσεων',
    description: 'Έσοδα πλατφόρμας, τιμολόγια και καταστάσεις συνδρομών σε όλους τους λογαριασμούς.',
    section: 'Διαχείριση',
  },
  '/admin/communities': {
    title: 'Κοινότητες',
    description: 'Όλες οι κοινότητες της πλατφόρμας, με μέλη και επίπεδα δραστηριότητας.',
    section: 'Διαχείριση',
  },
  '/admin/domains': {
    title: 'Διαχείριση domain',
    description: 'Επαλήθευση και δρομολόγηση προσαρμοσμένων domain για χώρους tenant.',
    section: 'Διαχείριση',
  },
  '/admin/feature-flags': {
    title: 'Feature flags',
    description: 'Ενεργοποίηση ή απενεργοποίηση λειτουργιών ανά περιβάλλον χωρίς deploy.',
    section: 'Διαχείριση',
  },
  '/admin/programs': {
    title: 'Προγράμματα',
    description: 'Επιταχυντές και cohorts σε όλη την πλατφόρμα — έγκριση, παύση ή έλεγχος.',
    section: 'Διαχείριση',
  },
  '/admin/reports': {
    title: 'Αναφορές & εποπτεία',
    description: 'Αναφορές χρηστών που περιμένουν απόφαση εποπτείας.',
    section: 'Διαχείριση',
  },
  '/admin/sso': {
    title: 'Ρύθμιση SSO',
    description: 'Πάροχοι ταυτότητας, endpoints ACS και δοκιμαστική σύνδεση για εταιρικούς tenants.',
    section: 'Διαχείριση',
  },
  '/admin/taxonomy': {
    title: 'Διαχείριση ταξινομίας',
    description: 'Λεξιλόγια δεξιοτήτων, κλάδων και σταδίων που διαβάζουν η αντιστοίχιση και η αναζήτηση.',
    section: 'Διαχείριση',
  },
  '/admin/tenants': {
    title: 'Διαχείριση tenants',
    description: 'Δημιουργία, αναστολή και έλεγχος χώρων εργασίας tenant.',
    section: 'Διαχείριση',
  },

  // ── Account ──
  '/profile': {
    title: 'Το προφίλ μου',
    description:
      'Ακριβώς όπως εμφανίζεστε στους άλλους. Διατηρείτε δεξιότητες, headline και βιογραφικό ενημερωμένα — τροφοδοτούν αντιστοιχίσεις και αναζήτηση.',
    section: 'Λογαριασμός',
  },
  '/profile/edit': {
    title: 'Επεξεργασία προφίλ',
    description:
      'Ενημέρωση φωτογραφίας, βιογραφικού, δεξιοτήτων και ρυθμίσεων ορατότητας. Αποθήκευση αυτόματα κατά την πληκτρολόγηση.',
    section: 'Λογαριασμός',
  },
  '/settings': {
    title: 'Ρυθμίσεις',
    description:
      'Διαχείριση τιμολόγησης, ειδοποιήσεων, ενσωματώσεων και ιδιωτικότητας.',
    section: 'Λογαριασμός',
  },
  '/settings/ai': {
    title: 'Βοηθός AI',
    description: 'Επιλέξτε το μοντέλο και τον προεπιλεγμένο πράκτορα που απαντούν στις ερωτήσεις σας.',
    section: 'Λογαριασμός',
  },
  '/settings/billing': {
    title: 'Πλάνο & χρεώσεις',
    description: 'Το τρέχον πλάνο σας, τι περιλαμβάνει και πού αποστέλλονται τα τιμολόγια.',
    section: 'Λογαριασμός',
  },
  '/settings/notifications': {
    title: 'Προτιμήσεις ειδοποιήσεων',
    description: 'Επιλέξτε ποια γεγονότα σας φτάνουν με email και πόσο συχνά.',
    section: 'Λογαριασμός',
  },
  '/settings/data-export': {
    title: 'Εξαγωγή δεδομένων',
    description: 'Κατεβάστε αντίγραφο του προφίλ, των μηνυμάτων και της δραστηριότητάς σας.',
    section: 'Λογαριασμός',
  },
  '/notifications': {
    title: 'Ειδοποιήσεις',
    description:
      'Ειδοποιήσεις δραστηριότητας — αντιστοιχίσεις, μηνύματα και ενημερώσεις προγραμμάτων.',
    section: 'Λογαριασμός',
  },
  '/achievements': {
    title: 'Επιτεύγματα',
    description:
      'Badges και XP από τη δραστηριότητα στην πλατφόρμα.',
    section: 'Λογαριασμός',
  },
  '/help': {
    title: 'Βοήθεια και υποστήριξη',
    description: 'Οδηγοί, συχνές ερωτήσεις και επιλογές επικοινωνίας.',
    section: 'Πόροι',
  },

  // ── Ten routes whose English header had no Greek half ──
  //    «Επιταχυντής» and «θερμοκοιτίδα» are what the Greek ecosystem calls an
  //    accelerator and an incubator; «bootcamp» is used untranslated, as it is
  //    in practice. A referral is «σύσταση» here in its networking sense — the
  //    same word endorsements use, which is correct: both are one person
  //    vouching for another.
  '/activity': {
    title: 'Ροή δραστηριότητας',
    description: 'Παρακολουθήστε τη δραστηριότητα του δικτύου σας, τις ειδοποιήσεις και τις εκδηλώσεις.',
    section: 'Λογαριασμός',
  },
  '/ai': {
    title: 'Βοηθός AI',
    description:
      'Ρωτήστε για τον ενεργό χώρο εργασίας, ελέγξτε τα στοιχεία και εγκρίνετε τις προτεινόμενες αλλαγές πριν εκτελεστούν.',
    section: 'Εργασία',
  },
  '/ai/capabilities': {
    title: 'Τι μπορεί να κάνει ο βοηθός',
    description:
      'Κάθε ανάγνωση και εγγραφή που μπορεί να κάνει ο βοηθός, παραγόμενη από το κοινό συμβόλαιο δυνατοτήτων. Τα δείγματα είναι παραδείγματα διατύπωσης με ενδεικτικό όνομα.',
    section: 'Εργασία',
  },
  '/compare': {
    title: 'Σύγκριση προφίλ',
    description: 'Σύγκριση δίπλα-δίπλα για να βρείτε την καλύτερη αντιστοίχιση. Συμβουλή: αποθηκεύστε ένα URL /matches/compare με ids προφίλ για να το μοιραστείτε.',
    section: 'Εξερεύνηση',
  },
  '/expert-reviews': {
    title: 'Αξιολογήσεις ειδικών',
    description: 'Δομημένη ανατροφοδότηση για το pitch, τα οικονομικά και τη στρατηγική σας από ειδικούς του κλάδου.',
    section: 'Πόροι',
  },
  '/invite': {
    title: 'Προσκλήσεις',
    description: 'Μεγαλώστε το δίκτυό σας προσκαλώντας συνιδρυτές, μέντορες και επενδυτές.',
    section: 'Κοινότητα',
  },
  '/members': {
    title: 'Κατάλογος μελών',
    description: 'Ανακαλύψτε και συνδεθείτε με μέλη από όλη την πλατφόρμα.',
    section: 'Εξερεύνηση',
  },
  '/programs': {
    title: 'Προγράμματα',
    description: 'Επιταχυντές, θερμοκοιτίδες, bootcamps και διαγωνισμοί για να μεγαλώσετε το startup σας.',
    section: 'Πόροι',
  },
  '/referrals': {
    title: 'Πρόγραμμα συστάσεων',
    description: 'Προσκαλέστε γνωστούς σας και κερδίστε ανταμοιβές όταν εγγραφούν στο CoFounderBay.',
    section: 'Κοινότητα',
  },
  '/reputation': {
    title: 'Βαθμολογία φήμης',
    description: 'Η αξιοπιστία σας στο CoFounderBay.',
    section: 'Λογαριασμός',
  },
  '/saved-searches': {
    title: 'Αποθηκευμένες αναζητήσεις',
    description: 'Διαχειριστείτε τα αποθηκευμένα φίλτρα και ειδοποιηθείτε για νέες αντιστοιχίσεις.',
    section: 'Εξερεύνηση',
  },

  // ── Programs, jobs, marketplace, community ──
  '/jobs': {
    title: 'Θέσεις εργασίας',
    description:
      'Θέσεις equity, πλήρους απασχόλησης και συμβατικών που δημοσιεύουν startups στην πλατφόρμα.',
    section: 'Πόροι',
  },
  '/opportunities': {
    title: 'Ευκαιρίες',
    description:
      'Κλήσεις συνιδρυτών, αμειβόμενες αναθέσεις, θέσεις equity και βραχυπρόθεσμες συνεργασίες σε ένα feed.',
    section: 'Πόροι',
  },
  '/events': {
    title: 'Εκδηλώσεις',
    description:
      'Εργαστήρια, demo days, meetups και διαδικτυακές συνεδρίες — RSVP και προσθήκη στο ημερολόγιο.',
    section: 'Πόροι',
  },
  '/events/create': {
    title: 'Δημιουργία εκδήλωσης',
    description: 'Δημοσιεύστε εργαστήριο, demo day ή meetup για να δηλώσει συμμετοχή η κοινότητα.',
    section: 'Πόροι',
  },
  '/learning': {
    title: 'Κέντρο μάθησης',
    description:
      'Επιλεγμένα courses, οδηγοί founders και πρότυπα ευθυγραμμισμένα με τα κενά ετοιμότητας.',
    section: 'Πόροι',
  },
  '/groups': {
    title: 'Κοινότητες',
    description:
      'Ομάδες βάσει κλάδου, στάδιου και ενδιαφέροντος. Συμμετοχή για αλληλεπίδραση· δημιουργία δικής σας ομάδας.',
    section: 'Κοινότητα',
  },
  '/posts': {
    title: 'Feed',
    description:
      'Ενημερώσεις από το δίκτυό σας, τις κοινότητες και τους ακολουθούμενους. Δείγματα εμφανίζονται μόνο όταν το live feed είναι κενό.',
    section: 'Κοινότητα',
  },
  '/feed': {
    title: 'Feed',
    description:
      'Ενημερώσεις από το δίκτυό σας, τις κοινότητες και τους ακολουθούμενους. Δείγματα εμφανίζονται μόνο όταν το live feed είναι κενό.',
    section: 'Κοινότητα',
  },
  '/pitch': {
    title: 'Δημόσιο pitch',
    description:
      'Deck για επενδυτές. Οι προβολές μετρώνται· η επαφή πηγαίνει στον ιδρυτή, όχι σε δημόσιο inbox.',
    section: 'Εργασία',
  },
  '/data-room': {
    title: 'Data room επενδυτών',
    description:
      'Ιδιωτικά έγγραφα για diligence. Η πρόσβαση μοιράζεται ανά επενδυτή· τίποτα εδώ δεν είναι δημόσιο.',
    section: 'Εργασία',
  },

  // ── Mentor sub-pages ──
  '/mentor/profile-setup': {
    title: 'Ρύθμιση προφίλ μέντορα',
    description:
      'Περιγραφή προσφοράς, τιμών και διαθεσιμότητας για founders.',
    section: 'Εργασία',
  },

  // ── Investor sub-pages ──
  '/investor/profile-setup': {
    title: 'Ρύθμιση επενδυτή',
    description:
      'Ρύθμιση thesis, check size, κλάδων και σταδίων για αντιστοιχισμένη ροή deals.',
    section: 'Εργασία',
  },

  // ── Provider sub-pages ──
  '/provider/listings': {
    title: 'Οι καταχωρίσεις μου',
    description:
      'Διαχείριση υπηρεσιών που προσφέρετε σε startups στο marketplace.',
    section: 'Εργασία',
  },
};

/** Dynamic route patterns with Greek metadata. */
export const PAGE_META_EL_PATTERNS: Array<{
  pattern: RegExp;
  meta: PageMetaEl;
}> = [
  {
    pattern: /^\/matches\/[^/]+$/,
    meta: {
      title: 'Λεπτομέρεια αντιστοίχισης',
      description:
        'Ανάλυση συμβατότητας και προτεινόμενες επόμενες ενέργειες με αυτό το άτομο.',
      section: 'Εξερεύνηση',
    },
  },
  {
    pattern: /^\/profiles\/[^/]+$/,
    meta: {
      title: 'Προφίλ μέλους',
      description:
        'Δημόσιο προφίλ — σύνδεση, μήνυμα ή αποθήκευση στη shortlist.',
      section: 'Εξερεύνηση',
    },
  },
  {
    pattern: /^\/admin\/user-detail\/[^/]+$/,
    meta: {
      title: 'Λεπτομέρεια χρήστη',
      description:
        'Πλήρης διαχειριστική επισκόπηση — δραστηριότητα, ιστορικό μέτρησης και έλεγχοι λογαριασμού.',
      section: 'Διαχείριση',
    },
  },
  {
    pattern: /^\/research\/[^/]+$/,
    meta: {
      title: 'Επιφάνεια έρευνας',
      description:
        'Συνεργατικό whiteboard για έρευνα startup.',
      section: 'Εργασία',
    },
  },
  {
    pattern: /^\/groups\/[^/]+$/,
    meta: {
      title: 'Κοινότητα',
      description:
        'Δημοσιεύσεις, μέλη και εκδηλώσεις αυτής της ομάδας.',
      section: 'Κοινότητα',
    },
  },
  {
    pattern: /^\/projects\/(?!create$)[^/]+$/,
    meta: {
      title: 'Έργο',
      description: 'Επισκόπηση, ανοιχτοί ρόλοι, ομάδα, ορόσημα και ενημερώσεις αυτού του έργου.',
      section: 'Εργασία',
    },
  },
  {
    pattern: /^\/org\/cohorts\/[^/]+$/,
    meta: {
      title: 'Cohort',
      description: 'Συμμετέχοντες, κάλυψη μεντόρων και πρόσφατες αντιστοιχίσεις αυτού του cohort.',
      section: 'Εργασία',
    },
  },
  {
    pattern: /^\/pitch\/[^/]+$/,
    meta: {
      title: 'Δημόσιο pitch',
      description:
        'Deck για επενδυτές. Οι προβολές μετρώνται· η επαφή πηγαίνει στον ιδρυτή, όχι σε δημόσιο inbox.',
      section: 'Εργασία',
    },
  },
  {
    pattern: /^\/data-room\/[^/]+$/,
    meta: {
      title: 'Data room επενδυτών',
      description:
        'Ιδιωτικά έγγραφα για diligence. Η πρόσβαση μοιράζεται ανά επενδυτή· τίποτα εδώ δεν είναι δημόσιο.',
      section: 'Εργασία',
    },
  },
];

/** Resolve Greek page metadata for the current pathname (exact, pattern, then prefix fallback). */
export function getPageMetaEl(pathname: string): PageMetaEl | undefined {
  const normalized = pathname.replace(/\/$/, '') || '/';
  const exact = PAGE_META_EL[normalized];
  if (exact) return exact;

  for (const { pattern, meta } of PAGE_META_EL_PATTERNS) {
    if (pattern.test(normalized)) {
      return meta;
    }
  }

  const sorted = Object.keys(PAGE_META_EL).sort((a, b) => b.length - a.length);
  for (const path of sorted) {
    if (path !== '/' && normalized.startsWith(path)) {
      return PAGE_META_EL[path];
    }
  }

  return undefined;
}
