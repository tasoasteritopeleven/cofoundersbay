'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CardHead } from '@/components/common/CardAnatomy';
import { cn } from '@/lib/utils';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualAria } from '@/lib/i18n/format';

/* ── Types ───────────────────────────────────────────────────────────────── */

export interface NextAction {
  id: string;
  label: string;
  labelEl?: string;
  description: string;
  descriptionEl?: string;
  href: string;
  cta: string;
  ctaEl?: string;
  /** Optional interpolation variables for templates like `{count}`. */
  vars?: Record<string, string | number>;
  /** One of: 'primary' | 'amber' | 'emerald' | 'violet' */
  accent?: 'primary' | 'amber' | 'emerald' | 'violet';
}

const STORAGE_PREFIX = 'cfb_nab_dismissed_v1_';

interface NextActionBannerProps {
  action: NextAction;
  /** If provided, banner will be suppressed after this ISO date */
  expiresAt?: string;
  className?: string;
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value)),
    template,
  );
}

/* ── Color maps ──────────────────────────────────────────────────────────── */

const ACCENT_CLASSES: Record<string, { border: string; bg: string; cta: string }> = {
  primary: {
    border: 'border-primary/15',
    bg:     'bg-primary/5',
    cta:    'text-primary-accessible hover:bg-primary/8',
  },
  amber: {
    border: 'border-border',
    bg:     'bg-card',
    cta:    'text-foreground hover:bg-secondary/70',
  },
  emerald: {
    border: 'border-border',
    bg:     'bg-card',
    cta:    'text-foreground hover:bg-secondary/70',
  },
  violet: {
    border: 'border-primary/15',
    bg:     'bg-primary/5',
    cta:    'text-primary-accessible hover:bg-primary/8',
  },
};

/* ── Component ───────────────────────────────────────────────────────────── */

