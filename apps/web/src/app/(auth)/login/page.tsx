'use client';

import { useState, useRef, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { safeInternalPath } from '@/lib/return-to';
import { useRouter, useSearchParams } from 'next/navigation';
import { login, discoverSSOByEmail, getSSOLoginUrl, type SSODiscoveryResult } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OAuthButtons, OAuthDivider } from '@/components/auth/OAuthButtons';
import { Logo, LogoIcon } from '@/components/brand/Logo';
import { useTenant } from '@/components/providers/TenantContext';
import { BilingualText } from '@/components/common/BilingualText';
import { useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';
import { MainLandmark } from '@/components/layout/AppShell';

// No member counts here: the platform does not publish one, so a figure
// would be invented. Each point describes something the product does.
const HERO_POINTS = [
  { en: 'Meet founders, mentors and investors in one place', el: 'Γνωρίστε ιδρυτές, μέντορες και επενδυτές σε ένα μέρος' },
  { en: 'Matches ranked for your stage and skills', el: 'Αντιστοιχίσεις ταξινομημένες για το στάδιο και τις δεξιότητές σας' },
  { en: 'Verified profiles, private by default', el: 'Επαληθευμένα προφίλ, ιδιωτικά από προεπιλογή' },
];

type Message = { en: string; el?: string };

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeTenant, branding } = useTenant();
  const { primary } = useLanguagePreference();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<Message | null>(null);
  const [loading, setLoading] = useState(false);
  const [ssoDiscovery, setSsoDiscovery] = useState<SSODiscoveryResult | null>(null);
  const [checkingSSO, setCheckingSSO] = useState(false);
  const submittingRef = useRef(false);
  const ssoCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check for SSO when email changes (debounced)
  const checkSSOForEmail = useCallback(async (emailValue: string) => {
    if (!emailValue.includes('@') || emailValue.split('@')[1]?.length < 3) {
      setSsoDiscovery(null);
      return;
    }

    setCheckingSSO(true);
    try {
      const result = await discoverSSOByEmail(emailValue);
      setSsoDiscovery(result);
    } catch {
      setSsoDiscovery(null);
    } finally {
      setCheckingSSO(false);
    }
  }, []);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    
    // Debounce SSO check
    if (ssoCheckTimeoutRef.current) {
      clearTimeout(ssoCheckTimeoutRef.current);
    }
    ssoCheckTimeoutRef.current = setTimeout(() => {
      checkSSOForEmail(value);
    }, 500);
  };

  const handleSSOLogin = () => {
    if (!ssoDiscovery?.provider?.id) return;
    const returnUrl = safeInternalPath(searchParams?.get('redirect') || searchParams?.get('returnUrl')) ?? '/';
    window.location.href = getSSOLoginUrl(ssoDiscovery.provider.id, returnUrl);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    setError(null);
    if (!email.trim() || !password) return;
    submittingRef.current = true;
    setLoading(true);
    try {
      const { user } = await login({ email: email.trim().toLowerCase(), password });
      if (typeof window !== 'undefined') {
        // Store only display data (name, role, avatar) — auth tokens are in httpOnly cookies
        localStorage.setItem('user', JSON.stringify(user));
      }
      const redirectTo = safeInternalPath(searchParams?.get('redirect') || searchParams?.get('returnUrl')) ?? '/';
      router.push(redirectTo);
    } catch (err) {
      submittingRef.current = false;
      const msg = err instanceof Error ? err.message : 'Login failed';
      if (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network') || msg.toLowerCase().includes('abort')) {
        setError({ en: 'Cannot reach server — check your connection or try again.', el: 'Δεν υπάρχει σύνδεση με τον διακομιστή — ελέγξτε τη σύνδεσή σας ή δοκιμάστε ξανά.' });
      } else if (msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('credentials')) {
        setError({ en: 'Incorrect email or password.', el: 'Λάθος email ή κωδικός πρόσβασης.' });
      } else {
        setError({ en: msg });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left — form */}
      <MainLandmark className="flex w-full flex-col justify-center px-8 py-12 lg:w-1/2 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-xl animate-fade-in">
          <Link href="/" className="mb-10 inline-block hover:opacity-80 transition-opacity">
            {activeTenant?.logoUrl ? (
              <img src={activeTenant.logoUrl} alt={activeTenant.name} className="h-8 object-contain" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
            ) : (
              <Logo size="sm" />
            )}
          </Link>

          <h1 className="font-display text-3xl font-semibold text-foreground">
            {activeTenant ? (
              <BilingualText
                en={`Welcome to ${activeTenant.displayName ?? activeTenant.name}`}
                el={`Καλώς ήρθατε στο ${activeTenant.displayName ?? activeTenant.name}`}
                wrap
              />
            ) : (
              <BilingualText en="Welcome back" el="Καλώς ήρθατε ξανά" wrap />
            )}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {branding?.dashboardWelcomeText ?? (
              <BilingualText en="Sign in to continue building your network." el="Συνδεθείτε για να συνεχίσετε να χτίζετε το δίκτυό σας." wrap />
            )}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive-accessible flex items-start gap-2"
              >
                <span className="mt-0.5 shrink-0 font-semibold">!</span>
                <span>{error.el ? <BilingualText en={error.en} el={error.el} wrap /> : error.en}</span>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">Email</label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={handleEmailChange}
                required
                autoComplete="email"
                placeholder="you@startup.com"
              />
              {checkingSSO && (
                <p className="text-xs text-muted-foreground animate-pulse">
                  <BilingualText en="Checking organisation settings…" el="Έλεγχος ρυθμίσεων οργανισμού…" wrap />
                </p>
              )}
            </div>

            {/* SSO Discovery Banner */}
            {ssoDiscovery?.ssoAvailable && ssoDiscovery.provider && (
              <div className="rounded-lg border border-primary/15 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-primary-accessible">
                    SSO
                  </span>
                  <span className="font-medium text-sm">
                    <BilingualText
                      en={`${ssoDiscovery.tenant?.name || 'Organisation'} SSO detected`}
                      el={`Εντοπίστηκε SSO για ${ssoDiscovery.tenant?.name || 'τον οργανισμό'}`}
                      wrap
                    />
                  </span>
                </div>
                <Button
                  type="button"
                  onClick={handleSSOLogin}
                  className="w-full gap-2"
                  variant="default"
                  style={ssoDiscovery.provider.loginButtonColor ? { backgroundColor: ssoDiscovery.provider.loginButtonColor } : undefined}
                >
                  {ssoDiscovery.provider.logoUrl && (
                    <img src={ssoDiscovery.provider.logoUrl} alt="" className="h-4 w-4" loading="lazy" decoding="async" referrerPolicy="no-referrer" width={16} height={16} />
                  )}
                  {ssoDiscovery.provider?.loginButtonText || <BilingualText en="Continue with SSO" el="Συνέχεια με SSO" compact />}
                </Button>
                {ssoDiscovery.ssoRequired && !ssoDiscovery.allowPasswordLogin ? (
                  <p className="text-xs text-muted-foreground text-center">
                    <BilingualText en="Your organisation requires SSO sign-in" el="Ο οργανισμός σας απαιτεί σύνδεση μέσω SSO" wrap />
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground text-center">
                    <BilingualText en="Or continue with your password below" el="Ή συνεχίστε με τον κωδικό σας παρακάτω" wrap />
                  </p>
                )}
              </div>
            )}

            {/* Password section - hidden if SSO is required */}
            {(!ssoDiscovery?.ssoRequired || ssoDiscovery?.allowPasswordLogin) && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="text-sm font-medium"><BilingualText en="Password" el="Κωδικός" compact /></label>
                    <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-primary-accessible transition-colors"><BilingualText en="Forgot password?" el="Ξεχάσατε τον κωδικό;" compact /></Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required={!ssoDiscovery?.ssoRequired}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="pr-24"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password. Απόκρυψη κωδικού' : 'Show password. Εμφάνιση κωδικού'}
                      className="absolute right-0 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center px-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {/* One language only: the slot sits inside the input. */}
                      {showPassword ? (primary === 'el' ? 'Απόκρυψη' : 'Hide') : (primary === 'el' ? 'Εμφάνιση' : 'Show')}
                    </button>
                  </div>
                </div>

                <Button type="submit" loading={loading} className="w-full" size="lg">
                  {loading ? <BilingualText en="Signing in…" el="Σύνδεση…" compact /> : <BilingualText en="Sign in" el="Σύνδεση" compact />}
                </Button>
              </>
            )}

            <OAuthDivider />
            <OAuthButtons mode="login" disabled={loading} />
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            <BilingualText en="Don't have an account?" el="Δεν έχετε λογαριασμό;" compact wrap />{' '}
            <Link href="/register" className="font-medium text-primary-accessible hover:underline">
              <BilingualText en="Create one free" el="Δημιουργήστε δωρεάν" compact />
            </Link>
          </p>
        </div>
      </MainLandmark>

      {/* Right — hero panel */}
      <div className="hidden bg-hero-gradient lg:flex lg:w-1/2 lg:flex-col lg:items-center lg:justify-center px-12 xl:px-20 relative overflow-hidden">
        {/* Subtle radial overlay */}
        <div className="absolute inset-0 bg-hero-radial pointer-events-none" />
        <div className="relative z-10 w-full max-w-2xl text-center">
          <div className="mx-auto mb-8 flex items-center justify-center">
            {activeTenant?.logoUrl ? (
              <img src={activeTenant.logoUrl} alt={activeTenant.name} className="h-16 object-contain" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
            ) : (
              <LogoIcon size={86} />
            )}
          </div>
          <h2 className="font-display text-3xl font-semibold text-white">
            {branding?.heroTitle ?? <BilingualText en="Your next co-founder is waiting" el="Ο επόμενος συνιδρυτής σας σας περιμένει" wrap stacked secondaryClassName="text-white/70" />}
          </h2>
          <p className="mt-4 text-white/65 text-base leading-relaxed">
            {branding?.heroSubtitle ?? (
              <BilingualText
                en="Join founders, mentors, and investors building the future together."
                el="Ενωθείτε με ιδρυτές, μέντορες και επενδυτές που χτίζουν μαζί το μέλλον."
                wrap
                stacked
                secondaryClassName="text-white/60"
              />
            )}
          </p>
          <div className="mt-10 space-y-3 text-left">
            {HERO_POINTS.map((point, index) => (
              <div key={point.en} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur-sm">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/15">
                  <span className="text-xs font-semibold text-white">{String(index + 1).padStart(2, '0')}</span>
                </div>
                <span className="text-sm text-white/85 font-medium"><BilingualText en={point.en} el={point.el} wrap stacked secondaryClassName="text-white/65" /></span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
