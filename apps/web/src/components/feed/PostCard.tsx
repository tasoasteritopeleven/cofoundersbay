'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
  Flag,
  UserMinus,
  Copy,
  Trash2,
  Edit,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RelativeTime } from '@/components/common/RelativeTime';
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
import { cn, initialsOf } from '@/lib/utils';
import { UnavailableMenuItem } from '@/components/common/UnavailableMenuItem';

type PostType = 'update' | 'ask' | 'offer' | 'hiring' | 'milestone' | 'pitch';

type Author = {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  role: string;
  headline?: string | null;
};

type PostCardProps = {
  id: string;
  type: PostType;
  author: Author;
  content: string;
  createdAt: Date;
  likesCount: number;
  commentsCount: number;
  isLiked?: boolean;
  isBookmarked?: boolean;
  isMine?: boolean;
  tags?: string[];
  attachments?: { type: 'image' | 'link'; url: string; title?: string }[];
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  onBookmark?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onReport?: () => void;
};

const postTypeConfig: Record<PostType, { label: string; color: string; emoji: string }> = {
  update: { label: 'Update', color: 'bg-status-info-bg text-status-info border-status-info-border', emoji: '📢' },
  ask: { label: 'Ask', color: 'bg-status-accent-bg text-status-accent border-status-accent-border', emoji: '❓' },
  offer: { label: 'Offer', color: 'bg-status-success-bg text-status-success border-status-success-border', emoji: '🎁' },
  hiring: { label: 'Hiring', color: 'bg-status-warning-bg text-status-warning border-status-warning-border', emoji: '👥' },
  milestone: { label: 'Milestone', color: 'bg-status-accent-bg text-status-accent border-status-accent-border', emoji: '🎉' },
  pitch: { label: 'Pitch', color: 'bg-status-info-bg text-status-info border-status-info-border', emoji: '🚀' },
};


