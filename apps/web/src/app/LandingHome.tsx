import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle,
  Compass,
  EyeOff,
  FileCheck,
  GraduationCap,
  Handshake,
  MessageCircle,
  Newspaper,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { NON_GUARANTEE_COPY } from '@cofounderbay/shared';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LandingNav } from '@/components/layout/LandingNav';
import { BilingualText } from '@/components/common/BilingualText';
import { CardHead } from '@/components/common/CardAnatomy';
import { CookieChoicesButton } from '@/components/common/CookieChoicesButton';
import { MainLandmark } from '@/components/layout/AppShell';
import { NeedCard, type NeedCardView } from '@/components/commitments/NeedCard';
import { LiveStatsSection, LiveStatsStrip } from '@/components/landing/LiveStats';
import { PLAN_HIGHLIGHTS } from '@/lib/billing';
import { ORG_FOUNDERS } from '@/lib/demo/org-world';

/**
 * The public home, read the way a first visit reads it: the one move (a need
 * card) and an example of it before anything else, then what protects you,
 * how a card becomes agreed terms, who it is for, what is built, measured
 * counts, plans, and the way in.
 *
 * What this page no longer says, and why (docs/PLATFORM_DESIGN_AI_PLAN.md
 * §48): six five-star testimonials from people who do not exist (one naming
 * a real employer); a "Trusted by" row of Y Combinator, Techstars, EIT
 * Digital, Innovate UK, Google for Startups and MIT Delta v, none of which
 * endorsed anything; "Join thousands of founders"; "signed term sheets";
 * "apply directly through your profile" (there is no apply route); a
 * 14-day free trial the checkout never grants; "priority match placement"
 * (paid placement is a labelled slot that never touches match scores);
 * links to /about, /blog and /contact, which do not exist; and social icons
 * pointing at twitter.com, linkedin.com and github.com themselves.
 */

type Pair = { en: string; el: string };
type Item = { icon: LucideIcon; title: Pair; desc: Pair };

/** One language pair, rendered the product's way. */
function T({ p, wrap, compact = true }: { p: Pair; wrap?: boolean; compact?: boolean }) {
  return <BilingualText en={p.en} el={p.el} compact={compact} wrap={wrap} />;
}

/**
 * The example card, from the demo world: Harbor is Elena Papadopoulos's
 * startup in Aegean Venture Lab's graduated cohort. Never a real company.
 */
const SAMPLE_NEED_CARD: NeedCardView = {
  kind: 'cofounder',
  title: 'Commercial co-founder for Harbor',
  exists: 'Harbor runs a working founder workspace (graph, readiness, builder) with $375K of a $750K seed committed.',
  goal: 'Reach twenty paying founder teams in Athens and close the seed by spring.',
  missing: 'A commercial co-founder who has sold software to founders, studios or programmes.',
  offer: {
    role: 'Co-founder, commercial',
    equity: '8–12%',
    hoursPerWeek: 40,
    scope: 'Own sales, partnerships with programmes and the first commercial hire.',
  },
  category: 'B2B SaaS',
  place: 'Athens, Greece',
  isRemote: false,
  stage: 'building',
  commitment: 'full_time',
  outcome: 'open',
  evidence: [
    { id: 'milestones_completed', count: 4 },
    { id: 'builder_documents', count: 2 },
    { id: 'email_verified', value: true },
  ],
  owner: {
    displayName: ORG_FOUNDERS['user-elena']?.name ?? 'Elena Papadopoulos',
    headline: ORG_FOUNDERS['user-elena']?.headline ?? 'Founder at Harbor',
  },
};

const MOVES: Array<{ title: Pair; note: Pair }> = [
  {
    title: { en: 'Say what is missing', el: 'Πείτε τι λείπει' },
    note: { en: 'What exists, the outcome, who is missing: three sentences and an offer.', el: 'Τι υπάρχει, το αποτέλεσμα, ποιος λείπει: τρεις προτάσεις και μια προσφορά.' },
  },
  {
    title: { en: 'Talk in a protected conversation', el: 'Συζητήστε προστατευμένα' },
    note: { en: 'No phone, email or links until both of you confirm.', el: 'Χωρίς τηλέφωνο, email ή συνδέσμους μέχρι να επιβεβαιώσετε και οι δύο.' },
  },
  {
    title: { en: 'Agree terms in versions', el: 'Συμφωνήστε όρους σε εκδόσεις' },
    note: { en: 'Each change is a new version with its difference; agreement opens the deal room.', el: 'Κάθε αλλαγή είναι νέα έκδοση με τη διαφορά της· η συμφωνία ανοίγει την αίθουσα.' },
  },
];

