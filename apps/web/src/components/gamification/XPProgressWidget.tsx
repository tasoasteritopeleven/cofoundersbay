'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useMyXP, useMyStreak } from '@/hooks/useGamification';
import { Skeleton } from '@/components/ui/skeleton';
import { BilingualText } from '@/components/common/BilingualText';
import { CardHead } from '@/components/common/CardAnatomy';
import { CfbGlyph } from '@/components/icons/CfbGlyph';
import { bilingualAria } from '@/lib/i18n/format';
import { LEVEL_LABEL_EL, REPUTATION_STRINGS } from '@/lib/i18n/strings-reputation';

export function XPProgressWidget() {
  const { data: xp, isLoading: xpLoading } = useMyXP();
  const { data: streakData, isLoading: streakLoading } = useMyStreak();

  // Render the streak only when the response actually carries the numbers.
  // A truthy object with missing fields used to reach the copy verbatim, and the
  // dashboard showed "undefined day streak · Best: undefined days". Treat a
  // malformed payload as "no streak" rather than interpolating it into a string.
  const currentStreak = Number.isFinite(streakData?.currentStreak as number)
    ? (streakData!.currentStreak as number)
    : null;
  const longestStreak = Number.isFinite(streakData?.longestStreak as number)
    ? (streakData!.longestStreak as number)
    : null;
  const streak = currentStreak === null ? null : { currentStreak, longestStreak: longestStreak ?? currentStreak };

  if (xpLoading || streakLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CfbGlyph name="award" className="icon-md text-muted-foreground" />
            <BilingualText en="Progress & XP" el="Πρόοδος & XP" compact wrap />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!xp || typeof xp.totalXp !== 'number' || typeof xp.levelProgress !== 'number') return null;

  const streakDaysEn = streak
    ? streak.currentStreak === 1
      ? '1 day streak'
      : `${streak.currentStreak} day streak`
    : '';
  const streakDaysEl = streak
    ? streak.currentStreak === 1
      ? '1 ημέρα σε σειρά'
      : `${streak.currentStreak} ημέρες σε σειρά`
    : '';
  const bestEn = streak
    ? streak.longestStreak === 1
      ? 'Best: 1 day'
      : `Best: ${streak.longestStreak} days`
    : '';
  const bestEl = streak
    ? streak.longestStreak === 1
      ? 'Καλύτερο: 1 ημέρα'
      : `Καλύτερο: ${streak.longestStreak} ημέρες`
    : '';

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CfbGlyph name="award" className="icon-md text-muted-foreground" />
          <BilingualText en="Progress & XP" el="Πρόοδος & XP" compact wrap />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          {/* The level as the mark, its name as the title and the points
              under it - the head every card has. */}
          <CardHead
            titleAs="p"
            mark={(
              <div data-card-mark="" className="flex h-10 w-10 items-center justify-center rounded-full bg-muted font-semibold tabular-nums text-foreground">
                {xp.level}
              </div>
            )}
            title={<BilingualText en={xp.levelLabel} el={LEVEL_LABEL_EL[xp.level] ?? xp.levelLabel} compact wrap />}
            subtitle={<span className="tabular-nums">{xp.totalXp.toLocaleString('en-GB')} XP</span>}
          />

          <div className="space-y-1">
            <Progress value={xp.levelProgress} label={bilingualAria('Level progress', 'Πρόοδος επιπέδου')} className="h-2" />
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span className="min-w-0">
                <BilingualText en={`Level ${xp.level}`} el={`Επίπεδο ${xp.level}`} compact />
              </span>
              <span className="tabular-nums">{xp.levelProgress.toFixed(0)}%</span>
              <span className="min-w-0 text-right">
                <BilingualText
                  en={`${xp.xpToNextLevel} to next`}
                  el={`${xp.xpToNextLevel} έως το επόμενο`}
                  compact
                />
              </span>
            </div>
          </div>
        </div>

        {/* The streak is a row of the card, under a hairline, not a tinted
            tile inside it. */}
        {streak && (
          <div className="flex min-w-0 items-start justify-between gap-2 border-t border-border pt-4">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold leading-snug">
                <BilingualText en={streakDaysEn} el={streakDaysEl} compact wrap />
              </div>
              <div className="text-xs leading-snug text-muted-foreground">
                <BilingualText en={bestEn} el={bestEl} compact wrap />
              </div>
            </div>
            {streak.currentStreak >= 7 && (
              <Badge variant="secondary" className="shrink-0 gap-1">
                <CfbGlyph name="award" className="icon-sm" />
                <BilingualText en="On fire" el="Σε φόρμα" compact />
              </Badge>
            )}
          </div>
        )}

        {xp.recentEvents.length > 0 && (
          <div className="min-w-0 space-y-2">
            <div className="min-w-0 text-sm font-medium leading-snug text-muted-foreground">
              {/* Not "Recent activity": the dashboard's activity feed already carries that name. */}
              <BilingualText en="Recent XP" el="Πρόσφατοι πόντοι XP" compact wrap />
            </div>
            {/* A divided list, not tinted boxes: in the 242px page-tools rail the boxes'
                padding left the label ~110px, and each language broke over two lines. */}
            <div className="divide-y divide-border/40">
              {xp.recentEvents.slice(0, 3).map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between gap-2 py-1.5 text-xs"
                >
                  <span className="min-w-0 leading-snug text-muted-foreground">
                    <BilingualText {...eventTypeLabel(event.eventType)} stacked wrap />
                  </span>
                  <span className="shrink-0 whitespace-nowrap font-medium tabular-nums text-status-warning">
                    +{event.xpAmount} XP
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** The reputation page's names for XP events; an unknown type falls back to its readable enum. */
function eventTypeLabel(eventType: string): { en: string; el: string } {
  const known = REPUTATION_STRINGS[`ev_${eventType}`];
  if (known) return known;
  const readable = eventType
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^\w/, (l) => l.toUpperCase());
  return { en: readable, el: readable };
}
