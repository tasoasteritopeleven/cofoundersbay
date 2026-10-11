'use client';

import { useState, memo, type ReactNode } from 'react';
import Link from 'next/link';
import {
  MessageCircle,
  Bookmark,
  ExternalLink,
  MoreHorizontal,
  UserPlus,
  Flag,
  Share2,
  Star,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RelativeTime } from '@/components/common/RelativeTime';
import { BilingualText } from '@/components/common/BilingualText';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RoleBadge } from '@/components/common/RoleBadge';
import { AIInsightButton } from '@/components/ai/AIInsightButton';
import { cn, initialsOf, relativeTimeLabel } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import { ReportBlockModal } from '@/components/common/ReportBlockModal';
import { FactLine } from '@/components/common/FactLine';
import { CardFoot, CardHead } from '@/components/common/CardAnatomy';
import { StatusText } from '@/components/common/StatusText';
import { bilingualAria } from '@/lib/i18n/format';

export type ProfileCardData = {
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
  linkedinUrl?: string | null;
  websiteUrl?: string | null;
  isVerified?: boolean;
  lastActive?: Date;
  matchScore?: number;
  lookingFor?: string | null;
  availability?: string | null;
  completenessScore?: number;
};

const ROLE_RING_COLORS: Record<string, string> = {
  founder: 'ring-primary/50',
  mentor: 'ring-status-info',
  investor: 'ring-status-warning',
  org: 'ring-status-accent',
  admin: 'ring-status-danger',
};

function ProfileCompletenessBar({ score }: { score: number }) {
  const getColor = () => {
    if (score >= 80) return 'bg-status-success-mark';
    if (score >= 50) return 'bg-status-warning-mark';
    return 'bg-status-danger-mark';
  };
  
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-secondary/60 rounded-full overflow-hidden">
        <div 
          className={cn('h-full rounded-full transition-all', getColor())}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground font-semibold">{score}%</span>
    </div>
  );
}

type ProfileCardProps = {
  profile: ProfileCardData;
  variant?: 'default' | 'compact' | 'featured';
  isBookmarked?: boolean;
  onBookmark?: () => void;
  onConnect?: () => void;
  onMessage?: () => void;
  className?: string;
};

function formatLastActive(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (hours < 1) return 'Active now';
  if (hours < 24) return `Active ${hours}h ago`;
  if (days < 7) return `Active ${days}d ago`;
  return `Active ${Math.floor(days / 7)}w ago`;
}

/** «Ενεργό πριν 2 ώ.» - the same thresholds as `formatLastActive`. */
function formatLastActiveEl(date: Date): string {
  const hours = Math.floor((Date.now() - date.getTime()) / 3600000);
  if (hours < 1) return 'Ενεργό τώρα';
  return `Ενεργό ${relativeTimeLabel(date, 'el')}`;
}