const PROTECTIONS: Item[] = [
  {
    icon: FileCheck,
    title: { en: 'Checked before it is published', el: 'Έλεγχος πριν από τη δημοσίευση' },
    desc: { en: 'Twelve checks run while you write. Contact details and promises of returns are refused on the server, in the same second.', el: 'Δώδεκα έλεγχοι τρέχουν όσο γράφετε. Στοιχεία επικοινωνίας και υποσχέσεις αποδόσεων απορρίπτονται στον server, στο ίδιο δευτερόλεπτο.' },
  },
  {
    icon: ShieldCheck,
    title: { en: 'No contact details at first', el: 'Χωρίς στοιχεία επικοινωνίας στην αρχή' },
    desc: { en: 'Phones, emails, links and other apps are refused in the first conversation, until both of you confirm.', el: 'Τηλέφωνα, email, σύνδεσμοι και άλλες εφαρμογές απορρίπτονται στην πρώτη συζήτηση, μέχρι να επιβεβαιώσετε και οι δύο.' },
  },
  {
    icon: EyeOff,
    title: { en: 'Blind confirmation', el: 'Τυφλή επιβεβαίωση' },
    desc: { en: 'Neither of you learns the other’s yes before both say yes, so no one is pressed and a quiet no stays quiet.', el: 'Κανείς δεν μαθαίνει το «ναι» του άλλου πριν πουν και οι δύο ναι· κανείς δεν πιέζεται και μια σιωπηλή άρνηση μένει σιωπηλή.' },
  },
  {
    icon: BadgeCheck,
    title: { en: 'Verified before terms', el: 'Επαλήθευση πριν από τους όρους' },
    desc: { en: 'A work email or Verified on LinkedIn is asked before terms open, not to show interest.', el: 'Εταιρικό email ή Verified on LinkedIn ζητείται πριν ανοίξουν οι όροι, όχι για να δείξετε ενδιαφέρον.' },
  },
];

const AFTER_AGREEMENT: Pair[] = [
  { en: 'Readiness', el: 'Ετοιμότητα' },
  { en: 'Milestones', el: 'Ορόσημα' },
  { en: 'Pitch', el: 'Pitch' },
  { en: 'Data room', el: 'Αίθουσα δεδομένων' },
  { en: 'AI next step', el: 'Επόμενο βήμα με AI' },
];

