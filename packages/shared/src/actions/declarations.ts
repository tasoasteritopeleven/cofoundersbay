import { CANVAS_COMMAND_OPS } from '../canvas/commands';
import type { ActionDeclaration, ToolCatalogEntry } from './types';

/**
 * Every capability the assistant has, declared once.
 *
 * `as const satisfies` is load-bearing: `satisfies` type-checks each entry
 * against `ActionDeclaration`, while `as const` keeps the literal `id` and
 * `reversal.kind` values in the emitted types. That is what lets each app
 * derive an exhaustive map of executors and undos, so a capability declared
 * here cannot be left unimplemented without a compile error.
 *
 * Reversal wording is the outcome of reading the controllers, not of
 * paraphrasing intent — see `ActionReversalKind`.
 */
export const ACTION_DECLARATIONS = [
  {
    id: 'get_graph',
    kind: 'read',
    label: { en: 'Read your workspace state', el: 'Ανάγνωση της κατάστασης του χώρου σου' },
    description: {
      en: 'Read the signed-in user’s own summary: unread messages, pending intros, unread notifications, venture readiness and the single next action.',
      el: 'Διαβάζει τη σύνοψη του συνδεδεμένου χρήστη: αδιάβαστα μηνύματα, εκκρεμείς συστάσεις, αδιάβαστες ειδοποιήσεις, ετοιμότητα και το επόμενο βήμα.',
    },
    params: [],
    writes: false,
  },
  {
    id: 'search_people',
    kind: 'read',
    label: { en: 'Search people', el: 'Αναζήτηση ανθρώπων' },
    description: {
      en: 'Search profiles across the network by free text and optionally by location, role, industry, commitment and investment stage. Known words in the text ("cofounder fintech Thessaloniki part-time") are read into those filters. Returns up to six people with headline, role and match score.',
      el: 'Αναζητά προφίλ στο δίκτυο με ελεύθερο κείμενο και προαιρετικά τοποθεσία, ρόλο, κλάδο, διαθέσιμο χρόνο και στάδιο επένδυσης. Γνωστές λέξεις του κειμένου («συνιδρυτής fintech Θεσσαλονίκη part-time») διαβάζονται ως φίλτρα. Επιστρέφει έως έξι άτομα με τίτλο, ρόλο και σκορ ταιριάσματος.',
    },
    params: [
      {
        name: 'q',
        type: 'string',
        required: false,
        description: {
          en: 'Free-text query, e.g. a name, a skill, or "technical cofounder".',
          el: 'Ελεύθερο κείμενο, π.χ. όνομα, δεξιότητα ή «technical cofounder».',
        },
      },
      {
        name: 'location',
        type: 'string',
        required: false,
        description: {
          en: 'City or country to narrow the search, e.g. "Athens".',
          el: 'Πόλη ή χώρα για περιορισμό, π.χ. «Αθήνα».',
        },
      },
      {
        name: 'roles',
        type: 'string',
        required: false,
        description: {
          en: 'Comma-separated directory roles: founder, mentor, investor, org.',
          el: 'Ρόλοι καταλόγου, χωρισμένοι με κόμμα: founder, mentor, investor, org.',
        },
      },
      {
        name: 'industries',
        type: 'string',
        required: false,
        description: {
          en: 'Comma-separated industries as the Discover filters name them, e.g. "Fintech,SaaS".',
          el: 'Κλάδοι όπως τους ονομάζουν τα φίλτρα της Ανακάλυψης, π.χ. «Fintech,SaaS».',
        },
      },
      {
        name: 'commitment',
        type: 'string',
        required: false,
        description: {
          en: 'Comma-separated time commitment: full-time, part-time, weekends, flexible.',
          el: 'Διαθέσιμος χρόνος, χωρισμένος με κόμμα: full-time, part-time, weekends, flexible.',
        },
      },
      {
        name: 'fundingStage',
        type: 'string',
        required: false,
        description: {
          en: 'Comma-separated investment stages for investors: pre-seed, seed, series-a, series-b, bootstrapped.',
          el: 'Στάδια επένδυσης για επενδυτές, χωρισμένα με κόμμα: pre-seed, seed, series-a, series-b, bootstrapped.',
        },
      },
    ],
    writes: false,
  },
  {
    id: 'get_recommendations',
    kind: 'read',
    label: { en: 'Get your matches', el: 'Λήψη των ταιριασμάτων σου' },
    description: {
      en: 'Read the personalised co-founder and team recommendations already computed for the signed-in user.',
      el: 'Διαβάζει τις εξατομικευμένες προτάσεις συνιδρυτών και ομάδας που έχουν υπολογιστεί για τον χρήστη.',
    },
    params: [],
    writes: false,
  },
  {
    id: 'get_notifications',
    kind: 'read',
    label: { en: 'Read notifications', el: 'Ανάγνωση ειδοποιήσεων' },
    description: {
      en: 'Read the most recent notifications for the signed-in user and which of them are unread.',
      el: 'Διαβάζει τις πιο πρόσφατες ειδοποιήσεις του χρήστη και ποιες είναι αδιάβαστες.',
    },
    params: [],
    writes: false,
  },
  // ── The areas the assistant could not see ──────────────────────────────
  //
  // Before these, it could read four things — the graph summary, people,
  // matches and notifications — while the product has some twenty areas. Asked
  // "what events are coming up" or "which milestones are overdue", it could
  // only offer to open the page. Each of these is a facade over a client
  // function the web app already calls for its own screen, so the assistant
  // reads exactly what the page shows and needs no new server surface.
  //
  // The descriptions say what comes back, not just what the tool is for: the
  // `en` half is the only thing a model sees when deciding whether a tool can
  // answer the question in front of it.
  {
    id: 'get_events',
    kind: 'read',
    label: { en: 'Read upcoming events', el: 'Ανάγνωση επερχόμενων εκδηλώσεων' },
    description: {
      en: 'Read upcoming events on the platform: title, date, whether online or in person, how many are attending, and whether the signed-in user has RSVPed. Returns up to five.',
      el: 'Διαβάζει τις επερχόμενες εκδηλώσεις της πλατφόρμας: τίτλο, ημερομηνία, αν γίνονται online ή δια ζώσης, πόσοι συμμετέχουν και αν ο χρήστης έχει δηλώσει συμμετοχή. Επιστρέφει έως πέντε.',
    },
    params: [
      {
        name: 'q',
        type: 'string',
        required: false,
        description: {
          en: 'Optional words to narrow the events, e.g. "demo day" or "fintech".',
          el: 'Προαιρετικές λέξεις για περιορισμό, π.χ. «demo day» ή «fintech».',
        },
      },
    ],
    writes: false,
  },
  {
    id: 'get_milestones',
    kind: 'read',
    label: { en: 'Read your milestones', el: 'Ανάγνωση των ορόσημών σου' },
    description: {
      en: 'Read the signed-in user’s milestones: how many are complete, overdue and due soon, the completion rate, and the next open milestones by due date.',
      el: 'Διαβάζει τα ορόσημα του χρήστη: πόσα έχουν ολοκληρωθεί, πόσα έχουν καθυστερήσει ή λήγουν σύντομα, το ποσοστό ολοκλήρωσης και τα επόμενα ανοιχτά κατά ημερομηνία λήξης.',
    },
    params: [],
    writes: false,
  },
  {
    id: 'get_jobs',
    kind: 'read',
    label: { en: 'Read open roles', el: 'Ανάγνωση ανοιχτών θέσεων' },
    description: {
      en: 'Read open roles that startups have posted on the platform: title, who posted it, location and whether it is remote. Returns up to five.',
      el: 'Διαβάζει τις ανοιχτές θέσεις που έχουν δημοσιεύσει startups: τίτλο, ποιος τη δημοσίευσε, τοποθεσία και αν είναι εξ αποστάσεως. Επιστρέφει έως πέντε.',
    },
    params: [],
    writes: false,
  },
  {
    id: 'get_groups',
    kind: 'read',
    label: { en: 'Read your communities', el: 'Ανάγνωση των κοινοτήτων σου' },
    description: {
      en: 'Read the communities the signed-in user belongs to, with member and post counts and the user’s role in each.',
      el: 'Διαβάζει τις κοινότητες στις οποίες ανήκει ο χρήστης, με πλήθος μελών και αναρτήσεων και τον ρόλο του σε καθεμία.',
    },
    params: [],
    writes: false,
  },
  {
    id: 'get_endorsements',
    kind: 'read',
    label: { en: 'Read your endorsements', el: 'Ανάγνωση των προσυπογραφών σου' },
    description: {
      en: 'Read how many endorsements the signed-in user has received and given, and which received ones are still waiting for their approval before they show on the profile.',
      el: 'Διαβάζει πόσες προσυπογραφές έχει λάβει και δώσει ο χρήστης, και ποιες από όσες έλαβε περιμένουν ακόμη την έγκρισή του για να εμφανιστούν στο προφίλ.',
    },
    params: [],
    writes: false,
  },
  {
    id: 'get_opportunities',
    kind: 'read',
    label: { en: 'Read open opportunities', el: 'Ανάγνωση ανοιχτών ευκαιριών' },
    description: {
      en: 'Read open opportunities — co-founder calls, paid gigs, equity roles and collaborations — with type, company, location and deadline. Returns up to five.',
      el: 'Διαβάζει ανοιχτές ευκαιρίες — αναζητήσεις συνιδρυτών, αμειβόμενα projects, θέσεις με equity και συνεργασίες — με είδος, εταιρεία, τοποθεσία και προθεσμία. Επιστρέφει έως πέντε.',
    },
    params: [
      {
        name: 'q',
        type: 'string',
        required: false,
        description: {
          en: 'Optional words to narrow the opportunities, e.g. "design" or "remote".',
          el: 'Προαιρετικές λέξεις για περιορισμό, π.χ. «design» ή «remote».',
        },
      },
    ],
    writes: false,
  },
  {
    id: 'get_commitments',
    kind: 'read',
    label: { en: 'Read my commitments', el: 'Ανάγνωση των δεσμεύσεών μου' },
    description: {
      en: 'Read the signed-in user\u2019s need cards and commitments: each card\u2019s outcome (open, in discussion, agreed, closed), each response\u2019s step on the ladder (interest, conversation, terms, agreed) and what waits on the user next.',
      el: 'Διαβάζει τις κάρτες ανάγκης και τις δεσμεύσεις του χρήστη: την έκβαση κάθε κάρτας (ανοιχτή, σε συζήτηση, συμφωνημένη, κλειστή), το βήμα κάθε απάντησης στην κλίμακα (ενδιαφέρον, συζήτηση, όροι, συμφωνία) και τι περιμένει στη συνέχεια από τον χρήστη.',
    },
    params: [],
    writes: false,
  },
  {
    id: 'get_founder_updates',
    kind: 'read',
    label: { en: 'Read founder updates', el: 'Ανάγνωση ενημερώσεων ιδρυτών' },
    description: {
      en: 'Read the latest updates from the people the signed-in user follows (title, author, figures, asks) and the user\u2019s own updates with whether each is public or for followers only.',
      el: 'Διαβάζει τις πιο πρόσφατες ενημερώσεις από όσους ακολουθεί ο χρήστης (τίτλος, συντάκτης, μεγέθη, αιτήματα) και τις δικές του ενημερώσεις, με το αν η καθεμία είναι δημόσια ή μόνο για ακολούθους.',
    },
    params: [],
    writes: false,
  },
  {
    id: 'get_intros',
    kind: 'read',
    label: { en: 'Read introductions', el: 'Ανάγνωση συστάσεων γνωριμίας' },
    description: {
      en: 'Read the signed-in user\u2019s warm introductions: requests waiting for them to forward, introductions forwarded to them, and the ones they asked for, with each status. With targetId, also who could introduce them to that person (intermediary ids and how each knows both) and which of their open need cards it could be for.',
      el: 'Διαβάζει τις συστάσεις γνωριμίας του χρήστη: αιτήματα που περιμένουν να τα προωθήσει, συστάσεις που του προωθήθηκαν και όσες ζήτησε, με την κατάσταση της καθεμίας. Με targetId, επίσης ποιος μπορεί να τον συστήσει σε αυτό το πρόσωπο (id ενδιαμέσων και πώς γνωρίζει τον καθένα) και για ποιες ανοιχτές κάρτες ανάγκης του.',
    },
    params: [
      { name: 'targetId', type: 'string', required: false, description: { en: 'Optional id of the person the user wants to meet, from a prior search or recommendation.', el: 'Προαιρετικό id του προσώπου που θέλει να γνωρίσει ο χρήστης, από προηγούμενη αναζήτηση ή πρόταση.' } },
    ],
    writes: false,
  },
  {
    id: 'get_skill_evidence',
    kind: 'read',
    label: { en: 'Read skills and their evidence', el: 'Ανάγνωση δεξιοτήτων και τεκμηρίων' },
    description: {
      en: 'Read the signed-in user\u2019s skills with the evidence behind each (completed milestones, builder documents, agreed commitments, and how many endorsements name it, how many from work done together), plus the completed items they could still link, with their kind and id.',
      el: 'Διαβάζει τις δεξιότητες του χρήστη με τα τεκμήρια της καθεμίας (ολοκληρωμένα ορόσημα, έγγραφα του builder, συμφωνημένες δεσμεύσεις, και πόσες συστάσεις την αναφέρουν, πόσες από κοινή δουλειά), καθώς και τα ολοκληρωμένα στοιχεία που μπορεί ακόμη να συνδέσει, με είδος και id.',
    },
    params: [],
    writes: false,
  },
  {
    id: 'get_scout',
    kind: 'read',
    label: { en: 'Read the co-founder scout', el: 'Ανάγνωση του ανιχνευτή συνιδρυτών' },
    description: {
      en: 'Read the signed-in founder\u2019s scout brief (role, skills, place, commitment, stage) and the people it currently proposes, with each one\u2019s fit score, reasons and proposal id. The scout proposes only; it never contacts anyone.',
      el: 'Διαβάζει το σημείωμα του ανιχνευτή (ρόλος, δεξιότητες, τόπος, δέσμευση, στάδιο) και τα πρόσωπα που προτείνει τώρα, με βαθμό ταιριάσματος, λόγους και id πρότασης. Ο ανιχνευτής μόνο προτείνει· δεν επικοινωνεί ποτέ με κανέναν.',
    },
    params: [],
    writes: false,
  },
  {
    id: 'get_mentorship_sessions',
    kind: 'read',
    label: { en: 'Read your mentoring sessions', el: 'Ανάγνωση των συνεδριών mentoring' },
    description: {
      en: 'Read the signed-in user’s upcoming mentoring sessions: title, date and time, length, and whether it is a video call, in person or a chat.',
      el: 'Διαβάζει τις επερχόμενες συνεδρίες mentoring του χρήστη: τίτλο, ημερομηνία και ώρα, διάρκεια, και αν είναι βιντεοκλήση, δια ζώσης ή συνομιλία.',
    },
    params: [],
    writes: false,
  },
  {
    id: 'get_shortlist',
    kind: 'read',
    label: { en: 'Read your saved profiles', el: 'Ανάγνωση των αποθηκευμένων προφίλ' },
    description: {
      en: 'Read the profiles the signed-in user has saved to their shortlist, with any private note they added. Returns up to six.',
      el: 'Διαβάζει τα προφίλ που έχει αποθηκεύσει ο χρήστης στη λίστα του, μαζί με όποια ιδιωτική σημείωση έχει προσθέσει. Επιστρέφει έως έξι.',
    },
    params: [],
    writes: false,
  },
  {
    id: 'get_research_boards',
    kind: 'read',
    label: { en: 'Read your research boards', el: 'Ανάγνωση των πινάκων έρευνας' },
    description: {
      en: 'Read the signed-in user’s research boards: title, how many notes are pinned, and whether it is archived. Returns up to five.',
      el: 'Διαβάζει τους πίνακες έρευνας του χρήστη: τίτλο, πόσα σημειώματα είναι καρφιτσωμένα, και αν είναι αρχειοθετημένος. Επιστρέφει έως πέντε.',
    },
    params: [],
    writes: false,
  },
  {
    id: 'get_investor_board',
    kind: 'read',
    label: { en: 'Read your investor board', el: '\u0391\u03bd\u03ac\u03b3\u03bd\u03c9\u03c3\u03b7 \u03c4\u03bf\u03c5 \u03c0\u03af\u03bd\u03b1\u03ba\u03b1 \u03b5\u03c0\u03b5\u03bd\u03b4\u03cd\u03c3\u03b5\u03c9\u03bd' },
    description: {
      en: 'Answer questions about the startups you are tracking: what is at which stage, what you have invested, and what moved recently. The watchlist, the pipeline and the portfolio are the same board.',
      el: '\u0391\u03c0\u03b1\u03bd\u03c4\u03ac \u03b3\u03b9\u03b1 \u03c4\u03b1 startups \u03c0\u03bf\u03c5 \u03c0\u03b1\u03c1\u03b1\u03ba\u03bf\u03bb\u03bf\u03c5\u03b8\u03b5\u03af\u03c2: \u03c4\u03b9 \u03b2\u03c1\u03af\u03c3\u03ba\u03b5\u03c4\u03b1\u03b9 \u03c3\u03b5 \u03c0\u03bf\u03b9\u03bf \u03c3\u03c4\u03ac\u03b4\u03b9\u03bf, \u03c4\u03b9 \u03ad\u03c7\u03b5\u03b9\u03c2 \u03b5\u03c0\u03b5\u03bd\u03b4\u03cd\u03c3\u03b5\u03b9 \u03ba\u03b1\u03b9 \u03c4\u03b9 \u03ba\u03b9\u03bd\u03ae\u03b8\u03b7\u03ba\u03b5 \u03c0\u03c1\u03cc\u03c3\u03c6\u03b1\u03c4\u03b1. \u0397 \u03bb\u03af\u03c3\u03c4\u03b1 \u03c0\u03b1\u03c1\u03b1\u03ba\u03bf\u03bb\u03bf\u03cd\u03b8\u03b7\u03c3\u03b7\u03c2, \u03c4\u03bf pipeline \u03ba\u03b1\u03b9 \u03c4\u03bf \u03c7\u03b1\u03c1\u03c4\u03bf\u03c6\u03c5\u03bb\u03ac\u03ba\u03b9\u03bf \u03b5\u03af\u03bd\u03b1\u03b9 \u03bf \u03af\u03b4\u03b9\u03bf\u03c2 \u03c0\u03af\u03bd\u03b1\u03ba\u03b1\u03c2.',
    },
    params: [],
    writes: false,
  },
  {
    id: 'get_builder_state',
    kind: 'read',
    label: { en: 'Read your Startup Builder workspaces', el: 'Ανάγνωση των χώρων Startup Builder' },
    description: {
      en: 'Read the signed-in user’s Startup Builder workspaces: name, status, document count and readiness score. Returns up to five.',
      el: 'Διαβάζει τους χώρους Startup Builder του χρήστη: όνομα, κατάσταση, πλήθος εγγράφων και βαθμό ετοιμότητας. Επιστρέφει έως πέντε.',
    },
    params: [],
    writes: false,
  },
  {
    id: 'get_profile',
    kind: 'read',
    label: { en: 'Read your profile', el: 'Ανάγνωση του προφίλ σου' },
    description: {
      en: 'Read the signed-in user’s own profile: display name, headline, bio, location, languages, role and skills — the same record the Profile page shows.',
      el: 'Διαβάζει το ίδιο το προφίλ του χρήστη: όνομα, τίτλο, βιογραφικό, τοποθεσία, γλώσσες, ρόλο και δεξιότητες — την ίδια εγγραφή που δείχνει η σελίδα Προφίλ.',
    },
    params: [],
    writes: false,
  },
  {
    id: 'get_messages',
    kind: 'read',
    label: { en: 'Read your conversations', el: 'Ανάγνωση των συνομιλιών σου' },
    description: {
      en: 'Read the signed-in user’s message conversations: who each thread is with, the last message, how many are unread and whether it is pinned. Returns up to five.',
      el: 'Διαβάζει τις συνομιλίες του χρήστη: με ποιον είναι κάθε νήμα, το τελευταίο μήνυμα, πόσα είναι αδιάβαστα και αν είναι καρφιτσωμένο. Επιστρέφει έως πέντε.',
    },
    params: [],
    writes: false,
  },
  {
    id: 'get_connections',
    kind: 'read',
    label: { en: 'Read your connections', el: 'Ανάγνωση των συνδέσεών σου' },
    description: {
      en: 'Read the signed-in user’s network: how many accepted connections there are, and which requests are still waiting — incoming ones the user can answer and outgoing ones still pending.',
      el: 'Διαβάζει το δίκτυο του χρήστη: πόσες αποδεκτές συνδέσεις υπάρχουν και ποια αιτήματα περιμένουν ακόμη — εισερχόμενα που μπορεί να απαντήσει και εξερχόμενα σε εκκρεμότητα.',
    },
    params: [],
    writes: false,
  },
  {
    id: 'get_programs',
    kind: 'read',
    label: { en: 'Read open programmes', el: 'Ανάγνωση ανοιχτών προγραμμάτων' },
    description: {
      en: 'Read the accelerator, incubator and bootcamp programmes taking applications: title, organisation, type, deadline and places left. Returns up to five.',
      el: 'Διαβάζει τα προγράμματα (επιταχυντές, θερμοκοιτίδες, bootcamps) που δέχονται αιτήσεις: τίτλο, οργανισμό, τύπο, προθεσμία και θέσεις. Επιστρέφει έως πέντε.',
    },
    params: [],
    writes: false,
  },
  {
    id: 'get_my_programs',
    kind: 'read',
    label: { en: 'Read your programme applications', el: 'Ανάγνωση των αιτήσεών σας σε προγράμματα' },
    description: {
      en: 'Read the programmes the signed-in user has applied to or joined, with where each application stands.',
      el: 'Διαβάζει τα προγράμματα στα οποία έχει κάνει αίτηση ή συμμετέχει ο χρήστης, και πού βρίσκεται κάθε αίτηση.',
    },
    params: [],
    writes: false,
  },
  {
    id: 'get_invites',
    kind: 'read',
    label: { en: 'Read your invitations', el: 'Ανάγνωση των προσκλήσεών σας' },
    description: {
      en: 'Read the invitations the signed-in user has sent to join CoFounderBay: who, whether they joined, and how many invitations are left.',
      el: 'Διαβάζει τις προσκλήσεις που έστειλε ο χρήστης για το CoFounderBay: σε ποιον, αν έγιναν μέλη, και πόσες προσκλήσεις απομένουν.',
    },
    params: [],
    writes: false,
  },
  {
    id: 'get_reputation',
    kind: 'read',
    label: { en: 'Read your level and badges', el: 'Ανάγνωση επιπέδου και σημάτων' },
    description: {
      en: 'Read the signed-in user’s level, XP, activity streak and most recent badges.',
      el: 'Διαβάζει το επίπεδο, τους πόντους εμπειρίας, το σερί δραστηριότητας και τα πιο πρόσφατα σήματα του χρήστη.',
    },
    params: [],
    writes: false,
  },
  {
    id: 'get_readiness',
    kind: 'read',
    label: { en: 'Read your venture readiness', el: 'Ανάγνωση της ετοιμότητας της startup' },
    description: {
      en: 'Read the signed-in founder’s venture readiness score, each dimension’s score, and the weakest dimension to work on next.',
      el: 'Διαβάζει τον δείκτη ετοιμότητας της startup του ιδρυτή, τη βαθμολογία κάθε διάστασης και την πιο αδύναμη διάσταση για να δουλέψει.',
    },
    params: [],
    writes: false,
  },
  {
    id: 'get_analytics',
    kind: 'read',
    label: { en: 'Read your activity figures', el: 'Ανάγνωση των στοιχείων δραστηριότητας' },
    description: {
      en: 'Read the signed-in user’s profile views, new connections and messages sent over the last 7 days, with the change against the week before.',
      el: 'Διαβάζει τις προβολές προφίλ, τις νέες συνδέσεις και τα μηνύματα του χρήστη τις τελευταίες 7 ημέρες, με τη μεταβολή από την προηγούμενη εβδομάδα.',
    },
    params: [],
    writes: false,
  },
  {
    id: 'get_mentors',
    kind: 'read',
    label: { en: 'Read the mentor directory', el: 'Ανάγνωση του καταλόγου μεντόρων' },
    description: {
      en: 'Read mentors taking sessions: name, headline, expertise, rating and price. Returns up to five, the most booked first.',
      el: 'Διαβάζει μέντορες που δέχονται συνεδρίες: όνομα, τίτλο, ειδίκευση, βαθμολογία και τιμή. Επιστρέφει έως πέντε, πρώτα τους πιο κλεισμένους.',
    },
    params: [],
    writes: false,
  },
  {
    id: 'get_mentor_requests',
    kind: 'read',
    label: { en: 'Read mentoring requests', el: 'Ανάγνωση αιτημάτων mentoring' },
    description: {
      en: 'Read mentoring requests the signed-in user has received and sent, with who asked and whether each is still pending.',
      el: 'Διαβάζει τα αιτήματα mentoring που έλαβε και έστειλε ο χρήστης, ποιος ζήτησε και αν εκκρεμούν ακόμη.',
    },
    params: [],
    writes: false,
  },
  {
    id: 'get_bookings',
    kind: 'read',
    label: { en: 'Read your mentor bookings', el: 'Ανάγνωση κρατήσεων mentoring' },
    description: {
      en: 'Read booked mentor sessions, as mentor or mentee: when, with whom, and whether each is requested, confirmed, completed or cancelled.',
      el: 'Διαβάζει κρατημένες συνεδρίες mentoring, ως μέντορας ή mentee: πότε, με ποιον, και αν είναι αίτημα, επιβεβαιωμένη, ολοκληρωμένη ή ακυρωμένη.',
    },
    params: [],
    writes: false,
  },
  {
    id: 'get_availability',
    kind: 'read',
    label: { en: 'Read your weekly hours', el: 'Ανάγνωση των εβδομαδιαίων ωρών σας' },
    description: {
      en: 'Read the weekly hours the signed-in mentor has saved as bookable, with their time zone.',
      el: 'Διαβάζει τις εβδομαδιαίες ώρες που έχει αποθηκεύσει ο μέντορας ως διαθέσιμες, με τη ζώνη ώρας τους.',
    },
    params: [],
    writes: false,
  },
  {
    id: 'get_services',
    kind: 'read',
    label: { en: 'Read your service offers', el: 'Ανάγνωση των υπηρεσιών σας' },
    description: {
      en: 'Read the service offers the signed-in provider lists: title, category, price, status, inquiries and rating.',
      el: 'Διαβάζει τις υπηρεσίες που προσφέρει ο πάροχος: τίτλο, κατηγορία, τιμή, κατάσταση, αιτήματα και βαθμολογία.',
    },
    params: [],
    writes: false,
  },
  {
    id: 'get_inquiries',
    kind: 'read',
    label: { en: 'Read service inquiries', el: 'Ανάγνωση αιτημάτων υπηρεσιών' },
    description: {
      en: 'Read inquiries about the signed-in provider’s services: which offer, from whom, status and budget. Returns up to five, newest first.',
      el: 'Διαβάζει αιτήματα για τις υπηρεσίες του παρόχου: ποια υπηρεσία, από ποιον, κατάσταση και προϋπολογισμό. Επιστρέφει έως πέντε, πρώτα τα νεότερα.',
    },
    params: [],
    writes: false,
  },
  {
    id: 'get_learning',
    kind: 'read',
    label: { en: 'Read learning resources', el: 'Ανάγνωση εκπαιδευτικού υλικού' },
    description: {
      en: 'Read featured learning resources: title, type, difficulty, length and author. Returns up to five.',
      el: 'Διαβάζει προτεινόμενο εκπαιδευτικό υλικό: τίτλο, τύπο, δυσκολία, διάρκεια και συγγραφέα. Επιστρέφει έως πέντε.',
    },
    params: [],
    writes: false,
  },
  {
    id: 'get_expert_reviews',
    kind: 'read',
    label: { en: 'Read expert reviews', el: 'Ανάγνωση αξιολογήσεων ειδικών' },
    description: {
      en: 'Read the expert reviews the signed-in user has requested or been asked to give: type, status, due date and score.',
      el: 'Διαβάζει τις αξιολογήσεις ειδικών που ζήτησε ή του ζητήθηκαν: τύπο, κατάσταση, προθεσμία και βαθμολογία.',
    },
    params: [],
    writes: false,
  },
  {
    id: 'get_org_cohorts',
    kind: 'read',
    label: { en: 'Read your organisation’s cohorts', el: 'Ανάγνωση των κοορτών του οργανισμού σας' },
    description: {
      en: 'Read the cohorts of the organisation the signed-in user belongs to: name, dates, members and whether each is running.',
      el: 'Διαβάζει τις κοόρτες του οργανισμού του χρήστη: όνομα, ημερομηνίες, μέλη και αν τρέχουν.',
    },
    params: [],
    writes: false,
  },
  {
    id: 'get_org_members',
    kind: 'read',
    label: { en: 'Read your organisation’s members', el: 'Ανάγνωση των μελών του οργανισμού σας' },
    description: {
      en: 'Read the people in the signed-in user’s organisation: name, role, cohort and when they joined. Returns up to five, newest first.',
      el: 'Διαβάζει τα άτομα του οργανισμού του χρήστη: όνομα, ρόλο, κοόρτη και πότε εντάχθηκαν. Επιστρέφει έως πέντε, πρώτα τα νεότερα.',
    },
    params: [],
    writes: false,
  },
  {
    id: 'get_platform_stats',
    kind: 'read',
    label: { en: 'Read platform figures (admin)', el: 'Ανάγνωση στοιχείων πλατφόρμας (διαχείριση)' },
    description: {
      en: 'Platform administrators only. Read platform-wide users, activity, content and the moderation queue size.',
      el: 'Μόνο για διαχειριστές πλατφόρμας. Διαβάζει χρήστες, δραστηριότητα, περιεχόμενο και το μέγεθος της ουράς ελέγχου σε όλη την πλατφόρμα.',
    },
    params: [],
    writes: false,
    // AdminController is @Roles('admin', 'super_admin').
    roles: ['admin', 'super_admin'],
  },
  {
    id: 'get_moderation_queue',
    kind: 'read',
    label: { en: 'Read the moderation queue (admin)', el: 'Ανάγνωση της ουράς ελέγχου (διαχείριση)' },
    description: {
      en: 'Platform administrators only. Read open reports: type, who was reported, the reason and when. Returns up to five, oldest first.',
      el: 'Μόνο για διαχειριστές πλατφόρμας. Διαβάζει ανοιχτές αναφορές: τύπο, ποιος αναφέρθηκε, αιτία και πότε. Επιστρέφει έως πέντε, πρώτα τις παλαιότερες.',
    },
    params: [],
    writes: false,
    // AdminController is @Roles('admin', 'super_admin').
    roles: ['admin', 'super_admin'],
  },
  {
    id: 'navigate',
    kind: 'mutation',
    label: { en: 'Open a page', el: 'Άνοιγμα σελίδας' },
    description: {
      en: 'Move the user to a route in the product. Proposes the destination; the user confirms before anything moves.',
      el: 'Μετακινεί τον χρήστη σε μια σελίδα του προϊόντος. Προτείνει τον προορισμό· ο χρήστης επιβεβαιώνει πριν γίνει οτιδήποτε.',
    },
    params: [
      {
        name: 'href',
        type: 'string',
        required: true,
        description: {
          en: 'Destination path inside the product, e.g. "/matches".',
          el: 'Διαδρομή προορισμού μέσα στο προϊόν, π.χ. «/matches».',
        },
      },
      {
        name: 'label',
        type: 'string',
        required: false,
        description: {
          en: 'Human-readable name of the destination, used in the proposal.',
          el: 'Αναγνώσιμο όνομα του προορισμού, για την πρόταση.',
        },
      },
    ],
    writes: false,
    invalidates: [],
    reversal: {
      kind: 'none',
      explanation: {
        en: 'Nothing is written, so there is nothing to undo. Use the browser’s back control to return.',
        el: 'Δεν γράφεται τίποτα, άρα δεν υπάρχει κάτι να αναιρεθεί. Χρησιμοποίησε το πίσω του browser για επιστροφή.',
      },
    },
    navigatesOnSuccess: true,
    confirmLabel: { en: 'Go', el: 'Μετάβαση' },
  },
  {
    // A page's supporting tools - its filters, totals, period, exports - live
    // in the page rail on the right, and the page context lists the rail's
    // sections by id. Without this the assistant could say "the filters are
    // in the panel on the right" and nothing more.
    id: 'open_rail_section',
    kind: 'mutation',
    label: { en: 'Open a page tools section', el: 'Άνοιγμα ενότητας εργαλείων σελίδας' },
    description: {
      en: 'Open one section of the current page’s tools panel (the rail on the right; a sheet on phones), such as its filters, totals or export. Only sections listed in the page context exist.',
      el: 'Ανοίγει μία ενότητα του πάνελ εργαλείων της τρέχουσας σελίδας (η στήλη δεξιά· φύλλο στα κινητά), π.χ. φίλτρα, σύνολα ή εξαγωγή. Υπάρχουν μόνο οι ενότητες που αναφέρει το πλαίσιο της σελίδας.',
    },
    params: [
      {
        name: 'section',
        type: 'string',
        required: true,
        description: {
          en: 'The section id, exactly as the page context’s rail lists it, e.g. "filters".',
          el: 'Το id της ενότητας, όπως ακριβώς το αναφέρει το rail του πλαισίου σελίδας, π.χ. «filters».',
        },
      },
      {
        name: 'label',
        type: 'string',
        required: false,
        description: {
          en: 'The section’s name as the reader sees it, used in the proposal.',
          el: 'Το όνομα της ενότητας όπως το βλέπει ο αναγνώστης, για την πρόταση.',
        },
      },
    ],
    // It shows a panel; it changes no data and moves the reader nowhere.
    writes: false,
    invalidates: [],
    reversal: {
      kind: 'none',
      explanation: {
        en: 'Nothing is written, so there is nothing to undo. The panel closes with Escape or when the pointer leaves it; on a phone, with the sheet’s close button. A panel you had pinned open stays pinned.',
        el: 'Δεν γράφεται τίποτα, άρα δεν υπάρχει κάτι να αναιρεθεί. Το πάνελ κλείνει με Escape ή όταν ο δείκτης φύγει από πάνω του· στο κινητό, με το κουμπί κλεισίματος του φύλλου. Ένα πάνελ που είχατε καρφιτσώσει μένει καρφιτσωμένο.',
      },
    },
    // Filed against the section, not against a user: the audit's default
    // treats the first required argument as a user id.
    auditSubject: { param: 'section', entityType: 'page_rail_section' },
    confirmLabel: { en: 'Open', el: 'Άνοιγμα' },
  },
  {
    // A page's own controls, as the page context lists them under `controls`:
    // filters, periods, sorting, exports, opening a panel. The page registers
    // the same handler its button calls (`usePageControls`), so this reaches
    // nothing the page does not already offer.
    id: 'use_page_control',
    kind: 'mutation',
    label: { en: 'Use a control on this page', el: 'Χρήση ελέγχου αυτής της σελίδας' },
    description: {
      en: 'Press one of the current page’s view controls - a filter, a period, a sort, an export, a panel - exactly as the reader could. Only controls listed in the page context with writes=false exist; pass the chosen option’s value when the control lists options.',
      el: 'Πατά έναν από τους ελέγχους προβολής της τρέχουσας σελίδας - φίλτρο, περίοδο, ταξινόμηση, εξαγωγή, πάνελ - όπως θα μπορούσε ο αναγνώστης. Υπάρχουν μόνο όσοι αναφέρονται στο πλαίσιο της σελίδας με writes=false· δώστε την τιμή της επιλογής όταν ο έλεγχος έχει επιλογές.',
    },
    params: [
      {
        name: 'control',
        type: 'string',
        required: true,
        description: { en: 'The control id, exactly as the page context lists it.', el: 'Το id του ελέγχου, όπως ακριβώς το αναφέρει το πλαίσιο της σελίδας.' },
      },
      {
        name: 'value',
        type: 'string',
        required: false,
        description: { en: 'The chosen option’s value, for a control that lists options.', el: 'Η τιμή της επιλογής, για έλεγχο με επιλογές.' },
      },
      {
        name: 'label',
        type: 'string',
        required: false,
        description: { en: 'What the reader will see pressed, used in the proposal.', el: 'Τι θα δει ο αναγνώστης να πατιέται, για την πρόταση.' },
      },
    ],
    // View controls only; the executor refuses a control that writes.
    writes: false,
    invalidates: [],
    reversal: {
      kind: 'none',
      explanation: {
        en: 'Nothing is stored. The same control on the page sets it back.',
        el: 'Δεν αποθηκεύεται τίποτα. Ο ίδιος έλεγχος στη σελίδα το επαναφέρει.',
      },
    },
    auditSubject: { param: 'control', entityType: 'page_control' },
    confirmLabel: { en: 'Apply', el: 'Εφαρμογή' },
  },
  {
    // The same, for a control that changes stored data: suspend a user,
    // resolve a report, archive a programme. Separate so `writes` is true
    // exactly when a write can happen, which is what the confirm card reads.
    id: 'run_page_command',
    kind: 'mutation',
    label: { en: 'Run a command on this page', el: 'Εκτέλεση εντολής αυτής της σελίδας' },
    description: {
      en: 'Run one of the current page’s commands - a control that changes stored data - with the same handler and the same confirmations the page uses. Only controls listed in the page context with writes=true exist; pass the chosen option’s value (often the row to act on).',
      el: 'Εκτελεί μία από τις εντολές της τρέχουσας σελίδας - έλεγχο που αλλάζει αποθηκευμένα δεδομένα - με τον ίδιο handler και τις ίδιες επιβεβαιώσεις της σελίδας. Υπάρχουν μόνο όσες αναφέρονται στο πλαίσιο της σελίδας με writes=true· δώστε την τιμή της επιλογής (συχνά τη γραμμή που αφορά).',
    },
    params: [
      {
        name: 'control',
        type: 'string',
        required: true,
        description: { en: 'The command id, exactly as the page context lists it.', el: 'Το id της εντολής, όπως ακριβώς το αναφέρει το πλαίσιο της σελίδας.' },
      },
      {
        name: 'value',
        type: 'string',
        required: false,
        description: { en: 'The chosen option’s value, for a command that lists options.', el: 'Η τιμή της επιλογής, για εντολή με επιλογές.' },
      },
      {
        name: 'label',
        type: 'string',
        required: false,
        description: { en: 'What the reader will see run, used in the proposal.', el: 'Τι θα δει ο αναγνώστης να εκτελείται, για την πρόταση.' },
      },
    ],
    writes: true,
    // The page's handler refreshes what it changed, as it does for a click.
    invalidates: [],
    // Partial, and only per command: a page names the verified opposite of a
    // command (reactivate for suspend, unpin for pin) from the row's state
    // before it runs, and Undo runs that opposite on the same row while the
    // page is open. A command whose opposite would not restore what it
    // changed - a removal that loses a note, a role lost on leaving - names
    // none, and its card offers no Undo.
    reversal: {
      kind: 'partial',
      explanation: {
        en: 'This runs the page’s own command. Where the page has a verified opposite for it (reactivate for suspend, unpin for pin), Undo runs that on the same row while this page is open; otherwise it cannot be taken back here.',
        el: 'Εκτελεί την εντολή της ίδιας της σελίδας. Όπου η σελίδα έχει επαληθευμένη αντίθετη εντολή (επανενεργοποίηση για αναστολή, ξεκαρφίτσωμα για καρφίτσωμα), η Αναίρεση την εκτελεί στην ίδια γραμμή όσο η σελίδα είναι ανοιχτή· αλλιώς δεν αναιρείται εδώ.',
      },
    },
    auditSubject: { param: 'control', entityType: 'page_command' },
    confirmLabel: { en: 'Run', el: 'Εκτέλεση' },
  },
  {
    id: 'shortlist_add',
    kind: 'mutation',
    label: { en: 'Save to shortlist', el: 'Αποθήκευση στη λίστα' },
    description: {
      en: 'Add a person to the signed-in user’s saved profiles. Writes only after confirmation.',
      el: 'Προσθέτει ένα άτομο στα αποθηκευμένα προφίλ του χρήστη. Γράφει μόνο μετά από επιβεβαίωση.',
    },
    params: [
      {
        name: 'userId',
        type: 'string',
        required: true,
        description: {
          en: 'Id of the person to save. Must come from a prior search or recommendation result.',
          el: 'Το id του ατόμου. Πρέπει να προέρχεται από προηγούμενη αναζήτηση ή πρόταση.',
        },
      },
    ],
    writes: true,
    invalidates: ['shortlist'],
    reversal: {
      // `DELETE /api/shortlist/:userId` runs `savedProfile.deleteMany`, so the
      // row is really gone and nobody else was notified.
      kind: 'full',
      explanation: {
        en: 'Fully reversible. Removing them deletes the saved entry, and nobody is notified either way.',
        el: 'Πλήρως αναστρέψιμο. Η αφαίρεση διαγράφει την αποθηκευμένη εγγραφή και δεν ειδοποιείται κανείς σε καμία περίπτωση.',
      },
    },
    confirmLabel: { en: 'Save to shortlist', el: 'Αποθήκευση στη λίστα' },
  },
  {
    id: 'shortlist_remove',
    kind: 'mutation',
    label: { en: 'Remove from shortlist', el: 'Αφαίρεση από τη λίστα' },
    description: {
      en: 'Remove a person from the signed-in user’s saved profiles. Writes only after confirmation, and can be put back in one click.',
      el: 'Αφαιρεί ένα άτομο από τα αποθηκευμένα προφίλ του χρήστη. Γράφει μόνο μετά από επιβεβαίωση και επιστρέφει με ένα κλικ.',
    },
    params: [
      {
        name: 'userId',
        type: 'string',
        required: true,
        description: {
          en: 'Id of the person to remove. Must come from a prior shortlist, search or recommendation result.',
          el: 'Το id του ατόμου. Πρέπει να προέρχεται από τη λίστα, προηγούμενη αναζήτηση ή πρόταση.',
        },
      },
    ],
    writes: true,
    invalidates: ['shortlist'],
    reversal: {
      kind: 'full',
      explanation: {
        en: 'Fully reversible. Putting them back recreates the saved entry, and nobody is notified either way.',
        el: 'Πλήρως αναστρέψιμο. Η επαναφορά δημιουργεί ξανά την αποθηκευμένη εγγραφή και δεν ειδοποιείται κανείς.',
      },
    },
    confirmLabel: { en: 'Remove from shortlist', el: 'Αφαίρεση από τη λίστα' },
  },
  {
    id: 'send_connection',
    kind: 'mutation',
    label: { en: 'Send an intro request', el: 'Αποστολή αιτήματος σύνδεσης' },
    description: {
      en: 'Send a connection request to a person through the same Connections API the rest of the product uses. Writes only after confirmation.',
      el: 'Στέλνει αίτημα σύνδεσης μέσω του ίδιου Connections API που χρησιμοποιεί το υπόλοιπο προϊόν. Γράφει μόνο μετά από επιβεβαίωση.',
    },
    params: [
      {
        name: 'receiverId',
        type: 'string',
        required: true,
        description: {
          en: 'Id of the person to invite. Must come from a prior search or recommendation result.',
          el: 'Το id του ατόμου. Πρέπει να προέρχεται από προηγούμενη αναζήτηση ή πρόταση.',
        },
      },
      {
        name: 'message',
        type: 'string',
        required: false,
        description: {
          en: 'Optional note sent with the request.',
          el: 'Προαιρετικό σημείωμα που στέλνεται με το αίτημα.',
        },
      },
    ],
    writes: true,
    invalidates: ['connections', 'graph'],
    reversal: {
      // `DELETE /connections/:id` withdraws a request the receiver has not
      // answered. Partial, not full: the notification fired when the request
      // was sent and nothing takes that back — only the pending request goes.
      kind: 'partial',
      explanation: {
        en: 'Withdraws the request, so it leaves their pending list. They were notified when it was sent, so they may already have seen it, and it can no longer be withdrawn once they have accepted or declined.',
        el: 'Ανακαλεί το αίτημα, ώστε να φύγει από τα εκκρεμή τους. Ειδοποιήθηκαν όταν στάλθηκε, οπότε μπορεί να το έχουν ήδη δει, και δεν ανακαλείται πια αν το έχουν αποδεχτεί ή απορρίψει.',
      },
    },
    confirmLabel: { en: 'Send intro', el: 'Αποστολή σύστασης' },
  },
  {
    id: 'start_or_send_message',
    kind: 'mutation',
    label: { en: 'Open a conversation', el: 'Άνοιγμα συνομιλίας' },
    description: {
      en: 'Open the direct thread with a person, creating it if there is none. Does not send any message text.',
      el: 'Ανοίγει το απευθείας νήμα με ένα άτομο, δημιουργώντας το αν δεν υπάρχει. Δεν στέλνει κείμενο μηνύματος.',
    },
    params: [
      {
        name: 'userId',
        type: 'string',
        required: true,
        description: {
          en: 'Id of the person to open a thread with.',
          el: 'Το id του ατόμου για το νήμα συνομιλίας.',
        },
      },
    ],
    writes: true,
    invalidates: ['messages'],
    reversal: {
      // MessagingController has no delete for a conversation, and
      // getOrCreateDirectConversation returns the same `{ id }` shape whether
      // it found an existing thread or created one. An undo could not tell
      // "we made this" from "this was already the user's thread", and
      // archiving the latter would destroy something never created here.
      kind: 'none',
      explanation: {
        en: 'No message is sent, so there is nothing for the other person to read. The thread itself cannot be removed, and the API does not report whether it was created now or already existed.',
        el: 'Δεν στέλνεται μήνυμα, άρα ο άλλος δεν έχει κάτι να διαβάσει. Το νήμα δεν μπορεί να αφαιρεθεί και το API δεν αναφέρει αν δημιουργήθηκε τώρα ή υπήρχε ήδη.',
      },
    },
    navigatesOnSuccess: true,
    confirmLabel: { en: 'Open thread', el: 'Άνοιγμα νήματος' },
  },
  {
    id: 'readiness_tick_criterion',
    kind: 'mutation',
    label: { en: 'Tick a readiness criterion', el: 'Σήμανση κριτηρίου ετοιμότητας' },
    description: {
      en: 'Mark one readiness criterion as met or not met on the user’s Startup Builder workspace, which recalculates that dimension’s score.',
      el: 'Σημειώνει ένα κριτήριο ετοιμότητας ως καλυμμένο ή μη στον χώρο Startup Builder του χρήστη, κάτι που επανυπολογίζει τη βαθμολογία της διάστασης.',
    },
    params: [
      {
        name: 'dimension',
        type: 'string',
        required: true,
        enumValues: ['team', 'market', 'product', 'business', 'funding', 'execution'],
        description: {
          en: 'Which of the six readiness dimensions the criterion belongs to.',
          el: 'Σε ποια από τις έξι διαστάσεις ετοιμότητας ανήκει το κριτήριο.',
        },
      },
      {
        name: 'criterionId',
        type: 'string',
        required: true,
        description: {
          en: 'The criterion’s id, as listed on the Readiness page for that dimension.',
          el: 'Το id του κριτηρίου, όπως εμφανίζεται στη σελίδα Ετοιμότητας για τη διάσταση.',
        },
      },
      {
        name: 'completed',
        type: 'boolean',
        required: true,
        description: {
          en: 'True to mark it met, false to clear it.',
          el: 'True για να σημανθεί ως καλυμμένο, false για να καθαριστεί.',
        },
      },
    ],
    writes: true,
    invalidates: ['readiness'],
    reversal: {
      // The identifier the undo needs is in the *input*, not the output, which
      // is what makes this genuinely reversible where `workspace_create` is
      // not. The executor also refuses a no-op: ticking something already
      // ticked would otherwise leave an undo that clears a box the user set
      // themselves.
      kind: 'full',
      explanation: {
        en: 'Setting the criterion back restores the previous score exactly. Nothing is sent to anyone, and the action is refused outright if the criterion is already in the state being asked for.',
        el: 'Η επαναφορά του κριτηρίου αποκαθιστά ακριβώς την προηγούμενη βαθμολογία. Δεν στέλνεται τίποτα σε κανέναν, και η ενέργεια απορρίπτεται αν το κριτήριο είναι ήδη στην κατάσταση που ζητείται.',
      },
    },
    auditSubject: { param: 'criterionId', entityType: 'readiness_criterion' },
    navigatesOnSuccess: true,
    confirmLabel: { en: 'Update criterion', el: 'Ενημέρωση κριτηρίου' },
  },
  {
    id: 'analytics_set_period',
    kind: 'mutation',
    label: { en: 'Change the analytics window', el: 'Αλλαγή περιόδου αναλυτικών' },
    description: {
      en: 'Switch the Analytics page between the 7, 14, 30 and 90 day windows.',
      el: 'Εναλλάσσει τη σελίδα Αναλυτικών μεταξύ των περιόδων 7, 14, 30 και 90 ημερών.',
    },
    params: [
      {
        name: 'period',
        type: 'string',
        required: true,
        enumValues: ['7d', '14d', '30d', '90d'],
        description: {
          en: 'The window to show.',
          el: 'Η περίοδος που θα εμφανιστεί.',
        },
      },
    ],
    // Like `navigate`, this moves the user's view rather than their data, and
    // that distinction is what the UI reads to decide whether to warn. Nothing
    // goes stale either: the page keys its query by the period in the address.
    writes: false,
    invalidates: [],
    reversal: {
      kind: 'partial',
      explanation: {
        en: 'Nothing is stored — the window lives in the page’s address. Taking it back returns to the default 7-day view, which is where the page starts, not necessarily the window you had open before; switching costs a click either way.',
        el: 'Δεν αποθηκεύεται τίποτα — η περίοδος ζει στη διεύθυνση της σελίδας. Η αναίρεση επιστρέφει στην προεπιλογή των 7 ημερών, δηλαδή εκεί που ξεκινά η σελίδα, όχι απαραίτητα στην περίοδο που είχατε ανοιχτή πριν· η εναλλαγή κοστίζει ένα κλικ έτσι κι αλλιώς.',
      },
    },
    auditSubject: { param: 'period', entityType: 'analytics_window' },
    navigatesOnSuccess: true,
    confirmLabel: { en: 'Show that window', el: 'Εμφάνιση περιόδου' },
  },
  {
    id: 'workspace_create',
    kind: 'mutation',
    label: { en: 'Create a Startup Builder workspace', el: 'Δημιουργία χώρου Startup Builder' },
    description: {
      en: 'Create the workspace the Readiness page needs before criteria can be ticked or a score saved.',
      el: 'Δημιουργεί τον χώρο εργασίας που χρειάζεται η σελίδα Ετοιμότητας πριν μπορέσουν να σημανθούν κριτήρια ή να αποθηκευτεί βαθμολογία.',
    },
    params: [
      {
        name: 'name',
        type: 'string',
        required: true,
        description: {
          en: 'What to call the workspace, e.g. the venture’s name.',
          el: 'Πώς θα ονομαστεί ο χώρος, π.χ. το όνομα του εγχειρήματος.',
        },
      },
      {
        name: 'description',
        type: 'string',
        required: false,
        description: {
          en: 'One line on what the venture is.',
          el: 'Μία γραμμή για το τι είναι το εγχείρημα.',
        },
      },
      {
        name: 'startupName',
        type: 'string',
        required: false,
        description: {
          en: 'The startup’s name, when it differs from the workspace name.',
          el: 'Το όνομα του startup, όταν διαφέρει από το όνομα του χώρου.',
        },
      },
    ],
    writes: true,
    invalidates: ['workspaces', 'readiness'],
    reversal: {
      // The executor hands back the id it created (`ActionOutcome.undo`), so
      // the undo archives that exact workspace rather than guessing by name.
      // Archive, not delete: it is the product's own word for putting a
      // workspace away, and it leaves the row recoverable from Builder.
      kind: 'full',
      explanation: {
        en: 'Archives the workspace that was just created, and clears it as your selected workspace. Nothing inside it is deleted — you can restore it from Startup Builder.',
        el: 'Αρχειοθετεί τον χώρο που μόλις δημιουργήθηκε και τον αφαιρεί από επιλεγμένο. Τίποτα μέσα του δεν διαγράφεται — μπορείς να τον επαναφέρεις από το Startup Builder.',
      },
    },
    auditSubject: { param: 'name', entityType: 'workspace' },
    navigatesOnSuccess: true,
    confirmLabel: { en: 'Create workspace', el: 'Δημιουργία χώρου' },
  },
  {
    id: 'investor_track_startup',
    kind: 'mutation',
    label: { en: 'Track a startup', el: 'Παρακολούθηση startup' },
    description: {
      en: 'Put a startup on your investor board at the watching stage. The same row the pipeline groups and the portfolio totals once you invest.',
      el: 'Βάζει ένα startup στον πίνακα επενδύσεων, στο στάδιο παρακολούθησης. Είναι η ίδια εγγραφή που ομαδοποιεί το pipeline και αθροίζει το χαρτοφυλάκιο μόλις επενδύσεις.',
    },
    params: [
      {
        name: 'name',
        type: 'string',
        required: true,
        description: {
          en: 'The startup to track, as it should appear on the board.',
          el: 'Το startup προς παρακολούθηση, όπως θα εμφανίζεται στον πίνακα.',
        },
      },
      {
        name: 'industry',
        type: 'string',
        required: false,
        description: { en: 'Its industry, when known.', el: 'Ο κλάδος του, αν είναι γνωστός.' },
      },
      {
        name: 'notes',
        type: 'string',
        required: false,
        description: {
          en: 'A private note on why it is worth watching.',
          el: 'Ιδιωτική σημείωση για το γιατί αξίζει να παρακολουθείται.',
        },
      },
    ],
    writes: true,
    invalidates: ['investor'],
    reversal: {
      // The executor hands back the id it created, so the undo removes that
      // exact row rather than one that happens to share a name.
      kind: 'full',
      explanation: {
        en: 'Removes the startup from your board again. Nothing is shared with the startup either way — a board is private to you.',
        el: 'Αφαιρεί ξανά το startup από τον πίνακά σου. Τίποτα δεν κοινοποιείται στο startup — ο πίνακας είναι ιδιωτικός.',
      },
    },
    auditSubject: { param: 'name', entityType: 'investor_deal' },
    confirmLabel: { en: 'Track it', el: 'Παρακολούθηση' },
  },
  {
    id: 'investor_move_stage',
    kind: 'mutation',
    label: { en: 'Move a deal to another stage', el: 'Μετακίνηση deal σε άλλο στάδιο' },
    description: {
      en: 'Move a startup along your pipeline — to reviewing, a meeting, due diligence, negotiating, invested or passed.',
      el: 'Μετακινεί ένα startup στο pipeline — σε εξέταση, συνάντηση, δέουσα επιμέλεια, διαπραγμάτευση, επένδυση ή απόρριψη.',
    },
    params: [
      {
        name: 'dealId',
        type: 'string',
        required: true,
        description: {
          en: 'Id of the deal to move. Must come from a prior read of the board.',
          el: 'Το id του deal. Πρέπει να προέρχεται από προηγούμενη ανάγνωση του πίνακα.',
        },
      },
      {
        name: 'pipelineStage',
        type: 'string',
        required: true,
        enumValues: [
          'discovered',
          'reviewing',
          'meeting',
          'due_diligence',
          'negotiating',
          'invested',
          'passed',
        ],
        description: { en: 'The stage to move it to.', el: 'Το στάδιο προορισμού.' },
      },
    ],
    writes: true,
    invalidates: ['investor'],
    reversal: {
      // The executor reads the stage it moved away from and hands it back, so
      // the undo returns the deal to where it actually was.
      kind: 'full',
      explanation: {
        en: 'Puts the deal back in the stage it came from. Reaching "invested" also stamps the date; that stamp is kept, so moving back and forth cannot rewrite when you invested.',
        el: 'Επαναφέρει το deal στο στάδιο από το οποίο ήρθε. Η άφιξη στο «επένδυση» σφραγίζει και την ημερομηνία· η σφραγίδα διατηρείται, ώστε οι μετακινήσεις να μην ξαναγράφουν πότε επένδυσες.',
      },
    },
    auditSubject: { param: 'dealId', entityType: 'investor_deal' },
    confirmLabel: { en: 'Move it', el: 'Μετακίνηση' },
  },
  {
    id: 'update_profile',
    kind: 'mutation',
    label: { en: 'Update your profile', el: 'Ενημέρωση του προφίλ σου' },
    description: {
      en: 'Change fields on the signed-in user’s own profile — headline, bio, location or timezone — through the same endpoint the profile editor saves with. Writes only after confirmation.',
      el: 'Αλλάζει πεδία του ίδιου του προφίλ του χρήστη — τίτλο, βιογραφικό, τοποθεσία ή ζώνη ώρας — μέσα από το ίδιο endpoint που αποθηκεύει η σελίδα επεξεργασίας. Γράφει μόνο μετά από επιβεβαίωση.',
    },
    params: [
      {
        name: 'headline',
        type: 'string',
        required: false,
        description: {
          en: 'New headline, up to 300 characters.',
          el: 'Νέος τίτλος, έως 300 χαρακτήρες.',
        },
      },
      {
        name: 'bio',
        type: 'string',
        required: false,
        description: {
          en: 'New bio, up to 5000 characters.',
          el: 'Νέο βιογραφικό, έως 5000 χαρακτήρες.',
        },
      },
      {
        name: 'location',
        type: 'string',
        required: false,
        description: {
          en: 'New location, e.g. "Athens, Greece".',
          el: 'Νέα τοποθεσία, π.χ. «Αθήνα, Ελλάδα».',
        },
      },
      {
        name: 'timezone',
        type: 'string',
        required: false,
        description: {
          en: 'New IANA timezone, e.g. "Europe/Athens".',
          el: 'Νέα ζώνη ώρας IANA, π.χ. «Europe/Athens».',
        },
      },
    ],
    writes: true,
    invalidates: ['profile'],
    reversal: {
      // The executor reads the profile before writing and hands the previous
      // values back as `undo.prior`, so the undo restores exactly what was
      // there — including empty fields, written back as empty strings.
      kind: 'full',
      explanation: {
        en: 'Fully reversible. The values being replaced are read first and the undo writes exactly those back.',
        el: 'Πλήρως αναστρέψιμο. Οι τιμές που αντικαθίστανται διαβάζονται πρώτα και η αναίρεση γράφει ακριβώς αυτές πίσω.',
      },
    },
    navigatesOnSuccess: true,
    confirmLabel: { en: 'Update profile', el: 'Ενημέρωση προφίλ' },
  },
  {
    id: 'respond_to_connection',
    kind: 'mutation',
    label: { en: 'Answer a connection request', el: 'Απάντηση αιτήματος σύνδεσης' },
    description: {
      en: 'Accept or decline a connection request sent to the signed-in user. The request id comes from a prior read of your connections. Writes only after confirmation.',
      el: 'Αποδέχεται ή απορρίπτει αίτημα σύνδεσης που εστάλη στον χρήστη. Το id προέρχεται από προηγούμενη ανάγνωση των συνδέσεων. Γράφει μόνο μετά από επιβεβαίωση.',
    },
    params: [
      {
        name: 'connectionId',
        type: 'string',
        required: true,
        description: {
          en: 'Id of the pending request. Must come from a prior read of your connections.',
          el: 'Το id του εκκρεμούς αιτήματος. Πρέπει να προέρχεται από προηγούμενη ανάγνωση των συνδέσεων.',
        },
      },
      {
        name: 'decision',
        type: 'string',
        required: true,
        enumValues: ['accepted', 'declined'],
        description: {
          en: 'Whether to accept or decline the request.',
          el: 'Αποδοχή ή απόρριψη του αιτήματος.',
        },
      },
    ],
    writes: true,
    invalidates: ['connections', 'graph'],
    reversal: {
      // `PATCH /connections/:id` answers the request and notifies the
      // requester. The only delete route is the sender's withdraw, which the
      // receiver cannot call — an answered request has no route that
      // un-answers it.
      kind: 'none',
      explanation: {
        en: 'Not reversible. Answering notifies the other person immediately, and there is no action that turns an accepted or declined request back into a pending one.',
        el: 'Δεν αναιρείται. Η απάντηση ειδοποιεί τον άλλον αμέσως και δεν υπάρχει ενέργεια που να ξανακάνει εκκρεμές ένα αποδεκτό ή απορριφθέν αίτημα.',
      },
    },
    auditSubject: { param: 'connectionId', entityType: 'connection' },
    confirmLabel: { en: 'Answer request', el: 'Απάντηση αιτήματος' },
  },
  {
    id: 'create_milestone',
    kind: 'mutation',
    label: { en: 'Create a milestone', el: 'Δημιουργία ορόσημου' },
    description: {
      en: 'Add a milestone to the signed-in user’s list — the same rows the Milestones page tracks and the summary counts. Writes only after confirmation.',
      el: 'Προσθέτει ορόσημο στη λίστα του χρήστη — τις ίδιες εγγραφές που παρακολουθεί η σελίδα Ορόσημα και μετρά η σύνοψη. Γράφει μόνο μετά από επιβεβαίωση.',
    },
    params: [
      {
        name: 'title',
        type: 'string',
        required: true,
        description: {
          en: 'What the milestone is, e.g. "Close pre-seed round".',
          el: 'Τι είναι το ορόσημο, π.χ. «Κλείσιμο pre-seed γύρου».',
        },
      },
      {
        name: 'description',
        type: 'string',
        required: false,
        description: {
          en: 'More detail on what done looks like.',
          el: 'Περισσότερες λεπτομέρειες για το τι σημαίνει ολοκληρωμένο.',
        },
      },
      {
        name: 'dueDate',
        type: 'string',
        required: false,
        description: {
          en: 'Deadline as an ISO date, e.g. "2026-06-01".',
          el: 'Προθεσμία σε ISO μορφή, π.χ. «2026-06-01».',
        },
      },
      {
        name: 'priority',
        type: 'string',
        required: false,
        enumValues: ['low', 'medium', 'high'],
        description: {
          en: 'How urgent it is. Defaults to the product’s normal priority.',
          el: 'Πόσο επείγον είναι. Αν παραλειφθεί ισχύει η κανονική προτεραιότητα.',
        },
      },
    ],
    writes: true,
    invalidates: ['milestones'],
    reversal: {
      // `DELETE /milestones/:id` removes the row, and the executor hands back
      // the id it created — the undo deletes that exact milestone, not one
      // that happens to share a title.
      kind: 'full',
      explanation: {
        en: 'Fully reversible. Deleting the milestone that was just created removes the row entirely; nobody else is notified either way.',
        el: 'Πλήρως αναστρέψιμο. Η διαγραφή του ορόσημου που μόλις δημιουργήθηκε αφαιρεί εντελώς την εγγραφή· δεν ειδοποιείται κανείς.',
      },
    },
    auditSubject: { param: 'title', entityType: 'milestone' },
    navigatesOnSuccess: true,
    confirmLabel: { en: 'Create milestone', el: 'Δημιουργία ορόσημου' },
  },
  {
    id: 'update_milestone_status',
    kind: 'mutation',
    label: { en: 'Update a milestone’s status', el: 'Ενημέρωση κατάστασης ορόσημου' },
    description: {
      en: 'Move one of the signed-in user’s milestones to a new status — start it, block it, complete it or cancel it. The milestone can be named by id from a prior read, or by exact title.',
      el: 'Μετακινεί ένα ορόσημο του χρήστη σε νέα κατάσταση — έναρξη, εμπόδιο, ολοκλήρωση ή ακύρωση. Το ορόσημο δίνεται με id από προηγούμενη ανάγνωση ή με ακριβή τίτλο.',
    },
    params: [
      {
        name: 'status',
        type: 'string',
        required: true,
        enumValues: ['todo', 'in_progress', 'blocked', 'completed', 'cancelled'],
        description: {
          en: 'The status to move it to.',
          el: 'Η κατάσταση προορισμού.',
        },
      },
      {
        name: 'milestoneId',
        type: 'string',
        required: false,
        description: {
          en: 'Id of the milestone, from a prior read of your milestones.',
          el: 'Το id του ορόσημου, από προηγούμενη ανάγνωση των ορόσημων.',
        },
      },
      {
        name: 'title',
        type: 'string',
        required: false,
        description: {
          en: 'Exact milestone title, used when the id is not known.',
          el: 'Ακριβής τίτλος ορόσημου, όταν δεν είναι γνωστό το id.',
        },
      },
    ],
    writes: true,
    invalidates: ['milestones'],
    reversal: {
      // The executor reads the milestone first and hands the status it moved
      // away from back as `undo.fromStatus`, so the undo restores where it
      // actually was rather than guessing a default.
      kind: 'full',
      explanation: {
        en: 'Fully reversible. The status it had is read before the move and the undo sets exactly that back.',
        el: 'Πλήρως αναστρέψιμο. Η προηγούμενη κατάσταση διαβάζεται πριν τη μετακίνηση και η αναίρεση την επαναφέρει ακριβώς.',
      },
    },
    auditSubject: { param: 'milestoneId', entityType: 'milestone' },
    confirmLabel: { en: 'Update status', el: 'Ενημέρωση κατάστασης' },
  },
  {
    id: 'rsvp_event',
    kind: 'mutation',
    label: { en: 'RSVP to an event', el: 'Δήλωση συμμετοχής σε εκδήλωση' },
    description: {
      en: 'Set the signed-in user’s RSVP on an event — going, interested or not going. The event can be named by id from a prior read, or by exact title.',
      el: 'Ορίζει τη συμμετοχή του χρήστη σε εκδήλωση — θα πάω, ενδιαφέρομαι ή δεν θα πάω. Η εκδήλωση δίνεται με id από προηγούμενη ανάγνωση ή με ακριβή τίτλο.',
    },
    params: [
      {
        name: 'status',
        type: 'string',
        required: true,
        enumValues: ['going', 'interested', 'not_going'],
        description: {
          en: 'The RSVP to set.',
          el: 'Η συμμετοχή που θα οριστεί.',
        },
      },
      {
        name: 'eventId',
        type: 'string',
        required: false,
        description: {
          en: 'Id of the event, from a prior read of events.',
          el: 'Το id της εκδήλωσης, από προηγούμενη ανάγνωση εκδηλώσεων.',
        },
      },
      {
        name: 'eventTitle',
        type: 'string',
        required: false,
        description: {
          en: 'Exact event title, used when the id is not known.',
          el: 'Ακριβής τίτλος εκδήλωσης, όταν δεν είναι γνωστό το id.',
        },
      },
    ],
    writes: true,
    invalidates: ['events'],
    reversal: {
      // The RSVP route upserts — it cannot remove a row. The undo writes back
      // the status read before the change, and `not_going` where there was no
      // RSVP at all: the row remains, which is why this is partial.
      kind: 'partial',
      explanation: {
        en: 'Restores the RSVP you had before, or marks you as not going when there was none — the RSVP record itself cannot be deleted, only set back.',
        el: 'Επαναφέρει τη συμμετοχή που είχες πριν, ή σε δηλώνει ως μη συμμετέχοντα αν δεν υπήρχε — η εγγραφή συμμετοχής δεν διαγράφεται, μόνο επαναφέρεται.',
      },
    },
    auditSubject: { param: 'eventId', entityType: 'event' },
    navigatesOnSuccess: true,
    confirmLabel: { en: 'Set RSVP', el: 'Ορισμός συμμετοχής' },
  },
  {
    id: 'create_event',
    kind: 'mutation',
    label: { en: 'Create an event', el: 'Δημιουργία εκδήλωσης' },
    description: {
      en: 'Publish an event on the platform — meetup, webinar, workshop, demo day or networking — visible to members the moment it is created. Writes only after confirmation.',
      el: 'Δημοσιεύει εκδήλωση στην πλατφόρμα — meetup, webinar, workshop, demo day ή networking — ορατή στα μέλη μόλις δημιουργηθεί. Γράφει μόνο μετά από επιβεβαίωση.',
    },
    params: [
      {
        name: 'title',
        type: 'string',
        required: true,
        description: {
          en: 'Event title, 2–120 characters.',
          el: 'Τίτλος εκδήλωσης, 2–120 χαρακτήρες.',
        },
      },
      {
        name: 'startAt',
        type: 'string',
        required: true,
        description: {
          en: 'Start date and time in ISO 8601, e.g. "2026-06-10T18:00:00+03:00".',
          el: 'Ημερομηνία και ώρα έναρξης σε ISO 8601, π.χ. «2026-06-10T18:00:00+03:00».',
        },
      },
      {
        name: 'type',
        type: 'string',
        required: false,
        enumValues: ['meetup', 'webinar', 'workshop', 'demo_day', 'networking', 'other'],
        description: {
          en: 'What kind of event it is. Defaults to networking.',
          el: 'Είδος εκδήλωσης. Αν παραλειφθεί, θεωρείται networking.',
        },
      },
      {
        name: 'description',
        type: 'string',
        required: false,
        description: {
          en: 'What the event is about, up to 5000 characters.',
          el: 'Περί τίνος πρόκειται, έως 5000 χαρακτήρες.',
        },
      },
      {
        name: 'location',
        type: 'string',
        required: false,
        description: {
          en: 'Where it happens, e.g. a venue or city. Leave out for online events.',
          el: 'Πού γίνεται, π.χ. χώρος ή πόλη. Παραλείπεται για online.',
        },
      },
      {
        name: 'isOnline',
        type: 'boolean',
        required: false,
        description: {
          en: 'True when the event is held online.',
          el: 'True όταν η εκδήλωση γίνεται online.',
        },
      },
      {
        name: 'endAt',
        type: 'string',
        required: false,
        description: {
          en: 'End date and time in ISO 8601.',
          el: 'Ημερομηνία και ώρα λήξης σε ISO 8601.',
        },
      },
    ],
    writes: true,
    invalidates: ['events'],
    reversal: {
      // EventsController has create, list, get and rsvp — no update and no
      // delete. Once published the event is visible to members and nothing
      // the client can call takes it down.
      kind: 'none',
      explanation: {
        en: 'Not reversible. There is no endpoint that updates or removes an event — once created it is listed for members, so check the details before confirming.',
        el: 'Δεν αναιρείται. Δεν υπάρχει endpoint που να ενημερώνει ή να αφαιρεί εκδήλωση — μόλις δημιουργηθεί εμφανίζεται στα μέλη, οπότε έλεγξε τα στοιχεία πριν επιβεβαιώσεις.',
      },
    },
    auditSubject: { param: 'title', entityType: 'event' },
    navigatesOnSuccess: true,
    confirmLabel: { en: 'Publish event', el: 'Δημοσίευση εκδήλωσης' },
  },
  // ── Wave C: writes whose reversal was read from the controller first ──
  {
    id: 'join_group',
    kind: 'mutation',
    label: { en: 'Join a group', el: 'Συμμετοχή σε ομάδα' },
    description: {
      en: 'Join a community group as a member. The group can be named by id from a prior read of groups, or by exact name. Secret groups cannot be joined without an invitation.',
      el: 'Εντάσσει τον χρήστη σε μια ομάδα κοινότητας ως μέλος. Η ομάδα δίνεται με id από προηγούμενη ανάγνωση ή με ακριβές όνομα. Στις μυστικές ομάδες δεν μπαίνει κανείς χωρίς πρόσκληση.',
    },
    params: [
      { name: 'groupId', type: 'string', required: false, description: { en: 'Id of the group, from a prior read of groups.', el: 'Το id της ομάδας, από προηγούμενη ανάγνωση ομάδων.' } },
      { name: 'groupName', type: 'string', required: false, description: { en: 'Exact group name, used when the id is not known.', el: 'Ακριβές όνομα ομάδας, όταν δεν είναι γνωστό το id.' } },
    ],
    writes: true,
    invalidates: ['groups', 'graph'],
    reversal: {
      // GroupsService.joinGroup creates the membership as a plain member and
      // fires the community-join automation; leaveGroup deletes the row. So
      // leaving removes the membership but not what the automation did.
      kind: 'partial',
      explanation: {
        en: 'Leaving removes your membership. Anything the group’s join automation did when you joined (a welcome message, points) stays.',
        el: 'Η αποχώρηση αφαιρεί τη συμμετοχή σας. Ό,τι έκανε ο αυτοματισμός εισόδου της ομάδας όταν μπήκατε (μήνυμα καλωσορίσματος, πόντοι) παραμένει.',
      },
    },
    auditSubject: { param: 'groupId', entityType: 'group' },
    navigatesOnSuccess: true,
    confirmLabel: { en: 'Join group', el: 'Συμμετοχή' },
  },
  {
    id: 'leave_group',
    kind: 'mutation',
    label: { en: 'Leave a group', el: 'Αποχώρηση από ομάδα' },
    description: {
      en: 'Leave a community group the user belongs to. The owner of a group cannot leave it.',
      el: 'Αποχώρηση από μια ομάδα κοινότητας στην οποία ανήκει ο χρήστης. Ο ιδιοκτήτης μιας ομάδας δεν μπορεί να αποχωρήσει.',
    },
    params: [
      { name: 'groupId', type: 'string', required: false, description: { en: 'Id of the group, from a prior read of groups.', el: 'Το id της ομάδας, από προηγούμενη ανάγνωση ομάδων.' } },
      { name: 'groupName', type: 'string', required: false, description: { en: 'Exact group name, used when the id is not known.', el: 'Ακριβές όνομα ομάδας, όταν δεν είναι γνωστό το id.' } },
    ],
    writes: true,
    invalidates: ['groups', 'graph'],
    reversal: {
      // leaveGroup deletes the membership row. Joining again creates a new one
      // as a plain member with today's date: an admin or moderator would lose
      // the role, and a secret group cannot be rejoined at all.
      kind: 'none',
      explanation: {
        en: 'Your membership is deleted. You can join again, but as a new member: a moderator or admin role is not restored, and a secret group needs a new invitation.',
        el: 'Η συμμετοχή σας διαγράφεται. Μπορείτε να ξαναμπείτε, αλλά ως νέο μέλος: ρόλος συντονιστή ή διαχειριστή δεν επανέρχεται και μια μυστική ομάδα θέλει νέα πρόσκληση.',
      },
    },
    auditSubject: { param: 'groupId', entityType: 'group' },
    navigatesOnSuccess: true,
    confirmLabel: { en: 'Leave group', el: 'Αποχώρηση' },
  },
  {
    id: 'apply_to_program',
    kind: 'mutation',
    label: { en: 'Apply to a programme', el: 'Αίτηση σε πρόγραμμα' },
    description: {
      en: 'Apply to an accelerator, incubator or bootcamp programme that is taking applications, with an optional note about fit. Named by id from a prior read of programmes, or by exact title.',
      el: 'Υποβάλλει αίτηση σε πρόγραμμα (επιταχυντή, θερμοκοιτίδα ή bootcamp) που δέχεται αιτήσεις, με προαιρετικό σημείωμα. Δίνεται με id από προηγούμενη ανάγνωση ή με ακριβή τίτλο.',
    },
    params: [
      { name: 'programId', type: 'string', required: false, description: { en: 'Id of the programme, from a prior read of programmes.', el: 'Το id του προγράμματος, από προηγούμενη ανάγνωση προγραμμάτων.' } },
      { name: 'programTitle', type: 'string', required: false, description: { en: 'Exact programme title, used when the id is not known.', el: 'Ακριβής τίτλος προγράμματος, όταν δεν είναι γνωστό το id.' } },
      { name: 'coverNote', type: 'string', required: false, description: { en: 'Why the startup fits, in the founder’s words.', el: 'Γιατί ταιριάζει η startup, με τα λόγια του ιδρυτή.' } },
    ],
    writes: true,
    invalidates: ['programs'],
    reversal: {
      // The programmes API has no withdraw: an application stays until the
      // organisation accepts or rejects it.
      kind: 'none',
      explanation: {
        en: 'There is no withdraw: the application stays with the organisation until they accept or reject it.',
        el: 'Δεν υπάρχει απόσυρση: η αίτηση μένει στον οργανισμό μέχρι να την εγκρίνει ή να την απορρίψει.',
      },
    },
    auditSubject: { param: 'programId', entityType: 'program' },
    navigatesOnSuccess: true,
    confirmLabel: { en: 'Send application', el: 'Υποβολή αίτησης' },
  },
  {
    id: 'send_invite',
    kind: 'mutation',
    label: { en: 'Invite someone to CoFounderBay', el: 'Πρόσκληση στο CoFounderBay' },
    description: {
      en: 'Email an invitation to join CoFounderBay to one address, with an optional personal note. Counts against the monthly invitation allowance.',
      el: 'Στέλνει με email πρόσκληση για το CoFounderBay σε μία διεύθυνση, με προαιρετικό προσωπικό σημείωμα. Μετρά στο μηνιαίο όριο προσκλήσεων.',
    },
    params: [
      { name: 'email', type: 'string', required: true, description: { en: 'The address to invite.', el: 'Η διεύθυνση που προσκαλείται.' } },
      { name: 'message', type: 'string', required: false, description: { en: 'A short personal note included in the email.', el: 'Σύντομο προσωπικό σημείωμα μέσα στο email.' } },
    ],
    writes: true,
    invalidates: ['invites'],
    reversal: {
      // InvitesService.createInvite queues the email; cancelInvite sets the
      // row to cancelled (pending only), which also returns it to the monthly
      // allowance because only pending and accepted invites count.
      kind: 'partial',
      explanation: {
        en: 'Cancelling voids the invitation link and returns it to your monthly allowance. The email has already been sent and cannot be recalled.',
        el: 'Η ακύρωση καταργεί τον σύνδεσμο της πρόσκλησης και την επιστρέφει στο μηνιαίο όριο. Το email έχει ήδη σταλεί και δεν ανακαλείται.',
      },
    },
    navigatesOnSuccess: true,
    confirmLabel: { en: 'Send invitation', el: 'Αποστολή πρόσκλησης' },
  },
  {
    id: 'write_endorsement',
    kind: 'mutation',
    label: { en: 'Endorse someone', el: 'Προσυπογραφή για κάποιον' },
    description: {
      en: 'Write an endorsement for another person, optionally for one skill. They are notified and choose whether it shows on their profile. The person must come from a prior search, shortlist or connections read.',
      el: 'Γράφει μια προσυπογραφή για άλλο άτομο, προαιρετικά για μία δεξιότητα. Ειδοποιείται και επιλέγει αν θα εμφανίζεται στο προφίλ του. Το άτομο πρέπει να προκύπτει από προηγούμενη αναζήτηση, λίστα ή συνδέσεις.',
    },
    params: [
      { name: 'userId', type: 'string', required: true, description: { en: 'Id of the person to endorse.', el: 'Το id του ατόμου.' } },
      { name: 'content', type: 'string', required: true, description: { en: 'The endorsement itself, in the writer’s words.', el: 'Το κείμενο της προσυπογραφής, με τα λόγια του συντάκτη.' } },
      { name: 'skill', type: 'string', required: false, description: { en: 'The skill it is for, if one.', el: 'Η δεξιότητα στην οποία αναφέρεται, αν υπάρχει.' } },
    ],
    writes: true,
    invalidates: ['endorsements'],
    reversal: {
      // EndorsementsService.createEndorsement notifies the recipient; the
      // giver may delete it (deleteEndorsement), which removes the row.
      kind: 'partial',
      explanation: {
        en: 'Deleting removes the endorsement from their list and profile. They were notified when you wrote it.',
        el: 'Η διαγραφή την αφαιρεί από τη λίστα και το προφίλ του. Έχει ήδη ειδοποιηθεί όταν τη γράψατε.',
      },
    },
    auditSubject: { param: 'userId', entityType: 'user' },
    confirmLabel: { en: 'Send endorsement', el: 'Αποστολή προσυπογραφής' },
  },
  {
    id: 'respond_to_mentor_request',
    kind: 'mutation',
    label: { en: 'Answer a mentoring request', el: 'Απάντηση σε αίτημα mentoring' },
    description: {
      en: 'Accept or decline a pending mentoring request the signed-in mentor received. Accepting starts a mentorship with that person.',
      el: 'Αποδέχεται ή απορρίπτει ένα εκκρεμές αίτημα mentoring που έλαβε ο μέντορας. Η αποδοχή ξεκινά mentoring με το άτομο.',
    },
    params: [
      { name: 'decision', type: 'string', required: true, enumValues: ['accept', 'decline'], description: { en: 'Accept or decline.', el: 'Αποδοχή ή απόρριψη.' } },
      { name: 'requestId', type: 'string', required: false, description: { en: 'Id of the request, from a prior read of mentoring requests.', el: 'Το id του αιτήματος, από προηγούμενη ανάγνωση αιτημάτων.' } },
      { name: 'requesterName', type: 'string', required: false, description: { en: 'Name of the person who asked, when the id is not known.', el: 'Όνομα του ατόμου που ζήτησε, όταν δεν είναι γνωστό το id.' } },
    ],
    writes: true,
    invalidates: ['mentorships', 'graph'],
    reversal: {
      // respondToMentorRequest refuses anything but a pending request, and on
      // accept creates the relationship, bumps the mentor's counts and fires
      // automation. There is no route back to pending.
      kind: 'none',
      explanation: {
        en: 'A request can be answered once. Accepting starts the mentorship and notifies them; declining closes the request for good.',
        el: 'Ένα αίτημα απαντιέται μία φορά. Η αποδοχή ξεκινά το mentoring και τους ειδοποιεί· η απόρριψη κλείνει το αίτημα οριστικά.',
      },
    },
    confirmLabel: { en: 'Send answer', el: 'Αποστολή απάντησης' },
  },
  // ── Wave D: forms as proposals. The assistant fills, the person submits ──
  {
    id: 'express_interest',
    kind: 'mutation',
    label: { en: 'Answer a need card', el: 'Απάντηση σε κάρτα ανάγκης' },
    description: {
      en: 'Send interest in someone else\u2019s need card (a co-founder seat, a role with equity or an investor introduction), with an optional one-line note. The note may not carry contact details. Writes only after confirmation.',
      el: 'Στέλνει ενδιαφέρον για την κάρτα ανάγκης κάποιου άλλου (θέση συνιδρυτή, ρόλος με equity ή σύσταση σε επενδυτή), με προαιρετικό σημείωμα μίας γραμμής χωρίς στοιχεία επικοινωνίας. Γράφει μόνο μετά από επιβεβαίωση.',
    },
    params: [
      {
        name: 'cardId',
        type: 'string',
        required: true,
        description: { en: 'Id of the need card, from a previous read.', el: 'Το id της κάρτας ανάγκης, από προηγούμενη ανάγνωση.' },
      },
      {
        name: 'note',
        type: 'string',
        required: false,
        description: { en: 'Why the user fits, in one line. No phone, email, links or handles.', el: 'Γιατί ταιριάζει ο χρήστης, σε μία γραμμή. Χωρίς τηλέφωνο, email, συνδέσμους ή λογαριασμούς.' },
      },
    ],
    writes: true,
    invalidates: ['commitments'],
    reversal: {
      // `DELETE /commitments/threads/:id/interest` (withdrawInterest): only
      // the candidate, only while the step is still `interest` (409 once the
      // author answers). The author was notified on arrival; that stays.
      kind: 'partial',
      explanation: {
        en: 'Withdraws the interest while the author has not answered, so it leaves their list. They were notified when it arrived, and once they accept it can no longer be withdrawn - only stepped back from.',
        el: 'Ανακαλεί το ενδιαφέρον όσο ο συντάκτης δεν έχει απαντήσει, ώστε να φύγει από τη λίστα του. Ειδοποιήθηκε όταν έφτασε, και μόλις το αποδεχτεί δεν ανακαλείται πια - μόνο αποχώρηση.',
      },
    },
    auditSubject: { param: 'cardId', entityType: 'need_card' },
    confirmLabel: { en: 'Send interest', el: 'Αποστολή ενδιαφέροντος' },
  },
  {
    id: 'close_need_card',
    kind: 'mutation',
    label: { en: 'Close a need card', el: 'Κλείσιμο κάρτας ανάγκης' },
    description: {
      en: 'Close one of the user\u2019s own need cards as filled or withdrawn. Responses stay as they are and nobody is notified.',
      el: 'Κλείνει μία από τις κάρτες ανάγκης του χρήστη ως καλυμμένη ή αποσυρμένη. Οι απαντήσεις μένουν ως έχουν και δεν ειδοποιείται κανείς.',
    },
    params: [
      {
        name: 'cardId',
        type: 'string',
        required: true,
        description: { en: 'Id of the user\u2019s own need card.', el: 'Το id της κάρτας ανάγκης του χρήστη.' },
      },
      {
        name: 'reason',
        type: 'string',
        required: false,
        enumValues: ['filled', 'withdrawn'],
        description: { en: 'filled when someone was found; withdrawn otherwise. Defaults to withdrawn.', el: 'filled όταν βρέθηκε κάποιος· withdrawn αλλιώς. Προεπιλογή: withdrawn.' },
      },
    ],
    writes: true,
    invalidates: ['commitments'],
    reversal: {
      // closeCard sets status, closedReason and settledAt and touches no
      // thread or notification; reopenCard clears the reason and settled
      // date, keeps the expiry unless it has passed, and recomputes the
      // outcome from the same untouched threads.
      kind: 'full',
      explanation: {
        en: 'Fully reversible. Reopening restores the card exactly as it was: the same outcome from the same responses, and nobody is notified either way.',
        el: 'Πλήρως αναστρέψιμο. Η επανενεργοποίηση επαναφέρει την κάρτα ακριβώς όπως ήταν: την ίδια έκβαση από τις ίδιες απαντήσεις, χωρίς ειδοποίηση σε κανέναν.',
      },
    },
    auditSubject: { param: 'cardId', entityType: 'need_card' },
    confirmLabel: { en: 'Close card', el: 'Κλείσιμο κάρτας' },
  },
  {
    id: 'draft_milestone',
    kind: 'mutation',
    label: { en: 'Draft a milestone', el: 'Πρόχειρο ορόσημο' },
    description: {
      en: 'Open the new-milestone form with fields filled in for the user to review and create. Saves nothing; use create_milestone only when the user asks for it to be saved directly.',
      el: 'Ανοίγει τη φόρμα νέου ορόσημου με συμπληρωμένα πεδία για να τα ελέγξει και να το δημιουργήσει ο χρήστης. Δεν αποθηκεύει τίποτα.',
    },
    params: [
      { name: 'title', type: 'string', required: true, description: { en: 'Short title of the milestone.', el: 'Σύντομος τίτλος του ορόσημου.' } },
      { name: 'description', type: 'string', required: false, description: { en: 'What done looks like.', el: 'Πώς φαίνεται η ολοκλήρωση.' } },
      { name: 'dueDate', type: 'string', required: false, description: { en: 'Due date as YYYY-MM-DD.', el: 'Προθεσμία ως ΕΕΕΕ-ΜΜ-ΗΗ.' } },
      { name: 'category', type: 'string', required: false, enumValues: ['product', 'fundraising', 'hiring', 'partnerships', 'growth', 'other'], description: { en: 'Area of the work.', el: 'Περιοχή της δουλειάς.' } },
      { name: 'priority', type: 'string', required: false, enumValues: ['low', 'medium', 'high'], description: { en: 'How urgent it is.', el: 'Πόσο επείγει.' } },
      { name: 'notes', type: 'string', required: false, description: { en: 'Private notes.', el: 'Ιδιωτικές σημειώσεις.' } },
    ],
    writes: false,
    invalidates: [],
    reversal: {
      // Nothing is written: the fields wait in the form until the person
      // presses its own submit button, and leaving the page discards them.
      kind: 'none',
      explanation: {
        en: 'Nothing is saved. The form opens with these fields filled; you review them and submit, or leave the page and nothing happens.',
        el: 'Δεν αποθηκεύεται τίποτα. Η φόρμα ανοίγει με αυτά τα πεδία συμπληρωμένα· τα ελέγχετε και υποβάλλετε, ή φεύγετε από τη σελίδα και δεν γίνεται τίποτα.',
      },
    },
    navigatesOnSuccess: true,
    confirmLabel: { en: 'Open filled form', el: 'Άνοιγμα συμπληρωμένης φόρμας' },
  },
  {
    id: 'draft_event',
    kind: 'mutation',
    label: { en: 'Draft an event', el: 'Πρόχειρη εκδήλωση' },
    description: {
      en: 'Open the create-event form with fields filled in for the user to review and publish. Saves nothing; use create_event only when the user asks for it to be published directly.',
      el: 'Ανοίγει τη φόρμα δημιουργίας εκδήλωσης με συμπληρωμένα πεδία για να τα ελέγξει και να τη δημοσιεύσει ο χρήστης. Δεν αποθηκεύει τίποτα.',
    },
    params: [
      { name: 'title', type: 'string', required: true, description: { en: 'Event title.', el: 'Τίτλος εκδήλωσης.' } },
      { name: 'description', type: 'string', required: false, description: { en: 'What happens and who it is for.', el: 'Τι γίνεται και για ποιους είναι.' } },
      { name: 'type', type: 'string', required: false, enumValues: ['meetup', 'webinar', 'workshop', 'demo_day', 'networking', 'other'], description: { en: 'Kind of event.', el: 'Είδος εκδήλωσης.' } },
      { name: 'startAt', type: 'string', required: false, description: { en: 'Start as local date and time, YYYY-MM-DDTHH:mm.', el: 'Έναρξη σε τοπική ώρα, ΕΕΕΕ-ΜΜ-ΗΗTΩΩ:λλ.' } },
      { name: 'endAt', type: 'string', required: false, description: { en: 'End as local date and time, YYYY-MM-DDTHH:mm.', el: 'Λήξη σε τοπική ώρα, ΕΕΕΕ-ΜΜ-ΗΗTΩΩ:λλ.' } },
      { name: 'location', type: 'string', required: false, description: { en: 'Venue or city.', el: 'Χώρος ή πόλη.' } },
      { name: 'isOnline', type: 'boolean', required: false, description: { en: 'True for an online event.', el: 'Αληθές για διαδικτυακή εκδήλωση.' } },
    ],
    writes: false,
    invalidates: [],
    reversal: {
      // Nothing is written: the fields wait in the form until the person
      // presses its own submit button, and leaving the page discards them.
      kind: 'none',
      explanation: {
        en: 'Nothing is saved. The form opens with these fields filled; you review them and submit, or leave the page and nothing happens.',
        el: 'Δεν αποθηκεύεται τίποτα. Η φόρμα ανοίγει με αυτά τα πεδία συμπληρωμένα· τα ελέγχετε και υποβάλλετε, ή φεύγετε από τη σελίδα και δεν γίνεται τίποτα.',
      },
    },
    navigatesOnSuccess: true,
    confirmLabel: { en: 'Open filled form', el: 'Άνοιγμα συμπληρωμένης φόρμας' },
  },
  {
    id: 'draft_project',
    kind: 'mutation',
    label: { en: 'Draft a project', el: 'Πρόχειρο project' },
    description: {
      en: 'Open the new-project form with its basics filled in for the user to review, complete and create. Saves nothing.',
      el: 'Ανοίγει τη φόρμα νέου project με τα βασικά συμπληρωμένα, για να τα ελέγξει, να τα ολοκληρώσει και να το δημιουργήσει ο χρήστης. Δεν αποθηκεύει τίποτα.',
    },
    params: [
      { name: 'name', type: 'string', required: true, description: { en: 'Project name.', el: 'Όνομα project.' } },
      { name: 'tagline', type: 'string', required: false, description: { en: 'One-line pitch.', el: 'Μονογραμμική περιγραφή.' } },
      { name: 'description', type: 'string', required: false, description: { en: 'What the project is.', el: 'Τι είναι το project.' } },
      { name: 'industry', type: 'string', required: false, description: { en: 'Industry, as the form lists them.', el: 'Κλάδος, όπως τον έχει η φόρμα.' } },
      { name: 'location', type: 'string', required: false, description: { en: 'Where the team is.', el: 'Πού βρίσκεται η ομάδα.' } },
      { name: 'website', type: 'string', required: false, description: { en: 'Website address.', el: 'Διεύθυνση ιστότοπου.' } },
    ],
    writes: false,
    invalidates: [],
    reversal: {
      // Nothing is written: the fields wait in the form until the person
      // presses its own submit button, and leaving the page discards them.
      kind: 'none',
      explanation: {
        en: 'Nothing is saved. The form opens with these fields filled; you review them and submit, or leave the page and nothing happens.',
        el: 'Δεν αποθηκεύεται τίποτα. Η φόρμα ανοίγει με αυτά τα πεδία συμπληρωμένα· τα ελέγχετε και υποβάλλετε, ή φεύγετε από τη σελίδα και δεν γίνεται τίποτα.',
      },
    },
    navigatesOnSuccess: true,
    confirmLabel: { en: 'Open filled form', el: 'Άνοιγμα συμπληρωμένης φόρμας' },
  },
  {
    id: 'draft_profile',
    kind: 'mutation',
    label: { en: 'Draft profile changes', el: 'Πρόχειρες αλλαγές προφίλ' },
    description: {
      en: 'Open the profile editor with some fields rewritten for the user to review and save. Saves nothing; use update_profile only when the user asks for the change to be saved directly.',
      el: 'Ανοίγει την επεξεργασία προφίλ με ορισμένα πεδία ξαναγραμμένα, για να τα ελέγξει και να τα αποθηκεύσει ο χρήστης. Δεν αποθηκεύει τίποτα.',
    },
    params: [
      { name: 'headline', type: 'string', required: false, description: { en: 'Profile headline.', el: 'Τίτλος προφίλ.' } },
      { name: 'bio', type: 'string', required: false, description: { en: 'Profile bio.', el: 'Βιογραφικό προφίλ.' } },
      { name: 'displayName', type: 'string', required: false, description: { en: 'Name shown to others.', el: 'Όνομα που βλέπουν οι άλλοι.' } },
      { name: 'location', type: 'string', required: false, description: { en: 'City or region.', el: 'Πόλη ή περιοχή.' } },
      { name: 'websiteUrl', type: 'string', required: false, description: { en: 'Personal or company website.', el: 'Προσωπικός ή εταιρικός ιστότοπος.' } },
      { name: 'linkedinUrl', type: 'string', required: false, description: { en: 'LinkedIn address.', el: 'Διεύθυνση LinkedIn.' } },
    ],
    writes: false,
    invalidates: [],
    reversal: {
      // Nothing is written: the fields wait in the form until the person
      // presses its own submit button, and leaving the page discards them.
      kind: 'none',
      explanation: {
        en: 'Nothing is saved. The form opens with these fields filled; you review them and submit, or leave the page and nothing happens.',
        el: 'Δεν αποθηκεύεται τίποτα. Η φόρμα ανοίγει με αυτά τα πεδία συμπληρωμένα· τα ελέγχετε και υποβάλλετε, ή φεύγετε από τη σελίδα και δεν γίνεται τίποτα.',
      },
    },
    navigatesOnSuccess: true,
    confirmLabel: { en: 'Open filled form', el: 'Άνοιγμα συμπληρωμένης φόρμας' },
  },
  {
    id: 'draft_need_card',
    kind: 'mutation',
    label: { en: 'Draft a need card', el: 'Πρόχειρη κάρτα ανάγκης' },
    description: {
      en: 'Open the two-minute need-card guide with its fields filled: one sentence on what already exists, one on the outcome, one on the person who is missing, and the offer (role, equity, hours a week, scope) with category, place, stage and commitment. Saves nothing; the person reads the checks and publishes.',
      el: 'Ανοίγει τον οδηγό δύο λεπτών για κάρτα ανάγκης με τα πεδία συμπληρωμένα: μία πρόταση για ό,τι υπάρχει ήδη, μία για το αποτέλεσμα, μία για το πρόσωπο που λείπει, και η προσφορά (ρόλος, equity, ώρες την εβδομάδα, εύρος) με κατηγορία, τόπο, στάδιο και δέσμευση. Δεν αποθηκεύει τίποτα· ο χρήστης βλέπει τους ελέγχους και δημοσιεύει.',
    },
    params: [
      { name: 'kind', type: 'string', required: false, enumValues: ['cofounder', 'equity_role', 'investor_intro'], description: { en: 'Kind of commitment.', el: 'Είδος δέσμευσης.' } },
      { name: 'title', type: 'string', required: false, description: { en: 'Short title.', el: 'Σύντομος τίτλος.' } },
      { name: 'exists', type: 'string', required: false, description: { en: 'One sentence on what already exists.', el: 'Μία πρόταση για ό,τι υπάρχει ήδη.' } },
      { name: 'goal', type: 'string', required: false, description: { en: 'One sentence on the outcome it is for.', el: 'Μία πρόταση για το αποτέλεσμα.' } },
      { name: 'missing', type: 'string', required: false, description: { en: 'One sentence on the person who is missing.', el: 'Μία πρόταση για το πρόσωπο που λείπει.' } },
      { name: 'offerRole', type: 'string', required: false, description: { en: 'The role offered.', el: 'Ο ρόλος που προσφέρεται.' } },
      { name: 'offerEquity', type: 'string', required: false, description: { en: 'The equity offered, e.g. 8–12%.', el: 'Το equity που προσφέρεται, π.χ. 8–12%.' } },
      { name: 'offerHours', type: 'string', required: false, description: { en: 'Hours a week, as a number.', el: 'Ώρες την εβδομάδα, ως αριθμός.' } },
      { name: 'offerScope', type: 'string', required: false, description: { en: 'The scope of the role.', el: 'Το εύρος του ρόλου.' } },
      { name: 'category', type: 'string', required: false, description: { en: 'Category, e.g. B2B SaaS.', el: 'Κατηγορία, π.χ. B2B SaaS.' } },
      { name: 'place', type: 'string', required: false, description: { en: 'City or region.', el: 'Πόλη ή περιοχή.' } },
      { name: 'stage', type: 'string', required: false, enumValues: ['idea', 'validating', 'building', 'launched', 'scaling'], description: { en: 'Stage of the startup.', el: 'Στάδιο της startup.' } },
      { name: 'commitment', type: 'string', required: false, enumValues: ['full_time', 'part_time', 'advisory', 'flexible'], description: { en: 'Time commitment.', el: 'Χρονική δέσμευση.' } },
    ],
    writes: false,
    invalidates: [],
    reversal: {
      // Nothing is written: the fields wait in the guide until the person
      // presses Publish, and leaving the page discards them.
      kind: 'none',
      explanation: {
        en: 'Nothing is saved. The guide opens with these fields filled; you review them and publish, or leave the page and nothing happens.',
        el: 'Δεν αποθηκεύεται τίποτα. Ο οδηγός ανοίγει με αυτά τα πεδία συμπληρωμένα· τα ελέγχετε και δημοσιεύετε, ή φεύγετε από τη σελίδα και δεν γίνεται τίποτα.',
      },
    },
    navigatesOnSuccess: true,
    confirmLabel: { en: 'Open filled guide', el: 'Άνοιγμα συμπληρωμένου οδηγού' },
  },
  {
    id: 'follow_person',
    kind: 'mutation',
    label: { en: 'Follow a person\u2019s updates', el: 'Παρακολούθηση ενημερώσεων ατόμου' },
    description: {
      en: 'Follow a founder, mentor or investor so the updates they write reach the signed-in user on /updates and in notifications. Writes only after confirmation.',
      el: 'Ακολουθεί έναν ιδρυτή, μέντορα ή επενδυτή ώστε οι ενημερώσεις που γράφει να φτάνουν στον χρήστη στο /updates και στις ειδοποιήσεις. Γράφει μόνο μετά από επιβεβαίωση.',
    },
    params: [
      {
        name: 'userId',
        type: 'string',
        required: true,
        description: {
          en: 'Id of the person to follow. Must come from a prior search or recommendation result.',
          el: 'Το id του ατόμου. Πρέπει να προέρχεται από προηγούμενη αναζήτηση ή πρόταση.',
        },
      },
    ],
    writes: true,
    invalidates: ['follows'],
    reversal: {
      // `DELETE /api/follows/:userId` runs `userFollow.deleteMany`, so the row
      // is gone; but a first follow already notified the person that someone
      // new follows them (founder-updates.service follow), and that stays.
      kind: 'partial',
      explanation: {
        en: 'Unfollowing removes the follow at once. The person was already told that someone new follows them (not who), and that notice stays.',
        el: 'Η διακοπή αφαιρεί αμέσως την παρακολούθηση. Το άτομο έχει ήδη ενημερωθεί ότι κάποιος νέος το ακολουθεί (όχι ποιος), και αυτή η ειδοποίηση μένει.',
      },
    },
    auditSubject: { param: 'userId', entityType: 'user' },
    confirmLabel: { en: 'Follow', el: 'Ακολούθηση' },
  },
  {
    id: 'draft_founder_update',
    kind: 'mutation',
    label: { en: 'Draft a founder update', el: 'Πρόχειρη ενημέρωση ιδρυτή' },
    description: {
      en: 'Open the update composer on /updates with a title and body filled in, and whether it should be public (its own link, made for LinkedIn) or for followers only. Sends nothing; the founder reads it, adds figures and asks, and presses Send.',
      el: 'Ανοίγει τη σύνταξη ενημέρωσης στο /updates με τίτλο και κείμενο συμπληρωμένα, και αν θα είναι δημόσια (δικός της σύνδεσμος, για το LinkedIn) ή μόνο για ακολούθους. Δεν στέλνει τίποτα· ο ιδρυτής τη διαβάζει, προσθέτει μεγέθη και αιτήματα και πατά Αποστολή.',
    },
    params: [
      { name: 'title', type: 'string', required: false, description: { en: 'Short title, e.g. “September: two pilots live”.', el: 'Σύντομος τίτλος, π.χ. «Σεπτέμβριος: δύο πιλοτικά σε λειτουργία».' } },
      { name: 'body', type: 'string', required: false, description: { en: 'What moved since the last update, in a few sentences. No promised returns.', el: 'Τι προχώρησε από την προηγούμενη ενημέρωση, σε λίγες προτάσεις. Χωρίς υποσχέσεις αποδόσεων.' } },
      { name: 'visibility', type: 'string', required: false, enumValues: ['followers', 'public'], description: { en: 'followers (default) or public.', el: 'followers (προεπιλογή) ή public.' } },
    ],
    writes: false,
    invalidates: [],
    reversal: {
      // Nothing is written: the composer waits until the founder presses Send.
      kind: 'none',
      explanation: {
        en: 'Nothing is sent. The composer opens with these fields filled; you review them and send, or leave the page and nothing happens.',
        el: 'Δεν στέλνεται τίποτα. Η σύνταξη ανοίγει με αυτά τα πεδία συμπληρωμένα· τα ελέγχετε και στέλνετε, ή φεύγετε από τη σελίδα και δεν γίνεται τίποτα.',
      },
    },
    navigatesOnSuccess: true,
    confirmLabel: { en: 'Open filled composer', el: 'Άνοιγμα συμπληρωμένης σύνταξης' },
  },
  {
    id: 'request_intro',
    kind: 'mutation',
    label: { en: 'Ask for an introduction', el: 'Αίτημα σύστασης γνωριμίας' },
    description: {
      en: 'Ask someone the user knows to introduce them to a person that intermediary also knows, for one of the user\u2019s open need cards. Use the intermediary and card ids get_intros returned for that target. The intermediary is notified and decides whether to forward it; nothing reaches the target until they do.',
      el: 'Ζητά από κάποιον που γνωρίζει ο χρήστης να τον συστήσει σε πρόσωπο που γνωρίζει κι εκείνος, για μία από τις ανοιχτές κάρτες ανάγκης του χρήστη. Χρησιμοποιήστε τα id ενδιαμέσου και κάρτας που επέστρεψε το get_intros. Ο ενδιάμεσος ειδοποιείται και αποφασίζει αν θα την προωθήσει.',
    },
    params: [
      { name: 'targetId', type: 'string', required: true, description: { en: 'Id of the person to be introduced to.', el: 'Το id του προσώπου στο οποίο ζητείται η σύσταση.' } },
      { name: 'intermediaryId', type: 'string', required: true, description: { en: 'Id of the person who would introduce them, from get_intros.', el: 'Το id του ενδιαμέσου, από το get_intros.' } },
      { name: 'cardId', type: 'string', required: true, description: { en: 'Id of the user\u2019s own open need card, from get_intros.', el: 'Το id της ανοιχτής κάρτας ανάγκης του χρήστη, από το get_intros.' } },
      { name: 'note', type: 'string', required: true, description: { en: 'One or two sentences: why this introduction, and why now. No email, phone or promised returns.', el: 'Μία-δύο προτάσεις: γιατί αυτή η σύσταση και γιατί τώρα. Χωρίς email, τηλέφωνο ή υποσχέσεις αποδόσεων.' } },
    ],
    writes: true,
    invalidates: ['intros'],
    reversal: {
      // `DELETE /intros/:id` (IntrosService.withdraw) is allowed only to the
      // requester and only while the status is pending; the intermediary was
      // notified when it arrived and that notice stays.
      kind: 'partial',
      explanation: {
        en: 'You can withdraw it until the intermediary answers. They were already notified that you asked.',
        el: 'Μπορείτε να την αποσύρετε μέχρι να απαντήσει ο ενδιάμεσος. Έχει ήδη ειδοποιηθεί ότι τη ζητήσατε.',
      },
    },
    auditSubject: { param: 'targetId', entityType: 'user' },
    confirmLabel: { en: 'Send to the intermediary', el: 'Αποστολή στον ενδιάμεσο' },
  },
  {
    id: 'set_open_to',
    kind: 'mutation',
    label: { en: 'Set what you are open to', el: 'Ορισμός του «Ανοιχτός/ή σε»' },
    description: {
      en: 'Save the user\u2019s quiet "Open to" signal: kinds (comma-separated: cofounder, advisor, angel, mentor), who sees it (nobody = matching only, verified, everyone) and an optional short note. It lifts them in matching for people looking for exactly that, and lasts 90 days.',
      el: 'Αποθηκεύει το ήσυχο σήμα «Ανοιχτός/ή σε» του χρήστη: είδη (χωρισμένα με κόμμα: cofounder, advisor, angel, mentor), ποιος το βλέπει (nobody = μόνο αντιστοιχίσεις, verified, everyone) και προαιρετική σύντομη σημείωση. Τον ανεβάζει στις αντιστοιχίσεις όσων ψάχνουν ακριβώς αυτό, για 90 ημέρες.',
    },
    params: [
      { name: 'kinds', type: 'string', required: true, description: { en: 'Comma-separated: cofounder, advisor, angel, mentor.', el: 'Χωρισμένα με κόμμα: cofounder, advisor, angel, mentor.' } },
      { name: 'visibility', type: 'string', required: false, enumValues: ['nobody', 'verified', 'everyone'], description: { en: 'Who sees it. Defaults to nobody (matching only).', el: 'Ποιος το βλέπει. Προεπιλογή: nobody (μόνο αντιστοιχίσεις).' } },
      { name: 'note', type: 'string', required: false, description: { en: 'Optional short note, no contact details.', el: 'Προαιρετική σύντομη σημείωση, χωρίς στοιχεία επικοινωνίας.' } },
    ],
    writes: true,
    invalidates: ['open_to'],
    reversal: {
      // `PUT /open-to/me` replaces the signal and restarts its 90 days;
      // `DELETE /open-to/me` removes it. Undo puts back what was there: no
      // signal is restored exactly, a previous one with a fresh 90 days.
      kind: 'partial',
      explanation: {
        en: 'Undo puts back your previous choice. If you had one, its 90 days start again; nobody was notified either way.',
        el: 'Η αναίρεση επαναφέρει την προηγούμενη επιλογή σας. Αν υπήρχε, οι 90 ημέρες της ξεκινούν από την αρχή· δεν ειδοποιείται κανείς.',
      },
    },
    confirmLabel: { en: 'Save', el: 'Αποθήκευση' },
  },
  {
    id: 'link_skill_evidence',
    kind: 'mutation',
    label: { en: 'Link evidence to a skill', el: 'Σύνδεση τεκμηρίου με δεξιότητα' },
    description: {
      en: 'Link one of the user\u2019s own completed items (a milestone, a builder document or an agreed commitment, by the kind and id get_skill_evidence returned) to a skill on their profile, so the profile shows where the skill was applied.',
      el: 'Συνδέει ένα από τα ολοκληρωμένα στοιχεία του χρήστη (ορόσημο, έγγραφο του builder ή συμφωνημένη δέσμευση, με το είδος και το id που επέστρεψε το get_skill_evidence) με μια δεξιότητα του προφίλ του, ώστε το προφίλ να δείχνει πού εφαρμόστηκε.',
    },
    params: [
      { name: 'skillName', type: 'string', required: true, description: { en: 'The skill, as it reads on the profile.', el: 'Η δεξιότητα, όπως γράφεται στο προφίλ.' } },
      { name: 'kind', type: 'string', required: true, enumValues: ['milestone', 'builder_document', 'agreement'], description: { en: 'What the evidence is.', el: 'Τι είναι το τεκμήριο.' } },
      { name: 'refId', type: 'string', required: true, description: { en: 'Id of the item, from get_skill_evidence.', el: 'Το id του στοιχείου, από το get_skill_evidence.' } },
    ],
    writes: true,
    invalidates: ['skill_evidence'],
    reversal: {
      // `DELETE /skill-evidence/:id` removes exactly the row the link created
      // (SkillEvidenceService.unlink, owner only); nobody is notified.
      kind: 'full',
      explanation: {
        en: 'Fully reversible. Removing it deletes only this link, and nobody is notified either way.',
        el: 'Πλήρως αναστρέψιμο. Η αφαίρεση διαγράφει μόνο αυτή τη σύνδεση και δεν ειδοποιείται κανείς.',
      },
    },
    confirmLabel: { en: 'Link', el: 'Σύνδεση' },
  },
  {
    id: 'run_scout',
    kind: 'mutation',
    label: { en: 'Run the co-founder scout', el: 'Εκτέλεση του ανιχνευτή συνιδρυτών' },
    description: {
      en: 'Run the founder\u2019s scout now against their saved brief. It adds up to five proposals to their own list, with reasons and a draft note; it messages, connects or notifies nobody.',
      el: 'Τρέχει τώρα τον ανιχνευτή με το αποθηκευμένο σημείωμα. Προσθέτει έως πέντε προτάσεις στη λίστα του ιδρυτή, με λόγους και πρόχειρο σημείωμα· δεν στέλνει μήνυμα, αίτημα ή ειδοποίηση σε κανέναν.',
    },
    params: [],
    writes: true,
    invalidates: ['scout'],
    reversal: {
      // ScoutService.run only creates proposals on the founder's own list
      // (ScoutProposal rows); there is no route that deletes them, and a
      // dismissal is a different state, so nothing restores "never run".
      kind: 'none',
      explanation: {
        en: 'Running only adds proposals to your own list and contacts nobody. Dismiss any you do not want; dismissed people are not proposed again.',
        el: 'Η εκτέλεση μόνο προσθέτει προτάσεις στη δική σας λίστα και δεν επικοινωνεί με κανέναν. Απορρίψτε όσες δεν θέλετε· όσοι απορρίπτονται δεν ξαναπροτείνονται.',
      },
    },
    roles: ['founder', 'admin', 'super_admin'],
    confirmLabel: { en: 'Run the scout', el: 'Εκτέλεση' },
  },
  {
    id: 'draft_scout_brief',
    kind: 'mutation',
    label: { en: 'Draft a scout brief', el: 'Πρόχειρο σημείωμα ανιχνευτή' },
    description: {
      en: 'Open the co-founder scout with its brief filled in: the role, skills (comma-separated), place, commitment and stage the founder is looking for. Saves nothing; the founder reviews it and presses Save brief.',
      el: 'Ανοίγει τον ανιχνευτή συνιδρυτών με το σημείωμα συμπληρωμένο: ρόλος, δεξιότητες (χωρισμένες με κόμμα), τόπος, δέσμευση και στάδιο. Δεν αποθηκεύει τίποτα· ο ιδρυτής το ελέγχει και πατά Αποθήκευση.',
    },
    params: [
      { name: 'role', type: 'string', required: true, description: { en: 'The role sought, e.g. Technical co-founder.', el: 'Ο ρόλος, π.χ. Τεχνικός συνιδρυτής.' } },
      { name: 'skills', type: 'string', required: false, description: { en: 'Comma-separated skills.', el: 'Δεξιότητες χωρισμένες με κόμμα.' } },
      { name: 'place', type: 'string', required: false, description: { en: 'City or region.', el: 'Πόλη ή περιοχή.' } },
      { name: 'commitment', type: 'string', required: false, enumValues: ['full_time', 'part_time', 'advisory', 'flexible'], description: { en: 'Time commitment.', el: 'Χρονική δέσμευση.' } },
      { name: 'stage', type: 'string', required: false, enumValues: ['idea', 'validating', 'building', 'launched', 'scaling'], description: { en: 'Stage of the startup.', el: 'Στάδιο της startup.' } },
      { name: 'note', type: 'string', required: false, description: { en: 'Anything else, briefly. No contact details.', el: 'Κάτι ακόμη, σύντομα. Χωρίς στοιχεία επικοινωνίας.' } },
    ],
    writes: false,
    invalidates: [],
    reversal: {
      kind: 'none',
      explanation: {
        en: 'Nothing is saved. The scout opens with the brief filled in; you review it and save, or leave the page and nothing happens.',
        el: 'Δεν αποθηκεύεται τίποτα. Ο ανιχνευτής ανοίγει με το σημείωμα συμπληρωμένο· το ελέγχετε και αποθηκεύετε, ή φεύγετε και δεν γίνεται τίποτα.',
      },
    },
    navigatesOnSuccess: true,
    confirmLabel: { en: 'Open filled brief', el: 'Άνοιγμα συμπληρωμένου σημειώματος' },
  },
  {
    id: 'canvas_command',
    kind: 'mutation',
    label: { en: 'Run a research canvas command', el: 'Εντολή στον καμβά έρευνας' },
    description: {
      en: 'Perform one canvas step the founder could also click: add a note, capture a question or hypothesis, connect, align, group, style, format note text (bold, lists, find/replace, citation, word count), merge or split notes, export, or link a node to Builder, Readiness or milestones. The open canvas runs it live; otherwise the user is taken to Research so the same step can land.',
      el: 'Εκτελεί ένα βήμα του καμβά που ο ιδρυτής θα μπορούσε και να πατήσει: σημείωση, ερώτηση ή υπόθεση, σύνδεση, στοίχιση, ομάδα, στυλ, μορφοποίηση κειμένου σημείωσης (έντονα, λίστες, εύρεση/αντικατάσταση, παραπομπή, πλήθος λέξεων), ένωση ή διαίρεση σημειώσεων, εξαγωγή, ή σύνδεση κόμβου με Builder, Ετοιμότητα ή ορόσημα. Ο ανοιχτός καμβάς το τρέχει ζωντανά· αλλιώς ο χρήστης πηγαίνει στην Έρευνα ώστε το ίδιο βήμα να εφαρμοστεί.',
    },
    params: [
      {
        name: 'op',
        type: 'string',
        required: true,
        enumValues: CANVAS_COMMAND_OPS,
        description: {
          en: 'Which canvas step to run. Same ids the toolbar uses.',
          el: 'Ποιο βήμα καμβά θα τρέξει. Τα ίδια id με την εργαλειοθήκη.',
        },
      },
      {
        name: 'boardId',
        type: 'string',
        required: false,
        description: {
          en: 'Research board to act on, when the user is not already on one.',
          el: 'Πίνακας έρευνας, όταν ο χρήστης δεν είναι ήδη σε έναν.',
        },
      },
      {
        name: 'title',
        type: 'string',
        required: false,
        description: {
          en: 'Title for a new note, or the note to select / connect from.',
          el: 'Τίτλος νέας σημείωσης, ή της σημείωσης προς επιλογή / σύνδεση.',
        },
      },
      {
        name: 'content',
        type: 'string',
        required: false,
        description: {
          en: 'Body text for a new note.',
          el: 'Κείμενο σώματος για νέα σημείωση.',
        },
      },
      {
        name: 'nodeType',
        type: 'string',
        required: false,
        description: {
          en: 'For capture: question, hypothesis, evidence or insight. For convert_type, the target type.',
          el: 'Για καταγραφή: question, hypothesis, evidence ή insight. Για convert_type, ο τύπος-στόχος.',
        },
      },
      {
        name: 'fromTitle',
        type: 'string',
        required: false,
        description: {
          en: 'Title of the node to connect from.',
          el: 'Τίτλος του κόμβου από τον οποίο ξεκινά η σύνδεση.',
        },
      },
      {
        name: 'toTitle',
        type: 'string',
        required: false,
        description: {
          en: 'Title of the node to connect to.',
          el: 'Τίτλος του κόμβου προς τον οποίο καταλήγει η σύνδεση.',
        },
      },
      {
        name: 'align',
        type: 'string',
        required: false,
        description: {
          en: 'Alignment: left, right, top, bottom, h (distribute horizontally) or v (vertically).',
          el: 'Στοίχιση: left, right, top, bottom, h (οριζόντια κατανομή) ή v (κάθετα).',
        },
      },
      {
        name: 'fill',
        type: 'string',
        required: false,
        description: {
          en: 'Fill colour for set_style, e.g. #FDE68A.',
          el: 'Χρώμα γεμίσματος για set_style, π.χ. #FDE68A.',
        },
      },
      {
        name: 'query',
        type: 'string',
        required: false,
        description: {
          en: 'Find query, replace text, note format (bold/italic/heading/…), layer name, zoom mode (in/out/reset), export format (json/outline/png), or layout algorithm.',
          el: 'Αναζήτηση, κείμενο αντικατάστασης, μορφή σημείωσης (bold/italic/heading/…), όνομα επιπέδου, zoom (in/out/reset), μορφή εξαγωγής (json/outline/png) ή αλγόριθμος διάταξης.',
        },
      },
      {
        name: 'href',
        type: 'string',
        required: false,
        description: {
          en: 'URL for insert_link, or a product path to link a node to (e.g. /builder or /readiness).',
          el: 'URL για insert_link, ή διαδρομή προϊόντος για σύνδεση κόμβου (π.χ. /builder ή /readiness).',
        },
      },
    ],
    writes: true,
    invalidates: ['research'],
    reversal: {
      // The live canvas has its own undo stack. Chat undo is handed the
      // original payload and never a snapshot, so it cannot restore nodes it
      // did not identify. Canvas undo (Ctrl+Z) is the honest reverse.
      kind: 'none',
      explanation: {
        en: 'The canvas keeps its own undo history. Chat cannot reverse a step it did not snapshot; use Undo on the board (Ctrl+Z) for the last move, alignment or style change.',
        el: 'Ο καμβάς κρατά τη δική του ιστορία αναίρεσης. Το chat δεν μπορεί να αντιστρέψει βήμα χωρίς στιγμιότυπο· χρησιμοποίησε Αναίρεση στον πίνακα (Ctrl+Z) για την τελευταία μετακίνηση, στοίχιση ή αλλαγή στυλ.',
      },
    },
    auditSubject: { param: 'op', entityType: 'research_canvas' },
    navigatesOnSuccess: true,
    confirmLabel: { en: 'Run on canvas', el: 'Εκτέλεση στον καμβά' },
  },
] as const satisfies readonly ActionDeclaration[];

