'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  HelpCircle, Search, ChevronDown,
  User, Users, MessageCircle, Shield, CreditCard, Settings,
  GraduationCap, Mail,
  BookOpen, Zap, Heart, Flag,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualAria, bilingualInline } from '@/lib/i18n/format';
import { HELP_FAQ_EL, HELP_TOPIC_EL } from '@/lib/i18n/strings-help';
import { choiceControl, usePageControls, usePageList } from '@/lib/page-controls';

type FAQItem = {
  question: string;
  answer: string;
};

type FAQCategory = {
  id: string;
  title: string;
  icon: React.ElementType;
  description: string;
  faqs: FAQItem[];
};

const faqCategories: FAQCategory[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: Zap,
    description: 'New to CoFounderBay? Start here.',
    faqs: [
      {
        question: 'What is CoFounderBay?',
        answer: 'CoFounderBay helps founding teams find co-founders, mentors and investors and get from a first conversation to agreed terms: need cards, protected conversations, terms in versions, and the workspace around them (readiness, builder, pitch, data room).',
      },
      {
        question: 'How do I create an account?',
        answer: 'Click "Join free" on the homepage and follow the registration. You can sign up with email, Google or LinkedIn. After registration, complete your profile to start getting matched.',
      },
      {
        question: 'Is CoFounderBay free to use?',
        answer: 'Yes. The Free plan has no time limit and includes your profile, discovery, matching, messages and need cards. Paid plans add volume, promoted placement in discovery (always labelled "Promoted", and it never changes a match score) and team workspaces.',
      },
      {
        question: 'How does the matching algorithm work?',
        answer: 'Our AI analyzes your profile, skills, experience, goals, and preferences to find compatible matches. We consider factors like complementary skills, shared values, work style compatibility, and startup stage alignment.',
      },
    ],
  },
  {
    id: 'profile',
    title: 'Profile & Account',
    icon: User,
    description: 'Managing your profile and settings.',
    faqs: [
      {
        question: 'How do I complete my profile?',
        answer: 'Go to Profile > Edit Profile to add your bio, skills, experience, and preferences. A complete profile significantly improves your match quality. Aim for at least 80% completion for best results.',
      },
      {
        question: 'Can I have multiple roles (founder, mentor, investor)?',
        answer: 'Yes! You can indicate multiple roles in your profile. This helps us show you relevant opportunities and connections for each role you play in the ecosystem.',
      },
      {
        question: 'How do I change my email or password?',
        answer: 'Change your password in Settings > Account; you will be asked for the current one first. Changing the email you sign in with is not self-serve yet: write to support@cofounderbay.com from that address.',
      },
      {
        question: 'How do I delete my account?',
        answer: 'In Settings, under Danger Zone, "Request deletion" opens an email to privacy@cofounderbay.com; send it from the address you signed up with and it is answered within 30 days. Deletion is permanent, so export your data first from the same place.',
      },
    ],
  },
  {
    id: 'matching',
    title: 'Matching & Connections',
    icon: Heart,
    description: 'Finding and connecting with others.',
    faqs: [
      {
        question: 'How do I find potential co-founders?',
        answer: 'Use the Discover page to browse profiles, or check your Matches page for AI-recommended connections. You can filter by role, skills, location, and startup stage to find the right people.',
      },
      {
        question: 'What does the compatibility score mean?',
        answer: 'The compatibility score (0-100%) indicates how well you might work together based on complementary skills, shared values, and aligned goals. Higher scores suggest stronger potential partnerships.',
      },
      {
        question: 'How do I send a connection request?',
        answer: 'Click "Connect" on any profile to send a request. Include a personalized message explaining why you\'d like to connect. The other person can accept or decline your request.',
      },
      {
        question: 'Can I save profiles to review later?',
        answer: 'Yes! Use the Shortlist feature to save interesting profiles. Click the bookmark icon on any profile to add it to your shortlist for easy access later.',
      },
    ],
  },
  {
    id: 'messaging',
    title: 'Messaging',
    icon: MessageCircle,
    description: 'Communicating with connections.',
    faqs: [
      {
        question: 'How do I message someone?',
        answer: 'Open Messages, or press Message on their profile. You can write to any member who has not blocked you. Replies to a need card are different: that first conversation is protected, and phone numbers, emails and links are refused until both of you confirm.',
      },
      {
        question: 'Can I send attachments in messages?',
        answer: 'Yes, you can attach files, images, and documents to your messages. Click the attachment icon in the message composer to upload files.',
      },
      {
        question: 'How do I know if someone read my message?',
        answer: 'Read receipts show when your message has been delivered and read. Look for the checkmark icons next to your messages.',
      },
      {
        question: 'Can I block or report someone?',
        answer: 'Yes. Click the menu icon in any conversation to report or block a user. Blocked users cannot message you or see your profile. Reports are reviewed by our moderation team.',
      },
    ],
  },
  {
    id: 'mentoring',
    title: 'Mentoring',
    icon: GraduationCap,
    description: 'Finding and working with mentors.',
    faqs: [
      {
        question: 'How do I find a mentor?',
        answer: 'Visit the Mentoring page to browse available mentors. Filter by expertise, industry, and availability. View their profiles to learn about their background and book a session.',
      },
      {
        question: 'How do I become a mentor?',
        answer: 'Update your profile to indicate you\'re available for mentoring. Set your expertise areas, availability, and optionally your hourly rate. Mentees can then discover and book sessions with you.',
      },
      {
        question: 'How do mentoring sessions work?',
        answer: 'After booking, you\'ll receive a confirmation with session details. Sessions can be conducted via video call (we integrate with popular tools) or in-person. Take notes during sessions to track progress.',
      },
      {
        question: 'Can I cancel or reschedule a session?',
        answer: 'You can change or cancel a booking from the Mentoring page. Please give at least 24 hours\' notice when you can, out of respect for everyone\'s time.',
      },
    ],
  },
  {
    id: 'communities',
    title: 'Communities & Groups',
    icon: Users,
    description: 'Joining and participating in groups.',
    faqs: [
      {
        question: 'How do I join a community?',
        answer: 'Browse communities on the Groups page. Click "Join" on any public community. Some communities require approval from admins before you can join.',
      },
      {
        question: 'Can I create my own community?',
        answer: 'Yes! Click "Create Group" on the Groups page. Set up your community with a name, description, and privacy settings. Invite members and start discussions.',
      },
      {
        question: 'How do community discussions work?',
        answer: 'Communities have discussion threads where members can post topics, share updates, and engage with each other. You can also create polls and share resources.',
      },
      {
        question: 'What are community events?',
        answer: 'Community admins can create events for members. These can be virtual meetups, workshops, or in-person gatherings. RSVP to events to get reminders and updates.',
      },
    ],
  },
  {
    id: 'milestones',
    title: 'Milestones & Progress',
    icon: Flag,
    description: 'Tracking your startup journey.',
    faqs: [
      {
        question: 'What are milestones?',
        answer: 'Milestones help you track important goals and achievements in your startup journey. Create milestones for product launches, funding rounds, team growth, and other key events.',
      },
      {
        question: 'How do I create a milestone?',
        answer: 'Go to the Milestones page and click "New Milestone". Add a title, description, due date and category. You can also add a collaborator and set a priority.',
      },
      {
        question: 'Can I share milestones with my team?',
        answer: 'Yes. Add a collaborator to a milestone; they see it in their own list and can update its status and notes with you.',
      },
      {
        question: 'How do milestone notifications work?',
        answer: 'You\'ll receive notifications for upcoming deadlines, status changes, and collaborator updates. Customize notification preferences in Settings.',
      },
    ],
  },
  {
    id: 'privacy-security',
    title: 'Privacy & Security',
    icon: Shield,
    description: 'Keeping your account safe.',
    faqs: [
      {
        question: 'Who can see my profile?',
        answer: 'Anyone with your profile\'s link can read it, unless you turn "Public profile" off in Settings > Privacy (then only signed-in members can). Members find you in search and recommendations unless you turn "Appear in search" off. Your email stays hidden. Hiding your location is not available yet; your "Open to" signal has its own setting: nobody, verified members or everyone.',
      },
      {
        question: 'How is my data protected?',
        answer: 'We use industry-standard encryption for data in transit and at rest. We never sell your personal information. See our Privacy Policy for full details.',
      },
      {
        question: 'Can I enable two-factor authentication?',
        answer: 'Yes. Go to Settings > Security and turn on two-factor authentication with an authenticator app (time-based codes). SMS codes are not offered.',
      },
      {
        question: 'How do I report a security issue?',
        answer: 'Email security@cofounderbay.com with details of any security concerns. We take all reports seriously and will respond promptly.',
      },
    ],
  },
  {
    id: 'billing',
    title: 'Billing & Subscriptions',
    icon: CreditCard,
    description: 'Payment, upgrades, cancelling and refunds.',
    faqs: [
      {
        question: 'What payment methods do you accept?',
        answer: 'Cards, through Stripe. Enterprise customers can also pay by invoice.',
      },
      {
        question: 'How do I upgrade my plan?',
        answer: 'Go to Settings > Billing to see the plans and subscribe. The plan\'s features apply once the payment is confirmed.',
      },
      {
        question: 'Can I cancel my subscription?',
        answer: 'Yes, you can cancel anytime from Settings > Billing. You\'ll retain access to premium features until the end of your billing period.',
      },
      {
        question: 'Do you offer refunds?',
        answer: 'Write to support@cofounderbay.com with your request. Your rights under EU consumer law apply in every case.',
      },
    ],
  },
];