const PERSONAS: Array<{ icon: LucideIcon; role: Pair; headline: Pair; bullets: Pair[] }> = [
  {
    icon: Briefcase,
    role: { en: 'Founder', el: 'Ιδρυτής' },
    headline: { en: 'Find your co-founder', el: 'Βρείτε τον συνιδρυτή σας' },
    bullets: [
      { en: 'A need card instead of a cold message', el: 'Μια κάρτα ανάγκης αντί για ψυχρό μήνυμα' },
      { en: 'Matches that explain their score', el: 'Αντιστοιχίσεις που εξηγούν τη βαθμολογία τους' },
      { en: 'Readiness, builder, pitch and data room in one place', el: 'Ετοιμότητα, builder, pitch και αίθουσα δεδομένων σε ένα σημείο' },
    ],
  },
  {
    icon: GraduationCap,
    role: { en: 'Mentor', el: 'Μέντορας' },
    headline: { en: 'Mentor where it counts', el: 'Καθοδηγήστε εκεί που μετράει' },
    bullets: [
      { en: 'Set your availability and take bookings', el: 'Ορίστε διαθεσιμότητα και δεχτείτε κρατήσεις' },
      { en: 'See what a founder has built before you meet', el: 'Δείτε τι έχει χτίσει ο ιδρυτής πριν συναντηθείτε' },
      { en: 'Recommendations that name the work you did together', el: 'Συστάσεις που ονομάζουν τη δουλειά που κάνατε μαζί' },
    ],
  },
  {
    icon: TrendingUp,
    role: { en: 'Investor', el: 'Επενδυτής' },
    headline: { en: 'Meet founders through people you trust', el: 'Γνωρίστε ιδρυτές μέσα από ανθρώπους που εμπιστεύεστε' },
    bullets: [
      { en: 'Filter by stage, sector and place', el: 'Φίλτρα ανά στάδιο, κλάδο και τόπο' },
      { en: 'Warm introductions from someone who knows both', el: 'Ζεστές συστάσεις από κάποιον που γνωρίζει και τους δύο' },
      { en: 'Follow founders and read their monthly updates', el: 'Ακολουθήστε ιδρυτές και διαβάστε τις μηνιαίες ενημερώσεις τους' },
    ],
  },
  {
    icon: Building2,
    role: { en: 'Programme', el: 'Πρόγραμμα' },
    headline: { en: 'Run your cohort', el: 'Τρέξτε την κοορτή σας' },
    bullets: [
      { en: 'Applications, cohorts and mentors in one workspace', el: 'Αιτήσεις, κοορτές και μέντορες σε έναν χώρο' },
      { en: 'Events and office hours', el: 'Εκδηλώσεις και ώρες γραφείου' },
      { en: 'Your own branding and domain', el: 'Δική σας ταυτότητα και domain' },
    ],
  },
];

const FEATURES: Item[] = [
  { icon: Compass, title: { en: 'Matching that explains itself', el: 'Αντιστοιχίσεις που εξηγούνται' }, desc: { en: 'Scores across skills, stage, industry, place and goals, with the reasons behind each one.', el: 'Βαθμολογία σε δεξιότητες, στάδιο, κλάδο, τόπο και στόχους, με τους λόγους πίσω από την καθεμία.' } },
  { icon: Search, title: { en: 'Search in plain words', el: 'Αναζήτηση με απλά λόγια' }, desc: { en: 'Type “co-founder SaaS Athens full-time”; the words become filters you can see and undo.', el: 'Γράψτε «συνιδρυτής SaaS Αθήνα πλήρης απασχόληση»· οι λέξεις γίνονται φίλτρα που βλέπετε και αναιρείτε.' } },
  { icon: Handshake, title: { en: 'Warm introductions', el: 'Ζεστές συστάσεις' }, desc: { en: 'Ask someone who knows both of you; they decide whether to forward.', el: 'Ζητήστε από κάποιον που γνωρίζει και τους δύο· εκείνος αποφασίζει αν θα προωθήσει.' } },
  { icon: Newspaper, title: { en: 'Founder updates', el: 'Ενημερώσεις ιδρυτών' }, desc: { en: 'A monthly update for the people who follow you, or as a public link.', el: 'Μηνιαία ενημέρωση για όσους σας ακολουθούν, ή ως δημόσιος σύνδεσμος.' } },
  { icon: Users, title: { en: 'Co-founder scout', el: 'Ανιχνευτής συνιδρυτών' }, desc: { en: 'Proposes people for your brief, with its reasons. It never contacts anyone.', el: 'Προτείνει ανθρώπους για το σημείωμά σας, με τους λόγους του. Δεν επικοινωνεί ποτέ με κανέναν.' } },
  { icon: MessageCircle, title: { en: 'Messages', el: 'Μηνύματα' }, desc: { en: 'Conversations that stay, can be searched and take attachments.', el: 'Συνομιλίες που μένουν, αναζητούνται και δέχονται συνημμένα.' } },
  { icon: GraduationCap, title: { en: 'Mentoring and sessions', el: 'Καθοδήγηση και συνεδρίες' }, desc: { en: 'Book one-to-one sessions from a mentor’s availability.', el: 'Κλείστε συνεδρίες ένας προς έναν από τη διαθεσιμότητα του μέντορα.' } },
  { icon: Calendar, title: { en: 'Events', el: 'Εκδηλώσεις' }, desc: { en: 'Meetups, webinars and demo days, with RSVP and a calendar file.', el: 'Meetups, webinars και demo days, με δήλωση συμμετοχής και αρχείο ημερολογίου.' } },
  { icon: Target, title: { en: 'Readiness, builder and data room', el: 'Ετοιμότητα, builder και αίθουσα δεδομένων' }, desc: { en: 'Know what is missing before a meeting, write it, and share it by link.', el: 'Δείτε τι λείπει πριν από μια συνάντηση, γράψτε το και μοιραστείτε το με σύνδεσμο.' } },
];

