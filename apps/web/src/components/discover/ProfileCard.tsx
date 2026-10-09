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
import { ListRowCard } from '@/components/common/ListRowCard';
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

  const mark = (
    <Avatar className="h-10 w-10 shrink-0 ring-2 ring-primary/20">
      <AvatarImage src={profile.avatarUrl || undefined} />
      <AvatarFallback className="bg-primary/20 text-primary-accessible font-semibold">
        {initialsOf(profile.displayName)}
      </AvatarFallback>
    </Avatar>
  );

  if (variant === 'compact') {
    return (
      <ListRowCard
        className={className}
        mark={mark}
        title={profile.displayName}
        titleHref={`/profiles/${profile.userId}`}
        badge={<RoleBadge role={profile.role} size="sm" />}
        headline={profile.headline}
        actions={(
          <Button aria-label="Connect · Σύνδεση" size="sm" variant="ghost" onClick={onConnect}>
            <UserPlus className="icon-sm" />
          </Button>
        )}
      />
    );
  }

  if (variant === 'featured') {
    return (
      <ListRowCard
        className={className}
        mark={mark}
        title={profile.displayName}
        titleHref={`/profiles/${profile.userId}`}
        badge={<RoleBadge role={profile.role} size="sm" />}
        headline={profile.headline}
        detail={[
          profile.bio,
          profile.location,
          profile.isVerified ? 'Verified' : null,
          profile.matchScore ? `${profile.matchScore}% match` : null,
          profile.lookingFor ? `Looking for ${profile.lookingFor}` : null,
          profile.availability,
          ...profile.skills.slice(0, 3),
          profile.skills.length > 3 ? `+${profile.skills.length - 3}` : null,
        ].filter(Boolean).join(' · ')}
        actions={(
          <>
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
          </>
        )}
      />
    );
  }

  return (
    <ListRowCard
      className={className}
      mark={mark}
      title={profile.displayName}
      titleHref={`/profiles/${profile.userId}`}
      badge={<RoleBadge role={profile.role} size="sm" />}
      headline={profile.headline}
      detail={[
        profile.location,
        profile.isVerified ? 'Verified' : null,
        profile.matchScore ? `${profile.matchScore}% match` : null,
        ...profile.skills.slice(0, 4),
      ].filter(Boolean).join(' · ')}
      actions={(
        <>
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
        </>
      )}
    />
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
