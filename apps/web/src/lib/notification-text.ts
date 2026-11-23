/**
 * The Greek of what the server writes into a notification (docs §112).
 *
 * The API stores one English sentence per notification, with the names already
 * inside it, so the page's catalogue, which matches whole strings, never found
 * them: a Greek reader's inbox was English. Translating at display also reaches
 * the notifications already stored. `notificationText.test.ts` reads the API's
 * source and fails on a sentence added there without a line here.
 */

type Rule = [RegExp, string];

const RULES: Rule[] = [
  [/^Reconnect after your event$/, 'Επανασυνδεθείτε μετά την εκδήλωση'],
  [/^You have a mutual event match$/, 'Έχετε αμοιβαίο ενδιαφέρον από την εκδήλωση'],
  // Connections and messages
  [/^New message from (.+)$/, 'Νέο μήνυμα από $1'],
  [/^(.+) wants to connect$/, '$1: αίτημα σύνδεσης'],
  [/^Sent you a connection request$/, 'Σας έστειλε αίτημα σύνδεσης'],
  [/^Reply to (.+)$/, 'Απάντηση: $1'],
  [/^(.+) accepted your connection$/, '$1: αποδοχή της σύνδεσής σας'],
  [/^You are now connected$/, 'Είστε πλέον συνδεδεμένοι'],
  [/^Conversation validation mode changed$/, 'Άλλαξε η λειτουργία επικύρωσης της συνομιλίας'],
  [/^A participant has enabled One-Party Validation for this conversation\.$/, 'Ένα μέλος ενεργοποίησε την επικύρωση από τη μία πλευρά σε αυτή τη συνομιλία.'],
  [/^A participant has enabled Two-Party Validation for this conversation\.$/, 'Ένα μέλος ενεργοποίησε την επικύρωση και από τις δύο πλευρές σε αυτή τη συνομιλία.'],
  [/^A participant has enabled (.+) for this conversation\.$/, 'Ένα μέλος ενεργοποίησε το $1 σε αυτή τη συνομιλία.'],

  // Need cards
  [/^(.+) is interested in “(.+)”$/, '$1: ενδιαφέρον για «$2»'],
  [/^New message about “(.+)”$/, 'Νέο μήνυμα για «$1»'],
  [/^Terms agreed for “(.+)”$/, 'Συμφωνήθηκαν οι όροι για «$1»'],
  [/^Terms v(\d+) proposed for “(.+)”$/, 'Προτάθηκαν οι όροι v$1 για «$2»'],
  [/^The deal room for “(.+)” was closed$/, 'Έκλεισε ο χώρος συμφωνίας για «$1»'],
  [/^You both confirmed “(.+)”$/, 'Επιβεβαιώσατε και οι δύο το «$1»'],
  [/^Your interest in “(.+)” was accepted$/, 'Το ενδιαφέρον σας για «$1» έγινε δεκτό'],
  [/^“(.+)” was closed$/, 'Έκλεισε το «$1»'],
  [/^Version (\d+) is agreed\. The deal room is open and the terms are frozen\.$/, 'Συμφωνήθηκε η έκδοση $1. Ο χώρος συμφωνίας άνοιξε και οι όροι κλείδωσαν.'],
  [/^The terms are open for revision again\.$/, 'Οι όροι είναι ξανά ανοιχτοί για αναθεώρηση.'],
  [/^Changed: (.+)$/, 'Άλλαξε: $1'],
  [/^First proposal\.$/, 'Πρώτη πρόταση.'],
  [/^The other person stepped back\.$/, 'Το άλλο μέρος αποσύρθηκε.'],
  [/^Open the card to accept and start a protected conversation\.$/, 'Ανοίξτε την κάρτα για να αποδεχτείτε και να ξεκινήσετε προστατευμένη συνομιλία.'],
  [/^Accept to start a protected conversation on their need card, or say not now\.$/, 'Αποδεχτείτε για να ξεκινήσει προστατευμένη συνομιλία στην κάρτα ανάγκης, ή πείτε όχι τώρα.'],
  [/^The terms space is open\. Each change of substance is a new version\.$/, 'Ο χώρος όρων άνοιξε. Κάθε ουσιαστική αλλαγή είναι νέα έκδοση.'],
  [/^A protected conversation is open\. Contact details stay out of it until you both confirm\.$/, 'Άνοιξε προστατευμένη συνομιλία. Τα στοιχεία επικοινωνίας μένουν εκτός ώσπου να επιβεβαιώσετε και οι δύο.'],

  // Introductions
  [/^An introduction was not forwarded$/, 'Μια γνωριμία δεν προωθήθηκε'],
  [/^Not now, for an introduction$/, 'Όχι τώρα, για μια γνωριμία'],
  [/^Your introduction was accepted$/, 'Η γνωριμία σας έγινε δεκτή'],
  [/^Your introduction was forwarded$/, 'Η γνωριμία σας προωθήθηκε'],
  [/^(.+) introduces you to (.+)$/, '$1: γνωριμία με $2'],
  [/^(.+) asks you for an introduction to (.+)$/, '$1: αίτημα γνωριμίας με $2'],
  [/^Try someone else who knows them, or answer on the card directly\.$/, 'Δοκιμάστε κάποιο άλλο κοινό πρόσωπο ή απαντήστε απευθείας στην κάρτα.'],
  [/^The person you were introduced to is not taking this up at the moment\.$/, 'Το πρόσωπο της γνωριμίας δεν το συνεχίζει προς το παρόν.'],
  [/^They are talking on the need card now\.$/, 'Μιλούν τώρα στην κάρτα ανάγκης.'],
  [/^They will see your card and decide\.$/, 'Θα δουν την κάρτα σας και θα αποφασίσουν.'],
  [/^You decide whether to forward it\. Nobody is told why if you do not\.$/, 'Εσείς αποφασίζετε αν θα προωθηθεί. Αν όχι, κανείς δεν ενημερώνεται για τον λόγο.'],

  // Fundraising, opportunities, the pitch
  [/^(.+) gave you access to their data room$/, '$1: πρόσβαση στο data room'],
  [/^(.+) shared a document with you$/, '$1: κοινή χρήση εγγράφου μαζί σας'],
  [/^(.+) shared (\d+) documents with you$/, '$1: κοινή χρήση $2 εγγράφων μαζί σας'],
  [/^(.+): new opportunity — (.+)$/, '$1: νέα ευκαιρία: $2'],
  [/^(.+) sent a proposal for (.+)$/, '$1: πρόταση για $2'],
  [/^Your proposal for (.+) was accepted$/, 'Η πρότασή σας για $1 έγινε δεκτή'],
  [/^Your proposal for (.+) was declined$/, 'Η πρότασή σας για $1 απορρίφθηκε'],
  [/^Your proposal for (.+) was (.+)$/, 'Η πρότασή σας για $1: $2'],
  [/^(.+) wrote about your pitch$/, '$1: μήνυμα για το pitch σας'],

  // Workspaces
  [/^New change proposal: "(.+)"$/, 'Νέα πρόταση αλλαγής: «$1»'],
  [/^Review requested: "(.+)"$/, 'Ζητήθηκε αξιολόγηση: «$1»'],
  [/^Proposal "(.+)": approved$/, 'Η πρόταση «$1» εγκρίθηκε'],
  [/^Proposal "(.+)": rejected$/, 'Η πρόταση «$1» απορρίφθηκε'],
  [/^Proposal "(.+)": (.+)$/, 'Πρόταση «$1»: $2'],
  [/^A change proposal was submitted in workspace "(.+)"\.$/, 'Υποβλήθηκε πρόταση αλλαγής στον χώρο εργασίας «$1».'],
  [/^You have been asked to review a change proposal\.$/, 'Σας ζητήθηκε να αξιολογήσετε μια πρόταση αλλαγής.'],
  [/^Your change proposal received a review decision\.$/, 'Η πρόταση αλλαγής σας αξιολογήθηκε.'],

  // Community, mentoring, programmes
  [/^New endorsement received$/, 'Νέα σύσταση'],
  [/^(.+) has written an endorsement for you\. Review and approve it to display on your profile\.$/, '$1: έγραψε σύσταση για εσάς. Ελέγξτε την και εγκρίνετέ τη για να εμφανιστεί στο προφίλ σας.'],
  [/^New RSVP$/, 'Νέα δήλωση συμμετοχής'],
  [/^Someone RSVP'd to "(.+)"$/, 'Νέα δήλωση συμμετοχής στο «$1»'],
  [/^Someone new follows your updates$/, 'Νέο μέλος ακολουθεί τις ενημερώσεις σας'],
  [/^Booking updated$/, 'Η κράτηση ενημερώθηκε'],
  [/^Booking status changed to (.+)$/, 'Η κατάσταση της κράτησης άλλαξε: $1'],
  [/^New mentoring request$/, 'Νέο αίτημα καθοδήγησης'],
  [/^You have a new booking request\.$/, 'Έχετε νέο αίτημα κράτησης.'],
  [/^(.+) asked to join your mentor pool$/, '$1: αίτημα ένταξης στους μέντορές σας'],
  [/^(.+) added you to its mentor pool$/, '$1: προσθήκη στους μέντορές του'],
  [/^(.+) did not add you to its mentor pool$/, '$1: δεν έγινε προσθήκη στους μέντορές του'],
  [/^(.+) invited you to join as (.+)$/, '$1: πρόσκληση συμμετοχής ως $2'],

  // The scout and the account
  [/^The scout found (\d+) people for your brief$/, 'Ο ανιχνευτής βρήκε $1 άτομα για την αναζήτησή σας'],
  [/^Proposals only: nobody was contacted\. Open them, save, ask for an introduction or dismiss\.$/, 'Μόνο προτάσεις: δεν έγινε καμία επαφή. Ανοίξτε τις, αποθηκεύστε, ζητήστε γνωριμία ή απορρίψτε.'],
  [/^Account moderation update$/, 'Ενημέρωση εποπτείας λογαριασμού'],
  [/^Your account status is now "(.+)"\.$/, 'Η κατάσταση του λογαριασμού σας είναι τώρα «$1».'],
];

/** The Greek of a server sentence; what it does not know, such as a member's own words, stays as written. */
export function notificationEl(text: string): string {
  for (const [pattern, greek] of RULES) {
    if (pattern.test(text)) return text.replace(pattern, greek);
  }
  return text;
}