export type DeclaredAction = (typeof ACTION_DECLARATIONS)[number];

/** Every capability id, as a literal union rather than `string`. */
export type DeclaredActionId = DeclaredAction['id'];

/** The subset that changes something; the only ids that need an executor. */
export type MutationActionId = Extract<DeclaredAction, { kind: 'mutation' }>['id'];

/**
 * The subset that answers a question.
 *
 * Derived for the same reason `MutationActionId` is: the web app keys its
 * readers by it, so a read declared here and left unimplemented there stops
 * compiling rather than reaching a model that can ask for it and get nothing.
 */
export type ReadActionId = Extract<DeclaredAction, { kind: 'read' }>['id'];

/**
 * The subset that claims it can be taken back. An app that binds undos to
 * this type cannot claim reversibility without shipping the implementation,
 * which is the guarantee that survived moving the declaration out of the app.
 */
export type UndoableActionId = Extract<
  DeclaredAction,
  { reversal: { kind: 'full' | 'partial' } }
>['id'];

export function listActionIds(): readonly DeclaredActionId[] {
  return ACTION_DECLARATIONS.map((action) => action.id);
}

/**
 * Returns the widened shape, not the literal union member.
 *
 * `as const` gives the read actions no `reversal` key at all, so a consumer
 * that reads `spec.reversal?.kind` cannot dot into the union. The literal
 * types exist for deriving `MutationActionId` and `UndoableActionId`; every
 * other caller wants `ActionDeclaration`, where the optional fields are
 * optional rather than absent.
 */
