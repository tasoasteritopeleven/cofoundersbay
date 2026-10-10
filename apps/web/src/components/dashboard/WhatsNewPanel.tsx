'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BilingualText } from '@/components/common/BilingualText';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useStoredUser } from '@/hooks/useStoredUser';

export type WhatsNewAudience = 'founder' | 'investor' | 'mentor' | 'org' | 'provider';

type Item = { href: string; en: string; el: string; hintEn: string; hintEl: string; for: readonly WhatsNewAudience[] };

const ALL: readonly WhatsNewAudience[] = ['founder', 'investor', 'mentor', 'org', 'provider'];

/**
 * What was added in the October 2026 rounds, each with the place to try it.
 * Only what is built and reachable is listed; each audience sees what it
 * can use. The list is fixed copy (not computed from today's date), so it
 * renders the same on the server and in the browser.
 */
const ITEMS: Item[] = [
  { href: '/commitments/new', en: 'Need cards', el: 'Κάρτες ανάγκης', hintEn: 'Say what exists, the outcome and who is missing in three sentences; the conversation stays protected until both confirm.', hintEl: 'Τι υπάρχει, το αποτέλεσμα και ποιος λείπει σε τρεις προτάσεις· η συζήτηση μένει προστατευμένη μέχρι να επιβεβαιώσουν και οι δύο.', for: ['founder'] },
  { href: '/scout', en: 'Co-founder scout', el: 'Ανιχνευτής συνιδρυτών', hintEn: 'Proposes people for your brief, with its reasons. It never contacts anyone.', hintEl: 'Προτείνει ανθρώπους για το σημείωμά σας, με τους λόγους του. Δεν επικοινωνεί ποτέ με κανέναν.', for: ['founder'] },
  { href: '/intros', en: 'Warm introductions', el: 'Ζεστές συστάσεις', hintEn: 'Ask someone who knows both of you; they decide whether to forward.', hintEl: 'Ζητήστε από κάποιον που γνωρίζει και τους δύο· εκείνος αποφασίζει αν θα προωθήσει.', for: ALL },
  { href: '/updates', en: 'Founder updates', el: 'Ενημερώσεις ιδρυτών', hintEn: 'Follow founders and read their monthly updates; write yours for followers or as a public link.', hintEl: 'Ακολουθήστε ιδρυτές και διαβάστε τις μηνιαίες ενημερώσεις τους· γράψτε τη δική σας για ακολούθους ή ως δημόσιο σύνδεσμο.', for: ['founder', 'investor', 'mentor'] },
  { href: '/discover', en: 'Search in plain words', el: 'Αναζήτηση με απλά λόγια', hintEn: 'Type "co-founder SaaS Athens full-time" and press Enter; the known words become filters.', hintEl: 'Γράψτε «συνιδρυτής SaaS Αθήνα πλήρης απασχόληση» και πατήστε Enter· οι γνωστές λέξεις γίνονται φίλτρα.', for: ALL },
  { href: '/opportunities', en: 'Alerts on new need cards', el: 'Ειδοποιήσεις για νέες κάρτες ανάγκης', hintEn: 'Save the need-card filters and hear about new cards that fit.', hintEl: 'Αποθηκεύστε τα φίλτρα καρτών ανάγκης και μάθετε για νέες κάρτες που ταιριάζουν.', for: ['founder', 'investor', 'mentor'] },
  { href: '/settings#verification', en: 'Verification', el: 'Επαλήθευση', hintEn: 'A work email or Verified on LinkedIn; the badge then shows on your profile and cards.', hintEl: 'Εταιρικό email ή Verified on LinkedIn· το σήμα εμφανίζεται έπειτα στο προφίλ και στις κάρτες σας.', for: ALL },
  { href: '/settings#open-to', en: '"Open to"', el: '«Ανοιχτός/ή σε»', hintEn: 'A private signal for co-founding, advising, investing or mentoring; you choose who may see it.', hintEl: 'Ιδιωτικό σήμα για συνίδρυση, συμβουλευτική, επένδυση ή καθοδήγηση· εσείς επιλέγετε ποιος το βλέπει.', for: ['founder', 'investor', 'mentor'] },
  { href: '/profile/edit', en: 'Import from LinkedIn', el: 'Εισαγωγή από το LinkedIn', hintEn: 'Fill your profile from your LinkedIn data export; nothing is saved until you press Save.', hintEl: 'Συμπληρώστε το προφίλ από το αρχείο εξαγωγής του LinkedIn· τίποτα δεν αποθηκεύεται πριν πατήσετε Αποθήκευση.', for: ALL },
  { href: '/profile', en: 'Skills with evidence', el: 'Δεξιότητες με τεκμήρια', hintEn: 'Link a skill to a milestone, a builder document or an agreed commitment.', hintEl: 'Συνδέστε μια δεξιότητα με ορόσημο, έγγραφο του builder ή συμφωνημένη δέσμευση.', for: ['founder', 'mentor', 'provider'] },
  { href: '/transparency', en: 'Transparency report', el: 'Αναφορά διαφάνειας', hintEn: 'What the safety rules refused and what members reported, per half year.', hintEl: 'Τι απέρριψαν οι κανόνες ασφαλείας και τι ανέφεραν τα μέλη, ανά εξάμηνο.', for: ALL },
  // 8 October 2026
  { href: '/connections', en: 'People you may know', el: 'Ίσως γνωρίζετε', hintEn: 'Suggestions from the roles you are looking for and what you share; each says why. Never from who viewed whom.', hintEl: 'Προτάσεις από τους ρόλους που αναζητάτε και όσα μοιράζεστε· η καθεμία λέει γιατί. Ποτέ από το ποιος είδε ποιον.', for: ALL },
  { href: '/jobs', en: 'Save jobs and listings', el: 'Αποθήκευση θέσεων και καταχωρίσεων', hintEn: 'Save keeps a job or a listing for you; "Saved only" in the filters brings them back. Nobody is told.', hintEl: 'Η Αποθήκευση κρατά μια θέση ή καταχώριση για εσάς· το «Μόνο αποθηκευμένα» στα φίλτρα τις επαναφέρει. Δεν ειδοποιείται κανείς.', for: ALL },
];

