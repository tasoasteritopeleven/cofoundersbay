'use client';

import type { ReactNode } from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { HelpCallout } from '@/components/common/HelpCallout';
import { useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';

type PageContextualHelpProps = {
  /** Override registry help id */
  id?: string;
  title?: string;
  titleEl?: string;
  children?: ReactNode;
  defaultOpen?: boolean;
  compact?: boolean;
  /** Size/weight for the help title only. */
  titleClassName?: string;
};

type HelpCopy = { en: ReactNode; el: ReactNode };

/**
 * Curated copy per page — concrete, actionable, no marketing fluff.
 * Falls back to the page description when no curated copy exists.
 *
 * Each entry carries both languages and the reader gets whichever is their
 * primary. Unlike a label, prose cannot be shown as `English · Ελληνικά` on one
 * line — two paragraphs paired inline read as a single run-on, so the choice is
 * made here rather than by `BilingualText`.
 */
const HELP_CONTENT: Record<string, HelpCopy> = {
  builder: {
    en: (
      <>
        <p>
          The Builder turns scattered notes into investor-ready artefacts. Move through the stage tabs:{' '}
          <strong>Idea Core → Market → Business Model → MVP → Financials → Pitch</strong>. Progress unlocks Pitch Deck
          and Applications. Invite collaborators and keep Version History for rollbacks.
        </p>
        <p>
          Use <em>New Document</em> for artefacts, or <em>Ask AI</em> to draft a section and suggest what to complete next.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Ο Builder μετατρέπει διάσπαρτες σημειώσεις σε υλικό για επενδυτές. Προχωρήστε στις καρτέλες:{' '}
          <strong>Πυρήνας ιδέας → Αγορά → Επιχειρηματικό μοντέλο → MVP → Οικονομικά → Pitch</strong>. Η πρόοδος
          ξεκλειδώνει Pitch Deck και Αιτήσεις. Προσκαλέστε συνεργάτες και κρατήστε Ιστορικό εκδόσεων για επαναφορά.
        </p>
        <p>
          Με το <em>Νέο έγγραφο</em> προσθέτετε παραδοτέα, ή <em>Ρωτήστε το AI</em> για προσχέδιο ενότητας και τι να
          ολοκληρώσετε μετά.
        </p>
      </>
    ),
  },
  'pitch-deck': {
    en: (
      <>
        <p>
          This page edits the same <strong>pitch_deck</strong> artefact as the Pitch tab in Startup Builder. Completion is
          the share of slides that have body text — adding empty templates does not raise the bar.
        </p>
        <p>
          Use <em>AI Generate</em> for a full outline, or <em>Ask AI</em> to draft the current slide from Idea Core, Market,
          and Financials. <em>Export</em> downloads Markdown. Save writes back to the workspace.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Αυτή η σελίδα επεξεργάζεται το ίδιο παραδοτέο <strong>pitch_deck</strong> με την καρτέλα Pitch στον Startup Builder.
          Η ολοκλήρωση είναι το μερίδιο διαφανειών με κείμενο — τα κενά πρότυπα δεν ανεβάζουν τη μπάρα.
        </p>
        <p>
          Με <em>Δημιουργία AI</em> παίρνετε πλήρες περίγραμμα, ή <em>Ρωτήστε το AI</em> για προσχέδιο της τρέχουσας
          διαφάνειας από Ιδέα, Αγορά και Οικονομικά. Η <em>Εξαγωγή</em> κατεβάζει Markdown. Η αποθήκευση γράφει στον χώρο εργασίας.
        </p>
      </>
    ),
  },
  applications: {
    en: (
      <>
        <p>
          This page edits the same <strong>application</strong> artefact as the Applications tab in Startup Builder. Four
          templates stay on the page — Y Combinator, Techstars, university incubator, and grants. Completion is the share
          of <em>required</em> answers filled; optional questions do not hold the bar.
        </p>
        <p>
          Use <em>AI Generate</em> to fill empty answers only in the open programme, or <em>Ask AI</em> to draft from
          your Idea Core, research boards and saved round details — it asks for anything missing rather than inventing
          figures. Save writes this workspace artefact. <em>Mark submitted</em> appears when
          every required field is filled. View Program opens the real application page.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Αυτή η σελίδα επεξεργάζεται το ίδιο παραδοτέο <strong>application</strong> με την καρτέλα Αιτήσεις στον Startup
          Builder. Τα τέσσερα πρότυπα μένουν στη σελίδα — Y Combinator, Techstars, πανεπιστημιακό incubator και
          επιχορηγήσεις. Η ολοκλήρωση είναι το μερίδιο <em>υποχρεωτικών</em> απαντήσεων· οι προαιρετικές δεν κρατούν τη μπάρα.
        </p>
        <p>
          Με <em>Δημιουργία AI</em> γεμίζετε μόνο κενές απαντήσεις στο ανοιχτό πρόγραμμα, ή με <em>Ρωτήστε το AI</em>
          συντάσσετε από τον Πυρήνα ιδέας, τους πίνακες έρευνας και τα αποθηκευμένα στοιχεία του γύρου σας — ρωτά ό,τι
          λείπει αντί να επινοεί αριθμούς. Η αποθήκευση γράφει σε αυτό το παραδοτέο. Η
          <em>Σήμανση υποβολής</em> εμφανίζεται όταν όλα τα υποχρεωτικά πεδία έχουν απάντηση. Το «Προβολή προγράμματος»
          ανοίγει την πραγματική αίτηση.
        </p>
      </>
    ),
  },
  ai: {
    en: (
      <>
        <p>
          This is the full-page assistant — the same tools as the popup. It reads your matches, research boards,
          fundraising pipeline, calendar and Builder artefacts — your workspace, not a sample. Writes (shortlist,
          connect, message) wait for your confirmation.
        </p>
        <p>
          Look-up rows run immediately. Amber rows write, and each one asks first. <em>What I can do</em> lists every
          capability. Threads on the left keep past questions. <em>I can read</em> opens workspace pages this copilot
          actually reads — Matches, Research, Fundraising, Calendar, Builder, or Applications.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Αυτός είναι ο βοηθός πλήρους σελίδας — τα ίδια εργαλεία με το αναδυόμενο. Διαβάζει τις αντιστοιχίσεις σας, τους
          πίνακες έρευνας, το pipeline χρηματοδότησης, το ημερολόγιο και τα παραδοτέα του Builder — τον δικό σας χώρο
          εργασίας, όχι δείγμα. Οι εγγραφές (λίστα, σύνδεση, μήνυμα) περιμένουν την επιβεβαίωσή σας.
        </p>
        <p>
          Οι γραμμές αναζήτησης τρέχουν αμέσως. Οι πορτοκαλί γράφουν και ρωτούν πρώτα. Το <em>Τι μπορώ να κάνω</em>{' '}
          απαριθμεί κάθε δυνατότητα. Τα νήματα αριστερά κρατούν προηγούμενες ερωτήσεις. Το <em>Μπορώ να διαβάσω</em>{' '}
          ανοίγει σελίδες που διαβάζει όντως ο βοηθός — Αντιστοιχίσεις, Έρευνα, Χρηματοδότηση, Ημερολόγιο, Builder ή
          Αιτήσεις.
        </p>
      </>
    ),
  },
  research: {
    en: (
      <>
        <p>
          Each board is a canvas of notes, files, and links. <em>Use template</em> seeds a common workflow
          (validation, market, pitch). <em>New board</em> starts blank. Pin keeps a board at the top.
        </p>
        <p>
          Open a board to add nodes, upload files, and connect ideas. Use <em>Ask AI</em> to propose a board
          structure from Builder artefacts, or to summarise what is already on the canvas.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Κάθε πίνακας είναι καμβάς σημειώσεων, αρχείων και συνδέσμων. Το <em>Χρήση προτύπου</em> γεμίζει μια
          συνηθισμένη ροή (επικύρωση, αγορά, pitch). Το <em>Νέος πίνακας</em> ξεκινά κενός. Το καρφίτσωμα κρατά
          τον πίνακα στην κορυφή.
        </p>
        <p>
          Ανοίξτε έναν πίνακα για κόμβους, αρχεία και συνδέσεις. Με το <em>Ρωτήστε το AI</em> προτείνετε δομή από
          τα παραδοτέα του Builder, ή σύνοψη όσων υπάρχουν ήδη στον καμβά.
        </p>
      </>
    ),
  },
  readiness: {
    en: (
      <>
        <p>
          Your score combines 6 dimensions: <strong>Team, Market, Product, Business Model, Funding, Execution</strong>.
          Accelerator and investor views weight those dimensions differently — team and market count more for investors.
        </p>
        <p>
          Tick criteria on a dimension card to update the saved score. Use <em>Reassess</em> after a major change, or{' '}
          <em>Ask AI</em> for a plan on the weakest area.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Η βαθμολογία συνδυάζει 6 διαστάσεις: <strong>Ομάδα, Αγορά, Προϊόν, Επιχειρηματικό μοντέλο, Χρηματοδότηση, Εκτέλεση</strong>.
          Οι όψεις επιταχυντή και επενδυτή τις ζυγίζουν διαφορετικά — ομάδα και αγορά μετράνε περισσότερο για επενδυτές.
        </p>
        <p>
          Τσεκάρετε κριτήρια σε μια κάρτα διάστασης για ενημέρωση της αποθηκευμένης βαθμολογίας. Μετά από σημαντική αλλαγή
          πατήστε <em>Επαναξιολόγηση</em>, ή <em>Ρωτήστε το AI</em> για πλάνο στο ασθενέστερο σημείο.
        </p>
      </>
    ),
  },
  analytics: {
    en: (
      <>
        <p>
          Numbers here are <strong>recorded counts</strong> for the selected period. A dash means the metric was not
          measured — it is not zero. Trends compare this period with the previous one of the same length.
        </p>
        <p>
          Use <em>Overview</em> for the funnel, <em>Engagement</em> for type breakdown, and <em>Growth</em> for view
          trends. <em>Ask AI</em> can explain a drop or suggest the next action.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Οι αριθμοί είναι <strong>καταγεγραμμένα πλήθη</strong> για την επιλεγμένη περίοδο. Η παύλα σημαίνει ότι η
          μέτρηση δεν έγινε — όχι μηδέν. Οι τάσεις συγκρίνουν αυτή την περίοδο με την προηγούμενη ίδιου μήκους.
        </p>
        <p>
          Η <em>Επισκόπηση</em> δείχνει τη χοάνη, η <em>Αφοσίωση</em> την ανάλυση ανά τύπο και η <em>Ανάπτυξη</em> την
          τάση προβολών. Το <em>Ρωτήστε το AI</em> εξηγεί μια πτώση ή προτείνει το επόμενο βήμα.
        </p>
      </>
    ),
  },
  discover: {
    en: (
      <>
        <p>
          Use Discover to <strong>browse</strong> with filters; use <a href="/matches">Matches</a> to see{' '}
          <strong>ranked</strong> suggestions. Combine role + skills + location to find specific profiles.
        </p>
        <p>
          Bookmark interesting people to <a href="/shortlist">Saved</a> and send a Connect request when ready.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Η Εξερεύνηση είναι για <strong>περιήγηση</strong> με φίλτρα· οι <a href="/matches">Αντιστοιχίσεις</a>{' '}
          δίνουν <strong>καταταγμένες</strong> προτάσεις. Συνδυάστε ρόλο, δεξιότητες και τοποθεσία για πιο
          στοχευμένα προφίλ.
        </p>
        <p>
          Αποθηκεύστε όσους σας ενδιαφέρουν στα <a href="/shortlist">Αποθηκευμένα</a> και στείλτε αίτημα σύνδεσης
          όταν είστε έτοιμοι.
        </p>
      </>
    ),
  },
  fundraising: {
    en: (
      <>
        <p>
          The round card shows your target, what is committed and what remains. The summary counts the full
          pipeline. Committed contacts are
          the investor count on the round card — they cannot disagree with Kanban. Contacts you add and stage moves stay
          in this browser until a fundraising API exists.
        </p>
        <p>
          Use <em>Ask AI</em> for who to contact next from Idea Core, the pitch deck, Research, and Data Room gaps. The{' '}
          <strong>Data Room</strong> tab holds documents shared via tokenised links — nothing is public unless you send it.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Η κάρτα γύρου δείχνει τον στόχο σας, τι έχει δεσμευτεί και τι απομένει. Οι στήλες Kanban είναι τα στάδια:{' '}
          <strong>Υποψήφιος → Επικοινωνία → Συνάντηση → Due diligence → Δεσμευμένος → Δεν προχώρησε</strong>. Η σύνοψη μετρά ολόκληρο
          το pipeline· οι δεσμευμένοι είναι ο αριθμός επενδυτών στην κάρτα γύρου — δεν μπορεί να διαφωνούν. Οι επαφές και
          οι μετακινήσεις μένουν σε αυτόν τον browser μέχρι να υπάρξει υπηρεσία χρηματοδότησης.
        </p>
        <p>
          Με <em>Ρωτήστε το AI</em> δείτε ποιον να προσεγγίσετε μετά από τον Πυρήνα ιδέας, το pitch deck, την Έρευνα και
          κενά του Data Room. Η καρτέλα <strong>Data Room</strong> κρατά έγγραφα με συνδέσμους token — τίποτα δεν είναι
          δημόσιο αν δεν τον στείλετε.
        </p>
      </>
    ),
  },
  matches: {
    en: (
      <>
        <p>
          Match score is computed from{' '}
          <strong>role complementarity, skill overlap, stage alignment, commitment, and location</strong>. Higher scores
          are stronger fits, but always read the &ldquo;Why you match&rdquo; reasons before reaching out.
        </p>
        <p>
          Click the chart icon on a card to see the compatibility breakdown, or open Compare to put two profiles side by side.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Η βαθμολογία αντιστοίχισης προκύπτει από{' '}
          <strong>συμπληρωματικότητα ρόλων, επικάλυψη δεξιοτήτων, ευθυγράμμιση σταδίου, διαθεσιμότητα και
          τοποθεσία</strong>. Η υψηλότερη βαθμολογία σημαίνει ισχυρότερο ταίριασμα, αλλά διαβάζετε πάντα τους λόγους
          στο «Γιατί ταιριάζετε» πριν επικοινωνήσετε.
        </p>
        <p>
          Πατήστε το εικονίδιο γραφήματος σε μια κάρτα για την ανάλυση συμβατότητας, ή ανοίξτε τη Σύγκριση για να
          δείτε δύο προφίλ δίπλα-δίπλα.
        </p>
      </>
    ),
  },
  connections: {
    en: (
      <>
        <p>
          <strong>Pending</strong> shows requests waiting for your response. <strong>Active</strong> is your network —
          message, schedule a call, or remove from the menu.
        </p>
        <p>
          Saved profiles you have not yet contacted live in <a href="/shortlist">Saved profiles</a>.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Στα <strong>Εκκρεμή</strong> βρίσκονται τα αιτήματα που περιμένουν απάντησή σας. Τα <strong>Ενεργά</strong>{' '}
          είναι το δίκτυό σας — στείλτε μήνυμα, κλείστε κλήση ή αφαιρέστε τα από το μενού.
        </p>
        <p>
          Τα προφίλ που αποθηκεύσατε χωρίς να επικοινωνήσετε ακόμη βρίσκονται στα{' '}
          <a href="/shortlist">Αποθηκευμένα προφίλ</a>.
        </p>
      </>
    ),
  },
  messages: {
    en: (
      <>
        <p>
          <strong>Chats</strong> are open conversations with people you are already connected to.{' '}
          <strong>Intro requests</strong> are first messages from someone outside your network — accepting one
          starts a chat, declining it does not notify them.
        </p>
        <p>
          Nobody can message you directly until you connect or accept their intro, so an empty Chats tab usually
          means there are requests waiting next door.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Οι <strong>Συνομιλίες</strong> είναι ανοιχτές συζητήσεις με άτομα με τα οποία είστε ήδη συνδεδεμένοι. Τα{' '}
          <strong>Αιτήματα γνωριμίας</strong> είναι πρώτα μηνύματα από άτομα εκτός του δικτύου σας — αν δεχτείτε
          ένα, ξεκινά συνομιλία· αν το απορρίψετε, δεν ειδοποιείται ο αποστολέας.
        </p>
        <p>
          Κανείς δεν μπορεί να σας γράψει απευθείας πριν συνδεθείτε ή δεχτείτε τη γνωριμία, οπότε μια άδεια καρτέλα
          Συνομιλιών συνήθως σημαίνει ότι σας περιμένουν αιτήματα στη διπλανή καρτέλα.
        </p>
      </>
    ),
  },
  settings: {
    en: (
      <>
        <p>
          Update notification frequency, manage billing and integrations, and control profile visibility. Changes save
          instantly.
        </p>
        <p>
          For privacy-sensitive actions (export data, delete account), see{' '}
          <a href="/settings/data-export">Data export</a>.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Ρυθμίστε τη συχνότητα ειδοποιήσεων, διαχειριστείτε χρεώσεις και ενσωματώσεις, και ελέγξτε την ορατότητα του
          προφίλ σας. Οι αλλαγές αποθηκεύονται άμεσα.
        </p>
        <p>
          Για ενέργειες που αφορούν προσωπικά δεδομένα (εξαγωγή δεδομένων, διαγραφή λογαριασμού) δείτε την{' '}
          <a href="/settings/data-export">Εξαγωγή δεδομένων</a>.
        </p>
      </>
    ),
  },
  'dashboard-founder': {
    en: (
      <>
        <p>
          Your dashboard surfaces the <strong>single next action</strong> most likely to move your startup forward right
          now — backed by your readiness score, recent activity, and platform signals.
        </p>
        <p>The widgets below it are reference cards: matches, recent messages, milestones, and gamified progress.</p>
      </>
    ),
    el: (
      <>
        <p>
          Ο πίνακάς σας αναδεικνύει τη <strong>μία επόμενη ενέργεια</strong> που έχει τις περισσότερες πιθανότητες να
          προωθήσει το startup σας αυτή τη στιγμή — με βάση τη βαθμολογία ετοιμότητας, την πρόσφατη δραστηριότητα και
          τα σήματα της πλατφόρμας.
        </p>
        <p>
          Τα widgets από κάτω είναι κάρτες αναφοράς: αντιστοιχίσεις, πρόσφατα μηνύματα, ορόσημα και πρόοδος.
        </p>
      </>
    ),
  },
  milestones: {
    en: (
      <>
        <p>
          Each row is one goal with an owner and a date. The summary counts the <strong>full tracker</strong>;
          search, category, and status only filter the list below. Completed items feed Readiness and investor updates.
        </p>
        <p>
          Use <em>New milestone</em> or <em>Ask AI</em> to propose the next three from Builder artefacts. Mark complete
          from the card menu — you can reopen if the work is not actually done.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Κάθε γραμμή είναι ένας στόχος με υπεύθυνο και ημερομηνία. Η σύνοψη μετρά τον <strong>ολόκληρο πίνακα</strong>·
          αναζήτηση, κατηγορία και κατάσταση φιλτράρουν μόνο τη λίστα. Τα ολοκληρωμένα τροφοδοτούν Ετοιμότητα και
          ενημερώσεις επενδυτών.
        </p>
        <p>
          Με <em>Νέο ορόσημο</em> ή <em>Ρωτήστε το AI</em> προτείνετε τα επόμενα τρία από τον Builder. Η ολοκλήρωση γίνεται
          από το μενού της κάρτας — μπορείτε να το ξανανοίξετε αν η δουλειά δεν τελείωσε.
        </p>
      </>
    ),
  },
  projects: {
    en: (
      <>
        <p>
          <strong>Discover</strong> lists published projects, including the ones you publish. In the showcase, sample
          projects keep <em>My projects</em>, <em>Joined</em> and <em>Starred</em> from being empty. Rail counts match the
          catalogue; filters only change what is on screen.
        </p>
        <p>
          Open a card for roles, team, milestones, and updates. Apply and request-to-join stay in this browser until a
          projects API exists — the founder has not accepted yet. Use <em>Ask AI</em> to pick a project that fits your Idea
          Core and research boards. Create still
          publishes every field from the four-step form.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Η <strong>Ανακάλυψη</strong> δείχνει τα δημοσιευμένα έργα, μαζί με όσα δημοσιεύετε εσείς. Στην επίδειξη, δείγματα
          έργων κρατούν τα <em>Τα έργα μου</em>, <em>Συμμετοχές</em> και <em>Αγαπημένα</em> ώστε να μην είναι άδεια. Οι αριθμοί στη ράγα ταιριάζουν με τον κατάλογο· τα
          φίλτρα αλλάζουν μόνο ό,τι φαίνεται.
        </p>
        <p>
          Ανοίξτε κάρτα για ρόλους, ομάδα, ορόσημα και ενημερώσεις. Αίτηση και αίτημα ένταξης μένουν σε αυτόν τον browser μέχρι
          να υπάρχει API έργων — ο ιδρυτής δεν έχει αποδεχτεί ακόμη. Με το <em>Ρωτήστε το AI</em> διαλέγετε έργο που ταιριάζει
          με τον Πυρήνα ιδέας και τους πίνακες έρευνάς σας. Η
          δημιουργία δημοσιεύει καταχώριση με όλα τα πεδία της φόρμας τεσσάρων βημάτων.
        </p>
      </>
    ),
  },
  'tenant-branding': {
    en: (
      <>
        <p>
          Branding changes preview live in the right panel and apply to your tenant&rsquo;s public landing and emails.
          Nothing goes live until you click <strong>Publish</strong> — work in draft as long as you need.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Οι αλλαγές επωνυμίας εμφανίζονται ζωντανά στο δεξί πάνελ και ισχύουν για τη δημόσια σελίδα και τα email του
          tenant σας. Τίποτα δεν δημοσιεύεται μέχρι να πατήσετε <strong>Δημοσίευση</strong> — δουλέψτε σε πρόχειρο όσο
          χρειάζεστε.
        </p>
      </>
    ),
  },
  'admin-overview': {
    en: (
      <>
        <p>
          This is the platform-wide console: pending <strong>reports</strong>, user and cohort management, events
          and job postings, and the role distribution chart. Counts here cover every tenant, not one community.
        </p>
        <p>
          Each card links to the specialised screen — <a href="/admin/user-management">User management</a> for bulk
          actions and filters, <a href="/admin/content-moderation">Content moderation</a> for the report queue, and{' '}
          <a href="/admin/security-monitoring">Security monitoring</a> for auth anomalies.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Αυτή είναι η κονσόλα για όλη την πλατφόρμα: εκκρεμείς <strong>αναφορές</strong>, διαχείριση χρηστών και
          cohorts, εκδηλώσεις και αγγελίες, και το γράφημα κατανομής ρόλων. Οι μετρήσεις αφορούν όλους τους tenants,
          όχι μία κοινότητα.
        </p>
        <p>
          Κάθε κάρτα οδηγεί στην εξειδικευμένη οθόνη — <a href="/admin/user-management">Διαχείριση χρηστών</a> για
          μαζικές ενέργειες και φίλτρα, <a href="/admin/content-moderation">Εποπτεία περιεχομένου</a> για την ουρά
          αναφορών, και <a href="/admin/security-monitoring">Παρακολούθηση ασφάλειας</a> για ανωμαλίες ταυτοποίησης.
        </p>
      </>
    ),
  },
  'admin-user-management': {
    en: (
      <>
        <p>
          Use the <strong>filters</strong> on the left to narrow by role or status. Select rows with checkboxes for{' '}
          <strong>bulk activate, suspend, or delete</strong>. Open a user with the eye icon or row menu — full detail
          lives on the user detail page.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Χρησιμοποιήστε τα <strong>φίλτρα</strong> αριστερά για περιορισμό ανά ρόλο ή κατάσταση. Επιλέξτε γραμμές με
          τα πλαίσια ελέγχου για <strong>μαζική ενεργοποίηση, αναστολή ή διαγραφή</strong>. Ανοίξτε έναν χρήστη με το
          εικονίδιο ματιού ή το μενού της γραμμής — η πλήρης εικόνα βρίσκεται στη σελίδα λεπτομερειών χρήστη.
        </p>
      </>
    ),
  },
  onboarding: {
    en: (
      <>
        <p>
          Each step shapes one part of your match score: <strong>role</strong> decides who appears as a candidate,{' '}
          <strong>skills</strong> drive overlap, <strong>stage</strong> filters out misalignment,{' '}
          <strong>commitment</strong> filters timing, and <strong>location</strong> is a small tie-breaker.
        </p>
        <p>
          You can edit any answer later in <a href="/profile/edit">Edit profile</a>.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Κάθε βήμα διαμορφώνει ένα κομμάτι της βαθμολογίας αντιστοίχισης: ο <strong>ρόλος</strong> καθορίζει ποιοι
          εμφανίζονται ως υποψήφιοι, οι <strong>δεξιότητες</strong> την επικάλυψη, το <strong>στάδιο</strong>{' '}
          αποκλείει ασύμβατες συνεργασίες, η <strong>διαθεσιμότητα</strong> φιλτράρει τον χρόνο, και η{' '}
          <strong>τοποθεσία</strong> λειτουργεί ως μικρό κριτήριο ισοβαθμίας.
        </p>
        <p>
          Μπορείτε να αλλάξετε οποιαδήποτε απάντηση αργότερα στην{' '}
          <a href="/profile/edit">Επεξεργασία προφίλ</a>.
        </p>
      </>
    ),
  },
  'admin-analytics': {
    en: (
      <>
        <p>
          <strong>Active</strong> users logged in during the selected range. Role charts show signup mix — use this to
          balance supply (mentors/investors) vs demand (founders). Tenant count reflects white-label communities.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          <strong>Ενεργοί</strong> είναι όσοι συνδέθηκαν στο επιλεγμένο διάστημα. Τα γραφήματα ρόλων δείχνουν τη
          σύνθεση των εγγραφών — χρησιμεύουν για να ισορροπήσετε την προσφορά (mentors/επενδυτές) με τη ζήτηση
          (ιδρυτές). Ο αριθμός tenants αφορά τις white-label κοινότητες.
        </p>
      </>
    ),
  },
  'admin-content-moderation': {
    en: (
      <>
        <p>
          Open items need a decision: <strong>Resolve</strong> if action was taken (warn/suspend content),{' '}
          <strong>Dismiss</strong> if the report was invalid. Resolved items stay in history for audit.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Τα ανοιχτά στοιχεία χρειάζονται απόφαση: <strong>Επίλυση</strong> αν ελήφθη μέτρο (προειδοποίηση ή αναστολή
          περιεχομένου), <strong>Απόρριψη</strong> αν η αναφορά ήταν αβάσιμη. Τα επιλυμένα παραμένουν στο ιστορικό
          για έλεγχο.
        </p>
      </>
    ),
  },
  'admin-security': {
    en: (
      <>
        <p>
          <strong>Critical</strong> events need immediate review. Failed-login clusters may indicate credential stuffing;
          export spikes may indicate data exfiltration attempts. Cross-check with the audit log for context.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Τα <strong>κρίσιμα</strong> συμβάντα απαιτούν άμεσο έλεγχο. Συστάδες αποτυχημένων συνδέσεων μπορεί να
          υποδεικνύουν credential stuffing· απότομες αυξήσεις εξαγωγών μπορεί να υποδεικνύουν απόπειρα διαρροής
          δεδομένων. Διασταυρώστε με το αρχείο ελέγχου για το πλαίσιο.
        </p>
      </>
    ),
  },
  'admin-mentorship': {
    en: (
      <>
        <p>
          <strong>Pending</strong> mentors need profile and credential review before appearing in{' '}
          <a href="/mentoring">Mentoring</a>. Session count and rating help identify top contributors vs. inactive
          listings.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Οι <strong>εκκρεμείς</strong> mentors χρειάζονται έλεγχο προφίλ και πιστοποιήσεων πριν εμφανιστούν στο{' '}
          <a href="/mentoring">Mentoring</a>. Το πλήθος συνεδριών και η βαθμολογία δείχνουν ποιοι συνεισφέρουν
          ουσιαστικά και ποιες καταχωρίσεις είναι ανενεργές.
        </p>
      </>
    ),
  },
  'admin-community-management': {
    en: (
      <>
        <p>
          Communities with status <strong>review</strong> were flagged or auto-held for first-time creators. High
          post-to-member ratio indicates healthy engagement; low activity may need admin outreach.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Οι κοινότητες σε κατάσταση <strong>έλεγχος</strong> έχουν επισημανθεί ή κρατήθηκαν αυτόματα επειδή ο
          δημιουργός τους είναι πρωτοεμφανιζόμενος. Υψηλή αναλογία δημοσιεύσεων ανά μέλος δείχνει υγιή συμμετοχή·
          η χαμηλή δραστηριότητα ίσως χρειάζεται παρέμβαση διαχειριστή.
        </p>
      </>
    ),
  },
  'admin-system-settings': {
    en: (
      <>
        <p>
          <strong>Maintenance mode</strong> shows a banner and blocks new sessions for non-admins.{' '}
          <strong>Registration</strong> toggle pauses new signups without affecting existing users.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Η <strong>λειτουργία συντήρησης</strong> εμφανίζει banner και μπλοκάρει νέες συνεδρίες για μη
          διαχειριστές. Ο διακόπτης <strong>εγγραφών</strong> παύει τις νέες εγγραφές χωρίς να επηρεάζει τους
          υπάρχοντες χρήστες.
        </p>
      </>
    ),
  },
  commitments: {
    en: (
      <>
        <p>
          A <strong>need card</strong> says three things in one sentence each — what already exists, the outcome it is
          for, and who is missing — and what is offered: role, equity, hours a week and scope. Category, place, stage and
          commitment are the filters people search by.
        </p>
        <p>
          Only commitments that bind people use the ladder: a co-founder seat, a role with equity, an investor
          introduction. Interest opens a <strong>protected conversation</strong> with no contact details; each of you
          confirms separately; then terms are versioned, with three revisions after the first proposal. Agreed terms
          open the deal room and stay frozen while it is open. Mentoring and simple intros keep ordinary messages.
        </p>
        <p>
          A public link shares the card without your email or phone. The platform organises the decision; it does not
          promise funding or income.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Μια <strong>κάρτα ανάγκης</strong> λέει τρία πράγματα, μία πρόταση το καθένα — τι υπάρχει ήδη, το αποτέλεσμα
          που επιδιώκεται και ποιος λείπει — και τι προσφέρεται: ρόλος, equity, ώρες την εβδομάδα και εύρος. Κατηγορία,
          τόπος, στάδιο και δέσμευση είναι τα φίλτρα αναζήτησης.
        </p>
        <p>
          Την κλίμακα τη χρησιμοποιούν μόνο οι δεσμεύσεις που δεσμεύουν ανθρώπους: θέση συνιδρυτή, ρόλος με equity,
          σύσταση σε επενδυτή. Το ενδιαφέρον ανοίγει μια <strong>προστατευμένη συζήτηση</strong> χωρίς στοιχεία
          επικοινωνίας· ο καθένας επιβεβαιώνει χωριστά· μετά οι όροι γράφονται σε εκδόσεις, με τρεις αναθεωρήσεις μετά την
          πρώτη πρόταση. Οι συμφωνημένοι όροι ανοίγουν την αίθουσα συμφωνίας και μένουν παγωμένοι όσο είναι ανοιχτή. Το
          mentoring και οι απλές συστάσεις κρατούν τα συνηθισμένα μηνύματα.
        </p>
        <p>
          Ο δημόσιος σύνδεσμος μοιράζεται την κάρτα χωρίς email ή τηλέφωνο. Η πλατφόρμα οργανώνει την απόφαση· δεν
          υπόσχεται χρηματοδότηση ή εισόδημα.
        </p>
      </>
    ),
  },
  scout: {
    en: (
      <>
        <p>
          Write a <strong>brief</strong>: the role, the skills, where, how much time and at what stage. The scout reads
          the member base against it and proposes up to five people, each with the reasons it chose them and a first note
          you could send.
        </p>
        <p>
          It <strong>proposes and never sends</strong>. Nobody it proposes is messaged, connected, followed or told. What
          happens next is your own click: open the profile, save to your shortlist, ask for an introduction, or dismiss;
          a dismissed person is not proposed again, and people you are already connected to are left out.
        </p>
        <p>
          While the brief is active it runs once a day and tells only you when it finds someone new. An &quot;Open to
          co-founding&quot; signal counts toward the ranking, and is named only where its owner lets you see it.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Γράψτε ένα <strong>σημείωμα</strong>: τον ρόλο, τις δεξιότητες, πού, πόσο χρόνο και σε ποιο στάδιο. Ο ανιχνευτής
          διαβάζει τα μέλη με βάση αυτό και προτείνει έως πέντε πρόσωπα, το καθένα με τους λόγους που επιλέχθηκε και ένα
          πρώτο σημείωμα που θα μπορούσατε να στείλετε.
        </p>
        <p>
          <strong>Προτείνει και δεν στέλνει ποτέ</strong>. Κανείς από όσους προτείνει δεν λαμβάνει μήνυμα, αίτημα σύνδεσης ή
          ειδοποίηση. Το επόμενο βήμα είναι δικό σας: άνοιγμα προφίλ, αποθήκευση στη λίστα, αίτημα σύστασης ή απόρριψη·
          όποιος απορρίπτεται δεν ξαναπροτείνεται, και όσοι είναι ήδη συνδέσεις σας εξαιρούνται.
        </p>
        <p>
          Όσο το σημείωμα είναι ενεργό, τρέχει μία φορά την ημέρα και ενημερώνει μόνο εσάς όταν βρει κάποιον νέο. Το σήμα
          «Ανοιχτός/ή σε συνίδρυση» μετρά στην κατάταξη και αναφέρεται μόνο όπου ο κάτοχός του σας επιτρέπει να το δείτε.
        </p>
      </>
    ),
  },
  intros: {
    en: (
      <>
        <p>
          On someone&apos;s profile, <strong>Ask for an introduction</strong> shows who among your connections, your
          mentor or mentees and your cohort-mates also knows them. You choose one, say why in a sentence or two, and pick
          the need card it is for.
        </p>
        <p>
          The <strong>intermediary decides</strong>. If they forward it, the other person sees your card and their note;
          if they do not, you are told only that it was not forwarded, and the other person never hears of it. Accepting
          answers your need card, so the conversation continues on its ladder: protected at first, then terms.
        </p>
        <p>
          You can have five requests waiting at once and withdraw one until it is answered. No email or phone in the
          notes: the conversation stays on the platform until you both confirm.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Στο προφίλ κάποιου, το <strong>«Ζητήστε σύσταση»</strong> δείχνει ποιοι από τις συνδέσεις σας, τον μέντορα ή
          τους καθοδηγούμενούς σας και τον κύκλο σας τον γνωρίζουν επίσης. Επιλέγετε έναν, λέτε γιατί σε μία-δύο
          προτάσεις και διαλέγετε την κάρτα ανάγκης για την οποία είναι.
        </p>
        <p>
          <strong>Ο ενδιάμεσος αποφασίζει</strong>. Αν την προωθήσει, το άλλο πρόσωπο βλέπει την κάρτα σας και τη
          σημείωσή του· αν όχι, μαθαίνετε μόνο ότι δεν προωθήθηκε και το άλλο πρόσωπο δεν το μαθαίνει ποτέ. Η αποδοχή
          απαντά στην κάρτα ανάγκης σας, οπότε η συζήτηση συνεχίζει στην κλίμακά της: προστατευμένη στην αρχή, μετά όροι.
        </p>
        <p>
          Μπορείτε να έχετε πέντε αιτήματα σε αναμονή ταυτόχρονα και να αποσύρετε ένα μέχρι να απαντηθεί. Χωρίς email ή
          τηλέφωνο στις σημειώσεις: η συζήτηση μένει στην πλατφόρμα μέχρι να επιβεβαιώσετε και οι δύο.
        </p>
      </>
    ),
  },
  updates: {
    en: (
      <>
        <p>
          <strong>Following</strong> a founder sends you the updates they write: what moved this month, a few figures,
          and up to three asks. You see them here and in your notifications. Following is one click and you can stop
          at any time; the founder is told someone new follows, not who.
        </p>
        <p>
          An update you write goes to your followers. Make it <strong>public</strong> and it gets its own link with a
          proper preview for LinkedIn or anywhere else: your name and headline, nothing that reaches you outside the
          platform. Switching it back to followers retires the link.
        </p>
        <p>
          A completed milestone can become an update from its menu. Updates that mention money carry the same note as
          every funding surface: the platform organises the conversation; it does not promise funding or returns, and an
          update that does is refused.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Όταν <strong>ακολουθείτε</strong> έναν ιδρυτή, λαμβάνετε τις ενημερώσεις που γράφει: τι προχώρησε αυτόν τον
          μήνα, μερικά νούμερα και έως τρία αιτήματα. Τις βλέπετε εδώ και στις ειδοποιήσεις σας. Η παρακολούθηση είναι
          ένα κλικ και σταματά όποτε θέλετε· ο ιδρυτής μαθαίνει ότι κάποιος νέος τον ακολουθεί, όχι ποιος.
        </p>
        <p>
          Μια ενημέρωση που γράφετε πηγαίνει σε όσους σας ακολουθούν. Αν τη κάνετε <strong>δημόσια</strong>, παίρνει δικό
          της σύνδεσμο με σωστή προεπισκόπηση για το LinkedIn ή οπουδήποτε αλλού: το όνομα και τον τίτλο σας, τίποτα που
          σας φτάνει εκτός πλατφόρμας. Αν την επαναφέρετε στους ακολούθους, ο σύνδεσμος αποσύρεται.
        </p>
        <p>
          Ένα ολοκληρωμένο ορόσημο γίνεται ενημέρωση από το μενού του. Όσες ενημερώσεις αναφέρουν χρήματα φέρουν την ίδια
          σημείωση με κάθε επιφάνεια χρηματοδότησης: η πλατφόρμα οργανώνει τη συζήτηση· δεν υπόσχεται χρηματοδότηση ή
          αποδόσεις, και μια ενημέρωση που το κάνει απορρίπτεται.
        </p>
      </>
    ),
  },
  opportunities: {
    en: (
      <>
        <p>
          Four tabs, one purpose: find work to do with someone. <strong>Co-founder & freelance</strong> is listings from
          the opportunities API. <strong>Jobs</strong> is the same feed as{' '}
          <a href="/jobs">Jobs & roles</a>. <strong>My applications</strong> tracks what you sent;{' '}
          <strong>Proposals</strong> is what others sent you.
        </p>
        <p>
          When a listing has no apply URL, <em>Draft an approach</em> opens the assistant with that listing pre-loaded —
          there is no silent apply endpoint. Sample proposals are labelled as sample.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Τέσσερις καρτέλες, ένας σκοπός: να βρείτε δουλειά μαζί με κάποιον. Το <strong>Συνιδρυτής & freelance</strong>{' '}
          είναι καταχωρίσεις από το API ευκαιριών. Οι <strong>Θέσεις</strong> είναι το ίδιο feed με τις{' '}
          <a href="/jobs">Θέσεις εργασίας</a>. Οι <strong>αιτήσεις μου</strong> είναι όσα στείλατε· οι{' '}
          <strong>Προτάσεις</strong> είναι όσα σας έστειλαν.
        </p>
        <p>
          Όταν μια καταχώριση δεν έχει URL αίτησης, η <em>Σύνταξη προσέγγισης</em> ανοίγει τον βοηθό με την καταχώριση
          προφορτωμένη — δεν υπάρχει σιωπηλό endpoint αίτησης. Οι δείγμα-προτάσεις φέρουν ετικέτα δείγματος.
        </p>
      </>
    ),
  },
  jobs: {
    en: (
      <>
        <p>
          Roles posted by startups on this platform — not a general job board. Filter by function and employment type.
          <em>Post a role</em> writes to the jobs API. Cards only show facts the posting actually
          has.
        </p>
        <p>
          Empty results can <em>Ask AI</em> to draft a cofounder or early-hire post from your profile gaps, or to
          suggest people instead of a job.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Θέσεις που δημοσιεύουν startups σε αυτή την πλατφόρμα — όχι γενικός πίνακας αγγελιών. Φιλτράρετε κατά
          λειτουργία και τύπο απασχόλησης. Η <em>Δημοσίευση θέσης</em> γράφει στο API. Οι κάρτες δείχνουν μόνο όσα έχει
          όντως η αγγελία.
        </p>
        <p>
          Τα κενά αποτελέσματα μπορούν να <em>Ρωτήσουν το AI</em> να συντάξει αγγελία συνιδρυτή ή πρώτης πρόσληψης από
          τα κενά του προφίλ σας, ή να προτείνει ανθρώπους αντί για θέση.
        </p>
      </>
    ),
  },
  learning: {
    en: (
      <>
        <p>
          Resources and sequenced <strong>paths</strong> aligned with readiness gaps. Tapping a path filters this page
          to that topic — it does not open a separate course player. Saved and Completed are local to the cards on
          this screen.
        </p>
        <p>
          Prefer a guided next step? <em>Ask AI</em> which gap in Readiness to study first.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Πόροι και διαδοχικά <strong>μονοπάτια</strong> ευθυγραμμισμένα με τα κενά ετοιμότητας. Το πάτημα ενός
          μονοπατιού φιλτράρει αυτή τη σελίδα στο θέμα του — δεν ανοίγει ξεχωριστό player. Τα Αποθηκευμένα και
          Ολοκληρωμένα είναι τοπικά στις κάρτες εδώ.
        </p>
        <p>
          Θέλετε καθοδηγούμενο επόμενο βήμα; <em>Ρωτήστε το AI</em> ποιο κενό στο Readiness να μελετήσετε πρώτα.
        </p>
      </>
    ),
  },
  feed: {
    en: (
      <>
        <p>
          Network updates from people you follow. When the live feed module has nothing, sample posts appear behind a
          notice — they are for layout, not activity you missed.
        </p>
        <p>
          <em>Ask AI</em> what to do next on Discover, Matches, or Messages instead of waiting on a sample timeline.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Ενημερώσεις δικτύου από όσους ακολουθείτε. Όταν το live module δεν έχει τίποτα, εμφανίζονται δείγματα πίσω
          από ειδοποίηση — είναι για τη διάταξη, όχι δραστηριότητα που χάσατε.
        </p>
        <p>
          <em>Ρωτήστε το AI</em> τι να κάνετε μετά στο Discover, τα Matches ή τα Μηνύματα αντί να περιμένετε σε δείγμα
          χρονολογίου.
        </p>
      </>
    ),
  },
  marketplace: {
    en: (
      <>
        <p>
          Legal, design, growth, and ops providers. When live listings are empty, sample experts appear behind a
          notice so you can learn the layout. <em>List your service</em> goes to the real provider workspace.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Πάροχοι νομικών, σχεδιασμού, growth και operations. Όταν οι live καταχωρίσεις είναι κενές, εμφανίζονται
          δείγματα πίσω από ειδοποίηση ώστε να δείτε τη διάταξη. Η <em>Καταχώριση υπηρεσίας</em> πηγαίνει στον
          πραγματικό χώρο του παρόχου.
        </p>
      </>
    ),
  },
  calendar: {
    en: (
      <>
        <p>
          Sessions, events, and milestone due dates are not one API yet. The grid is a labelled sample so you can
          learn month/list views. <em>Add event</em> opens the real event composer; live dates live on Events and
          Milestones.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Συνεδρίες, εκδηλώσεις και προθεσμίες οροσήμων δεν είναι ακόμη ένα API. Το πλέγμα είναι επισημασμένο δείγμα
          για τις προβολές μήνα/λίστας. Η <em>Προσθήκη εκδήλωσης</em> ανοίγει τον πραγματικό συνθέτη· οι ζωντανές
          ημερομηνίες είναι στις Εκδηλώσεις και τα Ορόσημα.
        </p>
      </>
    ),
  },
  programs: {
    en: (
      <>
        <p>
          Accelerators, incubators, bootcamps, and competitions. <strong>Open</strong> means you can still apply.{' '}
          <strong>My applications</strong> is what you already sent — the same artefact the Builder Applications tab
          writes. Deadlines of 7 days or less are highlighted.
        </p>
        <p>
          Readiness sends you here when the accelerator dimension is high enough to apply. <em>Ask AI</em> which open
          program fits your stage.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Επιταχυντές, θερμοκοιτίδες, bootcamps και διαγωνισμοί. <strong>Ανοιχτά</strong> σημαίνει ότι μπορείτε ακόμη να
          κάνετε αίτηση. Οι <strong>αιτήσεις μου</strong> είναι όσα έχετε ήδη στείλει — το ίδιο παραδοτέο με την καρτέλα
          Αιτήσεις στον Builder. Προθεσμίες έως 7 ημερών επισημαίνονται.
        </p>
        <p>
          Το Readiness σας φέρνει εδώ όταν η διάσταση επιταχυντή είναι αρκετά υψηλή. <em>Ρωτήστε το AI</em> ποιο ανοιχτό
          πρόγραμμα ταιριάζει στο στάδιό σας.
        </p>
      </>
    ),
  },
  groups: {
    en: (
      <>
        <p>
          Industry and stage communities. Join to post; create your own anytime. Public groups are listed here;
          private and secret groups stay off the directory unless you are a member.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Κοινότητες βάσει κλάδου και σταδίου. Συμμετέχετε για να δημοσιεύετε· δημιουργήστε τη δική σας οποτεδήποτε.
          Οι δημόσιες ομάδες εμφανίζονται εδώ· οι ιδιωτικές και μυστικές μένουν εκτός καταλόγου εκτός αν είστε μέλος.
        </p>
      </>
    ),
  },
  'public-pitch': {
    en: (
      <>
        <p>
          This is the investor-facing deck, not the Builder editor. Views are counted. Contact goes to the founder who
          published it — there is no public inbox.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Αυτό είναι το deck προς επενδυτές, όχι ο επεξεργαστής του Builder. Οι προβολές μετρώνται. Η επαφή πηγαίνει
          στον ιδρυτή που το δημοσίευσε — δεν υπάρχει δημόσιο inbox.
        </p>
      </>
    ),
  },
  'data-room': {
    en: (
      <>
        <p>
          Private diligence documents. Share access per investor; nothing here is public. Upload and share stay on
          this room — they do not publish to the feed or to Discover.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Ιδιωτικά έγγραφα diligence. Η πρόσβαση μοιράζεται ανά επενδυτή· τίποτα εδώ δεν είναι δημόσιο. Η μεταφόρτωση
          και ο διαμοιρασμός μένουν σε αυτό το room — δεν δημοσιεύονται στο feed ούτε στο Discover.
        </p>
      </>
    ),
  },
  activity: {
    en: (
      <>
        <p>
          Three streams, one page. <strong>Network</strong> is what people you are connected to did — new
          connections, posts, milestones. <strong>Notifications</strong> are messages addressed to you: intro
          requests, replies, mentions; the badge is the unread count and <em>Mark all read</em> clears it.{' '}
          <strong>Events</strong> are sessions and community events you are registered for or invited to.
        </p>
        <p>
          The filter chips narrow the open tab only. Refresh re-fetches all three streams. Nothing here is
          sample data unless it is labelled as sample.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Τρεις ροές, μία σελίδα. Το <strong>Δίκτυο</strong> είναι ό,τι έκαναν όσοι είστε συνδεδεμένοι — νέες
          συνδέσεις, δημοσιεύσεις, ορόσημα. Οι <strong>Ειδοποιήσεις</strong> είναι μηνύματα προς εσάς: αιτήματα
          γνωριμίας, απαντήσεις, αναφορές· το σήμα είναι τα αδιάβαστα και το <em>Σήμανση όλων ως αναγνωσμένα</em>{' '}
          το καθαρίζει. Οι <strong>Εκδηλώσεις</strong> είναι συνεδρίες και εκδηλώσεις κοινότητας στις οποίες
          έχετε εγγραφεί ή προσκληθεί.
        </p>
        <p>
          Τα φίλτρα περιορίζουν μόνο την ανοιχτή καρτέλα. Η ανανέωση ξαναφορτώνει και τις τρεις ροές. Τίποτα εδώ
          δεν είναι δείγμα αν δεν φέρει ετικέτα δείγματος.
        </p>
      </>
    ),
  },
  'cohort-detail': {
    en: (
      <>
        <p>
          One cohort of one program. <strong>Overview</strong> shows the headline numbers — participants, matches
          formed, mentoring sessions and average progress — plus the upcoming schedule. <strong>Participants</strong>{' '}
          lists every startup with its stage and progress; <strong>Matches</strong> are the co-founder pairings formed
          inside this cohort; <strong>Mentoring</strong> is every session booked, completed or cancelled.
        </p>
        <p>
          <em>Share</em> copies this page&rsquo;s link, <em>Export</em> downloads the participant list as CSV, and{' '}
          <em>Message all</em> opens one email with the cohort in Bcc. Sample cohorts are labelled as sample — a
          dash in a stat means it was not recorded, not zero.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Ένας κύκλος ενός προγράμματος. Η <strong>Επισκόπηση</strong> δείχνει τους βασικούς αριθμούς — συμμετέχοντες,
          αντιστοιχίσεις, συνεδρίες καθοδήγησης και μέση πρόοδο — και το επερχόμενο πρόγραμμα. Οι{' '}
          <strong>Συμμετέχοντες</strong> είναι κάθε startup με στάδιο και πρόοδο· οι <strong>Αντιστοιχίσεις</strong>{' '}
          είναι τα ζευγάρια συνιδρυτών που σχηματίστηκαν μέσα στον κύκλο· η <strong>Καθοδήγηση</strong> είναι κάθε
          συνεδρία που κλείστηκε, ολοκληρώθηκε ή ακυρώθηκε.
        </p>
        <p>
          Η <em>Κοινοποίηση</em> αντιγράφει τον σύνδεσμο της σελίδας, η <em>Εξαγωγή</em> κατεβάζει τη λίστα
          συμμετεχόντων σε CSV και το <em>Μήνυμα σε όλους</em> ανοίγει ένα email με τον κύκλο σε Bcc. Οι δείγμα-κύκλοι
          φέρουν ετικέτα δείγματος — μια παύλα σε στατιστικό σημαίνει ότι δεν καταγράφηκε, όχι μηδέν.
        </p>
      </>
    ),
  },
  recommendations: {
    en: (
      <>
        <p>
          These are <strong>ranked picks</strong>, not a browse directory. Order comes from your profile, skills, and
          recent activity, and is recalculated at least hourly. Use <em>Refresh</em> after a profile edit.
        </p>
        <p>
          Connect sends a request. Save writes the same shortlist as{' '}
          <a href="/shortlist">Saved profiles</a>. <em>Not relevant</em> trains the next batch — it does not notify them.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Αυτές είναι <strong>καταταγμένες επιλογές</strong>, όχι κατάλογος περιήγησης. Η σειρά προκύπτει από προφίλ,
          δεξιότητες και πρόσφατη δραστηριότητα, και επανυπολογίζεται τουλάχιστον κάθε ώρα. Πατήστε <em>Ανανέωση</em>{' '}
          μετά από αλλαγή προφίλ.
        </p>
        <p>
          Η Σύνδεση στέλνει αίτημα. Η Αποθήκευση γράφει την ίδια λίστα με τα{' '}
          <a href="/shortlist">Αποθηκευμένα προφίλ</a>. Το <em>Μη σχετικό</em> εκπαιδεύει την επόμενη παρτίδα — δεν
          ειδοποιεί εκείνον.
        </p>
      </>
    ),
  },
  search: {
    en: (
      <>
        <p>
          One box searches people, jobs, events, programs, and posts. Type at least two characters. Filters on the
          results apply only to the open type — they do not hide other categories from a new query.
        </p>
        <p>
          For ranked co-founder suggestions use <a href="/matches">Matches</a>. For a filtered browse, use{' '}
          <a href="/discover">Explore</a>.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Ένα πεδίο ψάχνει ανθρώπους, θέσεις, εκδηλώσεις, προγράμματα και αναρτήσεις. Γράψτε τουλάχιστον δύο χαρακτήρες.
          Τα φίλτρα στα αποτελέσματα ισχύουν μόνο για τον ανοιχτό τύπο — δεν κρύβουν άλλες κατηγορίες από νέα αναζήτηση.
        </p>
        <p>
          Για καταταγμένες προτάσεις συνιδρυτή χρησιμοποιήστε τις <a href="/matches">Αντιστοιχίσεις</a>. Για περιήγηση
          με φίλτρα, την <a href="/discover">Εξερεύνηση</a>.
        </p>
      </>
    ),
  },
  shortlist: {
    en: (
      <>
        <p>
          Profiles you bookmarked from Matches, Discover, or For you. Saving does not notify them and is not a
          connection. Add a note on a card so you remember why you kept it.
        </p>
        <p>
          Connect still goes through the normal request. Remove drops the row and its note — you can save them again later.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Προφίλ που αποθηκεύσατε από Αντιστοιχίσεις, Εξερεύνηση ή Για εσάς. Η αποθήκευση δεν τους ειδοποιεί και δεν
          είναι σύνδεση. Προσθέστε σημείωση στην κάρτα για να θυμάστε γιατί το κρατήσατε.
        </p>
        <p>
          Η Σύνδεση περνά από το κανονικό αίτημα. Η αφαίρεση σβήνει τη γραμμή και τη σημείωση — μπορείτε να το
          αποθηκεύσετε ξανά αργότερα.
        </p>
      </>
    ),
  },
  achievements: {
    en: (
      <>
        <p>
          <strong>XP</strong> and <strong>level</strong> come from the gamification service when it is reachable;
          otherwise the page sums points on unlocked badges, so there is only ever one score. A locked card
          shows progress toward that badge only.
        </p>
        <p>
          Tabs slice the same list: all, unlocked, locked, leaderboard, reputation, badges. The rail filters by
          category. Leaderboard ranks include a &ldquo;You&rdquo; row from your current XP.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Τα <strong>XP</strong> και το <strong>επίπεδο</strong> έρχονται από την υπηρεσία gamification όταν είναι
          διαθέσιμη· αλλιώς η σελίδα αθροίζει πόντους ξεκλειδωμένων σημάτων ώστε να μην υπάρχει δεύτερη βαθμολογία. Μια
          κλειδωμένη κάρτα δείχνει πρόοδο μόνο προς εκείνο το σήμα.
        </p>
        <p>
          Οι καρτέλες κόβουν την ίδια λίστα: όλα, ξεκλειδωμένα, κλειδωμένα, κατάταξη, φήμη, σήματα. Η ράγα φιλτράρει
          ανά κατηγορία. Η κατάταξη περιλαμβάνει γραμμή «Εσείς» από τα τρέχοντα XP.
        </p>
      </>
    ),
  },
  'org-admin': {
    en: (
      <>
        <p>
          This screen administers <strong>one organization</strong> — programs, cohorts, members, and branding for
          this slug — not the platform-wide admin console and not the public org page.
        </p>
        <p>
          Changes here apply to this org only. Cohort detail, applications, and the org dashboard stay one click away
          from the rail and header. A dash in a stat means it was not recorded, not zero.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Αυτή η οθόνη διαχειρίζεται <strong>έναν οργανισμό</strong> — προγράμματα, κύκλους, μέλη και branding για αυτό
          το slug — όχι την κονσόλα όλης της πλατφόρμας και όχι τη δημόσια σελίδα.
        </p>
        <p>
          Οι αλλαγές ισχύουν μόνο για αυτόν τον οργανισμό. Η λεπτομέρεια κύκλου, οι αιτήσεις και ο πίνακας οργανισμού
          μένουν ένα κλικ μακριά από ράγα και κεφαλίδα. Παύλα σε στατιστικό σημαίνει ότι δεν καταγράφηκε, όχι μηδέν.
        </p>
      </>
    ),
  },
  'expert-reviews': {
    en: (
      <>
        <p>
          Request structured feedback on a specific artefact — <strong>pitch deck, financial model, market analysis,</strong>{' '}
          or go-to-market. <strong>My reviews</strong> tracks what you requested; <strong>Find experts</strong> is the
          reviewer directory, filtered by domain; <strong>Insights</strong> aggregates scores once a review is submitted.
        </p>
        <p>
          Reviewers are the platform&rsquo;s vetted mentors, so requesting a review and messaging a reviewer both go through{' '}
          <a href="/mentoring">Mentoring</a>. A dash in a score means it was not rated yet, not zero.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Ζητήστε δομημένη ανατροφοδότηση για ένα συγκεκριμένο παραδοτέο — <strong>pitch deck, οικονομικό μοντέλο,
          ανάλυση αγοράς</strong> ή στρατηγική εισόδου. Οι <strong>αξιολογήσεις μου</strong> δείχνουν όσα ζητήσατε· η{' '}
          <strong>Εύρεση ειδικών</strong> είναι ο κατάλογος αξιολογητών ανά τομέα· οι <strong>Αναλύσεις</strong>{' '}
          συγκεντρώνουν τις βαθμολογίες μόλις υποβληθεί μια αξιολόγηση.
        </p>
        <p>
          Οι αξιολογητές είναι οι ελεγμένοι mentors της πλατφόρμας, οπότε τόσο το αίτημα αξιολόγησης όσο και το μήνυμα
          σε αξιολογητή περνούν από το <a href="/mentoring">Mentoring</a>. Μια παύλα σε βαθμολογία σημαίνει ότι δεν
          έχει βαθμολογηθεί ακόμη, όχι μηδέν.
        </p>
      </>
    ),
  },
  'dashboard-mentor': {
    en: (
      <>
        <p>
          Counts here are the same lists one click away: upcoming sessions, open mentee requests, and active
          mentees. A dash means the metric was not recorded — not zero.
        </p>
        <p>
          Open <a href="/mentor/requests">Requests</a> to accept or decline. <a href="/mentor/sessions">Sessions</a>{' '}
          holds the calendar. Earnings on this home are the month total from completed sessions when the API is up.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Οι αριθμοί εδώ είναι οι ίδιες λίστες ένα κλικ μακριά: επερχόμενες συνεδρίες, ανοιχτά αιτήματα mentee και
          ενεργοί μαθητευόμενοι. Η παύλα σημαίνει ότι η μέτρηση δεν καταγράφηκε — όχι μηδέν.
        </p>
        <p>
          Ανοίξτε τα <a href="/mentor/requests">Αιτήματα</a> για αποδοχή ή απόρριψη. Οι{' '}
          <a href="/mentor/sessions">Συνεδρίες</a> είναι το ημερολόγιο. Τα έσοδα σε αυτή την αρχική είναι το σύνολο
          μήνα από ολοκληρωμένες συνεδρίες όταν το API είναι διαθέσιμο.
        </p>
      </>
    ),
  },
  'mentor-sessions': {
    en: (
      <>
        <p>
          <strong>Upcoming</strong> is still-scheduled sessions. <strong>Past</strong> and <strong>Completed</strong>{' '}
          come from each mentorship&rsquo;s own history — the upcoming endpoint never includes them.
        </p>
        <p>
          Join opens the meeting URL when one exists. Reschedule and Cancel write back to that session. Notes appear
          only after the session is marked completed.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Οι <strong>Επερχόμενες</strong> είναι συνεδρίες που είναι ακόμη προγραμματισμένες. Τα{' '}
          <strong>Παρελθόντα</strong> και τα <strong>Ολοκληρωμένα</strong> έρχονται από το ιστορικό κάθε mentorship —
          το endpoint επερχόμενων δεν τα περιλαμβάνει.
        </p>
        <p>
          Η Συμμετοχή ανοίγει το URL συνάντησης όταν υπάρχει. Η αλλαγή ώρας και η ακύρωση γράφουν στη συνεδρία. Οι
          σημειώσεις εμφανίζονται μόνο αφού η συνεδρία σημειωθεί ολοκληρωμένη.
        </p>
      </>
    ),
  },
  'mentor-requests': {
    en: (
      <>
        <p>
          These are founders asking you to mentor them — not calendar bookings. Accept starts a mentorship;
          decline does not notify them with a message thread.
        </p>
        <p>
          After you accept, the founder appears on <a href="/mentor/mentees">Mentees</a> and can book against{' '}
          <a href="/mentor/availability">Availability</a>.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Αυτοί είναι ιδρυτές που ζητούν καθοδήγηση — όχι κρατήσεις ημερολογίου. Η αποδοχή ξεκινά mentorship· η
          απόρριψη δεν ανοίγει νήμα μηνύματος προς εκείνους.
        </p>
        <p>
          Μετά την αποδοχή, ο ιδρυτής εμφανίζεται στους <a href="/mentor/mentees">Mentees</a> και μπορεί να κλείσει
          ώρα από τη <a href="/mentor/availability">Διαθεσιμότητα</a>.
        </p>
      </>
    ),
  },
  'mentor-mentees': {
    en: (
      <>
        <p>
          One row per founder you have accepted. Session counts and last activity come from that mentorship — they
          cannot disagree with <a href="/mentor/sessions">Sessions</a>.
        </p>
        <p>
          Open a row to message or schedule. Ending a mentorship removes them from this list; it does not delete
          past session notes.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Μία γραμμή ανά ιδρυτή που αποδεχτήκατε. Τα πλήθη συνεδριών και η τελευταία δραστηριότητα έρχονται από
          εκείνο το mentorship — δεν μπορούν να διαφωνούν με τις <a href="/mentor/sessions">Συνεδρίες</a>.
        </p>
        <p>
          Ανοίξτε γραμμή για μήνυμα ή προγραμματισμό. Το τέλος του mentorship τους αφαιρεί από αυτή τη λίστα· δεν
          διαγράφει παλιές σημειώσεις συνεδριών.
        </p>
      </>
    ),
  },
  'mentor-availability': {
    en: (
      <>
        <p>
          These hours are what founders can book. Saving writes the slots the booking API reads — a hidden slot
          cannot be requested.
        </p>
        <p>
          Existing sessions stay on the calendar if you shrink a window; they are not auto-cancelled. Use{' '}
          <a href="/mentor/sessions">Sessions</a> to move or cancel one.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Αυτές οι ώρες είναι ό,τι μπορούν να κλείσουν οι ιδρυτές. Η αποθήκευση γράφει τα slots που διαβάζει το API
          κρατήσεων — ένα κρυφό slot δεν μπορεί να ζητηθεί.
        </p>
        <p>
          Οι υπάρχουσες συνεδρίες μένουν στο ημερολόγιο αν μικρύνετε ένα παράθυρο· δεν ακυρώνονται αυτόματα.
          Χρησιμοποιήστε τις <a href="/mentor/sessions">Συνεδρίες</a> για μετακίνηση ή ακύρωση.
        </p>
      </>
    ),
  },
  'mentor-earnings': {
    en: (
      <>
        <p>
          Pending is completed sessions not yet paid out. Paid is what has already left the platform. A dash is
          &ldquo;not recorded&rdquo;, not a zero payout.
        </p>
        <p>
          Totals always add up from the session list. Invoice and payout method live with
          billing, not on this page.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Τα εκκρεμή είναι ολοκληρωμένες συνεδρίες που δεν έχουν πληρωθεί ακόμη. Τα πληρωμένα έχουν ήδη φύγει από
          την πλατφόρμα. Η παύλα είναι «δεν καταγράφηκε», όχι μηδενική πληρωμή.
        </p>
        <p>
          Τα σύνολα προκύπτουν πάντα από τη λίστα συνεδριών. Τιμολόγιο και μέθοδος πληρωμής
          είναι στη χρέωση, όχι σε αυτή τη σελίδα.
        </p>
      </>
    ),
  },
  'mentor-reviews': {
    en: (
      <>
        <p>
          Reviews appear after a completed session when the founder submitted one. A missing score is not zero —
          it was not rated.
        </p>
        <p>
          You cannot edit a founder&rsquo;s review here. Reply only if the page exposes that action; otherwise the
          review is read-only.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Οι κριτικές εμφανίζονται μετά από ολοκληρωμένη συνεδρία όταν ο ιδρυτής υπέβαλε μία. Η απουσία βαθμού δεν
          είναι μηδέν — δεν βαθμολογήθηκε.
        </p>
        <p>
          Δεν επεξεργάζεστε την κριτική του ιδρυτή εδώ. Απαντήστε μόνο αν η σελίδα δείχνει αυτή την ενέργεια· αλλιώς
          η κριτική είναι μόνο για ανάγνωση.
        </p>
      </>
    ),
  },
  'mentor-profile': {
    en: (
      <>
        <p>
          This is what founders see on <a href="/mentoring">Find mentors</a>: expertise, rate, timezone, and who
          you want to reach. Empty fields stay empty — they are not filled with sample copy.
        </p>
        <p>
          Saving updates the directory listing. Availability still lives on{' '}
          <a href="/mentor/availability">Availability</a>; this page does not set bookable hours.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Αυτό βλέπουν οι ιδρυτές στην <a href="/mentoring">Εύρεση μεντόρων</a>: εξειδίκευση, χρέωση, ζώνη ώρας και
          ποιους θέλετε να προσεγγίσετε. Τα κενά πεδία μένουν κενά — δεν γεμίζουν με δείγμα.
        </p>
        <p>
          Η αποθήκευση ενημερώνει την καταχώριση στον κατάλογο. Η διαθεσιμότητα μένει στη{' '}
          <a href="/mentor/availability">Διαθεσιμότητα</a>· αυτή η σελίδα δεν ορίζει ώρες κράτησης.
        </p>
      </>
    ),
  },
  mentoring: {
    en: (
      <>
        <p>
          This is the public mentor directory — filter by expertise, timezone, and rate. Booking writes a real
          request or session; it is not a silent apply.
        </p>
        <p>
          Mentors set their own hours on Availability. Expert reviews of a pitch or model go through{' '}
          <a href="/expert-reviews">Expert reviews</a>, not this list.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Αυτός είναι ο δημόσιος κατάλογος μεντόρων — φιλτράρετε κατά εξειδίκευση, ζώνη ώρας και χρέωση. Η κράτηση
          γράφει πραγματικό αίτημα ή συνεδρία· δεν είναι σιωπηλή αίτηση.
        </p>
        <p>
          Οι μέντορες ορίζουν τις ώρες τους στη Διαθεσιμότητα. Οι αξιολογήσεις pitch ή μοντέλου περνούν από τις{' '}
          <a href="/expert-reviews">Αξιολογήσεις ειδικών</a>, όχι από αυτή τη λίστα.
        </p>
      </>
    ),
  },
  'dashboard-investor': {
    en: (
      <>
        <p>
          KPIs here count the same deals as <a href="/investor/pipeline">Pipeline</a> and{' '}
          <a href="/investor/watchlist">Watchlist</a>. A dash means the figure was not recorded.
        </p>
        <p>
          Scout to find new companies. Moving a card in Pipeline is what changes these totals — this home does not
          keep a second ledger.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Τα KPI εδώ μετράνε τις ίδιες συμφωνίες με το <a href="/investor/pipeline">Pipeline</a> και τη{' '}
          <a href="/investor/watchlist">Λίστα παρακολούθησης</a>. Η παύλα σημαίνει ότι ο αριθμός δεν καταγράφηκε.
        </p>
        <p>
          Το Scout βρίσκει νέες εταιρείες. Η μετακίνηση κάρτας στο Pipeline είναι αυτό που αλλάζει αυτά τα σύνολα —
          αυτή η αρχική δεν κρατά δεύτερο καθολικό.
        </p>
      </>
    ),
  },
  'investor-scouting': {
    en: (
      <>
        <p>
          Search and filter startups by stage, sector, and traction. Adding to the pipeline or watchlist writes the
          same deal the Kanban reads.
        </p>
        <p>
          Founder readiness scores stay private unless the founder has shared them — a missing score is simply
          left out.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Αναζητήστε και φιλτράρετε startups κατά στάδιο, κλάδο και traction. Η προσθήκη στο pipeline ή στη λίστα
          παρακολούθησης γράφει την ίδια συμφωνία που διαβάζει το Kanban.
        </p>
        <p>
          Οι βαθμολογίες ετοιμότητας ιδρυτή μένουν ιδιωτικές εκτός αν τις έχει μοιραστεί — όταν λείπει, απλώς δεν
          εμφανίζεται.
        </p>
      </>
    ),
  },
  'investor-pipeline': {
    en: (
      <>
        <p>
          Stages run <strong>Discovered → Reviewing → Meeting → Diligence → Negotiating → Invested / Passed</strong>.
          The summary counts the full pipeline; filters only change what is on screen.
        </p>
        <p>
          Move a card to change stage. Invested companies also appear on <a href="/investor/portfolio">Portfolio</a>.
          Passed stays in history — it is not deleted.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Τα στάδια είναι <strong>Ανακάλυψη → Έλεγχος → Συνάντηση → Diligence → Διαπραγμάτευση → Επένδυση / Απόρριψη</strong>.
          Η σύνοψη μετρά όλο το pipeline· τα φίλτρα αλλάζουν μόνο ό,τι φαίνεται.
        </p>
        <p>
          Μετακινήστε κάρτα για αλλαγή σταδίου. Οι επενδυμένες εταιρείες εμφανίζονται και στο{' '}
          <a href="/investor/portfolio">Χαρτοφυλάκιο</a>. Η απόρριψη μένει στο ιστορικό — δεν διαγράφεται.
        </p>
      </>
    ),
  },
  investors: {
    en: (
      <>
        <p>
          A public directory of angels, VCs, and syndicates. This is browse, not your personal pipeline. Filters
          apply to the open list only.
        </p>
        <p>
          Saving or connecting uses the same shortlist and connection flow as Discover. It does not add them as a
          deal on <a href="/investor/pipeline">Pipeline</a>.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Δημόσιος κατάλογος angels, VCs και syndicates. Είναι περιήγηση, όχι το προσωπικό σας pipeline. Τα φίλτρα
          ισχύουν μόνο για την ανοιχτή λίστα.
        </p>
        <p>
          Η αποθήκευση ή η σύνδεση χρησιμοποιεί την ίδια ροή με την Εξερεύνηση. Δεν τους προσθέτει ως συμφωνία στο{' '}
          <a href="/investor/pipeline">Pipeline</a>.
        </p>
      </>
    ),
  },
  'investor-portfolio': {
    en: (
      <>
        <p>
          Companies you marked <strong>Invested</strong> on the pipeline. Tracking here is that deal&rsquo;s record —
          it is not a second cap table.
        </p>
        <p>
          A dash in a metric means it was not shared or not recorded. Updates you log stay on this company; they
          do not publish to the founder feed.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Εταιρείες που σημειώσατε <strong>Επένδυση</strong> στο pipeline. Η παρακολούθηση εδώ είναι το αρχείο εκείνης
          της συμφωνίας — όχι δεύτερος πίνακας κεφαλαίου.
        </p>
        <p>
          Παύλα σε μέτρηση σημαίνει ότι δεν μοιράστηκε ή δεν καταγράφηκε. Οι ενημερώσεις που καταγράφετε μένουν σε
          αυτή την εταιρεία· δεν δημοσιεύονται στο feed του ιδρυτή.
        </p>
      </>
    ),
  },
  'investor-watchlist': {
    en: (
      <>
        <p>
          Founders and startups you are following before a commitment. Watchlist is not a pipeline stage and not a
          connection request.
        </p>
        <p>
          Move someone into <a href="/investor/pipeline">Pipeline</a> when you start diligence. Removing them here
          does not delete a deal that already exists there.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Ιδρυτές και startups που παρακολουθείτε πριν δεσμευτείτε. Η λίστα δεν είναι στάδιο του pipeline και δεν είναι
          αίτημα σύνδεσης.
        </p>
        <p>
          Μεταφέρετέ τους στο <a href="/investor/pipeline">Pipeline</a> όταν ξεκινήσετε diligence. Η αφαίρεση εδώ δεν
          διαγράφει συμφωνία που υπάρχει ήδη εκεί.
        </p>
      </>
    ),
  },
  'investor-analytics': {
    en: (
      <>
        <p>
          Trends are recorded counts for the selected range. Role and sector mix come from deals you actually
          moved — empty charts mean nothing was logged, not a zero market.
        </p>
        <p>
          Response rate is replies you sent versus inbound intros the API recorded. A dash is unmeasured.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Οι τάσεις είναι καταγεγραμμένα πλήθη για το επιλεγμένο διάστημα. Η σύνθεση ρόλου και κλάδου προέρχεται από
          συμφωνίες που μετακινήσατε — κενό γράφημα σημαίνει ότι δεν καταγράφηκε τίποτα, όχι μηδενική αγορά.
        </p>
        <p>
          Το ποσοστό απόκρισης είναι απαντήσεις που στείλατε προς εισερχόμενες γνωριμίες που κατέγραψε το API. Η
          παύλα είναι μη μετρημένο.
        </p>
      </>
    ),
  },
  'org-dashboard': {
    en: (
      <>
        <p>
          This home reads the same endpoints as the org lists: programs, their participants, members, and the
          mentor pool. A figure here is the length of a list one click away.
        </p>
        <p>
          <a href="/org/dashboard">/org/dashboard</a> redirects here. Upcoming dates come from the programs&rsquo;
          own start/end fields — not a separate milestone calendar.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Αυτή η αρχική διαβάζει τα ίδια endpoints με τις λίστες οργανισμού: προγράμματα, συμμετέχοντες, μέλη και
          το pool μεντόρων. Ένας αριθμός εδώ είναι το μήκος μιας λίστας ένα κλικ μακριά.
        </p>
        <p>
          Το <a href="/org/dashboard">/org/dashboard</a> ανακατευθύνει εδώ. Οι επερχόμενες ημερομηνίες έρχονται από
          τα πεδία έναρξης/λήξης των προγραμμάτων — όχι από ξεχωριστό ημερολόγιο οροσήμων.
        </p>
      </>
    ),
  },
  'org-programs': {
    en: (
      <>
        <p>
          Statuses are the API&rsquo;s five: draft, upcoming, active, completed, archived. Enrolment is{' '}
          <em>participantCount</em> from the same program row — it cannot disagree with Applications.
        </p>
        <p>
          Create writes a real program. Opening a row goes to that program&rsquo;s cohorts and applications, not a
          separate catalogue.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Οι καταστάσεις είναι οι πέντε του API: πρόχειρο, επερχόμενο, ενεργό, ολοκληρωμένο, αρχειοθετημένο. Η
          εγγραφή είναι το <em>participantCount</em> της ίδιας γραμμής — δεν μπορεί να διαφωνεί με τις Αιτήσεις.
        </p>
        <p>
          Η δημιουργία γράφει πραγματικό πρόγραμμα. Το άνοιγμα γραμμής πηγαίνει στους κύκλους και τις αιτήσεις του —
          όχι σε ξεχωριστό κατάλογο.
        </p>
      </>
    ),
  },
  'org-applications': {
    en: (
      <>
        <p>
          Applications across every open program you run. Scoring and status write to the same artefact the
          founder sees on Builder Applications.
        </p>
        <p>
          Filters slice this list only. A dash in a score means it was not rated yet. Accepting places the startup
          on <a href="/org/startups">Portfolio</a> and the matching cohort.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Αιτήσεις από κάθε ανοιχτό πρόγραμμα που τρέχετε. Η βαθμολογία και η κατάσταση γράφουν στο ίδιο παραδοτέο
          που βλέπει ο ιδρυτής στις Αιτήσεις του Builder.
        </p>
        <p>
          Τα φίλτρα κόβουν μόνο αυτή τη λίστα. Παύλα σε βαθμό σημαίνει ότι δεν βαθμολογήθηκε ακόμη. Η αποδοχή βάζει
          το startup στο <a href="/org/startups">Χαρτοφυλάκιο</a> και στον αντίστοιχο κύκλο.
        </p>
      </>
    ),
  },
  'org-cohorts': {
    en: (
      <>
        <p>
          One row per cohort of a program. Open a row for participants, matches, and mentoring — that detail page
          has its own help.
        </p>
        <p>
          Counts here are the cohort&rsquo;s recorded members. Empty coverage means no mentor was assigned, not a
          hidden pool.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Μία γραμμή ανά κύκλο προγράμματος. Ανοίξτε γραμμή για συμμετέχοντες, αντιστοιχίσεις και καθοδήγηση — η
          σελίδα λεπτομέρειας έχει δική της βοήθεια.
        </p>
        <p>
          Τα πλήθη εδώ είναι τα καταγεγραμμένα μέλη του κύκλου. Κενή κάλυψη σημαίνει ότι δεν ορίστηκε μέντορας, όχι
          κρυφό pool.
        </p>
      </>
    ),
  },
  'org-startups': {
    en: (
      <>
        <p>
          Startups currently in your programs and graduates. The row is a participant the applications list already
          accepted — not a second CRM.
        </p>
        <p>
          Stage and progress come from that program membership. A dash was not recorded. Open the company for the
          cohort they sit in.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Startups στα προγράμματά σας και απόφοιτοι. Η γραμμή είναι συμμετέχων που οι αιτήσεις έχουν ήδη
          αποδεχτεί — όχι δεύτερο CRM.
        </p>
        <p>
          Στάδιο και πρόοδος έρχονται από εκείνη τη συμμετοχή στο πρόγραμμα. Η παύλα δεν καταγράφηκε. Ανοίξτε την
          εταιρεία για τον κύκλο στον οποίο ανήκει.
        </p>
      </>
    ),
  },
  'org-members': {
    en: (
      <>
        <p>
          People who can run programs, review applications, and change settings for this organization. Invite
          writes a membership — it is not a platform-admin grant.
        </p>
        <p>
          Removing a member drops org access only. Their personal CoFounderBay account stays. Roles here do not
          replace tenant SSO mappings.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Όσοι μπορούν να τρέχουν προγράμματα, να αξιολογούν αιτήσεις και να αλλάζουν ρυθμίσεις αυτού του
          οργανισμού. Η πρόσκληση γράφει ιδιότητα μέλους — όχι δικαίωμα platform-admin.
        </p>
        <p>
          Η αφαίρεση μέλους κόβει μόνο την πρόσβαση στον οργανισμό. Ο προσωπικός λογαριασμός CoFounderBay μένει. Οι
          ρόλοι εδώ δεν αντικαθιστούν αντιστοιχίσεις SSO του tenant.
        </p>
      </>
    ),
  },
  'org-mentors': {
    en: (
      <>
        <p>
          Mentors available to your cohorts. Invite by email or pull from the public{' '}
          <a href="/mentoring">Find mentors</a> directory. They are not automatically every mentor on the platform.
        </p>
        <p>
          Assigning a mentor to a cohort happens on the cohort detail page. This list is the pool, not the
          session calendar.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Μέντορες διαθέσιμοι στους κύκλους σας. Προσκαλέστε με email ή από τον δημόσιο κατάλογο{' '}
          <a href="/mentoring">Εύρεση μεντόρων</a>. Δεν είναι αυτόματα όλοι οι μέντορες της πλατφόρμας.
        </p>
        <p>
          Η ανάθεση μέντορα σε κύκλο γίνεται στη σελίδα του κύκλου. Αυτή η λίστα είναι το pool, όχι το ημερολόγιο
          συνεδριών.
        </p>
      </>
    ),
  },
  'org-events': {
    en: (
      <>
        <p>
          Demo days, office hours, workshops, and pitch nights for your cohorts. RSVP and dates write to this
          org&rsquo;s events — not the public <a href="/events">Events</a> catalogue unless you publish them there.
        </p>
        <p>
          Create opens the real composer. A missing location or time is omitted on the card, not filled with
          sample copy.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Demo days, office hours, workshops και pitch nights για τους κύκλους σας. RSVP και ημερομηνίες γράφουν
          στις εκδηλώσεις αυτού του οργανισμού — όχι στον δημόσιο κατάλογο <a href="/events">Εκδηλώσεων</a> εκτός αν
          τις δημοσιεύσετε εκεί.
        </p>
        <p>
          Η δημιουργία ανοίγει τον πραγματικό συνθέτη. Η απουσία τοποθεσίας ή ώρας παραλείπεται στην κάρτα, δεν
          γεμίζει με δείγμα.
        </p>
      </>
    ),
  },
  'org-analytics': {
    en: (
      <>
        <p>
          Funnel and cohort health are recorded counts for this organization only — not platform-wide admin
          analytics. A dash means the period was not measured.
        </p>
        <p>
          Application totals must match <a href="/org/applications">Applications</a> for the same range. Member
          growth is new org memberships, not every login.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Η χοάνη και η υγεία των κύκλων είναι καταγεγραμμένα πλήθη μόνο γι&rsquo; αυτόν τον οργανισμό — όχι τα αναλυτικά όλης
          της πλατφόρμας. Η παύλα σημαίνει ότι η περίοδος δεν μετρήθηκε.
        </p>
        <p>
          Τα σύνολα αιτήσεων πρέπει να συμφωνούν με τις <a href="/org/applications">Αιτήσεις</a> για το ίδιο
          διάστημα. Η ανάπτυξη μελών είναι νέες ιδιότητες μέλους οργανισμού, όχι κάθε σύνδεση.
        </p>
      </>
    ),
  },
  'org-settings': {
    en: (
      <>
        <p>
          Profile, branding, permissions, and billing for <em>this</em> organization. These are not tenant
          white-label settings and not the platform admin console.
        </p>
        <p>
          Publish branding only when this screen says so. Team permissions overlap <a href="/org/members">Members</a>{' '}
          — changing a role here is the same membership.
        </p>
      </>
    ),
    el: (
      <>
        <p>
          Προφίλ, branding, δικαιώματα και χρέωση για <em>αυτόν</em> τον οργανισμό. Δεν είναι ρυθμίσεις white-label
          tenant και όχι η κονσόλα platform admin.
        </p>
        <p>
          Δημοσιεύστε branding μόνο όταν το λέει αυτή η οθόνη. Τα δικαιώματα ομάδας επικαλύπτονται με τα{' '}
          <a href="/org/members">Μέλη</a> — η αλλαγή ρόλου εδώ είναι η ίδια ιδιότητα μέλους.
        </p>
      </>
    ),
  },
};

/**
 * Renders contextual help from page-registry when helpId/helpTitle exist,
 * or explicit props when provided.
 */
export function PageContextualHelp({ id, title, titleEl, children, defaultOpen, compact, titleClassName }: PageContextualHelpProps) {
  const meta = usePageMeta();
  const { primary } = useLanguagePreference();
  const helpId = id ?? meta?.helpId;
  const helpTitle = title ?? meta?.helpTitle ?? meta?.title;
  const helpTitleEl = titleEl ?? meta?.helpTitleEl ?? meta?.titleEl;

  if (!helpId || !helpTitle) return null;

  const copy = HELP_CONTENT[helpId];
  // Greek falls back to English rather than to the page description: a curated
  // explanation in the wrong language still explains more than a one-line subtitle.
  const curated = copy ? (primary === 'el' ? copy.el ?? copy.en : copy.en) : null;
  const fallbackDescription = primary === 'el' && meta?.descriptionEl ? meta.descriptionEl : meta?.description;
  const body = children ?? curated ?? (fallbackDescription ? <p>{fallbackDescription}</p> : null);

  if (!body) return null;

  return (
    <HelpCallout
      id={helpId}
      title={helpTitle}
      titleEl={helpTitleEl}
      defaultOpen={defaultOpen ?? false}
      compact={compact}
      titleClassName={titleClassName}
    >
      {body}
    </HelpCallout>
  );
}

export { HELP_CONTENT };