function FAQAccordion({ faq, isOpen, onToggle }: { faq: FAQItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={onToggle}
        className={cn(
          'flex w-full items-center justify-between py-4 text-left transition-colors focus-ring rounded-md',
          isOpen ? 'text-primary-accessible' : 'hover:text-primary-accessible text-foreground',
        )}
      >
        <span className="text-sm font-medium pr-4"><BilingualText en={faq.question} el={HELP_FAQ_EL[faq.question]?.q} compact wrap /></span>
        <ChevronDown
          className={cn(
            'icon-sm shrink-0 text-muted-foreground transition-transform duration-200',
            isOpen && 'rotate-180 text-primary-accessible',
          )}
          aria-hidden="true"
        />
      </button>
      {isOpen && (
        <div className="pb-4 pr-8 animate-in fade-in slide-in-from-top-1 duration-150">
          <p className="text-sm text-muted-foreground leading-relaxed"><BilingualText en={faq.answer} el={HELP_FAQ_EL[faq.question]?.a} wrap /></p>
        </div>
      )}
    </div>
  );
}

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [openFAQs, setOpenFAQs] = useState<Set<string>>(new Set());

  const toggleFAQ = (categoryId: string, questionIndex: number) => {
    const key = `${categoryId}-${questionIndex}`;
    setOpenFAQs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const filteredCategories = faqCategories.map((category) => ({
    ...category,
    faqs: category.faqs.filter(
      (faq) =>
        !searchQuery ||
        [faq.question, faq.answer, HELP_FAQ_EL[faq.question]?.q ?? '', HELP_FAQ_EL[faq.question]?.a ?? '']
          .some((text) => text.toLowerCase().includes(searchQuery.toLowerCase()))
    ),
  })).filter((category) => category.faqs.length > 0);

  const displayCategories = selectedCategory
    ? filteredCategories.filter((c) => c.id === selectedCategory)
    : filteredCategories;

  // Topic, opening a question and clearing, offered to the assistant; the
  // questions on screen are published so it can answer from them.
  const shown = displayCategories.flatMap((c) => c.faqs.map((faq) => ({ c, faq, key: `${c.id}-${c.faqs.indexOf(faq)}` })));
  usePageControls([
    choiceControl('help_topic', 'Help topic', 'Θέμα βοήθειας', [
      { value: 'all', en: 'All topics', el: 'Όλα τα θέματα' },
      ...faqCategories.map((c) => ({ value: c.id, en: c.title, el: HELP_TOPIC_EL[c.id]?.title ?? c.title })),
    ], selectedCategory ?? 'all', (v) => setSelectedCategory(v === 'all' ? null : v)),
    {
      id: 'open_question',
      labelEn: 'Open a question',
      labelEl: 'Άνοιγμα ερώτησης',
      writes: false,
      options: shown.map(({ faq, key }) => ({ value: key, labelEn: faq.question, labelEl: HELP_FAQ_EL[faq.question]?.q ?? faq.question })),
      unavailableEn: shown.length === 0 ? 'No question matches the search.' : undefined,
      unavailableEl: shown.length === 0 ? 'Καμία ερώτηση δεν ταιριάζει με την αναζήτηση.' : undefined,
      run: (value) => { if (value) setOpenFAQs((prev) => new Set(prev).add(value)); },
    },
    {
      id: 'clear_filters',
      labelEn: 'Clear the search and topic',
      labelEl: 'Καθαρισμός αναζήτησης και θέματος',
      writes: false,
      unavailableEn: !searchQuery && !selectedCategory ? 'No filter is set.' : undefined,
      unavailableEl: !searchQuery && !selectedCategory ? 'Δεν υπάρχει φίλτρο.' : undefined,
      run: () => { setSearchQuery(''); setSelectedCategory(null); },
    },
  ]);
  usePageList([
    {
      id: 'help_questions',
      labelEn: 'Help questions',
      labelEl: 'Ερωτήσεις βοήθειας',
      rows: shown.map(({ c, faq }) => `${c.title}: ${faq.question} — ${faq.answer}`),
      total: faqCategories.reduce((sum, c) => sum + c.faqs.length, 0),
      sample: false,
    },
  ]);

  return (
    <AppShell
      title="Help & Support"
      titleEl="Βοήθεια & υποστήριξη"
      description="Find answers, guides, and get in touch with the CoFounderBay team"
      descriptionEl="Βρείτε απαντήσεις και οδηγούς ή επικοινωνήστε με την ομάδα του CoFounderBay"
      actions={
        // A <button> nested in an <a> is two controls in one place
        // (axe nested-interactive); the link is the control.
        <Button asChild size="sm" className="gap-2">
          <a href="mailto:support@cofounderbay.com">
            <Mail className="icon-sm" aria-hidden="true" />
            <BilingualText en="Contact Support" el="Επικοινωνία με υποστήριξη" compact />
          </a>
        </Button>
      }
    >
      <div className="space-y-6 pb-10">

        {/* Search Hero */}
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-1"><BilingualText en="How can we help you?" el="Πώς μπορούμε να βοηθήσουμε;" compact wrap /></h2>
          <p className="text-sm text-muted-foreground mb-4"><BilingualText en="Search our knowledge base or browse topics below" el="Αναζητήστε στη βάση γνώσεων ή δείτε τα θέματα παρακάτω" wrap /></p>
          <div className="max-w-lg relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" />
            <Input
              type="text"
              aria-label={bilingualAria("Search help", "Αναζήτηση βοήθειας")}
              placeholder={bilingualInline("Search for help (e.g. matching, billing, profile…)", "Αναζήτηση βοήθειας (π.χ. αντιστοιχίσεις, χρεώσεις, προφίλ…)")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-11 bg-background border-border"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <BilingualText en="Clear" el="Καθαρισμός" compact />
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="mt-2 text-xs text-muted-foreground">
              <BilingualText
                en={`${shown.length} result${shown.length !== 1 ? 's' : ''} for “${searchQuery}”`}
                el={`${shown.length} ${shown.length !== 1 ? 'αποτελέσματα' : 'αποτέλεσμα'} για «${searchQuery}»`}
                compact
              />
            </p>
          )}
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={selectedCategory === null}
            onClick={() => setSelectedCategory(null)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
              selectedCategory === null
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground',
            )}
          >
            <BilingualText en="All Topics" el="Όλα τα θέματα" compact />
            <Badge variant="secondary" className={cn('ml-0.5 h-4 px-1.5 text-2xs', selectedCategory === null && 'bg-primary-foreground text-primary-accessible')}>
              {faqCategories.reduce((sum, c) => sum + c.faqs.length, 0)}
            </Badge>
          </button>
          {faqCategories.map((category) => (
            <button
              key={category.id}
              type="button"
              aria-pressed={selectedCategory === category.id}
              onClick={() => setSelectedCategory(selectedCategory === category.id ? null : category.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                selectedCategory === category.id
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground',
              )}
            >
              <category.icon className="h-3 w-3" aria-hidden="true" />
              <BilingualText en={category.title} el={HELP_TOPIC_EL[category.id]?.title} compact />
            </button>
          ))}
        </div>

        {/* Results count when filtering */}
        {(selectedCategory || searchQuery) && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              <BilingualText
                en={`Showing ${displayCategories.length} topic${displayCategories.length !== 1 ? 's' : ''}${selectedCategory ? ` in "${faqCategories.find((c) => c.id === selectedCategory)?.title}"` : ''}`}
                el={`${displayCategories.length} ${displayCategories.length !== 1 ? 'θέματα' : 'θέμα'}${selectedCategory ? ` στο «${HELP_TOPIC_EL[selectedCategory]?.title ?? ''}»` : ''}`}
                compact
                wrap
              />
            </p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedCategory(null); }}
              className="text-xs text-primary-accessible hover:underline"
            >
              <BilingualText en="Clear all filters" el="Καθαρισμός όλων των φίλτρων" compact />
            </button>
          </div>
        )}

        {/* FAQ Content */}
        {displayCategories.length === 0 ? (
          <Card>
            <CardContent>
              <HelpCircle className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-foreground mb-2"><BilingualText en="No results found" el="Δεν βρέθηκαν αποτελέσματα" compact /></h2>
              <p className="text-sm text-muted-foreground mb-4"><BilingualText en="Try a different search term or browse all topics" el="Δοκιμάστε άλλον όρο ή δείτε όλα τα θέματα" wrap /></p>
              <Button variant="outline" size="sm" onClick={() => { setSearchQuery(''); setSelectedCategory(null); }}>
                <BilingualText en="Clear search" el="Καθαρισμός αναζήτησης" compact />
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {displayCategories.map((category) => (
              <Card key={category.id} className="shadow-sm border-border">
                <CardHeader className="border-b border-border py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <category.icon className="h-4 w-4 text-primary-accessible" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm font-semibold"><BilingualText en={category.title} el={HELP_TOPIC_EL[category.id]?.title} compact /></CardTitle>
                      <p className="text-xs text-muted-foreground"><BilingualText en={category.description} el={HELP_TOPIC_EL[category.id]?.description} compact wrap /></p>
                    </div>
                    <Badge variant="outline" className="text-2xs shrink-0">
                      <BilingualText en={`${category.faqs.length} FAQ${category.faqs.length !== 1 ? 's' : ''}`} el={`${category.faqs.length} ${category.faqs.length !== 1 ? 'ερωτήσεις' : 'ερώτηση'}`} compact />
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 px-6">
                  {category.faqs.map((faq, index) => (
                    <FAQAccordion
                      key={index}
                      faq={faq}
                      isOpen={openFAQs.has(`${category.id}-${index}`)}
                      onToggle={() => toggleFAQ(category.id, index)}
                    />
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Contact Support */}
        <Card>
          <CardContent>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
              <Mail className="icon-lg text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1"><BilingualText en="Still need help?" el="Χρειάζεστε ακόμα βοήθεια;" compact /></h2>
            <p className="text-sm text-muted-foreground mb-5 max-w-prose">
              <BilingualText en="Can&apos;t find what you&apos;re looking for? Our support team typically responds within 24 hours." el="Δεν βρίσκετε αυτό που ψάχνετε; Η ομάδα υποστήριξης απαντά συνήθως μέσα σε 24 ώρες." wrap />
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="gap-2">
                <a href="mailto:support@cofounderbay.com">
                  <Mail className="icon-sm" aria-hidden="true" />
                  <BilingualText en="Email Support" el="Υποστήριξη μέσω email" compact />
                </a>
              </Button>
              <Button variant="outline" className="gap-2" asChild>
                {/* It opens the reader's own inbox; there is no live support
                    chat behind it, so it no longer says "Live chat". */}
                <Link href="/messages">
                  <MessageCircle className="icon-sm" aria-hidden="true" />
                  <BilingualText en="Your messages" el="Τα μηνύματά σας" compact />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link href="/terms" className="group">
            <Card className="h-full transition-colors hover:border-primary/40">
              <CardContent className="pt-5 pb-5">
                <BookOpen className="mx-auto h-7 w-7 text-muted-foreground group-hover:text-primary-accessible transition-colors mb-2" />
                <h3 className="text-sm font-medium text-foreground mb-0.5"><BilingualText en="Terms of Service" el="Όροι χρήσης" compact /></h3>
                <p className="text-xs text-muted-foreground"><BilingualText en="Read our terms and conditions" el="Διαβάστε τους όρους χρήσης" compact /></p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/privacy" className="group">
            <Card className="h-full transition-colors hover:border-primary/40">
              <CardContent className="pt-5 pb-5">
                <Shield className="mx-auto h-7 w-7 text-muted-foreground group-hover:text-primary-accessible transition-colors mb-2" />
                <h3 className="text-sm font-medium text-foreground mb-0.5"><BilingualText en="Privacy Policy" el="Πολιτική απορρήτου" compact /></h3>
                <p className="text-xs text-muted-foreground"><BilingualText en="Learn how we protect your data" el="Μάθετε πώς προστατεύουμε τα δεδομένα σας" compact /></p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/settings" className="group">
            <Card className="h-full transition-colors hover:border-primary/40">
              <CardContent className="pt-5 pb-5">
                <Settings className="mx-auto h-7 w-7 text-muted-foreground group-hover:text-primary-accessible transition-colors mb-2" />
                <h3 className="text-sm font-medium text-foreground mb-0.5"><BilingualText en="Account Settings" el="Ρυθμίσεις λογαριασμού" compact /></h3>
                <p className="text-xs text-muted-foreground"><BilingualText en="Manage your preferences" el="Διαχειριστείτε τις προτιμήσεις σας" compact /></p>
              </CardContent>
            </Card>
          </Link>
        </div>

      </div>
    </AppShell>
  );
}
