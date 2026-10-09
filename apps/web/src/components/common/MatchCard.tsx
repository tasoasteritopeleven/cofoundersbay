'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { UserPlus, X, MessageCircle, Bookmark, MapPin, Clock, Sparkles, TrendingUp, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ListRowCard } from '@/components/common/ListRowCard';
import { Badge } from '@/components/ui/badge';
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
  const { colors } = getScoreTier(compatibilityScore);

  const handleBookmark = () => {
    setBookmarked(!bookmarked);
    onBookmark?.();
  };

  const facts = [
    location,
    timezone,
    ...skills.slice(0, 4),
    skills.length > 4 ? `+${skills.length - 4}` : null,
    ...matchReasons.slice(0, 2).map((reason) => reason.text),
    commitment ? commitment.step : null,
  ].filter(Boolean).join(' · ');

  return (
    <ListRowCard
      className={cn(isSelected && 'ring-2 ring-primary', onClick && 'cursor-pointer', className)}
      onClick={onClick}
      mark={(
        <span className="flex items-center gap-2">
          {onSelect ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSelect(); }}
              aria-pressed={Boolean(isSelected)}
              aria-label={bilingualAria(`Select ${displayName}`, `Επιλογή: ${displayName}`)}
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-sm border-2',
                isSelected ? 'border-primary bg-primary' : 'border-border bg-background',
              )}
            >
              {isSelected ? <Check className="icon-sm text-primary-foreground" /> : null}
            </button>
          ) : null}
          <Link href={`/profiles/${userId}`}>
            <Avatar className="h-10 w-10 shrink-0 ring-2 ring-primary/20">
              <AvatarImage src={avatarUrl || undefined} alt="" />
              <AvatarFallback className="bg-primary/20 font-semibold text-primary-accessible">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </Link>
        </span>
      )}
      title={displayName}
      titleHref={`/profiles/${userId}`}
      badge={(
        <>
          <RoleBadge role={role} size="sm" />
          <Badge variant="outline" className={cn('text-xs', colors.chip)}>
            {compatibilityScore}%
          </Badge>
        </>
      )}
      headline={headline}
      detail={facts}
      actions={(
        <>
          {commitment ? (
            <Link href={commitment.href} className="rounded-full" aria-label={bilingualAria(`Commitment with ${displayName}`, `Δέσμευση με ${displayName}`)}>
              <StepChip step={commitment.step} />
            </Link>
          ) : null}
          {onPass ? (
            <button
              type="button"
              onClick={onPass}
              aria-label={bilingualAria(`Pass on ${displayName}`, `Παράλειψη: ${displayName}`)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-destructive-accessible"
            >
              <X className="icon-sm" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleBookmark}
            aria-pressed={bookmarked}
            aria-label={bookmarked
              ? bilingualAria(`${displayName} is on your shortlist`, `${displayName}: στη λίστα επιλογών`)
              : bilingualAria(`Save ${displayName} to shortlist`, `Αποθήκευση ${displayName} στη λίστα`)}
            className={cn('flex h-8 w-8 items-center justify-center rounded-full', bookmarked ? STATUS.warning.icon : 'text-muted-foreground')}
          >
            <Bookmark className={cn('icon-sm', bookmarked && 'fill-current')} />
          </button>
          {onBreakdown ? (
            <Button size="sm" variant="outline" className="gap-1" onClick={onBreakdown}>
              <BilingualText en="Breakdown" el="Ανάλυση" compact />
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="gap-1" asChild>
              <Link href={`/matches/${userId}`}>
                <BilingualText en="Compatibility" el="Συμβατότητα" compact />
              </Link>
            </Button>
          )}
          {onMessage ? (
            <Button onClick={onMessage} size="sm" variant="secondary" aria-label={bilingualAria('Message', 'Μήνυμα')}>
              <MessageCircle className="icon-sm" />
            </Button>
          ) : null}
          {onLike ? (
            <Button onClick={onLike} size="sm" className="gap-1">
              <UserPlus className="icon-sm" />
              <BilingualText en="Connect" el="Σύνδεση" compact />
            </Button>
          ) : null}
        </>
      )}
    />
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
