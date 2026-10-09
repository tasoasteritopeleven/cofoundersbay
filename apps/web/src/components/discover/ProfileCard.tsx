'use client';

import { useState, memo } from 'react';
import Link from 'next/link';
import {
  MessageCircle,
  Bookmark,
  MapPin,
  Clock,
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

  if (variant === 'compact') {
    return (
      <Card className={cn('group hover:border-primary/30 transition-colors', className)}>
        <CardContent>
          <div className="flex items-center gap-3">
            <Link href={`/profiles/${profile.userId}`}>
              <Avatar className="h-10 w-10">
                <AvatarImage src={profile.avatarUrl || undefined} />
                <AvatarFallback className="bg-primary/20 text-primary-accessible text-sm font-semibold">
                  {initialsOf(profile.displayName)}
                </AvatarFallback>
              </Avatar>
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <Link
                  href={`/profiles/${profile.userId}`}
                  // tap-target-y + inline-flex: the name link measured 23px tall, a hair under the 24px target minimum, and inline-flex already takes it out of the inline flow so SC 2.5.8's inline-link exception does not apply.
                  className="person-name inline-flex tap-target-y items-center font-semibold leading-snug text-foreground transition-colors hover:text-primary-accessible"
                >
                  {profile.displayName}
                </Link>
                <RoleBadge role={profile.role} size="sm" />
              </div>
              {profile.headline && (
                <p className="text-xs text-muted-foreground truncate">{profile.headline}</p>
              )}
            </div>
            <Button aria-label="Connect · Σύνδεση" size="sm" variant="ghost" onClick={onConnect}>
              <UserPlus className="icon-sm" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (variant === 'featured') {
    return (
      <Card className={cn('group relative overflow-hidden', className)}>
        {/* Featured gradient border */}
        <div className="absolute inset-0 bg-primary/[0.04] opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity" />
        
        {profile.matchScore && (
          <div className="absolute top-3 right-3 z-10">
            <Badge variant="secondary" className="bg-primary/20 text-primary-accessible border-primary/30">
              {profile.matchScore}% match
            </Badge>
          </div>
        )}

        <CardContent className="relative pt-6 pb-4">
          {/* Header */}
          <div className="flex items-start gap-4">
            <Link href={`/profiles/${profile.userId}`}>
              <Avatar className="h-12 w-12 ring-2 ring-border/40 group-hover:ring-primary/40 transition-all">
                <AvatarImage src={profile.avatarUrl || undefined} />
                <AvatarFallback className="bg-primary/20 text-primary-accessible text-base font-semibold">
                  {initialsOf(profile.displayName)}
                </AvatarFallback>
              </Avatar>
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={`/profiles/${profile.userId}`}
                  className="text-base font-semibold text-foreground hover:text-primary-accessible transition-colors"
                >
                  {profile.displayName}
                </Link>
                {profile.isVerified && (
                  <Badge variant="secondary" size="sm" className="bg-status-success-bg text-status-success border-status-success-border">
                    Verified
                  </Badge>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <RoleBadge role={profile.role} showIcon />
              </div>
              {profile.headline && (
                <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{profile.headline}</p>
              )}
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="mt-4 text-sm text-foreground/80 line-clamp-3">{profile.bio}</p>
          )}

          {/* Meta */}
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {profile.location && (
              <span className="flex items-center gap-1">
                <MapPin className="icon-sm" />
                {profile.location}
              </span>
            )}
            {profile.lastActive && (
              <span className="flex items-center gap-1">
                <Clock className="icon-sm" />
                <RelativeTime date={profile.lastActive} format={formatLastActive} formatEl={formatLastActiveEl} />
              </span>
            )}
          </div>

          {/* Skills */}
          {profile.skills.length > 0 && (
            <div className="mt-4">
              <FactLine items={[...profile.skills.slice(0, 5), profile.skills.length > 5 ? `+${profile.skills.length - 5}` : null]} />
            </div>
          )}

          {/* Looking for / availability */}
          {(profile.lookingFor || profile.availability) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.lookingFor && (
                <div className="chip rounded-lg bg-secondary/60 px-3 py-1.5 text-xs">
                  <span className="text-muted-foreground">Looking for: </span>
                  <span className="font-medium text-foreground">{profile.lookingFor}</span>
                </div>
              )}
              {profile.availability && (
                <div className="chip rounded-lg bg-secondary/60 px-3 py-1.5 text-xs">
                  <span className="text-muted-foreground">Availability: </span>
                  <span className="font-medium text-foreground">{profile.availability}</span>
                </div>
              )}
            </div>
          )}

          {/* AI Insight */}
          {profile.matchScore && profile.matchScore > 0 && (
            <div className="mt-4">
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
                variant="ghost"
                size="sm"
              />
            </div>
          )}

          {/* Actions */}
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <Button onClick={onConnect} size="sm" className="min-h-10 flex-1 gap-2">
              <UserPlus className="icon-sm" />
              <BilingualText en="Connect" el="Σύνδεση" compact />
            </Button>
            <Button onClick={onMessage} size="sm" variant="secondary" className="min-h-10 flex-1 gap-2">
              <MessageCircle className="icon-sm" />
              <BilingualText en="Message" el="Μήνυμα" compact />
            </Button>
            <div className="flex items-center gap-1">
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
                  <Button variant="ghost" size="icon" className="h-10 w-10" aria-label={`More actions for ${profile.displayName}`}>
                    <MoreHorizontal className="icon-sm" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => void shareProfile()}>
                    <Share2 className="icon-sm mr-2" aria-hidden="true" />
                    Share profile
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
                    Report
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
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Default variant
  return (
    <Card className={cn('group hover:border-primary/30 transition-all hover:-translate-y-0.5', className)}>
      <CardContent className="pt-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Link href={`/profiles/${profile.userId}`}>
            <div className="relative">
              <Avatar className={cn('h-10 w-10 ring-2', ROLE_RING_COLORS[profile.role] || 'ring-border/40')}>
                <AvatarImage src={profile.avatarUrl || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary-accessible font-semibold">
                  {initialsOf(profile.displayName)}
                </AvatarFallback>
              </Avatar>
              {profile.isVerified && (
                <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-status-success-mark flex items-center justify-center ring-2 ring-card">
                  <svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              {/* The name wraps rather than truncating. It shares this row with
                  a role badge, and at 1024px "Elena Papadopoulos" was left 46px
                  of the 141px it needs — two thirds of a person's name gone, in
                  a card whose whole purpose is to introduce that person. */}
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <Link
                  href={`/profiles/${profile.userId}`}
                  className="person-name inline-flex tap-target-y items-center font-semibold leading-snug text-foreground transition-colors hover:text-primary-accessible"
                >
                  {profile.displayName}
                </Link>
                <RoleBadge role={profile.role} size="sm" />
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-1">
                {profile.matchScore && profile.matchScore > 0 && (
                  <div className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary-accessible">
                    <Star className="icon-sm fill-current" />
                    {profile.matchScore}%
                  </div>
                )}
                <Button aria-label="Save"
                  variant="ghost"
                  size="icon"
                  onClick={handleBookmark}
                  className={cn(
                    'h-8 w-8 flex-shrink-0',
                    bookmarked ? 'text-status-warning ' : 'text-muted-foreground hover:text-status-warning '
                  )}
                >
                  <Bookmark className={cn('icon-sm', bookmarked && 'fill-current')} />
                </Button>
              </div>
            </div>
            {profile.headline && (
              <p className="person-subtitle mt-1 text-sm text-muted-foreground dark:text-muted-foreground line-clamp-2">{profile.headline}</p>
            )}
            {profile.location && (
              <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground dark:text-muted-foreground">
                <MapPin className="icon-sm" />
                {profile.location}
              </div>
            )}
          </div>
        </div>

        {/* Skills */}
        {profile.skills.length > 0 && (
          <FactLine className="mt-3" items={[...profile.skills.slice(0, 4), profile.skills.length > 4 ? `+${profile.skills.length - 4}` : null]} />
        )}

        {/* AI Insight for matches */}
        {profile.matchScore && profile.matchScore >= 60 && (
          <div className="mt-3">
            <AIInsightButton
              prompt={`Why is ${profile.displayName} (${profile.role}) a ${profile.matchScore}% match? Skills: ${profile.skills.slice(0, 4).join(', ')}`}
              agentId="matching"
              context={{ matchScore: profile.matchScore, targetName: profile.displayName, role: profile.role, skills: profile.skills }}
              label="AI match analysis"
              labelEl="Ανάλυση αντιστοίχισης με AI"
              variant="ghost"
              size="sm"
            />
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex min-w-0 items-center gap-2">
          <Button onClick={onConnect} size="sm" variant="secondary" className="min-h-10 flex-1 gap-1.5">
            <UserPlus className="icon-sm" />
            <BilingualText en="Connect" el="Σύνδεση" compact />
          </Button>
          <Button onClick={onMessage} size="sm" variant="ghost" className="min-h-10 min-w-10 gap-1.5 sm:min-w-0 sm:px-3" aria-label="Message · Μήνυμα">
            <MessageCircle className="icon-sm" />
            <span className="hidden sm:inline"><BilingualText en="Message" el="Μήνυμα" compact /></span>
          </Button>
        </div>
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