const PLANS: Array<{ key: keyof typeof PLAN_HIGHLIGHTS; name: Pair; desc: Pair; highlight?: boolean }> = [
  { key: 'free', name: { en: 'Free', el: 'Δωρεάν' }, desc: { en: 'Everything you need to start.', el: 'Ό,τι χρειάζεστε για να ξεκινήσετε.' } },
  { key: 'pro', name: { en: 'Pro', el: 'Pro' }, desc: { en: 'For founders and mentors who are active every week.', el: 'Για ιδρυτές και μέντορες που είναι ενεργοί κάθε εβδομάδα.' }, highlight: true },
  { key: 'team', name: { en: 'Team', el: 'Team' }, desc: { en: 'For accelerators, incubators and programmes.', el: 'Για επιταχυντές, θερμοκοιτίδες και προγράμματα.' } },
];

const FOOTER: Array<{ title: Pair; links: Array<{ href: string; label: Pair }> }> = [
  {
    title: { en: 'Product', el: 'Προϊόν' },
    links: [
      { href: '/#need-cards', label: { en: 'Need cards', el: 'Κάρτες ανάγκης' } },
      { href: '/#how-it-works', label: { en: 'How it works', el: 'Πώς λειτουργεί' } },
      { href: '/pricing', label: { en: 'Pricing', el: 'Τιμές' } },
      { href: '/discover', label: { en: 'Discover', el: 'Ανακάλυψη' } },
      { href: '/events', label: { en: 'Events', el: 'Εκδηλώσεις' } },
    ],
  },
  {
    title: { en: 'Community', el: 'Κοινότητα' },
    links: [
      { href: '/mentoring', label: { en: 'Find a mentor', el: 'Βρείτε μέντορα' } },
      { href: '/groups', label: { en: 'Communities', el: 'Κοινότητες' } },
      { href: '/jobs', label: { en: 'Startup jobs', el: 'Θέσεις σε startups' } },
      { href: '/marketplace', label: { en: 'Service marketplace', el: 'Αγορά υπηρεσιών' } },
      { href: '/learning', label: { en: 'Learning hub', el: 'Κέντρο μάθησης' } },
    ],
  },
  {
    title: { en: 'Trust', el: 'Εμπιστοσύνη' },
    links: [
      { href: '/help', label: { en: 'Help centre', el: 'Κέντρο βοήθειας' } },
      { href: '/privacy', label: { en: 'Privacy policy', el: 'Πολιτική απορρήτου' } },
      { href: '/terms', label: { en: 'Terms of service', el: 'Όροι χρήσης' } },
      { href: '/transparency', label: { en: 'Transparency report', el: 'Αναφορά διαφάνειας' } },
    ],
  },
];

function SectionHeading({ eyebrow, title, lead }: { eyebrow: Pair; title: Pair; lead?: Pair }) {
  return (
    <div className="mx-auto mb-12 max-w-3xl text-center">
      <Badge variant="outline" className="mb-3 border-primary/30 text-primary-accessible"><T p={eyebrow} /></Badge>
      <h2 className="font-display text-3xl font-semibold text-foreground sm:text-4xl"><T p={title} wrap /></h2>
      {/* Under the heading on every width: on a phone the heading sits on
          the 15.343 title step and an unclassed lead (16.327) outranked it. */}
      {lead ? <p className="mt-3 text-sm text-muted-foreground sm:text-lg"><BilingualText en={lead.en} el={lead.el} wrap /></p> : null}
    </div>
  );
}

