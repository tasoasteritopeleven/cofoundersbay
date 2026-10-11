'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { takeReturnTo } from '@/lib/return-to';
import { User, Briefcase, Zap, ArrowRight, Check, Loader2, Bot, Rocket, HelpCircle } from 'lucide-react';
import { createProfile, listSkills, type Skill } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/brand/Logo';
import { bilingualInline } from '@/lib/i18n/format';
import { BilingualText } from '@/components/common/BilingualText';
import { useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';

type Role = 'founder' | 'mentor' | 'investor' | 'org';

interface Message {
  id: string;
  from: 'bot' | 'user';
  content: React.ReactNode;
  timestamp: Date;
}

type Step =
  | 'welcome'
  | 'name'
  | 'role'
  | 'headline'
  | 'location'
  | 'bio'
  | 'skills'
  | 'submitting'
  | 'done';

/** The six answers a founder gives, in order — the stepper and the "why" hint read from here. */
type InputStep = 'name' | 'role' | 'headline' | 'location' | 'bio' | 'skills';
const INPUT_STEPS: InputStep[] = ['name', 'role', 'headline', 'location', 'bio', 'skills'];

const STEP_META: Record<InputStep, { labelEn: string; labelEl: string; whyEn: string; whyEl: string }> = {
  name: {
    labelEn: 'Name', labelEl: 'Όνομα',
    whyEn: 'Shown on your profile card and in messages — people connect with a name, not a handle.',
    whyEl: 'Εμφανίζεται στην κάρτα προφίλ και στα μηνύματα — οι άνθρωποι συνδέονται με όνομα, όχι με ψευδώνυμο.',
  },
  role: {
    labelEn: 'Role', labelEl: 'Ρόλος',
    whyEn: 'Decides who appears as a match: founders are paired with complementary co-founders, mentors and investors with founders.',
    whyEl: 'Καθορίζει ποιοι εμφανίζονται ως αντιστοιχίσεις: οι ιδρυτές ζευγαρώνουν με συμπληρωματικούς συνιδρυτές, οι mentors και επενδυτές με ιδρυτές.',
  },
  headline: {
    labelEn: 'Headline', labelEl: 'Τίτλος',
    whyEn: 'The one line others read first in Discover and Matches. Say what you build and what you are looking for.',
    whyEl: 'Η μία γραμμή που διαβάζουν πρώτη οι άλλοι στην Εξερεύνηση και τις Αντιστοιχίσεις. Πείτε τι φτιάχνετε και τι ψάχνετε.',
  },
  location: {
    labelEn: 'Location', labelEl: 'Τοποθεσία',
    whyEn: 'A small tie-breaker in match scoring and a filter in Discover. Optional — skip it if you work fully remote.',
    whyEl: 'Μικρό κριτήριο ισοβαθμίας στη βαθμολογία αντιστοίχισης και φίλτρο στην Εξερεύνηση. Προαιρετικό — παραλείψτε το αν δουλεύετε πλήρως απομακρυσμένα.',
  },
  bio: {
    labelEn: 'About you', labelEl: 'Σχετικά με εσάς',
    whyEn: 'Gives the AI assistant and your matches context: what you are working on and what help you need. You can edit it any time.',
    whyEl: 'Δίνει στον βοηθό AI και στις αντιστοιχίσεις σας πλαίσιο: πάνω σε τι δουλεύετε και τι βοήθεια χρειάζεστε. Μπορείτε να το αλλάξετε οποτεδήποτε.',
  },
  skills: {
    labelEn: 'Skills', labelEl: 'Δεξιότητες',
    whyEn: 'Skill overlap and complementarity are the largest part of your match score. Pick the ones you would actually bring to a team.',
    whyEl: 'Η επικάλυψη και η συμπληρωματικότητα δεξιοτήτων είναι το μεγαλύτερο μέρος της βαθμολογίας αντιστοίχισης. Διαλέξτε όσες θα φέρνατε πραγματικά σε μια ομάδα.',
  },
};

const ROLE_OPTIONS: { value: Role; label: string; labelEl: string; desc: string; descEl: string; icon: React.ElementType }[] = [
  { value: 'founder', label: 'Founder', labelEl: 'Ιδρυτής', desc: 'Building and leading a startup', descEl: 'Χτίζει και οδηγεί ένα startup', icon: Rocket },
  { value: 'mentor', label: 'Mentor', labelEl: 'Mentor', desc: 'Coaching and guiding teams', descEl: 'Καθοδηγεί ομάδες', icon: User },
  { value: 'investor', label: 'Investor', labelEl: 'Επενδυτής', desc: 'Backing early-stage teams', descEl: 'Στηρίζει ομάδες πρώιμου σταδίου', icon: Zap },
  { value: 'org', label: 'Organization', labelEl: 'Οργανισμός', desc: 'Representing a company or institution', descEl: 'Εκπροσωπεί εταιρεία ή φορέα', icon: Briefcase },
];

const BOT_QUESTIONS: Record<Step, { en: string; el: string }> = {
  welcome: {
    en: "Welcome to CoFounderBay! I'll help you set up your profile in six quick steps — about three minutes. Every answer shapes who you get matched with.",
    el: 'Καλώς ήρθατε στο CoFounderBay! Θα σας βοηθήσω να φτιάξετε το προφίλ σας σε έξι γρήγορα βήματα — περίπου τρία λεπτά. Κάθε απάντηση διαμορφώνει με ποιους θα αντιστοιχιστείτε.',
  },
  name: { en: "Let's start! What should we call you?", el: 'Ας ξεκινήσουμε! Πώς να σας λέμε;' },
  role: { en: 'Nice to meet you! What best describes your role?', el: 'Χαίρω πολύ! Τι περιγράφει καλύτερα τον ρόλο σας;' },
  headline: { en: 'Perfect. What\'s your professional headline? (e.g. "Founder @ Stealth | Building AI tools")', el: 'Τέλεια. Ποιος είναι ο επαγγελματικός σας τίτλος; (π.χ. «Founder @ Stealth | Φτιάχνω εργαλεία AI»)' },
  location: { en: 'Where are you based? You can skip this.', el: 'Πού βρίσκεστε; Μπορείτε να το παραλείψετε.' },
  bio: { en: "Tell us a bit about yourself — what you're working on and what you're looking for.", el: 'Πείτε μας λίγα λόγια — πάνω σε τι δουλεύετε και τι ψάχνετε.' },
  skills: { en: 'Last step: what are your key skills? Select all that apply.', el: 'Τελευταίο βήμα: ποιες είναι οι βασικές σας δεξιότητες; Επιλέξτε όσες ισχύουν.' },
  submitting: { en: 'Creating your profile…', el: 'Δημιουργία του προφίλ σας…' },
  done: { en: 'Your profile is ready! Welcome to CoFounderBay.', el: 'Το προφίλ σας είναι έτοιμο! Καλώς ήρθατε στο CoFounderBay.' },
};

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <Bot className="icon-sm text-muted-foreground" />
      </div>
      <div className="rounded-2xl rounded-bl-sm bg-card border border-border px-4 py-3">
        <div className="flex gap-1 items-center h-4">
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

function BotBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-end gap-2 animate-fade-in">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <Bot className="icon-sm text-muted-foreground" />
      </div>
      <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-card border border-border px-4 py-3">
        <p className="text-sm text-foreground leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-end justify-end gap-2 animate-fade-in">
      <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-3" data-own-message="">
        <p className="text-sm text-primary-foreground leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

export function ConversationalOnboarding() {
  const router = useRouter();
  const { primary } = useLanguagePreference();
  const [step, setStep] = useState<Step>('welcome');
  const [showTyping, setShowTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Bot prose is one language at a time — read from the primary preference
  // at the moment the bubble is created, so earlier bubbles never re-flow.
  const say = useCallback((q: { en: string; el: string }) => (primary === 'el' ? q.el : q.en), [primary]);

  const form = useRef({
    displayName: '',
    headline: '',
    location: '',
    bio: '',
    role: 'founder' as Role,
    skillIds: [] as string[],
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, showTyping, scrollToBottom]);

  const addBotMessage = useCallback((content: React.ReactNode, delay = 600) => {
    setShowTyping(true);
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        setShowTyping(false);
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), from: 'bot', content, timestamp: new Date() },
        ]);
        resolve();
      }, delay);
    });
  }, []);

  const addUserMessage = useCallback((content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), from: 'user', content, timestamp: new Date() },
    ]);
  }, []);

  // Init: show welcome message
  useEffect(() => {
    void addBotMessage(say(BOT_QUESTIONS.welcome), 800).then(() => {
      setTimeout(() => void addBotMessage(say(BOT_QUESTIONS.name), 400), 200);
      setStep('name');
    });
    // Load skills in background
    listSkills().then(setSkills).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const advanceTo = useCallback(async (nextStep: Step, userMsg?: string) => {
    if (userMsg) addUserMessage(userMsg);
    await addBotMessage(say(BOT_QUESTIONS[nextStep]), 700);
    setStep(nextStep);
    setInputValue('');
    setTimeout(() => (inputRef.current as HTMLInputElement | null)?.focus(), 100);
  }, [addBotMessage, addUserMessage, say]);

  const handleSubmitName = useCallback(async () => {
    const name = inputValue.trim();
    if (!name) return;
    form.current.displayName = name;
    await advanceTo('role', name);
  }, [inputValue, advanceTo]);

  const handleSelectRole = useCallback(async (role: Role, label: string) => {
    form.current.role = role;
    setSelectedRole(role);
    await advanceTo('headline', label);
  }, [advanceTo]);

  const handleSubmitHeadline = useCallback(async () => {
    const h = inputValue.trim();
    if (!h) return;
    form.current.headline = h;
    await advanceTo('location', h);
  }, [inputValue, advanceTo]);

  const handleSubmitLocation = useCallback(async () => {
    const loc = inputValue.trim();
    form.current.location = loc;
    await advanceTo('bio', loc || say({ en: 'Not specified', el: 'Δεν προσδιορίστηκε' }));
  }, [inputValue, advanceTo, say]);

  const handleSubmitBio = useCallback(async () => {
    const bio = inputValue.trim();
    form.current.bio = bio;
    await advanceTo('skills', bio.length > 60 ? bio.slice(0, 57) + '...' : bio || say({ en: 'Skipped', el: 'Παραλείφθηκε' }));
  }, [inputValue, advanceTo, say]);

  const handleToggleSkill = useCallback((skillId: string, skillName: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skillId) ? prev.filter((s) => s !== skillId) : [...prev, skillId]
    );
    form.current.skillIds = selectedSkills.includes(skillId)
      ? selectedSkills.filter((s) => s !== skillId)
      : [...selectedSkills, skillId];
  }, [selectedSkills]);

  const handleSubmitSkills = useCallback(async () => {
    form.current.skillIds = selectedSkills;
    const skillNames = skills
      .filter((s) => selectedSkills.includes(s.id))
      .map((s) => s.name)
      .join(', ') || say({ en: 'None selected', el: 'Καμία επιλογή' });

    addUserMessage(skillNames);
    setSubmitting(true);
    setStep('submitting');

    try {
      await createProfile({
        displayName: form.current.displayName,
        headline: form.current?.headline || undefined,
        bio: form.current?.bio || undefined,
        location: form.current?.location || undefined,
        role: form.current.role,
        skillIds: form.current.skillIds.length ? form.current.skillIds : undefined,
      });
      await addBotMessage(say(BOT_QUESTIONS.done), 500);
      setStep('done');
      setTimeout(() => router.push(takeReturnTo('/')), 1500);
    } catch {
      await addBotMessage(say({ en: 'Something went wrong saving your profile. Check your connection and try again.', el: 'Κάτι πήγε στραβά στην αποθήκευση του προφίλ. Ελέγξτε τη σύνδεση και δοκιμάστε ξανά.' }), 500);
      setSubmitting(false);
      setStep('skills');
    }
  }, [selectedSkills, skills, addBotMessage, addUserMessage, router, say]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (step === 'name') void handleSubmitName();
      else if (step === 'headline') void handleSubmitHeadline();
      else if (step === 'location') void handleSubmitLocation();
    }
  };

  const stepIndex = INPUT_STEPS.indexOf(step as InputStep);
  const isInputStep = stepIndex >= 0;
  const completedCount = step === 'submitting' || step === 'done' ? INPUT_STEPS.length : Math.max(stepIndex, 0);
  const progress = (completedCount / INPUT_STEPS.length) * 100;
  const meta = isInputStep ? STEP_META[INPUT_STEPS[stepIndex]] : null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header: named stepper with live progress */}
      <header className="border-b border-border bg-card px-4 py-3 sm:px-6" data-testid="onboarding-header">
        <div className="mx-auto w-full max-w-2xl space-y-3">
          <div className="flex items-center gap-3">
            <Logo size="xs" />
            <p className="border-l border-border pl-3 text-xs text-muted-foreground">
              <BilingualText en="Profile setup" el="Ρύθμιση προφίλ" compact />
            </p>
            <p className="ml-auto text-xs font-medium tabular-nums text-foreground" data-testid="onboarding-step-counter">
              {step === 'done' ? (
                <BilingualText en="Done" el="Ολοκληρώθηκε" compact />
              ) : (
                <BilingualText
                  en={`Step ${Math.min(completedCount + 1, INPUT_STEPS.length)} of ${INPUT_STEPS.length}`}
                  el={`Βήμα ${Math.min(completedCount + 1, INPUT_STEPS.length)} από ${INPUT_STEPS.length}`}
                  compact
                />
              )}
            </p>
          </div>
          <Progress
            value={progress}
            className="h-1.5"
            aria-label={bilingualInline('Profile setup progress', 'Πρόοδος ρύθμισης προφίλ')}
          />
          <ol className="grid grid-cols-6 gap-1" aria-label={bilingualInline('Setup steps', 'Βήματα ρύθμισης')}>
            {INPUT_STEPS.map((s, i) => {
              const state = i < completedCount ? 'done' : i === completedCount && step !== 'done' ? 'current' : 'todo';
              return (
                <li
                  key={s}
                  aria-current={state === 'current' ? 'step' : undefined}
                  data-testid={`onboarding-step-${s}`}
                  className={cn(
                    'flex min-w-0 items-center gap-1.5 text-2xs sm:text-xs',
                    state === 'current' ? 'text-foreground' : state === 'done' ? 'text-primary-accessible' : 'text-muted-foreground/70',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-2xs font-semibold motion-safe:transition-colors',
                      state === 'done' && 'border-primary bg-primary text-primary-foreground',
                      state === 'current' && 'border-primary bg-primary/10 text-primary-accessible',
                      state === 'todo' && 'border-border bg-background',
                    )}
                    aria-hidden="true"
                  >
                    {state === 'done' ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  <span className={cn('hidden truncate sm:inline', state === 'current' && 'font-medium')}>
                    {primary === 'el' ? STEP_META[s].labelEl : STEP_META[s].labelEn}
                  </span>
                </li>
              );
            })}
          </ol>
          {meta && (
            <p className="text-xs font-medium text-foreground sm:hidden" data-testid="onboarding-current-step-label">
              {primary === 'el' ? meta.labelEl : meta.labelEn}
            </p>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-2xl mx-auto w-full">
        {messages.map((msg) =>
          msg.from === 'bot'
            ? <BotBubble key={msg.id}>{msg.content}</BotBubble>
            : <UserBubble key={msg.id}>{msg.content as string}</UserBubble>
        )}
        {showTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-border bg-card px-4 py-4">
        <div className="max-w-2xl mx-auto space-y-3">

          {/* Why we ask — one line per step, so no field feels arbitrary. */}
          {meta && !showTyping && (
            <p
              className="flex items-start gap-2 rounded-xl bg-primary/5 px-3 py-2 text-xs leading-snug text-muted-foreground"
              data-testid="onboarding-why-hint"
            >
              <HelpCircle className="mt-0.5 icon-sm shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>
                <span className="font-medium text-foreground">
                  <BilingualText en="Why we ask:" el="Γιατί το ρωτάμε:" compact />
                </span>{' '}
                {primary === 'el' ? meta.whyEl : meta.whyEn}
              </span>
            </p>
          )}

          {/* Role selection */}
          {step === 'role' && !showTyping && (
            <div className="grid grid-cols-2 gap-2">
              {ROLE_OPTIONS.map(({ value, label, labelEl, desc, descEl, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  data-testid={`onboarding-role-${value}`}
                  onClick={() => void handleSelectRole(value, primary === 'el' ? labelEl : label)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-3 text-left transition-all',
                    selectedRole === value
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50 hover:bg-secondary/50',
                  )}
                >
                  <Icon className="icon-md text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground"><BilingualText en={label} el={labelEl} compact /></p>
                    <p className="text-xs text-muted-foreground"><BilingualText en={desc} el={descEl} wrap /></p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Skills multi-select */}
          {step === 'skills' && !showTyping && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                {(skills.length ? skills : [
                  { id: 'react', name: 'React', slug: 'react', category: null },
                  { id: 'node', name: 'Node.js', slug: 'node', category: null },
                  { id: 'product', name: 'Product Management', slug: 'product', category: null },
                  { id: 'fundraising', name: 'Fundraising', slug: 'fundraising', category: null },
                  { id: 'sales', name: 'Sales', slug: 'sales', category: null },
                  { id: 'marketing', name: 'Marketing', slug: 'marketing', category: null },
                  { id: 'design', name: 'UI/UX Design', slug: 'design', category: null },
                  { id: 'ml', name: 'Machine Learning', slug: 'ml', category: null },
                ]).map((skill) => (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => handleToggleSkill(skill.id, skill.name)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      selectedSkills.includes(skill.id)
                        ? 'border-primary bg-primary/10 text-primary-accessible'
                        : 'border-border text-muted-foreground hover:border-primary/50',
                    )}
                  >
                    {selectedSkills.includes(skill.id) && <Check className="inline icon-sm mr-1" />}
                    {skill.name}
                  </button>
                ))}
              </div>
              <Button
                className="w-full gap-2"
                onClick={handleSubmitSkills}
                disabled={submitting}
                data-testid="onboarding-complete-button"
              >
                {submitting ? <Loader2 className="icon-sm animate-spin" /> : <ArrowRight className="icon-sm" />}
                <BilingualText en={submitting ? 'Creating profile…' : 'Complete setup'} el={submitting ? 'Δημιουργία προφίλ…' : 'Ολοκλήρωση ρύθμισης'} compact />
              </Button>
            </div>
          )}

          {/* Text input */}
          {(step === 'name' || step === 'headline' || step === 'location') && !showTyping && (
            <div className="flex gap-2">
              <Input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                data-testid="onboarding-text-input"
                aria-label={bilingualInline(STEP_META[step].labelEn, STEP_META[step].labelEl)}
                placeholder={
                  step === 'name' ? bilingualInline('Your name…', 'Το όνομά σας…') :
                  step === 'headline' ? bilingualInline('Your professional headline…', 'Ο επαγγελματικός σας τίτλος…') :
                  bilingualInline('City, Country…', 'Πόλη, Χώρα…')
                }
                className="flex-1"
                autoFocus
              />
              <Button aria-label={bilingualInline('Next', 'Επόμενο')}
                data-testid="onboarding-next-button"
                onClick={() => {
                  if (step === 'name') void handleSubmitName();
                  else if (step === 'headline') void handleSubmitHeadline();
                  else if (step === 'location') void handleSubmitLocation();
                }}
                disabled={(step === 'name' || step === 'headline') && !inputValue.trim()}
                size="icon"
              >
                <ArrowRight className="icon-sm" />
              </Button>
            </div>
          )}

          {/* Bio textarea */}
          {step === 'bio' && !showTyping && (
            <div className="space-y-2">
              <Textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={bilingualInline("Tell us about yourself…", "Πείτε μας για εσάς…")}
                aria-label={bilingualInline(STEP_META.bio.labelEn, STEP_META.bio.labelEl)}
                data-testid="onboarding-bio-input"
                rows={3}
                autoFocus
              />
              <div className="flex justify-between items-center">
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  data-testid="onboarding-skip-bio"
                  onClick={() => void handleSubmitBio()}
                >
                  <BilingualText en="Skip for now" el="Παράλειψη για τώρα" compact />
                </button>
                <Button onClick={() => void handleSubmitBio()} className="gap-2" data-testid="onboarding-continue-button">
                  <ArrowRight className="icon-sm" />
                  <BilingualText en="Continue" el="Συνέχεια" compact />
                </Button>
              </div>
            </div>
          )}

          {step === 'done' && (
            <Button className="w-full gap-2" onClick={() => router.push(takeReturnTo('/'))} data-testid="onboarding-explore-button">
              <ArrowRight className="icon-sm" />
              <BilingualText en="Explore CoFounderBay" el="Εξερευνήστε το CoFounderBay" compact />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