// A new round shows the panel again to those who hid the previous one.
const ROUND = '2026-10-08';

export function whatsNewItems(audience: WhatsNewAudience): Item[] {
  return ITEMS.filter((i) => i.for.includes(audience));
}

/** A dismissible card of what is new for this audience, remembered per member in this browser. */
export function WhatsNewPanel({ audience }: { audience: WhatsNewAudience }) {
  const me = useStoredUser();
  const [hidden, setHidden] = useState(true);
  const key = `cfb.whatsnew.${ROUND}.${me?.id ?? 'guest'}`;
  useEffect(() => {
    try {
      setHidden(window.localStorage.getItem(key) === 'hidden');
    } catch {
      setHidden(false);
    }
  }, [key]);
  if (hidden) return null;
  const items = whatsNewItems(audience);
  const hide = () => {
    setHidden(true);
    try {
      window.localStorage.setItem(key, 'hidden');
    } catch {
      // storage blocked: hidden for this page view
    }
  };
  return (
    <Card aria-labelledby="whats-new-heading">
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="whats-new-heading" className="card-title text-foreground">
              <BilingualText en="What’s new" el="Τι νέο υπάρχει" compact />
            </h2>
            <p className="text-xs text-muted-foreground">
              <BilingualText en="Added on 7 and 8 October 2026. Each opens where you can try it." el="Προστέθηκαν στις 7 και 8 Οκτωβρίου 2026. Το καθένα ανοίγει εκεί που μπορείτε να το δοκιμάσετε." wrap />
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={hide}>
            <BilingualText en="Hide" el="Απόκρυψη" compact />
          </Button>
        </div>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {items.map((item) => (
            <li key={item.href} className="min-w-0">
              <Link href={item.href} className="axis-row block rounded-lg py-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="block text-sm font-medium text-foreground"><BilingualText en={item.en} el={item.el} compact /></span>
                <span className="block text-xs text-muted-foreground"><BilingualText en={item.hintEn} el={item.hintEl} wrap /></span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