export function NextActionBanner({ action, expiresAt, className }: NextActionBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  const storageKey = `${STORAGE_PREFIX}${action.id}`;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(storageKey) === 'true') {
      setDismissed(true);
      return;
    }
    if (expiresAt && new Date(expiresAt) < new Date()) {
      setDismissed(true);
    }
  }, [storageKey, expiresAt]);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(storageKey, 'true');
  };

  if (dismissed) return null;

  const accent = action.accent ?? 'primary';
  const ac     = ACCENT_CLASSES[accent] ?? ACCENT_CLASSES.primary;

  const label = interpolate(action.label, action.vars);
  const labelEl = action.labelEl ? interpolate(action.labelEl, action.vars) : undefined;
  const description = interpolate(action.description, action.vars);
  const descriptionEl = action.descriptionEl ? interpolate(action.descriptionEl, action.vars) : undefined;
  const cta = interpolate(action.cta, action.vars);
  const ctaEl = action.ctaEl ? interpolate(action.ctaEl, action.vars) : undefined;

  const dismissLabel = bilingualAria('Dismiss next-action suggestion', 'Απόρριψη επόμενης ενέργειας');

  // The head every card has: the action as the title and the sentence under
  // it; the call to action and the dismiss at the head's right from `sm`. On
  // a phone the dismiss stays at the top right and the call to action sits
  // under the sentence, on the card's axis.
  return (
    <Card className={cn('relative transition-all', ac.border, ac.bg, className)}>
      <CardContent className="space-y-3">
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute right-2 top-2 rounded-xl p-1.5 text-muted-foreground/50 transition-colors hover:bg-muted/60 hover:text-muted-foreground sm:hidden"
          title={bilingualAria('Dismiss', 'Απόρριψη')}
          aria-label={dismissLabel}
        >
          <X className="icon-sm" />
        </button>

        <CardHead
          titleAs="p"
          className="pr-8 sm:pr-0"
          title={<BilingualText en={label} el={labelEl} />}
          subtitle={<BilingualText en={description} el={descriptionEl} />}
          asideClassName="hidden sm:flex sm:flex-nowrap"
          aside={(
            <>
              <Button
                asChild
                variant="outline"
                size="sm"
                className={ac.cta}
              >
                <Link href={action.href}>
                  <BilingualText en={cta} el={ctaEl} compact />
                </Link>
              </Button>
              <button
                type="button"
                onClick={handleDismiss}
                className="rounded-xl p-1 text-muted-foreground/50 transition-colors hover:bg-muted/60 hover:text-muted-foreground"
                title={bilingualAria('Dismiss', 'Απόρριψη')}
                aria-label={dismissLabel}
              >
                <X className="icon-sm" />
              </button>
            </>
          )}
        />
        <Button
          asChild
          variant="outline"
          size="sm"
          className={cn('sm:hidden', ac.cta)}
        >
          <Link href={action.href}>
            <BilingualText en={cta} el={ctaEl} compact />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

/* ── Helper: derive the highest-value next action from context data ───────── */

export function deriveNextAction(opts: {
  hasProfile: boolean;
  hasPreferences: boolean;
  connectionCount: number;
  boardCount: number;
  docCount: number;
  vrsLowestKey?: string;
  pendingRequests: number;
  unreadMessages: number;
}): NextAction | null {
  // Pending requests first — social proof trigger
  if (opts.pendingRequests > 0) {
    return {
      id: 'pending-requests',
      label: opts.pendingRequests === 1 ? '{count} connection request waiting' : '{count} connection requests waiting',
      labelEl: opts.pendingRequests === 1
        ? '{count} αίτημα σύνδεσης σε αναμονή'
        : '{count} αιτήματα σύνδεσης σε αναμονή',
      vars: { count: opts.pendingRequests },
      description: 'Review and accept — new connections compound your opportunities.',
      descriptionEl: 'Δείτε και αποδεχτείτε — οι νέες συνδέσεις πολλαπλασιάζουν τις ευκαιρίες.',
      href: '/connections?tab=requests',
      cta: 'Review now',
      ctaEl: 'Έλεγχος τώρα',
      accent: 'amber',
    };
  }

  // Profile is prerequisite for everything
  if (!opts.hasProfile) {
    return {
      id: 'complete-profile',
      label: 'Complete your founder profile',
      labelEl: 'Ολοκληρώστε το προφίλ ιδρυτή',
      description: 'Unlock accurate matches and be found by investors, co-founders, and mentors.',
      descriptionEl: 'Ξεκλειδώστε ακριβείς αντιστοιχίσεις και βρείτε επενδυτές, συνιδρυτές και μέντορες.',
      href: '/profile',
      cta: 'Complete profile',
      ctaEl: 'Ολοκλήρωση προφίλ',
      accent: 'primary',
    };
  }

  // Research canvas
  if (opts.boardCount === 0) {
    return {
      id: 'create-board',
      label: 'Start your first research board',
      labelEl: 'Ξεκινήστε τον πρώτο πίνακα έρευνας',
      description: 'Map your hypothesis, market signals, and problem space visually.',
      descriptionEl: 'Χαρτογραφήστε υπόθεση, σήματα αγοράς και το πρόβλημα οπτικά.',
      href: '/research',
      cta: 'Create board',
      ctaEl: 'Δημιουργία πίνακα',
      accent: 'violet',
    };
  }

  // Builder artifact
  if (opts.docCount === 0) {
    return {
      id: 'create-artifact',
      label: 'Build your first startup artifact',
      labelEl: 'Φτιάξτε το πρώτο παραδοτέο του startup',
      description: 'Turn your research into a Business Model Canvas or pitch deck.',
      descriptionEl: 'Μετατρέψτε την έρευνα σε Business Model Canvas ή pitch deck.',
      href: '/builder',
      cta: 'Open Builder',
      ctaEl: 'Άνοιγμα Builder',
      accent: 'emerald',
    };
  }

  // Connection growth
  if (opts.connectionCount < 3) {
    return {
      id: 'grow-connections',
      label: 'Grow your network — find 3 high-match co-founders',
      labelEl: 'Αυξήστε το δίκτυο — βρείτε 3 συνιδρυτές υψηλής αντιστοίχισης',
      description: 'Strong networks unlock advisors, co-founders, and warm investor intros.',
      descriptionEl: 'Ένα ισχυρό δίκτυο ανοίγει συμβούλους, συνιδρυτές και ζεστές γνωριμίες με επενδυτές.',
      href: '/discover',
      cta: 'Discover people',
      ctaEl: 'Ανακάλυψη ανθρώπων',
      accent: 'primary',
    };
  }

  // VRS-driven: boost lowest dimension
  if (opts.vrsLowestKey === 'research') {
    return {
      id: 'vrs-research',
      label: 'Deepen your market research',
      labelEl: 'Βαθύνετε την έρευνα αγοράς',
      description: 'Add more nodes to your research canvas — signals, competitors, or hypotheses.',
      descriptionEl: 'Προσθέστε κόμβους στον καμβά — σήματα, ανταγωνιστές ή υποθέσεις.',
      href: '/research',
      cta: 'Open Canvas',
      ctaEl: 'Άνοιγμα καμβά',
      accent: 'violet',
    };
  }

  if (opts.vrsLowestKey === 'ecosystem') {
    return {
      id: 'vrs-ecosystem',
      label: 'Join the ecosystem',
      labelEl: 'Μπείτε στο οικοσύστημα',
      description: 'Attend events, join groups, and build your presence in the startup community.',
      descriptionEl: 'Πηγαίνετε σε εκδηλώσεις, μπείτε σε ομάδες και χτίστε παρουσία στην κοινότητα.',
      href: '/events',
      cta: 'Browse events',
      ctaEl: 'Περιήγηση εκδηλώσεων',
      accent: 'amber',
    };
  }

  if (opts.vrsLowestKey === 'momentum') {
    return {
      id: 'vrs-momentum',
      label: 'Stay active — your momentum score needs a boost',
      labelEl: 'Μείνετε ενεργοί — η δυναμική σας χρειάζεται ώθηση',
      description: 'Make at least one meaningful action in the next 14 days to maintain streak.',
      descriptionEl: 'Κάντε τουλάχιστον μία ουσιαστική ενέργεια τις επόμενες 14 ημέρες για να κρατήσετε το streak.',
      href: '/discover',
      cta: 'Get active',
      ctaEl: 'Δράση τώρα',
      accent: 'amber',
    };
  }

  return null;
}
