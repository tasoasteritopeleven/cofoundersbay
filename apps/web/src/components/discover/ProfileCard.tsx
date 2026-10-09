'use client';

import { useState, memo } from 'react';
import Link from 'next/link';
import {
  MessageCircle,
  Bookmark,
  ExternalLink,
  MoreHorizontal,
  UserPlus,
  Flag,
  Share2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BilingualText } from '@/components/common/BilingualText';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RoleBadge } from '@/components/common/RoleBadge';
import { AIInsightButton } from '@/components/ai/AIInsightButton';
import { cn, initialsOf } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import { ReportBlockModal } from '@/components/common/ReportBlockModal';
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
          <div className="flex items-center gap-4">
            <Link href={`/profiles/${profile.userId}`}>
              <Avatar className="h-10 w-10">
                <AvatarImage src={profile.avatarUrl || undefined} />
                <AvatarFallback className="bg-primary/20 text-primary-accessible text-sm font-semibold">
                  {initialsOf(profile.displayName)}
                </AvatarFallback>
              </Avatar>
            </Link>
            <div className="min-w-0 flex-1 space-y-1">
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
                <p className="row-ellipsis text-sm text-muted-foreground">{profile.headline}</p>
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
      <Card className={cn('card-interactive', className)}>
        <CardContent className="flex items-center gap-4">
          <Link href={`/profiles/${profile.userId}`}>
            <Avatar className="h-10 w-10 shrink-0 ring-2 ring-primary/20">
              <AvatarImage src={profile.avatarUrl || undefined} />
              <AvatarFallback className="bg-primary/20 text-primary-accessible font-semibold">
                {initialsOf(profile.displayName)}
              </AvatarFallback>
            </Avatar>
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/profiles/${profile.userId}`}
                className="person-name inline-flex tap-target-y items-center font-display text-base font-semibold text-foreground transition-colors hover:text-primary-accessible"
              >
                {profile.displayName}
              </Link>
              <RoleBadge role={profile.role} size="sm" />
            </div>
            {profile.headline ? (
              <p className="row-ellipsis text-sm text-muted-foreground">{profile.headline}</p>
            ) : null}
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {[
                profile.bio,
                profile.location,
                profile.isVerified ? 'Verified' : null,
                profile.matchScore ? `${profile.matchScore}% match` : null,
                profile.lookingFor ? `Looking for ${profile.lookingFor}` : null,
                profile.availability,
                ...profile.skills.slice(0, 3),
                profile.skills.length > 3 ? `+${profile.skills.length - 3}` : null,
              ].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {profile.matchScore && profile.matchScore > 0 ? (
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
                  },
                }}
                label="Why this match?"
                labelEl="Γιατί ταιριάζετε;"
                variant="icon"
              />
            ) : null}
            <Button onClick={onConnect} size="sm" className="gap-1">
              <UserPlus className="icon-sm" />
              <BilingualText en="Connect" el="Σύνδεση" compact />
            </Button>
            <Button onClick={onMessage} size="sm" variant="secondary" aria-label="Message">
              <MessageCircle className="icon-sm" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`More actions for ${profile.displayName}`}>
                  <MoreHorizontal className="icon-sm" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={handleBookmark}>
                  <Bookmark className="icon-sm mr-2" aria-hidden="true" />
                  {bookmarked ? 'Saved' : 'Save'}
                </DropdownMenuItem>
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
        </CardContent>
      </Card>
    );
  }

  // Default variant
  return (
    <Card className={cn('card-interactive', className)}>
      <CardContent className="flex items-center gap-4">
        {/* Header */}
        <div className="flex items-center gap-4">
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
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Link
                href={`/profiles/${profile.userId}`}
                className="person-name inline-flex tap-target-y items-center font-display text-base font-semibold text-foreground transition-colors hover:text-primary-accessible"
              >
                {profile.displayName}
              </Link>
              <RoleBadge role={profile.role} size="sm" />
            </div>
            {profile.headline && (
              <p className="row-ellipsis text-sm text-muted-foreground">{profile.headline}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {[
                profile.location,
                profile.matchScore ? `${profile.matchScore}% match` : null,
                ...profile.skills.slice(0, 4),
              ].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              aria-label="Save"
              variant="ghost"
              size="icon"
              onClick={handleBookmark}
              className={cn('h-8 w-8', bookmarked ? 'text-status-warning' : 'text-muted-foreground')}
            >
              <Bookmark className={cn('icon-sm', bookmarked && 'fill-current')} />
            </Button>
            <Button onClick={onConnect} size="sm" className="gap-1">
              <UserPlus className="icon-sm" />
              <BilingualText en="Connect" el="Σύνδεση" compact />
            </Button>
          </div>
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
