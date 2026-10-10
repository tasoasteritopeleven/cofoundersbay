'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { UserPlus, X, MessageCircle, Bookmark, Sparkles, TrendingUp, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RoleBadge } from './RoleBadge';
import { BilingualText } from './BilingualText';
import { cn } from '@/lib/utils';
import { bilingualAria } from '@/lib/i18n/format';
import { STATUS, type StatusTone } from '@/lib/semantic-colors';

import { pressableProps } from '@/lib/pressable';
import type { CommitmentStep } from '@cofounderbay/shared';
import { StepChip } from '@/components/commitments/OutcomeChip';
import { FactLine } from '@/components/common/FactLine';
import { CardFoot, CardHead } from '@/components/common/CardAnatomy';
type MatchReason = {
  type: 'skills' | 'location' | 'stage' | 'industry' | 'availability' | 'values';
  text: string;
  score: number; // 0-100
};

type MatchCardProps = {
  id: string;
  userId: string;
  displayName: string;
  headline?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  role: string;
  location?: string | null;
  timezone?: string | null;
  skills: string[];
  compatibilityScore: number; // 0-100
  matchReasons: MatchReason[];
  isBookmarked?: boolean;
  onLike?: () => void;
  onPass?: () => void;
  onMessage?: () => void;
  onBookmark?: () => void;
  onBreakdown?: () => void;
  onClick?: () => void;
  isSelected?: boolean;
  onSelect?: () => void;
  className?: string;
  /** Where a commitment with this person stands, beside the score: a link to its board. */
  commitment?: { step: CommitmentStep; href: string } | null;
};

// ── Score tier helpers ────────────────────────────────────────────────────────

type MatchTier = 'excellent' | 'strong' | 'good' | 'potential';

const MATCH_TIER_TONE: Record<MatchTier, StatusTone> = {
  excellent: 'success',
  strong: 'info',
  good: 'warning',
  potential: 'danger',
};

const TIER_STROKE: Record<MatchTier, string> = {
  excellent: 'hsl(var(--status-success-mark))',
  strong: 'hsl(var(--status-info-mark))',
  good: 'hsl(var(--status-warning-mark))',
  potential: 'hsl(var(--status-danger-mark))',
};

function tierGlow(stroke: string) {
  return `color-mix(in srgb, ${stroke} 12%, transparent)`;
}

const TIER_LABEL: Record<MatchTier, { en: string; el: string }> = {
  excellent: { en: 'Excellent', el: 'Εξαιρετική' },
  strong: { en: 'Strong', el: 'Ισχυρή' },
  good: { en: 'Good', el: 'Καλή' },
  potential: { en: 'Low', el: 'Χαμηλή' },
};

function getScoreTier(score: number) {
  let tier: MatchTier = 'potential';
  if (score >= 80) tier = 'excellent';
  else if (score >= 65) tier = 'strong';
  else if (score >= 45) tier = 'good';
  const stroke = TIER_STROKE[tier];
  return { label: TIER_LABEL[tier], tier, stroke, glow: tierGlow(stroke), colors: STATUS[MATCH_TIER_TONE[tier]] };
}

// ── Score Badge (top-right) ───────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const { label } = getScoreTier(score);
  const r = 8, cx = 10, cy = 10;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;

  // One line, the ring in front of its words: the score and the tier read
  // as a state at the head's right (under the headline on a phone), not a
  // 44px dial with the tier hanging alone beneath it.
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-[hsl(var(--ring-gold-ink))]">
      <svg width={20} height={20} viewBox="0 0 20 20" className="shrink-0" aria-hidden="true">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--ring-gold-track))" strokeWidth={2} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--ring-gold))" strokeWidth={2}
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeDashoffset={circ / 4}
          strokeLinecap="round"
          style={{ transformOrigin: '10px 10px', transition: 'stroke-dasharray 1s ease' }} />
      </svg>
      <span className="tabular-nums">{score}%</span>
      <span className="min-w-0">
        <BilingualText en={label.en} el={label.el} compact />
      </span>
    </span>
  );
}

