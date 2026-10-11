'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Cookie, X, Settings, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/components/layout/SidebarContext';
import { isPreviewDemo } from '@/lib/preview-demo';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualAria } from '@/lib/i18n/format';
import {
  COOKIE_CONSENT_KEY,
  ESSENTIAL_ONLY,
  OPEN_COOKIE_CHOICES_EVENT,
  readCookiePreferences,
  saveCookiePreferences,
  type CookiePreferences,
} from '@/lib/cookie-consent';

/**
 * The cookie question, asked once, in both languages, about the two kinds
 * of storage the product actually uses (see `lib/cookie-consent.ts`).
 *
 * Layout: text first and full width, choices on their own row. The choices
 * used to sit beside the text with `flex-nowrap`; three bilingual buttons
 * took ~690px of the 896px box and left the text column ~40px, one word per
 * line, on every desktop first visit.
 *
 * "Essential only" and "Allow analytics" carry the same weight: refusing is
 * as easy as accepting.
 */
export function CookieConsent() {
  const { mobileNavOpen } = useSidebar();
  const [isVisible, setIsVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    if (isPreviewDemo()) {
      try { localStorage.setItem(COOKIE_CONSENT_KEY, 'true'); } catch { /* storage blocked */ }
      return;
    }
    const stored = readCookiePreferences();
    if (!stored) {
      // Small delay to avoid layout shift on initial load
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
    setAnalytics(stored.analytics);
  }, []);

  // "Cookie choices" in the footer and in Settings reopens the choices.
  useEffect(() => {
    const open = () => {
      setAnalytics(readCookiePreferences()?.analytics ?? false);
      setShowSettings(true);
      setIsVisible(true);
    };
    window.addEventListener(OPEN_COOKIE_CHOICES_EVENT, open);
    return () => window.removeEventListener(OPEN_COOKIE_CHOICES_EVENT, open);
  }, []);

  const save = (prefs: CookiePreferences) => {
    saveCookiePreferences(prefs);
    setAnalytics(prefs.analytics);
    setIsVisible(false);
  };

  if (!isVisible || mobileNavOpen) return null;

  return (
    <div
      className={cn(
        'pointer-events-none fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom))] left-0 right-0 z-30 p-3 sm:p-4 transition-transform duration-300 lg:bottom-0 lg:pb-[calc(1rem+env(safe-area-inset-bottom))]',
        isVisible ? 'translate-y-0' : 'translate-y-full'
      )}
    >
      <div className="pointer-events-none mx-auto max-w-3xl">
        <section
          role="region"
          aria-label={bilingualAria('Cookie choices', 'Επιλογές cookies')}
          className="pointer-events-auto rounded-xl border border-border bg-card shadow-lg"
        >
          {!showSettings ? (
            <div className="space-y-4 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted" aria-hidden="true">
                  <Cookie className="icon-sm text-muted-foreground" />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <h2 className="text-sm font-semibold text-foreground">
                    <BilingualText en="Your privacy" el="Το απόρρητό σας" compact />
                  </h2>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    <BilingualText
                      en="Essential cookies keep you signed in and the site secure, and remember the language and theme you choose. Product analytics run only if you allow them. There are no advertising cookies."
                      el="Τα απαραίτητα cookies σάς κρατούν συνδεδεμένους και τον ιστότοπο ασφαλή, και θυμούνται τη γλώσσα και το θέμα που διαλέγετε. Τα αναλυτικά στοιχεία χρήσης τρέχουν μόνο αν τα επιτρέψετε. Cookies διαφήμισης δεν υπάρχουν."
                      wrap
                    />{' '}
                    <Link href="/privacy#cookies" className="text-primary-accessible underline-offset-2 hover:underline">
                      <BilingualText en="Privacy policy" el="Πολιτική απορρήτου" compact />
                    </Link>
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)} className="gap-1.5 text-xs">
                  <Settings className="icon-sm" />
                  <BilingualText en="Choose" el="Επιλογή" compact />
                </Button>
                <Button variant="outline" size="sm" onClick={() => save(ESSENTIAL_ONLY)} className="text-xs">
                  <BilingualText en="Essential only" el="Μόνο τα απαραίτητα" compact />
                </Button>
                <Button variant="outline" size="sm" onClick={() => save({ essential: true, analytics: true })} className="gap-1.5 text-xs">
                  <BilingualText en="Allow analytics" el="Αποδοχή αναλυτικών" compact />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-foreground">
                  <BilingualText en="Cookie choices" el="Επιλογές cookies" compact />
                </h2>
                <Button
                  aria-label={bilingualAria('Back', 'Πίσω')}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowSettings(false)}
                >
                  <X className="icon-sm" />
                </Button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground"><BilingualText en="Essential" el="Απαραίτητα" compact /></p>
                    <p className="text-xs text-muted-foreground">
                      <BilingualText en="Sign-in, security, and the language and theme you choose." el="Σύνδεση, ασφάλεια, και η γλώσσα και το θέμα που διαλέγετε." wrap />
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground"><BilingualText en="Always on" el="Πάντα ενεργά" compact /></span>
                </div>

                <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border p-3 transition-colors hover:bg-muted/20">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground"><BilingualText en="Product analytics" el="Αναλυτικά στοιχεία χρήσης" compact /></p>
                    <p className="text-xs text-muted-foreground">
                      <BilingualText en="Which pages and features are used, so we know what to fix. Not used for advertising." el="Ποιες σελίδες και λειτουργίες χρησιμοποιούνται, για να ξέρουμε τι να διορθώσουμε. Όχι για διαφήμιση." wrap />
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={analytics}
                    onChange={(e) => setAnalytics(e.target.checked)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition-colors',
                      analytics ? 'justify-end bg-primary' : 'justify-start bg-muted',
                    )}
                  >
                    <span className="h-4 w-4 rounded-full bg-card shadow-sm" />
                  </span>
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                <Link href="/privacy#cookies" className="text-xs text-primary-accessible hover:underline">
                  <BilingualText en="About cookies" el="Σχετικά με τα cookies" compact />
                </Link>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowSettings(false)} className="text-xs">
                    <BilingualText en="Cancel" el="Ακύρωση" compact />
                  </Button>
                  <Button size="sm" onClick={() => save({ essential: true, analytics })} className="gap-1.5 text-xs">
                    <Check className="icon-sm" />
                    <BilingualText en="Save choices" el="Αποθήκευση επιλογών" compact />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
