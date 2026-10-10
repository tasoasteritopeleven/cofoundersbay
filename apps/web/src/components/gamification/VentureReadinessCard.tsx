'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { CfbGlyph } from '@/components/icons/CfbGlyph';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualAria } from '@/lib/i18n/format';
import { useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';
import { STATUS } from '@/lib/semantic-colors';
import { cn } from '@/lib/utils';
import { getVentureReadiness, type VentureReadiness } from '@/lib/api';
import { ventureDimensionEl } from '@/lib/i18n/venture-dimensions';
import { qk } from '@/lib/query-keys';

/* ── Helpers ─────────────────────────────────────────────────────────────── */

/**
 * Tier thresholds are shared by the gauge, the tier label and every dimension
 * bar, so a colour always means the same band throughout the card.
 * Uses semantic status tokens rather than raw palette classes so the hues stay
 * correct on the alliance / cofounder / system themes too, not just light+dark.
 */
function scoreTier(score: number): {
  labelEn: string; labelEl: string; color: string; ring: string; bar: string;
} {
  if (score >= 80) return { labelEn: 'High',     labelEl: 'Υψηλή',    color: STATUS.success.text, ring: 'stroke-status-success', bar: '[&>div]:bg-status-success-mark' };
  if (score >= 55) return { labelEn: 'Growing',  labelEl: 'Αυξανόμενη', color: STATUS.warning.text, ring: 'stroke-status-warning', bar: '[&>div]:bg-status-warning-mark' };
  if (score >= 30) return { labelEn: 'Early',    labelEl: 'Πρώιμη',   color: 'text-foreground',   ring: 'stroke-primary',        bar: '[&>div]:bg-primary'        };
  return             { labelEn: 'Building', labelEl: 'Σε δόμηση', color: 'text-muted-foreground', ring: 'stroke-muted-foreground', bar: '[&>div]:bg-muted-foreground' };
}

/* ── Sub-component: Radial gauge ─────────────────────────────────────────── */

function RadialGauge({ score }: { score: number }) {
  const { labelEn, labelEl, color, ring } = scoreTier(score);
  const { primary } = useLanguagePreference();
  const tierLabel = primary === 'el' ? labelEl : labelEn;

  const circumference = 2 * Math.PI * 15.5;
  const dash = (score / 100) * circumference;

  return (
    <div
      /* 88px, stated in px so one root cannot render it differently from
         another: `h-20` is 80px at a 100% root and 65.6px at the desktop app's
         82%, which is why this used to need an `lg:` override to stop the tier
         label being clipped by the stroke.
         
         Why 88 and not 80. Measured inside the 80px ring: 62.2px of clear
         space for a 45.1px block — 8.5px above the figure and 8.5px below the
         label, which is what made the pair look pressed against the stroke.
         The figure's line box is 24px whatever `leading-none` asks for, because
         the type scale sets a line-height on `.text-base` and wins on source
         order, so the block cannot be made shorter without shrinking the type
         past the 11px floor. 88px puts the clear space at 68.4px, which pays
         for a real gap between the two lines and still leaves 10.8px around
         them. The gauge is `shrink-0` beside a text column that stacks below
         `sm`, so the 8px costs no layout. */
        className="relative h-[88px] w-[88px] shrink-0 after:pointer-events-none after:absolute after:inset-2 after:rounded-full after:border after:border-primary/15 after:bg-primary/[0.04] after:content-['']"
      role="img"
      aria-label={bilingualAria(
        `Venture readiness ${score} out of 100 — ${labelEn}`,
        `Ετοιμότητα εγχειρήματος ${score} στα 100 — ${labelEl}`,
      )}
    >
      <svg viewBox="0 0 36 36" className="relative z-10 h-[88px] w-[88px] -rotate-90" aria-hidden="true">
        <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3" className="stroke-muted" />
        <circle
          cx="18" cy="18" r="15.5"
          fill="none" strokeWidth="3"
          strokeDasharray={`${dash} ${circumference}`}
          className={ring}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1" aria-hidden="true">
        <span className="text-base font-semibold leading-none text-foreground tabular-nums">
          {score}
          <span className="text-xs text-muted-foreground">/100</span>
        </span>
        {/* The tier label is a single Greek or English word inside the ring;
            centred and clipped rather than allowed to spill, so a longer tier
            name shortens instead of crossing the stroke. The 1.64px `mt-0.5`
            it used to carry is now a 3.3px `gap` on the column, so the figure
            and the label are separated by the container rather than by a margin
            that the first line's own leading was already eating. */}
        <span className={cn('max-w-full truncate px-1 text-center text-xs font-semibold', color)}>
          {tierLabel}
        </span>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */

interface VentureReadinessCardProps {
  /** Pre-fetched data; if omitted, component fetches itself */
  data?: VentureReadiness;
  /** Show a compact inline version (sidebar) vs full card */
  compact?: boolean;
  className?: string;
  /**
   * Optional actions rendered below the dimension list — used by the founder
   * dashboard so readiness has exactly one home instead of two cards showing
   * the same score.
   */
  footer?: ReactNode;
  titleClassName?: string;
}

export function VentureReadinessCard({ data: prefetched, compact = false, className, footer, titleClassName }: VentureReadinessCardProps) {
  const { data, isLoading } = useQuery({
    queryKey: qk('readiness', 'venture'),
    queryFn: getVentureReadiness,
    enabled: !prefetched,
    staleTime: 5 * 60 * 1000,
  });

  const vrs = prefetched ?? data;

  if (isLoading && !vrs) {
    return (
      <Card className={className}>
        <CardContent className="space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  // The card dereferences `overall` and maps `dimensions` unconditionally, and
  // `<Link href>` throws outright on `undefined` — so anything short of a
  // complete payload has to render nothing rather than take the page down.
  if (!vrs || typeof vrs.overall !== 'number' || !Array.isArray(vrs.dimensions)) return null;

  const { labelEn: tierEn, labelEl: tierEl, color: tierColor } = scoreTier(vrs.overall);
  const dimensionCount = vrs.dimensions.length;

  // `weight` arrives as a *relative* weight, not a percentage — the three demo
  // dimensions each carry weight 1, meaning they count equally. Printing it raw
  // rendered "weight 1%" three times, which reads as though each dimension were
  // worth one percent. Express it as its share of the total instead, which is
  // correct whether the API sends 1/1/1 or 40/35/25.
  const weightTotal = vrs.dimensions.reduce((sum, d) => sum + (Number(d.weight) || 0), 0);
  const weightShare = (weight: number): number | null => {
    const w = Number(weight);
    if (!Number.isFinite(w) || weightTotal <= 0) return null;
    return Math.round((w / weightTotal) * 100);
  };

  return (
    <Card className={cn('min-w-0 overflow-hidden border-0 bg-primary/[0.03]', className)}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className={cn('flex min-w-0 items-center gap-2', compact && 'page-section--compact', titleClassName)}>
            <CfbGlyph name="chart" className="icon-sm text-muted-foreground" />
            <BilingualText en="Founder progress score" el="Βαθμός προόδου ιδρυτή" />
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs gap-1" asChild>
            <Link href="/achievements" className="shrink-0">
              <BilingualText en="History" el="Ιστορικό" compact />
              <ArrowRight className="icon-sm" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* The gauge beside its words at every width: the words are
            sentences, and sentences in a card start on its left axis. */}
        <div className="mb-4 flex items-center gap-4">
          <RadialGauge score={vrs.overall} />
          <div className="min-w-0 flex-1">
            <p className={cn('text-sm font-semibold', tierColor)}>
              <BilingualText en={`${tierEn} progress`} el={`${tierEl} πρόοδος`} />
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              <BilingualText
                en={`Weighted across ${dimensionCount} dimensions of founder progress`}
                el={`Ζυγισμένος σε ${dimensionCount} διαστάσεις προόδου ιδρυτή`}
              />
            </p>
            {/* Two different questions used to share the word "readiness": how
                much of the platform this founder has put to work, and how close
                the venture is to raising. Name the other one and link it. */}
            <p className="mt-1 text-xs text-muted-foreground">
              <Link href="/readiness" className="underline underline-offset-2 hover:text-foreground">
                <BilingualText
                  en="Investor and accelerator readiness is scored separately"
                  el="Η ετοιμότητα για επενδυτές και επιταχυντές βαθμολογείται ξεχωριστά"
                  compact wrap
                />
              </Link>
            </p>
            {vrs.lowestDimension?.href && (
              <div className={cn('mt-2 flex items-start gap-1.5 text-xs', STATUS.warning.text)}>
                <CfbGlyph name="spark" className="icon-sm mt-0.5 shrink-0" />
                <span className="min-w-0 text-pretty">
                  <BilingualText en="Lowest" el="Χαμηλότερη" compact />{': '}
                  <Link href={vrs.lowestDimension.href} className="font-medium underline underline-offset-2">
                    <BilingualText
                      en={vrs.lowestDimension.label}
                      el={ventureDimensionEl(vrs.lowestDimension.key, vrs.lowestDimension.label)}
                      compact
                    />
                  </Link>{' '}
                  ({vrs.lowestDimension.score}%)
                </span>
              </div>
            )}
          </div>
        </div>

        <ul className={cn('space-y-2.5', compact && 'hidden')}>
          {vrs.dimensions.filter((dim) => dim?.href).map((dim) => {
            const { color, bar } = scoreTier(dim.score);
            return (
              <li key={dim.key}>
                <Link href={dim.href} className="group block rounded-sm">
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate text-muted-foreground transition-colors group-hover:text-foreground">
                      <BilingualText en={dim.label} el={ventureDimensionEl(dim.key, dim.label)} compact />
                      {weightShare(dim.weight) !== null && (
                        <span className="ml-1 hidden text-muted-foreground sm:inline">
                          ·{' '}
                          <BilingualText
                            en={`weight ${weightShare(dim.weight)}%`}
                            el={`βάρος ${weightShare(dim.weight)}%`}
                            compact
                          />
                        </span>
                      )}
                    </span>
                    <span className={cn('shrink-0 font-semibold tabular-nums', color)}>{dim.score}%</span>
                  </div>
                  <Progress value={dim.score} label={dim.label} className={cn('h-2 transition-all', bar)} />
                </Link>
              </li>
            );
          })}
        </ul>

        {footer && <div className="mt-5 border-t border-border pt-4">{footer}</div>}
      </CardContent>
    </Card>
  );
}
