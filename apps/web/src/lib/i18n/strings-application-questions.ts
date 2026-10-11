import type { BilingualPair } from './types';

/** Prompts and tips keyed by question id (`yc1`, `ts5`, …). English stays canonical. */
export const APPLICATION_QUESTION_STRINGS: Record<string, BilingualPair> = {
  yc1: {
    en: 'Describe what your company does in 50 characters or less.',
    el: 'Περιγράψτε τι κάνει η εταιρεία σας σε 50 χαρακτήρες ή λιγότερο.',
  },
  yc2: {
    en: 'What is your company going to make? Please describe your product and what it does or will do.',
    el: 'Τι θα φτιάξει η εταιρεία σας; Περιγράψτε το προϊόν και τι κάνει ή θα κάνει.',
  },
  yc3: {
    en: 'Where do you live now, and where would the company be based after YC?',
    el: 'Πού μένετε τώρα και πού θα έχει έδρα η εταιρεία μετά το YC;',
  },
  yc4: {
    en: 'How long have the founders known one another and how did you meet?',
    el: 'Πόσο καιρό γνωρίζονται οι ιδρυτές και πώς γνωριστήκατε;',
  },
  yc5: {
    en: 'Why did you pick this idea to work on? Do you have domain expertise in this area?',
    el: 'Γιατί διαλέξατε αυτή την ιδέα; Έχετε εξειδίκευση στον τομέα;',
  },
  yc6: {
    en: 'What\'s new about what you\'re making? What substitutes do people resort to because it doesn\'t exist yet?',
    el: 'Τι είναι καινούργιο σε αυτό που φτιάχνετε; Σε ποιες εναλλακτικές καταφεύγουν σήμερα επειδή δεν υπάρχει ακόμα;',
  },
  yc7: {
    en: 'Who are your competitors? Who might become competitors?',
    el: 'Ποιοι είναι οι ανταγωνιστές σας; Ποιοι μπορεί να γίνουν;',
  },
  yc8: {
    en: 'How do or will you make money? How much could you make?',
    el: 'Πώς βγάζετε ή θα βγάλετε χρήματα; Πόσα θα μπορούσατε να κερδίσετε;',
  },
  yc9: {
    en: 'How will you get users? If your idea is the type that faces a chicken-and-egg problem, how will you overcome it?',
    el: 'Πώς θα αποκτήσετε χρήστες; Αν η ιδέα έχει πρόβλημα «κότας και αυγού», πώς θα το ξεπεράσετε;',
  },
  yc10: {
    en: 'What have you learned so far from working on your product?',
    el: 'Τι έχετε μάθει μέχρι τώρα δουλεύοντας στο προϊόν;',
  },
  yc11: {
    en: 'If you have already participated in an incubator or accelerator, which one?',
    el: 'Αν έχετε ήδη συμμετάσχει σε incubator ή επιταχυντή, σε ποιον;',
  },
  yc12: {
    en: 'Why do you want to be part of Y Combinator?',
    el: 'Γιατί θέλετε να συμμετάσχετε στο Y Combinator;',
  },
  ts1: {
    en: 'What does your company do? (One sentence)',
    el: 'Τι κάνει η εταιρεία σας; (Μία πρόταση)',
  },
  ts2: {
    en: 'What problem are you solving?',
    el: 'Ποιο πρόβλημα λύνετε;',
  },
  ts3: {
    en: 'What is your solution?',
    el: 'Ποια είναι η λύση σας;',
  },
  ts4: {
    en: 'What is your business model?',
    el: 'Ποιο είναι το επιχειρηματικό σας μοντέλο;',
  },
  ts5: {
    en: 'What traction do you have?',
    el: 'Ποια traction έχετε;',
  },
  ts6: {
    en: 'What is your competitive advantage?',
    el: 'Ποιο είναι το ανταγωνιστικό σας πλεονέκτημα;',
  },
  ts7: {
    en: 'Tell us about your team.',
    el: 'Πείτε μας για την ομάδα σας.',
  },
  ts8: {
    en: 'Why Techstars? Why this program specifically?',
    el: 'Γιατί Techstars; Γιατί αυτό το πρόγραμμα συγκεκριμένα;',
  },
  ts9: {
    en: 'What do you hope to accomplish during the program?',
    el: 'Τι θέλετε να πετύχετε κατά τη διάρκεια του προγράμματος;',
  },
  uni1: {
    en: 'Project/Startup Name',
    el: 'Όνομα έργου / startup',
  },
  uni2: {
    en: 'Executive Summary (max 300 words)',
    el: 'Εκτελεστική σύνοψη (έως 300 λέξεις)',
  },
  uni3: {
    en: 'Problem Statement',
    el: 'Δήλωση προβλήματος',
  },
  uni4: {
    en: 'Proposed Solution',
    el: 'Προτεινόμενη λύση',
  },
  uni5: {
    en: 'Target Market',
    el: 'Αγορά-στόχος',
  },
  uni6: {
    en: 'Team Background and Qualifications',
    el: 'Υπόβαθρο και προσόντα ομάδας',
  },
  uni7: {
    en: 'Current Stage of Development',
    el: 'Τρέχον στάδιο ανάπτυξης',
  },
  uni8: {
    en: 'Resources Needed from the Incubator',
    el: 'Πόροι που χρειάζεστε από το incubator',
  },
  uni9: {
    en: 'Timeline and Milestones',
    el: 'Χρονοδιάγραμμα και ορόσημα',
  },
  uni10: {
    en: 'Connection to University (if any)',
    el: 'Σύνδεση με το πανεπιστήμιο (αν υπάρχει)',
  },
  gr1: {
    en: 'Project Title',
    el: 'Τίτλος έργου',
  },
  gr2: {
    en: 'Abstract (max 250 words)',
    el: 'Περίληψη (έως 250 λέξεις)',
  },
  gr3: {
    en: 'Problem/Need Statement',
    el: 'Δήλωση προβλήματος / ανάγκης',
  },
  gr4: {
    en: 'Innovation Description',
    el: 'Περιγραφή καινοτομίας',
  },
  gr5: {
    en: 'Technical Approach',
    el: 'Τεχνική προσέγγιση',
  },
  gr6: {
    en: 'Market Opportunity',
    el: 'Ευκαιρία αγοράς',
  },
  gr7: {
    en: 'Team Qualifications',
    el: 'Προσόντα ομάδας',
  },
  gr8: {
    en: 'Budget Overview',
    el: 'Επισκόπηση προϋπολογισμού',
  },
  gr9: {
    en: 'Expected Outcomes and Impact',
    el: 'Αναμενόμενα αποτελέσματα και αντίκτυπος',
  },
  gr10: {
    en: 'Sustainability Plan',
    el: 'Σχέδιο βιωσιμότητας',
  },
};