export function listDeclarations(): readonly ActionDeclaration[] {
  return ACTION_DECLARATIONS;
}

export function getActionDeclaration(id: string): ActionDeclaration | undefined {
  return listDeclarations().find((action) => action.id === id);
}

/**
 * The server uses this to reject a tool name a model invented, rather than
 * trusting whatever arrived on the request.
 */
export function isDeclaredAction(id: string): id is DeclaredActionId {
  return ACTION_DECLARATIONS.some((action) => action.id === id);
}

/**
 * Derives the model-facing catalogue from the declarations.
 *
 * Both apps call this, so the tools a model is offered and the tools the
 * server will accept are the same list by construction rather than by review.
 */
/**
 * Whether a user with this platform role may use the capability. An unknown
 * role (a caller without one) is refused only for role-limited capabilities.
 */
export function canUseAction(id: string, role: string | null | undefined): boolean {
  const declaration = getActionDeclaration(id);
  if (!declaration) return false;
  if (!declaration.roles || declaration.roles.length === 0) return true;
  return Boolean(role) && (declaration.roles as readonly string[]).includes(role as string);
}

export function toToolCatalog(role?: string | null): ToolCatalogEntry[] {
  // Widened on purpose. `as const` is there so ids and reversal kinds stay
  // literal for the apps, but it also narrows `params` to exactly the fields
  // the current entries happen to use — and none of them use `enumValues`
  // yet, so reading it off the literal type does not compile.
  const declarations: readonly ActionDeclaration[] = ACTION_DECLARATIONS;

  // A model is offered only what its caller may use. Without a role (a
  // catalogue requested for documentation), every capability is listed.
  const offered = role === undefined ? declarations : declarations.filter((action) => canUseAction(action.id, role));

  return offered.map((action) => ({
    type: 'function' as const,
    function: {
      name: action.id,
      description: action.description.en,
      parameters: {
        type: 'object' as const,
        properties: Object.fromEntries(
          action.params.map((param) => [
            param.name,
            {
              type: param.type,
              description: param.description.en,
              ...(param.enumValues ? { enum: param.enumValues } : {}),
            },
          ]),
        ),
        required: action.params.filter((param) => param.required).map((param) => param.name),
      },
    },
  }));
}