export function LandingHome() {
  return (
    <div
      className="min-h-screen bg-background"
      style={{ paddingTop: 'calc(var(--banner-network, 0px) + var(--banner-demo, 0px))' }}
    >
      <LandingNav />
      <MainLandmark>

      {/* ── Hero: the one move, and an example of it ─────────────────────── */}
      <section id="need-cards" className="relative overflow-hidden pt-[52px]">
        {/* blur-3xl is 64px. 10% less, then another 5% (54.72px). */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="landing-wash absolute left-[18%] top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/[0.16] sm:left-1/4 sm:h-96 sm:w-96" />
          <div className="landing-wash absolute bottom-0 right-[12%] h-56 w-56 translate-x-1/2 rounded-full bg-primary/[0.11] sm:right-1/4 sm:h-96 sm:w-96" />
        </div>
        <div className="landing-intro relative mx-auto w-full px-4 py-8 sm:px-8 sm:py-16 lg:px-12 lg:py-20 xl:px-16">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14">
            <div className="min-w-0 animate-fade-in text-center lg:text-left">
              <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.06] px-4 py-1.5 text-sm text-primary-accessible">
                <Sparkles className="icon-sm" />
                <BilingualText en="Co-founders, mentors and investors" el="Συνιδρυτές, μέντορες και επενδυτές" compact />
              </span>
              <h1 className="landing-display font-display font-semibold tracking-tight text-foreground">
                <BilingualText
                  en="Say what is missing. Meet who will build it with you."
                  el="Πείτε τι λείπει. Γνωρίστε ποιος θα το χτίσει μαζί σας."
                  stacked
                  wrap
                  secondaryClassName="landing-display-secondary"
                />
              </h1>
              <p className="landing-lead mx-auto mt-4 max-w-2xl text-muted-foreground sm:mt-6 lg:mx-0">
                <BilingualText
                  en="One need card: what exists, the outcome, who is missing. The right people answer in a protected conversation, and terms are agreed in versions."
                  el="Μία κάρτα ανάγκης: τι υπάρχει, το αποτέλεσμα, ποιος λείπει. Οι κατάλληλοι άνθρωποι απαντούν σε προστατευμένη συζήτηση και οι όροι συμφωνούνται σε εκδόσεις."
                  stacked
                  wrap
                />
              </p>

              <div className="mx-auto mt-8 flex w-full max-w-sm flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:items-center sm:justify-center lg:justify-start">
                <Button size="lg" className="w-full gap-2 sm:w-auto" asChild>
                  <Link href="/register?redirect=/commitments/new">
                    <BilingualText en="Write your need card" el="Γράψτε την κάρτα σας" compact />
                    <ArrowRight className="icon-sm" />
                  </Link>
                </Button>
                <Button variant="outline" size="lg" className="w-full sm:w-auto" asChild>
                  <Link href="/demo">
                    <Play className="icon-sm" />
                    <BilingualText en="Try the demo" el="Δοκιμάστε το demo" compact />
                  </Link>
                </Button>
              </div>
              <p className="mt-4 text-sm">
                <Link href="/discover" className="text-muted-foreground hover:text-foreground hover:underline">
                  <BilingualText en="or browse profiles first" el="ή δείτε πρώτα προφίλ" compact />
                </Link>
              </p>

              <ol className="mt-8 grid grid-cols-1 gap-3 text-left sm:grid-cols-3" aria-label="Three moves · Τρεις κινήσεις">
                {MOVES.map(({ title }, index) => (
                  <li key={title.en} className="flex min-w-0 items-center gap-2.5 rounded-xl border border-border bg-card/60 px-3 py-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-2xs font-bold tabular-nums text-primary-foreground">{index + 1}</span>
                    <span className="min-w-0 text-sm font-medium text-foreground"><T p={title} wrap /></span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="min-w-0 animate-fade-in" style={{ animationDelay: '120ms' }}>
              <Card className="mx-auto w-full max-w-xl shadow-lg shadow-primary/5">
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant="secondary" className="text-2xs"><BilingualText en="Example card" el="Ενδεικτική κάρτα" compact /></Badge>
                    <span className="text-2xs text-muted-foreground"><BilingualText en="From the demo, not a real company" el="Από το demo, όχι πραγματική εταιρεία" compact /></span>
                  </div>
                  <NeedCard card={SAMPLE_NEED_CARD} />
                </CardContent>
              </Card>
            </div>
          </div>

          <LiveStatsStrip />
        </div>
      </section>

      {/* ── What protects you ───────────────────────────────────────────── */}
      <section id="trust" className="border-t border-border bg-secondary/10 px-6 py-16 sm:px-8 lg:px-12 xl:px-16">
        <div className="mx-auto w-full">
          <SectionHeading
            eyebrow={{ en: 'What protects you', el: 'Τι σας προστατεύει' }}
            title={{ en: 'Checked before it is published, protected while you talk', el: 'Ελέγχεται πριν δημοσιευτεί, προστατεύεται όσο μιλάτε' }}
          />
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {PROTECTIONS.map(({ icon: Icon, title, desc }) => (
              <li key={title.en} className="min-w-0 space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
                {/* The Endorsements card's head: a 2.5rem mark beside the
                    title, the sentence under both on the mark's edge. */}
                <CardHead
                  titleAs="h3"
                  className="items-center"
                  mark={(
                    <span data-card-mark="" className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10" aria-hidden="true">
                      <Icon className="icon-md text-primary-accessible" />
                    </span>
                  )}
                  title={<T p={title} wrap />}
                />
                <p className="card-body text-muted-foreground"><BilingualText en={desc.en} el={desc.el} wrap /></p>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col items-center gap-2 text-center text-sm text-muted-foreground">
            <p className="font-medium text-foreground"><BilingualText en={NON_GUARANTEE_COPY.en} el={NON_GUARANTEE_COPY.el} wrap /></p>
            <Link href="/transparency" className="text-primary-accessible hover:underline">
              <BilingualText en="How often the rules refused, per half year: the transparency report" el="Πόσο συχνά απέρριψαν οι κανόνες, ανά εξάμηνο: η αναφορά διαφάνειας" compact wrap />
            </Link>
          </div>
        </div>
      </section>

      {/* ── How it works: from a card to agreed terms ───────────────────── */}
      <section id="how-it-works" className="border-t border-border px-6 py-20 sm:px-8 lg:px-12 xl:px-16">
        <div className="mx-auto w-full">
          <SectionHeading
            eyebrow={{ en: 'How it works', el: 'Πώς λειτουργεί' }}
            title={{ en: 'From a card to agreed terms', el: 'Από την κάρτα σε συμφωνημένους όρους' }}
            lead={{ en: 'Mentoring and simple introductions keep ordinary messages; co-founder roles, equity roles and investor introductions use these three steps.', el: 'Η καθοδήγηση και οι απλές συστάσεις κρατούν τα συνηθισμένα μηνύματα· θέσεις συνιδρυτή, ρόλοι με equity και συστάσεις σε επενδυτές ακολουθούν αυτά τα τρία βήματα.' }}
          />
          <ol className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {MOVES.map(({ title, note }, index) => (
              <li key={title.en} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:p-6">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold tabular-nums text-primary-foreground">{index + 1}</span>
                <h3 className="card-title text-foreground"><T p={title} wrap /></h3>
                <p className="card-body text-muted-foreground"><BilingualText en={note.en} el={note.el} wrap /></p>
              </li>
            ))}
          </ol>
          <div className="mt-10 flex flex-col items-center gap-4 text-center">
            <p className="text-sm font-medium text-foreground sm:text-lg">
              <BilingualText en="The agreement is the threshold, not the ceiling." el="Η συμφωνία είναι το κατώφλι, όχι το ταβάνι." wrap />
            </p>
            <ul className="flex flex-wrap justify-center gap-1.5" aria-label="What continues after the agreement · Τι συνεχίζεται μετά τη συμφωνία">
              {AFTER_AGREEMENT.map((p) => (
                <li key={p.en} className="rounded-full border border-border px-2.5 py-1 text-2xs text-muted-foreground"><T p={p} /></li>
              ))}
            </ul>
            <Button variant="outline" asChild>
              <Link href="/demo">
                <BilingualText en="Walk through it in the demo" el="Δείτε το βήμα βήμα στο demo" compact />
                <ArrowRight className="icon-sm" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Who it is for ───────────────────────────────────────────────── */}
      <section id="roles" className="border-t border-border bg-secondary/20 px-6 py-20 sm:px-8 lg:px-12 xl:px-16">
        <div className="mx-auto w-full">
          <SectionHeading
            eyebrow={{ en: 'Roles', el: 'Ρόλοι' }}
            title={{ en: 'Built for every role in a founding team’s first year', el: 'Φτιαγμένο για κάθε ρόλο στον πρώτο χρόνο μιας ιδρυτικής ομάδας' }}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PERSONAS.map(({ icon: Icon, role, headline, bullets }) => (
              <Card key={role.en} className="h-full">
                <CardHeader className="pb-3">
                  <Badge variant="outline" className="w-fit gap-1.5 text-xs text-primary-accessible">
                    <Icon className="icon-sm" />
                    <T p={role} />
                  </Badge>
                  <CardTitle><T p={headline} wrap /></CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {bullets.map((bullet) => (
                    <div key={bullet.en} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="mt-0.5 icon-sm shrink-0 text-status-success" />
                      <BilingualText en={bullet.en} el={bullet.el} wrap />
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── What is built ───────────────────────────────────────────────── */}
      <section id="features" className="border-t border-border px-6 py-20 sm:px-8 lg:px-12 xl:px-16">
        <div className="mx-auto w-full">
          <SectionHeading
            eyebrow={{ en: 'Platform', el: 'Πλατφόρμα' }}
            title={{ en: 'What is built, and where to try it', el: 'Τι έχει χτιστεί, και πού να το δοκιμάσετε' }}
            lead={{ en: 'You can try each of them in the demo.', el: 'Μπορείτε να δοκιμάσετε καθένα από αυτά στο demo.' }}
          />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title.en} className="min-w-0 space-y-3 rounded-2xl border border-border bg-card/70 p-4 sm:p-5">
                <CardHead
                  titleAs="h3"
                  className="items-center"
                  mark={(
                    <span data-card-mark="" className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10" aria-hidden="true">
                      <Icon className="icon-md text-primary-accessible" />
                    </span>
                  )}
                  title={<T p={title} wrap />}
                />
                <div className="min-w-0">
                  <p className="card-body text-muted-foreground"><BilingualText en={desc.en} el={desc.el} wrap /></p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Counted, not claimed (renders only with measured counts) ────── */}
      <LiveStatsSection
        heading={
          <SectionHeading
            eyebrow={{ en: 'By the numbers', el: 'Σε αριθμούς' }}
            title={{ en: 'Counted, not claimed', el: 'Μετρημένα, όχι διατυπωμένα' }}
            lead={{ en: 'Live counts from the platform’s own records. None of them is a target or an estimate.', el: 'Ζωντανές μετρήσεις από τα αρχεία της ίδιας της πλατφόρμας. Κανένας αριθμός δεν είναι στόχος ή εκτίμηση.' }}
          />
        }
      />

      {/* ── Plans ───────────────────────────────────────────────────────── */}
      <section id="pricing" className="border-t border-border bg-secondary/20 px-6 py-20 sm:px-8 lg:px-12 xl:px-16">
        <div className="mx-auto w-full">
          <SectionHeading
            eyebrow={{ en: 'Pricing', el: 'Τιμές' }}
            title={{ en: 'Start free', el: 'Ξεκινήστε δωρεάν' }}
            lead={{ en: 'Paid plans add volume, promoted placement that is always labelled, and team workspaces. Paid placement never changes a match score.', el: 'Τα πληρωμένα πλάνα προσθέτουν όγκο, προωθημένη θέση που πάντα σημαίνεται, και χώρους ομάδας. Η πληρωμένη θέση δεν αλλάζει ποτέ βαθμολογία αντιστοίχισης.' }}
          />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {PLANS.map(({ key, name, desc, highlight }) => (
              <div
                key={key}
                className={highlight
                  ? 'flex flex-col rounded-2xl border border-primary/40 bg-primary/[0.03] p-6'
                  : 'flex flex-col rounded-2xl border border-border bg-card/80 p-6'}
              >
                <h3 className="card-title text-foreground"><T p={name} /></h3>
                <p className="mt-1 text-sm text-muted-foreground"><BilingualText en={desc.en} el={desc.el} wrap /></p>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {PLAN_HIGHLIGHTS[key].map((f) => (
                    <li key={f.en} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="mt-0.5 icon-sm shrink-0 text-status-success" />
                      <BilingualText en={f.en} el={f.el} wrap />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-8 flex justify-center">
            <Button variant="outline" asChild>
              <Link href="/pricing">
                <BilingualText en="Compare plans and prices" el="Σύγκριση πλάνων και τιμών" compact />
                <ArrowRight className="icon-sm" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── The way in ──────────────────────────────────────────────────── */}
      <section id="cta" className="border-t border-border px-6 py-24 sm:px-8 lg:px-12 xl:px-16">
        <div className="mx-auto w-full max-w-3xl text-center">
          <h2 className="font-display text-4xl font-semibold text-foreground">
            <BilingualText en="Write the card. Meet the people." el="Γράψτε την κάρτα. Γνωρίστε τους ανθρώπους." stacked wrap />
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            <BilingualText en="Free to start. Nothing is shared outside the platform until both of you say yes." el="Δωρεάν για να ξεκινήσετε. Τίποτα δεν βγαίνει εκτός πλατφόρμας πριν πείτε και οι δύο ναι." wrap />
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" className="gap-2 px-10" asChild>
              <Link href="/register">
                <BilingualText en="Create a free account" el="Δημιουργία δωρεάν λογαριασμού" compact />
                <ArrowRight className="icon-sm" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="gap-2 px-8" asChild>
              <Link href="/discover">
                <Users className="icon-sm" />
                <BilingualText en="Browse profiles" el="Περιήγηση προφίλ" compact />
              </Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            <BilingualText en="Already have an account?" el="Έχετε ήδη λογαριασμό;" compact />{' '}
            <Link href="/login" className="font-medium text-primary-accessible hover:underline"><BilingualText en="Sign in" el="Σύνδεση" compact /></Link>
          </p>
        </div>
      </section>

      </MainLandmark>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-secondary/10 px-6 py-12 sm:px-8 lg:px-12 xl:px-16">
        <div className="mx-auto w-full">
          <div className="mb-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-4 lg:col-span-2">
              <Logo size="sm" />
              <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                <BilingualText
                  en="Where founding teams go from a first message to agreed terms: need cards, protected conversations and the workspace around them."
                  el="Εκεί όπου οι ιδρυτικές ομάδες πάνε από το πρώτο μήνυμα σε συμφωνημένους όρους: κάρτες ανάγκης, προστατευμένες συζητήσεις και ο χώρος γύρω τους."
                  wrap
                />
              </p>
            </div>
            {FOOTER.map(({ title, links }) => (
              <div key={title.en} className="space-y-4">
                <h2 className="text-sm font-semibold text-foreground"><T p={title} /></h2>
                <ul className="space-y-2.5 text-sm">
                  {links.map(({ href, label }) => (
                    <li key={href}>
                      <Link href={href} className="text-muted-foreground transition-colors hover:text-foreground"><T p={label} /></Link>
                    </li>
                  ))}
                  {title.en === 'Trust' ? (
                    <>
                      <li>
                        <a href="mailto:support@cofounderbay.com" className="text-muted-foreground transition-colors hover:text-foreground">
                          <BilingualText en="Contact" el="Επικοινωνία" compact />
                        </a>
                      </li>
                      <li><CookieChoicesButton /></li>
                    </>
                  ) : null}
                </ul>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center justify-between gap-3 border-t border-border pt-6 sm:flex-row">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} CoFounderBay. <BilingualText en="All rights reserved." el="Με την επιφύλαξη παντός δικαιώματος." compact />
            </p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Zap className="icon-sm text-muted-foreground" />
              <BilingualText en="Built for founders, by founders" el="Από ιδρυτές, για ιδρυτές" compact />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
