'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { rememberReturnTo } from '@/lib/return-to';
import { register as registerApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OAuthButtons, OAuthDivider } from '@/components/auth/OAuthButtons';
import { Logo, LogoIcon } from '@/components/brand/Logo';
import { useTenant } from '@/components/providers/TenantContext';
import { BilingualText } from '@/components/common/BilingualText';
import { useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';
import { bilingualInline } from '@/lib/i18n/format';
import { MainLandmark } from '@/components/layout/AppShell';

/**
 * Password strength presentation. Colour comes from the semantic status tokens,
 * which already carry theme-tuned light/dark values — the previous hardcoded
 * `text-status-danger dark:text-status-danger` pairs had to restate every theme by hand and
 * ignored tenant branding entirely.
 */
const PASSWORD_STRENGTH = {
  weak: { filled: 1, bar: 'bg-status-danger-mark', text: 'text-status-danger', en: 'Weak', el: 'Αδύναμος' },
  medium: { filled: 2, bar: 'bg-status-warning-mark', text: 'text-status-warning', en: 'Medium', el: 'Μέτριος' },
  strong: { filled: 3, bar: 'bg-status-success-mark', text: 'text-status-success', en: 'Strong', el: 'Ισχυρός' },
} as const;

const ROLES = [
  {
    value: 'founder',
    label: 'Founder',
    labelEl: 'Ιδρυτής',
    description: 'Build and lead startups',
    descriptionEl: 'Χτίστε και οδηγήστε startups',
    badge: 'F',
  },
  {
    value: 'mentor',
    label: 'Mentor',
    labelEl: 'Μέντορας',
    description: 'Coach and guide teams',
    descriptionEl: 'Καθοδηγήστε ομάδες',
    badge: 'M',
  },
  {
    value: 'investor',
    label: 'Investor',
    labelEl: 'Επενδυτής',
    description: 'Back early-stage teams',
    descriptionEl: 'Στηρίξτε ομάδες πρώιμου σταδίου',
    badge: 'I',
  },
  {
    value: 'org',
    label: 'Organization',
    labelEl: 'Οργανισμός',
    description: 'Represent a company',
    descriptionEl: 'Εκπροσωπήστε έναν οργανισμό',
    badge: 'O',
  },
] as const;

// What joining gives you, not member counts: the platform publishes none, so
// "10K+ members" and "80+ countries" were invented figures.
const HERO_STATS = [
  { value: '4', label: 'Ways to join', labelEl: 'Τρόποι συμμετοχής', accent: 'from-status-warning-bg to-white/0' },
  { value: '2', label: 'Languages, EN and EL', labelEl: 'Γλώσσες, EN και EL', accent: 'from-status-success-bg to-white/0' },
  { value: '1', label: 'Profile for every match', labelEl: 'Προφίλ για κάθε αντιστοίχιση', accent: 'from-status-info-bg to-white/0' },
];

type Message = { en: string; el?: string };

export default function RegisterPage() {
  const router = useRouter();
  const { activeTenant, branding } = useTenant();
  const { primary } = useLanguagePreference();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<string>('founder');
  const [error, setError] = useState<Message | null>(null);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  const passwordStrength = password.length === 0 ? null
    : password.length < 8 ? 'weak'
    : password.length < 12 || !/[0-9]/.test(password) ? 'medium'
    : 'strong';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    setError(null);
    if (!email.trim()) { setError({ en: 'Please enter your email.', el: 'Συμπληρώστε το email σας.' }); return; }
    if (password.length < 8) { setError({ en: 'Password must be at least 8 characters.', el: 'Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.' }); return; }
    submittingRef.current = true;
    setLoading(true);
    try {
      const { user, tokens } = await registerApi({
        email: email.trim().toLowerCase(),
        password,
        role: role as 'founder' | 'mentor' | 'investor' | 'org',
      });
      if (typeof window !== 'undefined') {
        // Store only display data (name, role, avatar) — auth tokens are in httpOnly cookies
        localStorage.setItem('user', JSON.stringify(user));
        // A public need card sends people here with `redirect`: onboarding
        // first, then back to that card.
        rememberReturnTo(new URLSearchParams(window.location.search).get('redirect'));
      }
      router.push('/onboarding');
    } catch (err) {
      submittingRef.current = false;
      const msg = err instanceof Error ? err.message : 'Registration failed';
      if (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network') || msg.toLowerCase().includes('abort')) {
        setError({ en: 'Cannot reach server — check your connection or try again.', el: 'Δεν υπάρχει σύνδεση με τον διακομιστή — ελέγξτε τη σύνδεσή σας ή δοκιμάστε ξανά.' });
      } else if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('exists') || msg.toLowerCase().includes('conflict')) {
        setError({ en: 'An account with this email already exists. Try signing in.', el: 'Υπάρχει ήδη λογαριασμός με αυτό το email. Δοκιμάστε να συνδεθείτε.' });
      } else {
        setError({ en: msg });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <MainLandmark className="flex min-h-screen">
      {/* Left — hero panel */}
      <div className="hidden bg-hero-gradient lg:flex lg:w-1/2 lg:flex-col lg:items-center lg:justify-center px-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-hero-radial pointer-events-none" />
        <div className="relative z-10 max-w-md text-center">
          <div className="mx-auto mb-8 flex items-center justify-center">
            {activeTenant?.logoUrl
              ? <img src={activeTenant.logoUrl} alt={activeTenant.name} className="h-16 w-auto object-contain" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
              : <LogoIcon size={72} />}
          </div>
          <h2 className="font-display text-3xl font-semibold text-white">
            {branding?.heroTitle || (activeTenant ? (
              <BilingualText
                en={`Join ${activeTenant.displayName ?? activeTenant.name}`}
                el={`Γίνετε μέλος του ${activeTenant.displayName ?? activeTenant.name}`}
                wrap
                stacked
                secondaryClassName="text-white/70"
              />
            ) : (
              <BilingualText en="Start your journey" el="Ξεκινήστε το ταξίδι σας" wrap stacked secondaryClassName="text-white/70" />
            ))}
          </h2>
          <p className="mt-4 text-white/65 text-base leading-relaxed">
            {branding?.heroSubtitle || (activeTenant?.shortDescription ?? (
              <BilingualText
                en="Create a detailed profile and get matched with the right founders, mentors, and investors."
                el="Φτιάξτε ένα αναλυτικό προφίλ και βρείτε τους κατάλληλους ιδρυτές, μέντορες και επενδυτές."
                wrap
                stacked
                secondaryClassName="text-white/60"
              />
            ))}
          </p>
          <div className="mt-10 grid grid-cols-3 gap-3">
            {HERO_STATS.map(({ value, label, labelEl, accent }) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/8 px-3 py-4 text-center backdrop-blur-sm">
                <div className={`mx-auto mb-2 h-2.5 w-10 rounded-full bg-gradient-to-r ${accent}`} />
                <p className="font-display text-xl font-bold text-white">{value}</p>
                <p className="text-xs text-white/65"><BilingualText en={label} el={labelEl} wrap stacked secondaryClassName="text-white/55" /></p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex w-full flex-col justify-center overflow-y-auto px-8 py-12 lg:w-1/2 lg:px-24">
        <div className="mx-auto w-full max-w-md animate-fade-in">
          <Link href="/" className="mb-10 inline-block hover:opacity-80 transition-opacity">
            {activeTenant?.logoUrl
              ? <img src={activeTenant.logoUrl} alt={activeTenant.name} className="h-8 object-contain" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
              : <Logo size="sm" />}
          </Link>

          <h1 className="font-display text-3xl font-semibold text-foreground">
            <BilingualText en="Create your account" el="Δημιουργήστε λογαριασμό" wrap />
          </h1>
          <p className="mt-2 text-muted-foreground">
            {activeTenant ? (
              <BilingualText
                en={`Join ${activeTenant.displayName ?? activeTenant.name} in under 2 minutes.`}
                el={`Γίνετε μέλος του ${activeTenant.displayName ?? activeTenant.name} σε λιγότερο από 2 λεπτά.`}
                wrap
              />
            ) : (
              <BilingualText en="Join the startup ecosystem in under 2 minutes." el="Μπείτε στο οικοσύστημα των startups σε λιγότερο από 2 λεπτά." wrap />
            )}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && (
              <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-accessible flex items-start gap-2">
                <span className="mt-0.5 shrink-0 font-semibold">!</span>
                <span>{error.el ? <BilingualText en={error.en} el={error.el} wrap /> : error.en}</span>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="reg-email" className="text-sm font-medium">Email</label>
              <Input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@startup.com"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="reg-password" className="text-sm font-medium"><BilingualText en="Password" el="Κωδικός" compact /></label>
              <div className="relative">
                <Input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder={bilingualInline('Min 8 characters', 'Τουλάχιστον 8 χαρακτήρες')}
                  className="pr-24"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-0 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center px-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Hide password. Απόκρυψη κωδικού' : 'Show password. Εμφάνιση κωδικού'}
                >
                  {/* One language only: the slot sits inside the input. */}
                  {showPassword ? (primary === 'el' ? 'Απόκρυψη' : 'Hide') : (primary === 'el' ? 'Εμφάνιση' : 'Show')}
                </button>
              </div>
              {/* The live region is always mounted so the strength change is announced;
                  a region that appears at the same moment its text does is missed by
                  most screen readers. The bars repeat the label, so they stay hidden. */}
              <div className="min-h-5" role="status" aria-live="polite">
                {passwordStrength && (
                  <div className="flex items-center gap-2">
                    <div className="flex flex-1 gap-1" aria-hidden="true">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            i < PASSWORD_STRENGTH[passwordStrength].filled
                              ? PASSWORD_STRENGTH[passwordStrength].bar
                              : 'bg-border'
                          }`}
                        />
                      ))}
                    </div>
                    <span className={`text-xs font-medium ${PASSWORD_STRENGTH[passwordStrength].text}`}>
                      <span className="sr-only">Password strength: / Ισχύς κωδικού: </span>
                      <BilingualText
                        en={PASSWORD_STRENGTH[passwordStrength].en}
                        el={PASSWORD_STRENGTH[passwordStrength].el}
                        compact
                      />
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium" id="role-label"><BilingualText en="I am a…" el="Είμαι…" compact /></p>
              <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="role-label">
                {ROLES.map((r) => {
                  const active = role === r.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setRole(r.value)}
                      aria-pressed={active}
                      className={`flex items-start gap-2.5 rounded-xl border px-3 py-3 text-left text-sm transition-all focus-ring ${
                        active
                          ? 'border-primary/60 bg-primary/10 text-primary-accessible'
                          : 'border-border bg-secondary/30 text-muted-foreground hover:border-primary/30 hover:text-foreground'
                      }`}
                    >
                      <span
                        className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-2xs font-semibold ${
                          active ? 'bg-primary/15 text-primary-accessible' : 'bg-background text-muted-foreground'
                        }`}
                      >
                        {r.badge}
                      </span>
                      {/* Stacked: a 2-column grid of cards is too narrow for
                          "Organization · Οργανισμός" on one line. */}
                      <div className="min-w-0">
                        <p className="font-medium"><BilingualText en={r.label} el={r.labelEl} stacked wrap keepSecondaryOnMobile /></p>
                        <p className="text-xs text-muted-foreground mt-1"><BilingualText en={r.description} el={r.descriptionEl} stacked wrap /></p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <Button type="submit" loading={loading} className="w-full" size="lg">
              {loading ? <BilingualText en="Creating account…" el="Δημιουργία λογαριασμού…" compact /> : <BilingualText en="Create account" el="Δημιουργία λογαριασμού" compact />}
            </Button>

            <OAuthDivider />
            <OAuthButtons mode="register" disabled={loading} />
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            <BilingualText en="Already have an account?" el="Έχετε ήδη λογαριασμό;" compact wrap />{' '}
            <Link href="/login" className="font-medium text-primary-accessible hover:underline">
              <BilingualText en="Sign in" el="Σύνδεση" compact />
            </Link>
          </p>
        </div>
      </div>
    </MainLandmark>
  );
}
