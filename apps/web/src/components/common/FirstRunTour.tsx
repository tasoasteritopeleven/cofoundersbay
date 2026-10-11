'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BilingualText } from '@/components/common/BilingualText';
import { useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';
import { bilingualAria } from '@/lib/i18n/format';
import { useAuthenticatedSession } from '@/hooks/useAuthenticatedSession';
import { analytics } from '@/lib/analytics';
import { cn } from '@/lib/utils';

export type TourStep = {
  /** Value of the `data-tour` attribute on the element to spotlight. */
  target: string;
  titleEn: string;
  titleEl: string;
  bodyEn: string;
  bodyEl: string;
};

type FirstRunTourProps = {
  /** Stable id — completion is remembered per user under this key. */
  tourId: string;
  steps: TourStep[];
  /** Hold the tour back while the page is still loading its real content. */
  ready?: boolean;
};

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 8;
const POPOVER_W = 340;
const GAP = 14;

function storageKey(tourId: string, userKey: string) {
  return `cfb.tour.${tourId}.${userKey}`;
}

/** Mark a tour as not seen so it plays again on the next visit. */
export function resetTour(tourId: string, userKey = 'preview') {
  try {
    window.localStorage.removeItem(storageKey(tourId, userKey));
  } catch { /* storage unavailable */ }
}

function findTarget(name: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-tour="${name}"]`);
}

/**
 * A short, spotlighted walkthrough shown once per user on a page's first
 * visit. Steps whose anchor is not in the DOM are skipped, so a page that
 * renders differently per state never shows a highlight over nothing.
 * Completion (or skip) is stored in localStorage per user id; there is no
 * server round-trip and demo sessions are remembered under `preview`.
 */
export function FirstRunTour({ tourId, steps, ready = true }: FirstRunTourProps) {
  const { primary } = useLanguagePreference();
  const { user, isChecking } = useAuthenticatedSession();
  const userKey = user?.id ?? 'preview';
  const key = storageKey(tourId, userKey);

  const [active, setActive] = useState(false);
  const [available, setAvailable] = useState<TourStep[]>([]);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const popoverRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  // Decide once whether to run: never seen, not still resolving who the user is,
  // page content mounted, and at least one anchor actually on screen.
  useEffect(() => {
    if (started.current || !ready || isChecking) return;
    let seen = false;
    try {
      seen = window.localStorage.getItem(key) === 'done';
    } catch { seen = true; }
    if (seen) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches && window.innerWidth < 640) {
      // Reduced-motion mobile readers get the contextual help instead of an overlay.
      return;
    }
    const timer = window.setTimeout(() => {
      const present = steps.filter((s) => findTarget(s.target));
      if (present.length === 0) return;
      started.current = true;
      setAvailable(present);
      setIndex(0);
      setActive(true);
      void analytics.track('tour_started', { tour: tourId, steps: present.length });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [ready, isChecking, key, steps, tourId]);

  const finish = useCallback(
    (how: 'completed' | 'skipped') => {
      try {
        window.localStorage.setItem(key, 'done');
      } catch { /* storage unavailable */ }
      setActive(false);
      if (how === 'completed') void analytics.track('tour_completed', { tour: tourId, steps: available.length });
      else void analytics.track('tour_skipped', { tour: tourId, step_index: index });
    },
    [key, tourId, available.length, index],
  );

  const step = available[index];

  // Track the spotlighted element through scroll and resize.
  const measure = useCallback(() => {
    if (!step) return;
    const el = findTarget(step.target);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    setViewport({ w: window.innerWidth, h: window.innerHeight });
  }, [step]);

  useLayoutEffect(() => {
    if (!active || !step) return;
    const el = findTarget(step.target);
    if (el) {
      const tall = el.getBoundingClientRect().height > window.innerHeight * 0.6;
      el.scrollIntoView({ block: tall ? 'start' : 'center', inline: 'nearest', behavior: 'smooth' });
    }
    measure();
    const raf = window.requestAnimationFrame(measure);
    const settle = window.setTimeout(measure, 450);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(settle);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [active, step, measure]);

  useEffect(() => {
    if (!active) return;
    popoverRef.current?.focus();
  }, [active, index]);

  // Keyboard: Esc skips, arrows move.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); finish('skipped'); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); setIndex((i) => Math.min(i + 1, available.length - 1)); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, available.length, finish]);

  const popoverStyle = useMemo(() => {
    if (!rect || viewport.w < 640) return undefined;
    const left = Math.min(Math.max(rect.left, 16), viewport.w - POPOVER_W - 16);
    // A target taller than most of the viewport (a results grid) has no room
    // above or below: the card sits over its top edge instead.
    if (rect.height > viewport.h * 0.6) {
      return { top: Math.min(Math.max(rect.top, 0) + GAP + PAD, viewport.h - 280), left, width: POPOVER_W };
    }
    const spaceBelow = viewport.h - (rect.top + rect.height);
    const placeBelow = spaceBelow > 240 || rect.top < 240;
    return placeBelow
      ? { top: Math.min(rect.top + rect.height + GAP, viewport.h - 280), left, width: POPOVER_W }
      : { bottom: viewport.h - rect.top + GAP, left, width: POPOVER_W };
  }, [rect, viewport]);

  if (!active || !step) return null;

  const last = index === available.length - 1;
  const body = primary === 'el' ? step.bodyEl : step.bodyEn;
  const titleId = `tour-${tourId}-title`;
  const bodyId = `tour-${tourId}-body`;

  return createPortal(
    <div className="fixed inset-0 z-[80]" data-testid="first-run-tour">
      {/* Spotlight: the dark veil is the shadow of the hole, so the target stays fully interactive-looking. */}
      {rect ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-2xl ring-2 ring-primary/70 motion-safe:transition-[top,left,width,height] motion-safe:duration-300"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: '0 0 0 9999px hsl(var(--foreground) / 0.55)',
          }}
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-foreground/55" />
      )}
      {/* Click-catcher so the page underneath is not driven by accident. */}
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={bilingualAria('Skip tour', 'Παράλειψη ξενάγησης')}
        onClick={() => finish('skipped')}
        tabIndex={-1}
      />

      <div
        ref={popoverRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        data-testid="first-run-tour-step"
        style={popoverStyle}
        data-surface="overlay"
        className={cn(
          'absolute rounded-2xl border border-border bg-background p-4 text-sm shadow-none outline-none',
          'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200',
          !popoverStyle && 'inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] sm:inset-x-auto',
        )}
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            {/* One language per line: in a 340px card a run-together pair breaks mid-phrase. */}
            <h3 id={titleId} className="page-section min-w-0 pt-1 font-semibold leading-tight text-foreground">
              <BilingualText en={step.titleEn} el={step.titleEl} stacked wrap secondaryClassName="mt-0.5" />
            </h3>
          </div>
          <button
            type="button"
            onClick={() => finish('skipped')}
            data-testid="first-run-tour-skip"
            aria-label={bilingualAria('Skip tour', 'Παράλειψη ξενάγησης')}
            className="rounded-xl p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="icon-sm" aria-hidden="true" />
          </button>
        </div>
        <p id={bodyId} className="text-sm leading-relaxed text-muted-foreground">{body}</p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5" aria-label={`${index + 1} / ${available.length}`}>
            {available.map((s, i) => (
              <span
                key={s.target}
                aria-hidden="true"
                className={cn(
                  'h-1.5 rounded-full motion-safe:transition-all',
                  i === index ? 'w-5 bg-primary' : i < index ? 'w-1.5 bg-primary/60' : 'w-1.5 bg-border',
                )}
              />
            ))}
            <span className="ml-1 text-2xs tabular-nums text-muted-foreground">{index + 1}/{available.length}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {index > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => setIndex((i) => i - 1)}
                data-testid="first-run-tour-back"
              >
                <BilingualText en="Back" el="Πίσω" compact />
              </Button>
            )}
            <Button
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={() => (last ? finish('completed') : setIndex((i) => i + 1))}
              data-testid="first-run-tour-next"
            >
              {last ? (
                <BilingualText en="Got it" el="Κατάλαβα" compact />
              ) : (
                <BilingualText en="Next" el="Επόμενο" compact />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