function ProfileCardInner({
  profile,
  variant = 'default',
  isBookmarked = false,
  onBookmark,
  onConnect,
  onMessage,
  className,
}: ProfileCardProps) {
  const [bookmarked, setBookmarked] = useState(isBookmarked);
  const [reporting, setReporting] = useState(false);
  const { success, error: toastError } = useToast();

  // "Share profile" and "Report" had no handler.
  const shareProfile = async () => {
    const url = `${window.location.origin}/profiles/${profile.userId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: profile.displayName, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      success('Profile link copied');
    } catch (e) {
      // A dismissed share sheet is not an error worth reporting.
      if (e instanceof Error && e.name === 'AbortError') return;
      toastError('Could not share', 'The browser refused the share or clipboard request.');
    }
  };

  const handleBookmark = () => {
    setBookmarked(!bookmarked);
    onBookmark?.();
  };

  const profileLink = (avatarClass: string, fallbackClass: string, extra?: ReactNode) => (
    <Link href={`/profiles/${profile.userId}`} className="relative block" aria-label={bilingualAria(`Open ${profile.displayName}'s profile`, `Άνοιγμα προφίλ: ${profile.displayName}`)}>
      <Avatar className={cn('h-10 w-10', avatarClass)}>
        <AvatarImage src={profile.avatarUrl || undefined} alt="" />
        <AvatarFallback className={fallbackClass}>
          {initialsOf(profile.displayName)}
        </AvatarFallback>
      </Avatar>
      {extra}
    </Link>
  );
  const nameWithRole = (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
      <Link href={`/profiles/${profile.userId}`} className="person-name transition-colors hover:text-primary-accessible">
        {profile.displayName}
      </Link>
      <RoleBadge role={profile.role} size="sm" />
    </span>
  );

  if (variant === 'compact') {
    // One row of the Connections card: the head, and Connect at its right.
    return (
      <Card className={cn('group hover:border-primary/30 transition-colors', className)}>
        <CardContent>
          <CardHead
            mark={profileLink('', 'bg-primary/20 text-primary-accessible text-sm font-semibold')}
            title={nameWithRole}
            subtitle={profile.headline ? <span className="line-clamp-1">{profile.headline}</span> : undefined}
            asideStays
            aside={(
              <Button aria-label="Connect · Σύνδεση" size="sm" variant="ghost" onClick={onConnect}>
                <UserPlus className="icon-sm" />
              </Button>
            )}
          />
        </CardContent>
      </Card>
    );
  }

  if (variant === 'featured') {
    // The Opportunities card for a person: head, sentence, facts, then the
    // foot, all on the avatar's edge.
    return (
      <Card className={cn('group relative overflow-hidden', className)}>
        {/* Featured hover wash */}
        <div className="absolute inset-0 bg-primary/[0.04] opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity" />

        <CardContent className="relative space-y-3">
          <CardHead
            mark={profileLink('ring-2 ring-border/40 group-hover:ring-primary/40 transition-all', 'bg-primary/20 text-primary-accessible font-semibold')}
            title={(
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                <Link href={`/profiles/${profile.userId}`} className="person-name transition-colors hover:text-primary-accessible">
                  {profile.displayName}
                </Link>
                {profile.isVerified && (
                  <Badge variant="secondary" size="sm" className="bg-status-success-bg text-status-success border-status-success-border">
                    <BilingualText en="Verified" el="Επαληθευμένο" compact />
                  </Badge>
                )}
                <RoleBadge role={profile.role} size="sm" showIcon />
              </span>
            )}
            subtitle={profile.headline ? <span className="line-clamp-2">{profile.headline}</span> : undefined}
            aside={profile.matchScore ? (
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-xs tabular-nums text-primary-accessible">
                <BilingualText en={`${profile.matchScore}% match`} el={`${profile.matchScore}% ταίριασμα`} compact />
              </Badge>
            ) : undefined}
          />

          {/* Bio */}
          {profile.bio && (
            <p className="card-body line-clamp-3 text-muted-foreground">{profile.bio}</p>
          )}

          {/* Facts: place, last active, skills, what they look for. */}
          <div className="space-y-1">
            <FactLine
              items={[
                profile.location,
                profile.lastActive ? <RelativeTime key="active" date={profile.lastActive} format={formatLastActive} formatEl={formatLastActiveEl} /> : null,
              ]}
            />
            {profile.skills.length > 0 && (
              <FactLine items={[...profile.skills.slice(0, 5), profile.skills.length > 5 ? `+${profile.skills.length - 5}` : null]} />
            )}
            <FactLine
              items={[
                profile.lookingFor ? (
                  <span key="looking">
                    <BilingualText en="Looking for" el="Αναζητά" compact />: <span className="font-medium text-foreground">{profile.lookingFor}</span>
                  </span>
                ) : null,
                profile.availability ? (
                  <span key="availability">
                    <BilingualText en="Availability" el="Διαθεσιμότητα" compact />: <span className="font-medium text-foreground"><StatusText value={profile.availability} /></span>
                  </span>
                ) : null,
              ]}
            />
          </div>

          {/* AI Insight: an outlined control, so its box sits on the axis. */}
          {profile.matchScore && profile.matchScore > 0 && (
            <AIInsightButton
              prompt={`Analyze why ${profile.displayName} would be a good match. Their role is ${profile.role}, skills: ${profile.skills.slice(0, 5).join(', ')}. ${profile.headline || ''} ${profile.lookingFor ? `Looking for: ${profile.lookingFor}` : ''}`}
              agentId="matching"
              context={{
                matchScore: profile.matchScore,
                targetUser: {
                  name: profile.displayName,
                  role: profile.role,
                  skills: profile.skills,
                  headline: profile.headline,
                  lookingFor: profile.lookingFor,
                }
              }}
              label="Why this match?"
              labelEl="Γιατί ταιριάζετε;"
              variant="outline"
              size="sm"
            />
          )}

          {/* Actions */}
          <CardFoot>
            <Button onClick={onConnect} size="sm" className="gap-2">
              <UserPlus className="icon-sm" />
              <BilingualText en="Connect" el="Σύνδεση" compact />
            </Button>
            <Button onClick={onMessage} size="sm" variant="secondary" className="gap-2">
              <MessageCircle className="icon-sm" />
              <BilingualText en="Message" el="Μήνυμα" compact />
            </Button>
            <Button aria-label="Save"
              variant="ghost"
              size="icon"
              onClick={handleBookmark}
              className={cn(
                'h-10 w-10 gap-1.5 sm:w-auto sm:px-3',
                bookmarked ? 'text-status-warning' : 'text-muted-foreground hover:text-status-warning'
              )}
            >
              <Bookmark className={cn('icon-sm', bookmarked && 'fill-current')} />
              <span className="hidden sm:inline"><BilingualText en={bookmarked ? 'Saved' : 'Save'} el={bookmarked ? 'Αποθηκεύτηκε' : 'Αποθήκευση'} compact /></span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10" aria-label={bilingualAria(`More actions for ${profile.displayName}`, `Περισσότερες ενέργειες: ${profile.displayName}`)}>
                  <MoreHorizontal className="icon-sm" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => void shareProfile()}>
                  <Share2 className="icon-sm mr-2" aria-hidden="true" />
                  <BilingualText en="Share profile" el="Κοινοποίηση προφίλ" compact />
                </DropdownMenuItem>
                {profile.linkedinUrl && (
                  <DropdownMenuItem asChild>
                    <a href={profile.linkedinUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="icon-sm mr-2" />
                      LinkedIn
                    </a>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive-accessible" onSelect={() => setReporting(true)}>
                  <Flag className="icon-sm mr-2" aria-hidden="true" />
                  <BilingualText en="Report" el="Αναφορά" compact />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {reporting && (
              <ReportBlockModal
                open
                onOpenChange={setReporting}
                userId={profile.userId}
                userName={profile.displayName}
                mode="report"
              />
            )}
          </CardFoot>
        </CardContent>
      </Card>
    );
  }

  // Default variant: the Connections card. Circle, name with its role,
  // headline and place; the score at the right; skills and the foot on the
  // avatar's edge.
  return (
    <Card className={cn('group hover:border-primary/30 transition-all hover:-translate-y-0.5', className)}>
      <CardContent className="space-y-3">
        <CardHead
          mark={profileLink(
            cn('ring-2', ROLE_RING_COLORS[profile.role] || 'ring-border/40'),
            'bg-primary/10 text-primary-accessible font-semibold',
            profile.isVerified ? (
              <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-status-success-mark ring-2 ring-card">
                <svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </span>
            ) : null,
          )}
          title={nameWithRole}
          subtitle={profile.headline ? <span className="person-subtitle line-clamp-2">{profile.headline}</span> : undefined}
          meta={profile.location ?? undefined}
          aside={profile.matchScore && profile.matchScore > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary-accessible">
              <Star className="icon-sm fill-current" aria-hidden="true" />
              {profile.matchScore}%
            </span>
          ) : undefined}
        />

        {/* Skills */}
        {profile.skills.length > 0 && (
          <FactLine items={[...profile.skills.slice(0, 4), profile.skills.length > 4 ? `+${profile.skills.length - 4}` : null]} />
        )}

        {/* AI Insight for matches: outlined, so its box sits on the axis. */}
        {profile.matchScore && profile.matchScore >= 60 && (
          <AIInsightButton
            prompt={`Why is ${profile.displayName} (${profile.role}) a ${profile.matchScore}% match? Skills: ${profile.skills.slice(0, 4).join(', ')}`}
            agentId="matching"
            context={{ matchScore: profile.matchScore, targetName: profile.displayName, role: profile.role, skills: profile.skills }}
            label="AI match analysis"
            labelEl="Ανάλυση αντιστοίχισης με AI"
            variant="outline"
            size="sm"
          />
        )}

        {/* Actions */}
        <CardFoot>
          <Button onClick={onConnect} size="sm" variant="secondary" className="gap-1.5">
            <UserPlus className="icon-sm" />
            <BilingualText en="Connect" el="Σύνδεση" compact />
          </Button>
          <Button onClick={onMessage} size="sm" variant="ghost" className="min-w-10 gap-1.5 sm:min-w-0 sm:px-3" aria-label="Message · Μήνυμα">
            <MessageCircle className="icon-sm" />
            <span className="hidden sm:inline"><BilingualText en="Message" el="Μήνυμα" compact /></span>
          </Button>
          <Button aria-label="Save"
            variant="ghost"
            size="icon"
            onClick={handleBookmark}
            aria-pressed={bookmarked}
            className={cn(
              'h-10 w-10 flex-shrink-0',
              bookmarked ? 'text-status-warning' : 'text-muted-foreground hover:text-status-warning'
            )}
          >
            <Bookmark className={cn('icon-sm', bookmarked && 'fill-current')} />
          </Button>
        </CardFoot>
      </CardContent>
    </Card>
  );
}

export const ProfileCard = memo(ProfileCardInner);

// Skeleton for loading
export function ProfileCardSkeleton({ variant = 'default' }: { variant?: 'default' | 'compact' | 'featured' }) {
  if (variant === 'compact') {
    return (
      <Card>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-secondary animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-secondary rounded animate-pulse" />
              <div className="h-3 w-48 bg-secondary rounded animate-pulse" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-full bg-secondary animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 bg-secondary rounded animate-pulse" />
            <div className="h-3 w-48 bg-secondary rounded animate-pulse" />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <div className="h-6 w-16 bg-secondary rounded-full animate-pulse" />
          <div className="h-6 w-20 bg-secondary rounded-full animate-pulse" />
          <div className="h-6 w-14 bg-secondary rounded-full animate-pulse" />
        </div>
        <div className="mt-4 flex gap-2">
          <div className="h-8 flex-1 bg-secondary rounded animate-pulse" />
          <div className="h-8 w-10 bg-secondary rounded animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}