function MatchCardInner({
  id,
  userId,
  displayName,
  headline,
  bio,
  avatarUrl,
  role,
  location,
  timezone,
  skills,
  compatibilityScore,
  matchReasons,
  isBookmarked = false,
  onLike,
  onPass,
  onMessage,
  onBookmark,
  onBreakdown,
  onClick,
  isSelected,
  onSelect,
  className,
  commitment,
}: MatchCardProps) {
  const [bookmarked, setBookmarked] = useState(isBookmarked);
  const [showReasons, setShowReasons] = useState(false);
  const { stroke, glow, colors } = getScoreTier(compatibilityScore);

  const handleBookmark = () => {
    setBookmarked(!bookmarked);
    onBookmark?.();
  };

  return (
    <Card
      className={cn(
        'group relative overflow-hidden transition-all duration-200',
        'hover:border-primary/30',
        isSelected && 'ring-2 ring-primary ring-offset-1',
        onClick && 'cursor-pointer',
        className
      )}
      style={{ '--hover-glow': glow } as React.CSSProperties}
      onClick={(e) => {
        if (onClick && !(e.target as HTMLElement).closest('button, a')) {
          onClick();
        }
      }}
      // A link role keeps the inner action buttons announced (role="button"
      // would flatten them); the label keeps the card's name from becoming
      // its entire text content.
      {...(onClick ? pressableProps({ role: 'link', label: bilingualAria(`Preview ${displayName}`, `Προεπισκόπηση: ${displayName}`) }) : {})}
    >
      {/* Left score-color border strip */}
      <div
        className="absolute left-0 inset-y-0 w-0.5 transition-all duration-200 group-hover:w-1"
        style={{ background: stroke }}
      />

      {/* The Connections card: the person's circle, the name with its role,
          the headline under it, the score at the right of the head; facts,
          the reasons and the foot all start on the avatar's edge. */}
      <CardContent className="space-y-3">
        <CardHead
          mark={(
            <Link href={`/profiles/${userId}`} aria-label={bilingualAria(`Open ${displayName}'s profile`, `Άνοιγμα προφίλ: ${displayName}`)}>
              <Avatar className="h-10 w-10 border border-border transition-transform group-hover:scale-105">
                <AvatarImage src={avatarUrl || undefined} alt="" />
                <AvatarFallback className="bg-muted text-foreground text-sm font-semibold">
                  {displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Link>
          )}
          title={(
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <Link href={`/profiles/${userId}`} className="transition-colors hover:text-primary-accessible">
                {displayName}
              </Link>
              <RoleBadge role={role} size="sm" />
            </span>
          )}
          subtitle={headline ? <span className="line-clamp-2">{headline}</span> : undefined}
          // Where a commitment stands: a state on the title's edge, under
          // the headline, so the head keeps one thing at its right.
          meta={commitment ? (
            <Link href={commitment.href} onClick={(e) => e.stopPropagation()} className="inline-flex rounded-full" aria-label={bilingualAria(`Commitment with ${displayName}`, `Δέσμευση με ${displayName}`)}>
              <StepChip step={commitment.step} />
            </Link>
          ) : undefined}
          aside={(
            <>
              {/* Selection checkbox (compare mode): beside the score, never
                  over the avatar. */}
              {onSelect && (
                <button
                  onClick={(e) => { e.stopPropagation(); onSelect(); }}
                  className="flex h-10 w-10 items-center justify-center rounded-md"
                  aria-pressed={Boolean(isSelected)}
                  aria-label={bilingualAria(`Select ${displayName}`, `Επιλογή: ${displayName}`)}
                >
                  <span className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-sm border-2 transition-colors',
                    isSelected ? 'bg-primary border-primary' : 'bg-background/80 border-border hover:border-primary'
                  )}>
                    {isSelected && <Check className="icon-sm text-primary-foreground" />}
                  </span>
                </button>
              )}
              <ScoreBadge score={compatibilityScore} />
            </>
          )}
        />

        {/* Place, time zone and skills: facts on one muted line each. */}
        {(location || timezone || skills.length > 0) && (
          <div className="space-y-1">
            <FactLine items={[location, timezone]} />
            <FactLine items={[...skills.slice(0, 4), skills.length > 4 ? `+${skills.length - 4}` : null]} />
          </div>
        )}

        {/* Match reasons toggle */}
        <button
          onClick={() => setShowReasons(!showReasons)}
          aria-expanded={showReasons}
          // tap-target-y: a 16px-tall disclosure is under the 24px target minimum.
          className={cn('flex tap-target-y items-center gap-1.5 text-xs font-medium transition-colors', colors.text)}
        >
          <Sparkles className="icon-sm" />
          {showReasons
            ? <BilingualText en="Hide reasons" el="Απόκρυψη λόγων" compact />
            : <BilingualText en="Why this match?" el="Γιατί ταιριάζετε;" compact />}
          {showReasons ? <ChevronUp className="icon-sm" /> : <ChevronDown className="icon-sm" />}
        </button>

        {/* Match reasons (collapsible): rows on the card, not tiles in it. */}
        {showReasons && (
          <ul className="space-y-1">
            {matchReasons.map((reason, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: stroke }} aria-hidden="true" />
                <span className="min-w-0 flex-1 first-letter:uppercase">{reason.text}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Foot: the quick answers at the left, the next steps at the right. */}
        <CardFoot
          meta={(onPass || onLike || onBookmark) ? (
            <div className="flex items-center gap-1.5">
              {onPass && (
                <button
                  onClick={onPass}
                  aria-label={bilingualAria(`Pass on ${displayName}`, `Παράλειψη: ${displayName}`)}
                  title={bilingualAria(`Pass on ${displayName}`, `Παράλειψη: ${displayName}`)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive-accessible"
                >
                  <X className="icon-sm" />
                </button>
              )}
              {onLike && (
                <button
                  onClick={onLike}
                  aria-label={bilingualAria(`Connect with ${displayName}`, `Σύνδεση με ${displayName}`)}
                  title={bilingualAria(`Connect with ${displayName}`, `Σύνδεση με ${displayName}`)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-status-accent-border/40 hover:text-status-accent"
                >
                  <UserPlus className="icon-sm" />
                </button>
              )}
              <button
                onClick={handleBookmark}
                aria-pressed={bookmarked}
                aria-label={
                  bookmarked
                    ? bilingualAria(`${displayName} is on your shortlist`, `${displayName}: στη λίστα επιλογών`)
                    : bilingualAria(`Save ${displayName} to shortlist`, `Αποθήκευση ${displayName} στη λίστα`)
                }
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full border border-border transition-colors',
                  bookmarked ? STATUS.warning.icon : cn('text-muted-foreground', 'hover:text-status-warning')
                )}
              >
                <Bookmark className={cn('icon-sm', bookmarked && 'fill-current')} />
              </button>
            </div>
          ) : undefined}
        >
          {onBreakdown ? (
            <Button
              size="sm"
              variant="outline"
              className={cn('gap-1.5', colors.border, colors.text)}
              style={{ borderColor: `color-mix(in srgb, ${stroke} 25%, transparent)` }}
              onClick={onBreakdown}
            >
              <TrendingUp className="icon-sm" />
              <BilingualText en="Breakdown" el="Ανάλυση" compact />
            </Button>
          ) : (
            <Button size="sm" variant="outline" className={cn('gap-1.5', colors.text)} style={{ borderColor: `color-mix(in srgb, ${stroke} 25%, transparent)` }} asChild>
              <Link href={`/matches/${userId}`}>
                <TrendingUp className="icon-sm" />
                <BilingualText en="Compatibility" el="Συμβατότητα" compact />
              </Link>
            </Button>
          )}

          {onMessage && (
            <Button onClick={onMessage} size="sm" className="gap-1.5">
              <MessageCircle className="icon-sm" />
              <BilingualText en="Message" el="Μήνυμα" compact />
            </Button>
          )}
        </CardFoot>
      </CardContent>
    </Card>
  );
}

export const MatchCard = React.memo(MatchCardInner);

// Swipeable Match Card for mobile
export function SwipeableMatchCard(props: MatchCardProps & { onSwipeLeft?: () => void; onSwipeRight?: () => void }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Note: Full swipe implementation would require a gesture library like framer-motion or react-spring
  // This is a simplified version
  return (
    <div
      className="touch-pan-y"
      style={{
        transform: `translateX(${position.x}px) rotate(${position.x * 0.05}deg)`,
        transition: isDragging ? 'none' : 'transform 0.3s ease-out',
      }}
    >
      <MatchCard {...props} />
    </div>
  );
}