export function PostCard({
  id,
  type,
  author,
  content,
  createdAt,
  likesCount,
  commentsCount,
  isLiked = false,
  isBookmarked = false,
  isMine = false,
  tags = [],
  attachments = [],
  onLike,
  onComment,
  onShare,
  onBookmark,
  onDelete,
  onEdit,
  onReport,
}: PostCardProps) {
  const [liked, setLiked] = useState(isLiked);
  const [bookmarked, setBookmarked] = useState(isBookmarked);
  const [localLikesCount, setLocalLikesCount] = useState(likesCount);

  const typeConfig = postTypeConfig[type];

  const handleLike = () => {
    setLiked(!liked);
    setLocalLikesCount((prev) => (liked ? prev - 1 : prev + 1));
    onLike?.();
  };

  const handleBookmark = () => {
    setBookmarked(!bookmarked);
    onBookmark?.();
  };

  return (
    <Card className="group hover:border-primary/30 transition-colors">
      <CardContent className="pt-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Link href={`/profiles/${author.id}`}>
              <Avatar className="h-11 w-11 ring-2 ring-border/40">
                <AvatarImage src={author.avatarUrl || undefined} />
                <AvatarFallback className="bg-primary/20 text-primary-accessible font-semibold">
                  {initialsOf(author.displayName)}
                </AvatarFallback>
              </Avatar>
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={`/profiles/${author.id}`}
                  className="person-name inline-flex tap-target-y items-center font-semibold text-foreground transition-colors hover:text-primary-accessible"
                >
                  {author.displayName}
                </Link>
                <RoleBadge role={author.role} size="sm" />
                <span className="text-xs text-muted-foreground">·</span>
                {/* RelativeTime, not suppressHydrationWarning: suppression
                    hides the console error but React still repaints the
                    mismatched text; the two-pass component removes the
                    mismatch itself. */}
                <span className="text-xs text-muted-foreground"><RelativeTime date={createdAt} short absoluteAfterDays={7} /></span>
              </div>
              {author.headline && (
                <p className="mt-1 text-xs text-muted-foreground truncate">{author.headline}</p>
              )}
            </div>
          </div>

          {/* Post type badge & menu */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn('text-xs', typeConfig.color)}>
              {typeConfig.emoji} {typeConfig.label}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity" aria-label="Post options">
                  <MoreHorizontal className="icon-sm" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigator.clipboard.writeText(window.location.origin + `/post/${id}`)}>
                  <Copy className="icon-sm mr-2" />
                  Copy link
                </DropdownMenuItem>
                {isMine ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onEdit}>
                      <Edit className="icon-sm mr-2" />
                      Edit post
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onDelete} className="text-destructive-accessible">
                      <Trash2 className="icon-sm mr-2" />
                      Delete post
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onReport}>
                      <Flag className="icon-sm mr-2" />
                      Report post
                    </DropdownMenuItem>
                    {/* No follow relationship exists in the API, so there is
                        nothing to undo; the item says so instead of closing. */}
                    <UnavailableMenuItem
                      icon={<UserMinus className="icon-sm mr-2 mt-0.5" aria-hidden="true" />}
                      en={`Unfollow ${author.displayName}`}
                      el={`Άρση ακολούθησης: ${author.displayName}`}
                      reasonEn="Following people is not supported yet."
                      reasonEl="Η ακολούθηση ατόμων δεν υποστηρίζεται ακόμη."
                    />
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Content */}
        <div className="mt-4">
          <p className="card-body text-foreground whitespace-pre-wrap">{content}</p>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Link
                key={tag}
                href={`/discover?tag=${encodeURIComponent(tag)}`}
                className="text-xs text-primary-accessible hover:underline"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="mt-4 space-y-2">
            {attachments.map((attachment, i) => (
              attachment.type === 'image' ? (
                <img
                  key={i}
                  src={attachment.url}
                  alt=""
                  className="rounded-xl max-h-96 w-full object-cover"
                />
              ) : (
                <a
                  key={i}
                  href={attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl border border-border p-3 hover:bg-secondary/40 transition-colors"
                >
                  <p className="text-sm font-medium text-foreground truncate">
                    {attachment.title || attachment.url}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{attachment.url}</p>
                </a>
              )
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLike}
              aria-label={liked ? 'Unlike' : 'Like'}
              aria-pressed={liked}
              className={cn(
                'gap-1.5 h-8',
                liked ? 'text-status-accent' : 'text-muted-foreground hover:text-status-accent'
              )}
            >
              <Heart className={cn('icon-sm', liked && 'fill-current')} aria-hidden="true" />
              <span className="text-xs">{localLikesCount > 0 ? localLikesCount : ''}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onComment}
              aria-label="Comment"
              className="gap-1.5 h-8 text-muted-foreground hover:text-primary-accessible"
            >
              <MessageCircle className="icon-sm" aria-hidden="true" />
              <span className="text-xs">{commentsCount > 0 ? commentsCount : ''}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onShare}
              aria-label="Share"
              className="gap-1.5 h-8 text-muted-foreground hover:text-primary-accessible"
            >
              <Share2 className="icon-sm" aria-hidden="true" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBookmark}
            aria-label={bookmarked ? 'Remove bookmark' : 'Save post'}
            aria-pressed={bookmarked}
            className={cn(
              'h-8 w-8',
              bookmarked ? 'text-status-warning ' : 'text-muted-foreground hover:text-status-warning '
            )}
          >
            <Bookmark className={cn('icon-sm', bookmarked && 'fill-current')} aria-hidden="true" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Post skeleton for loading
export function PostCardSkeleton() {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-full bg-secondary animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 bg-secondary rounded animate-pulse" />
            <div className="h-3 w-48 bg-secondary rounded animate-pulse" />
          </div>
          <div className="h-6 w-20 bg-secondary rounded-full animate-pulse" />
        </div>
        <div className="mt-4 space-y-2">
          <div className="h-4 w-full bg-secondary rounded animate-pulse" />
          <div className="h-4 w-3/4 bg-secondary rounded animate-pulse" />
          <div className="h-4 w-1/2 bg-secondary rounded animate-pulse" />
        </div>
        <div className="mt-4 pt-3 border-t border-border flex gap-4">
          <div className="h-8 w-16 bg-secondary rounded animate-pulse" />
          <div className="h-8 w-16 bg-secondary rounded animate-pulse" />
          <div className="h-8 w-12 bg-secondary rounded animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}