export const APPLICATION_TIP_STRINGS: Record<string, BilingualPair> = {
  yc1: {
    en: 'Be extremely concise. Think elevator pitch in one sentence.',
    el: 'Να είστε εξαιρετικά σύντομοι. Ένα elevator pitch σε μία πρόταση.',
  },
  yc2: {
    en: 'Focus on the product, not the market. Be specific about what you\'re building.',
    el: 'Εστιάστε στο προϊόν, όχι στην αγορά. Να είστε συγκεκριμένοι για το τι χτίζετε.',
  },
  yc4: {
    en: 'YC values strong founder relationships. Be honest about your history.',
    el: 'Το YC εκτιμά ισχυρές σχέσεις ιδρυτών. Να είστε ειλικρινείς για την ιστορία σας.',
  },
  yc5: {
    en: 'Show your unique insight and why you\'re the right team.',
    el: 'Δείξτε τη μοναδική σας ματιά και γιατί είστε η σωστή ομάδα.',
  },
  yc6: {
    en: 'Highlight your innovation and current workarounds.',
    el: 'Αναδείξτε την καινοτομία και τις σημερινές λύσεις ανάγκης.',
  },
  yc7: {
    en: 'Show you understand the landscape. Don\'t say "no competitors".',
    el: 'Δείξτε ότι κατανοείτε το τοπίο. Μην πείτε «δεν υπάρχουν ανταγωνιστές».',
  },
  yc8: {
    en: 'Be specific about your business model and market size.',
    el: 'Να είστε συγκεκριμένοι για το επιχειρηματικό μοντέλο και το μέγεθος αγοράς.',
  },
  yc9: {
    en: 'Show a concrete go-to-market strategy.',
    el: 'Δείξτε συγκεκριμένη στρατηγική go-to-market.',
  },
  yc10: {
    en: 'Share insights from customer discovery and building.',
    el: 'Μοιραστείτε συμπεράσματα από την ανακάλυψη πελατών και την κατασκευή.',
  },
  yc12: {
    en: 'Be specific about what you hope to gain from YC.',
    el: 'Να είστε συγκεκριμένοι για το τι θέλετε να κερδίσετε από το YC.',
  },
  ts5: {
    en: 'Include metrics, users, revenue, partnerships.',
    el: 'Συμπεριλάβετε μετρικά, χρήστες, έσοδα, συνεργασίες.',
  },
};

export function applicationQuestionCopy(id: string, fallback?: string): BilingualPair {
  return APPLICATION_QUESTION_STRINGS[id] ?? { en: fallback ?? id, el: fallback ?? id };
}

export function applicationTipCopy(id: string, fallback?: string): BilingualPair | null {
  if (APPLICATION_TIP_STRINGS[id]) return APPLICATION_TIP_STRINGS[id];
  if (fallback) return { en: fallback, el: fallback };
  return null;
}
