'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { UserPlus, X, MessageCircle, Bookmark, MapPin, Clock, Sparkles, TrendingUp, ChevronDown, ChevronUp, Check } from 'lucide-react';
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
  const r = 18, cx = 22, cy = 22;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative flex items-center justify-center" style={{ width: 44, height: 44 }}>
        <svg width={44} height={44} viewBox="0 0 44 44">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--ring-gold-track))" strokeWidth={1.5} />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--ring-gold))" strokeWidth={1.5}
            strokeDasharray={`${filled} ${circ - filled}`}
            strokeDashoffset={circ / 4}
            strokeLinecap="round"
            style={{ transformOrigin: '22px 22px', transition: 'stroke-dasharray 1s ease' }} />
        </svg>
        <span className="absolute text-2xs font-medium tabular-nums text-[hsl(var(--ring-gold-ink))]">
          {score}%
        </span>
      </div>
      <span className="text-xs font-medium text-[hsl(var(--ring-gold-ink))]">
        <BilingualText en={label.en} el={label.el} compact />
      </span>
    </div>
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

      {/* Selection checkbox */}
      {onSelect && (
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          className="absolute left-3 top-3 z-20"
          aria-pressed={Boolean(isSelected)}
          aria-label={bilingualAria(`Select ${displayName}`, `Επιλογή: ${displayName}`)}
        >
          <div className={cn(
            'h-5 w-5 rounded-sm border-2 flex items-center justify-center transition-colors',
            isSelected ? 'bg-primary border-primary' : 'bg-background/80 border-border hover:border-primary'
          )}>
            {isSelected && <Check className="icon-sm text-primary-foreground" />}
          </div>
        </button>
      )}

      {/* Score badge top-right */}
      <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-1">
        <ScoreBadge score={compatibilityScore} />
        {commitment ? (
          <Link href={commitment.href} onClick={(e) => e.stopPropagation()} className="rounded-full" aria-label={bilingualAria(`Commitment with ${displayName}`, `Δέσμευση με ${displayName}`)}>
            <StepChip step={commitment.step} />
          </Link>
        ) : null}
      </div>

      <CardContent className="pl-5 pr-4 py-5">
        {/* Profile header */}
        <div className="flex items-start gap-3">
          <Link href={`/profiles/${userId}`}>
            <Avatar className="h-11 w-11 border border-border transition-transform group-hover:scale-105 shrink-0">
              <AvatarImage src={avatarUrl || undefined} alt={displayName} />
              <AvatarFallback className="bg-muted text-foreground text-sm font-semibold">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1 min-w-0 pr-14">
            <Link
              href={`/profiles/${userId}`}
              className="text-base font-semibold text-foreground hover:text-primary-accessible transition-colors line-clamp-1"
            >
              {displayName}
            </Link>
            <div className="mt-0.5 flex items-center gap-2">
              <RoleBadge role={role} size="sm" showIcon />
            </div>
            {headline && (
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground line-clamp-2 leading-relaxed">{headline}</p>
            )}
          </div>
        </div>

        {/* Location & timezone */}
        {(location || timezone) && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {location && (
              <span className="flex items-center gap-1">
                <MapPin className="icon-sm shrink-0" />
                {location}
              </span>
            )}
            {timezone && (
              <span className="flex items-center gap-1">
                <Clock className="icon-sm shrink-0" />
                {timezone}
              </span>
            )}
          </div>
        )}

        {/* Skills */}
        {skills.length > 0 && (
          <FactLine className="mt-3" items={[...skills.slice(0, 4), skills.length > 4 ? `+${skills.length - 4}` : null]} />
        )}

        {/* Match reasons toggle */}
        <button
          onClick={() => setShowReasons(!showReasons)}
          aria-expanded={showReasons}
          // tap-target-y: a 16px-tall disclosure is under the 24px target minimum.
          className={cn('mt-3 flex tap-target-y items-center gap-1.5 text-xs font-medium transition-colors', colors.text)}
        >
          <Sparkles className="icon-sm" />
          {showReasons
            ? <BilingualText en="Hide reasons" el="Απόκρυψη λόγων" compact />
            : <BilingualText en="Why this match?" el="Γιατί ταιριάζετε;" compact />}
          {showReasons ? <ChevronUp className="icon-sm" /> : <ChevronDown className="icon-sm" />}
        </button>

        {/* Match reasons (collapsible) */}
        {showReasons && (
          <div className="mt-2 space-y-1.5">
            {matchReasons.map((reason, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs bg-muted/60">
                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: stroke }} />
                <span className="text-foreground flex-1">{reason.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Divider */}
        <div className="mt-4 border-t border-border" />

        {/* Action buttons */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
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
              'flex h-10 w-10 items-center justify-center rounded-full transition-colors',
              bookmarked ? STATUS.warning.icon : cn('text-muted-foreground', 'hover:text-status-warning')
            )}
          >
            <Bookmark className={cn('icon-sm', bookmarked && 'fill-current')} />
          </button>

          <div className="flex min-w-0 flex-1 basis-full flex-wrap items-center justify-end gap-1.5 sm:basis-auto">
          {onBreakdown ? (
            <Button
              size="sm"
              variant="outline"
              className={cn('h-10 gap-1.5 px-2.5 text-xs font-medium', colors.border, colors.text)}
              style={{ borderColor: `color-mix(in srgb, ${stroke} 25%, transparent)` }}
              onClick={onBreakdown}
            >
              <TrendingUp className="icon-sm" />
              <BilingualText en="Breakdown" el="Ανάλυση" compact />
            </Button>
          ) : (
            <Button size="sm" variant="outline" className={cn('h-10 gap-1.5 px-2.5 text-xs font-medium', colors.text)} style={{ borderColor: `color-mix(in srgb, ${stroke} 25%, transparent)` }} asChild>
              <Link href={`/matches/${userId}`}>
                <TrendingUp className="icon-sm" />
                <BilingualText en="Compatibility" el="Συμβατότητα" compact />
              </Link>
            </Button>
          )}

          {onMessage && (
            <Button onClick={onMessage} size="sm" className="h-10 gap-1.5 px-2.5 text-xs">
              <MessageCircle className="icon-sm" />
              <BilingualText en="Message" el="Μήνυμα" compact />
            </Button>
          )}
          </div>
        </div>
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
