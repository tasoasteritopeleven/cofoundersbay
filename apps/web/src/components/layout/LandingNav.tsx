'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/brand/Logo';
import { useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';
import { bilingualAria } from '@/lib/i18n/format';
import { TOP_BANNER_STACK } from './useTopBannerHeight';

type Pair = { en: string; el: string };

const NAV_LINKS: Array<{ href: string; label: Pair }> = [
  { href: '/#need-cards', label: { en: 'Need cards', el: 'Κάρτες ανάγκης' } },
  { href: '/#how-it-works', label: { en: 'How it works', el: 'Πώς λειτουργεί' } },
  { href: '/#roles', label: { en: "Who it's for", el: 'Για ποιους' } },
  { href: '/pricing', label: { en: 'Pricing', el: 'Τιμές' } },
  { href: '/demo', label: { en: 'Demo', el: 'Demo' } },
];

const LOG_IN: Pair = { en: 'Log in', el: 'Σύνδεση' };
const JOIN: Pair = { en: 'Join free', el: 'Εγγραφή' };

/**
 * The public pages' top bar. Chrome, so it speaks the reader's chosen
 * language only (the switcher sets it): five links as "English · Ελληνικά"
 * pairs ran past the bar at tablet widths. It used to be English only.
 */
export function LandingNav() {
  const [open, setOpen] = useState(false);
  const { primary } = useLanguagePreference();
  const say = (p: Pair) => (primary === 'el' ? p.el : p.en);
  const lang = primary === 'el' ? 'el' : 'en';

  return (
    <nav
      aria-label={bilingualAria('Primary', 'Κύρια πλοήγηση')}
      style={{ top: TOP_BANNER_STACK }}
      className="fixed z-40 w-full border-b border-border bg-background/80 backdrop-blur-xl safe-top"
    >
      <div className="mx-auto flex h-[52px] w-full items-center justify-between px-6 sm:px-8 lg:px-12 xl:px-16">
        <Link href="/" aria-label={bilingualAria('CoFounderBay home', 'Αρχική CoFounderBay')}>
          <Logo size="sm" />
        </Link>
        <div className="hidden items-center gap-7 text-sm text-muted-foreground md:flex" lang={lang}>
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="transition-colors hover:text-foreground">
              {say(link.label)}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2" lang={lang}>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login" className="hidden sm:block">
              {say(LOG_IN)}
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/register">
              {say(JOIN)}
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={open ? bilingualAria('Close menu', 'Κλείσιμο μενού') : bilingualAria('Open menu', 'Άνοιγμα μενού')}
            aria-expanded={open}
            aria-controls="landing-mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="icon-md" /> : <Menu className="icon-md" />}
          </Button>
        </div>
      </div>
      {open && (
        <div
          id="landing-mobile-nav"
          lang={lang}
          className="border-t border-border bg-background px-6 py-4 sm:px-8 md:hidden"
        >
          <div className="flex flex-col gap-3">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="py-1 text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setOpen(false)}
              >
                {say(link.label)}
              </Link>
            ))}
            <Button variant="ghost" size="sm" className="w-full" asChild>
              <Link href="/login" onClick={() => setOpen(false)}>
                {say(LOG_IN)}
              </Link>
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
}
