'use client';

import { useState, useCallback, useEffect } from 'react';
import { ReportBlockModal } from '@/components/common/ReportBlockModal';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import {
  Heart, MessageCircle, Share2, Bookmark, MoreHorizontal,
  Send, Link2, Smile, TrendingUp,
  Users, Sparkles, Filter, Clock, Flame, ThumbsUp,
  Award, Rocket, Target, Briefcase, GraduationCap,
  Plus, RefreshCw, ChevronDown, X, Flag, Settings, CalendarDays,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { RailAction } from '@/components/layout/RailParts';
import { usePageRail } from '@/components/layout/PageRailContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { bilingualAria, bilingualInline } from '@/lib/i18n/format';
import { readComposedPosts } from '@/lib/feed-demo';
import { RelativeTime } from '@/components/common/RelativeTime';
import { BilingualText } from '@/components/common/BilingualText';
import { CardFoot, CardHead } from '@/components/common/CardAnatomy';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge, badgeVariants } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { FeedPostComposer } from '@/components/feed/FeedPostComposer';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/toast';
import { cn, initialsOf } from '@/lib/utils';
import { feedEn, feedEl } from '@/lib/i18n/strings-feed';
import { isPreviewDemo } from '@/lib/preview-demo';
import { SampleDataNotice } from '@/components/common/SampleDataNotice';
import { qk } from '@/lib/query-keys';
import { choiceControl, rowOptions, settle, usePageControls, usePageList, type PageControlRunResult } from '@/lib/page-controls';
import {
  getPersonalizedFeed,
  createFeedPost,
  getFeedPreferences,
  updateFeedPreferences,
  recordFeedInteraction,
  getTrendingTopics,
  type FeedPost,
  type FeedPreferences,
} from '@/lib/api';
import { FactLine } from '@/components/common/FactLine';

type PostType = 'update' | 'milestone' | 'question' | 'announcement' | 'achievement';

type FeedComment = {
  id: string;
  author: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
  content: string;
  likes: number;
  isLiked: boolean;
  createdAt: string;
};

const POST_TYPE_CONFIG: Record<PostType, { icon: typeof Rocket; color: string; label: string; labelEl: string }> = {
  update: { icon: Sparkles, color: 'text-primary-accessible', label: 'Update', labelEl: 'Ενημέρωση' },
  milestone: { icon: Target, color: 'text-status-success', label: 'Milestone', labelEl: 'Ορόσημο' },
  question: { icon: MessageCircle, color: 'text-status-warning', label: 'Question', labelEl: 'Ερώτηση' },
  announcement: { icon: TrendingUp, color: 'text-status-accent', label: 'Announcement', labelEl: 'Ανακοίνωση' },
  achievement: { icon: Award, color: 'text-status-accent', label: 'Achievement', labelEl: 'Επίτευγμα' },
};

const DEMO_POSTS: FeedPost[] = [
  {
    id: '1',
    author: {
      id: 'u1',
      displayName: 'Elena Papadopoulos',
      avatarUrl: undefined,
      headline: 'Founder & CEO at TechStart',
      role: 'founder',
    },
    type: 'milestone',
    content: '🎉 Excited to announce we just closed our pre-seed round! €250K from amazing angels who believe in our vision. Next stop: building the MVP and getting our first 100 users. Thank you to everyone who supported us on this journey!',
    likes: 47,
    comments: 12,
    shares: 5,
    isLiked: false,
    isBookmarked: false,
    createdAt: '2026-03-26T10:30:00Z',
    tags: ['fundraising', 'preseed', 'startup'],
  },
  {
    id: '2',
    author: {
      id: 'u2',
      displayName: 'Marcus Chen',
      avatarUrl: undefined,
      headline: 'Technical Co-founder | Full-stack Developer',
      role: 'cofounder',
    },
    type: 'question',
    content: 'Fellow founders: What\'s your go-to stack for building MVPs in 2026? We\'re debating between Next.js + Supabase vs. Remix + PlanetScale. Would love to hear your experiences!',
    likes: 23,
    comments: 31,
    shares: 2,
    isLiked: true,
    isBookmarked: true,
    createdAt: '2026-03-26T08:15:00Z',
    tags: ['tech', 'mvp', 'webdev'],
  },
  {
    id: '3',
    author: {
      id: 'u3',
      displayName: 'Dr. Sarah Kim',
      avatarUrl: undefined,
      headline: 'Startup Mentor | Former product lead | 3x Founder',
      role: 'mentor',
    },
    type: 'update',
    content: 'Just wrapped up an amazing mentoring session with @TechStart team. Their pivot strategy is solid and I\'m confident they\'ll nail product-market fit. Remember: the best founders aren\'t afraid to change direction when the data tells them to.',
    likes: 89,
    comments: 7,
    shares: 15,
    isLiked: false,
    isBookmarked: false,
    createdAt: '2026-03-25T16:45:00Z',
  },
  {
    id: '4',
    author: {
      id: 'u4',
      displayName: 'CoFounderBay',
      avatarUrl: undefined,
      headline: 'Official Platform Account',
      role: 'admin',
    },
    type: 'announcement',
    content: '📢 New Feature Alert: Introducing Profile Comparison! Now you can compare up to 4 profiles side-by-side to find your perfect co-founder match. Check it out in the Matches section.',
    likes: 156,
    comments: 24,
    shares: 42,
    isLiked: false,
    isBookmarked: false,
    createdAt: '2026-03-25T09:00:00Z',
    tags: ['feature', 'update', 'matching'],
  },
  {
    id: '5',
    author: {
      id: 'u5',
      displayName: 'Alex Dimitriou',
      avatarUrl: undefined,
      headline: 'Angel Investor | Fintech Focus',
      role: 'investor',
    },
    type: 'achievement',
    content: '🏆 Proud to share that our portfolio company @PayFlow just hit 10,000 active users! From a pitch deck to a thriving product in 8 months. This is why I love early-stage investing.',
    likes: 234,
    comments: 18,
    shares: 28,
    isLiked: false,
    isBookmarked: false,
    createdAt: '2026-03-24T14:20:00Z',
    tags: ['portfolio', 'fintech', 'growth'],
  },
];

function PostCard({
  post,
  onLike,
  onBookmark,
  onComment,
  onShare,
  onView,
  onReport,
}: {
  post: FeedPost;
  onLike: () => void;
  onBookmark: () => void;
  onComment: () => void;
  onShare: () => void;
  onView?: () => void;
  /** Opens the report dialog for the post's author. */
  onReport: () => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const config = POST_TYPE_CONFIG[post.type] ?? POST_TYPE_CONFIG.update;

  // Track view when component mounts
  useEffect(() => {
    onView?.();
    // Record a view once per post, not whenever the parent callback identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  const initials = (post.author?.displayName ?? '')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();


  // The Endorsements card: the author's mark and name, their headline under
  // it and the kind and time as a caption; the post, its tags and a foot
  // with the counts and the actions all start on the mark's left edge.
  return (
    <Card
      id={`post-${post.id}`}
      tabIndex={-1}
      className="scroll-mt-24 transition-colors hover:border-primary/20 focus:outline-none data-[linked=true]:ring-2 data-[linked=true]:ring-primary"
    >
      <CardContent className="space-y-3">
        <CardHead
          mark={(
            <Avatar className="h-10 w-10">
              <AvatarImage src={post.author?.avatarUrl} alt="" />
              <AvatarFallback className="bg-primary/10 text-primary-accessible font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
          )}
          title={(
            <a href={`/profiles/${post.author?.id}`} className="transition-colors hover:text-primary-accessible">
              {post.author?.displayName}
            </a>
          )}
          subtitle={post.author?.headline || undefined}
          /* Computed in an effect, not during render: the server's "now" is
             not the browser's, and the two disagreeing is what made this page
             fail hydration on every load. */
          meta={(
            <FactLine
              items={[
                <span key="kind" className={config.color}><BilingualText en={config.label} el={config.labelEl} compact /></span>,
                <RelativeTime key="time" date={post.createdAt} />,
                post.personalizationScore ? (
                  <BilingualText key="match" en={`${Math.round(post.personalizationScore * 100)}% match`} el={`${Math.round(post.personalizationScore * 100)}% ταίριασμα`} compact />
                ) : null,
              ]}
            />
          )}
          asideStays
          aside={(
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={bilingualAria('Open post actions', 'Άνοιγμα ενεργειών δημοσίευσης')}>
                <MoreHorizontal className="icon-sm" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onBookmark}>
                <Bookmark className="icon-sm mr-2" />
                {post.isBookmarked
                  ? <BilingualText en="Remove Bookmark" el="Αφαίρεση σελιδοδείκτη" compact />
                  : <BilingualText en="Bookmark" el="Σελιδοδείκτης" compact />}
              </DropdownMenuItem>
              {/* Copy Link and Report had no handler. */}
              <DropdownMenuItem onSelect={onShare}>
                <Link2 className="icon-sm mr-2" aria-hidden="true" />
                <BilingualText en="Copy Link" el="Αντιγραφή συνδέσμου" compact />
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive-accessible" onSelect={onReport}>
                <Flag className="icon-sm mr-2" aria-hidden="true" />
                <BilingualText en="Report" el="Αναφορά" compact />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          )}
        />
        {(post.relevanceReasons?.length ?? 0) > 0 && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium"><BilingualText en="Why you're seeing this" el="Γιατί το βλέπετε" compact />:</span> {post.relevanceReasons?.join(', ')}
          </p>
        )}

        <p className="card-body text-foreground whitespace-pre-wrap first-letter:uppercase">{post.content}</p>

        {(post.tags?.length ?? 0) > 0 && (
          <FactLine items={(post.tags ?? []).map((tag) => `#${tag}`)} />
        )}

        {/* The counts at the left of the foot, the actions at its right. */}
        <CardFoot
          meta={(
            <FactLine
              items={[
                <BilingualText key="likes" en={`${post.likes} likes`} el={`${post.likes} μου αρέσει`} compact />,
                <BilingualText key="comments" en={`${post.comments} comments`} el={`${post.comments} σχόλια`} compact />,
                <BilingualText key="shares" en={`${post.shares} shares`} el={`${post.shares} κοινοποιήσεις`} compact />,
              ]}
            />
          )}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={onLike}
            aria-pressed={post.isLiked}
            className={cn(post.isLiked && 'text-primary-accessible')}
          >
            <Heart className={cn('icon-sm mr-1', post.isLiked && 'fill-current')} aria-hidden="true" />
            <BilingualText en="Like" el="Μου αρέσει" compact />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={showComments}
            onClick={() => setShowComments(!showComments)}
          >
            <MessageCircle className="icon-sm mr-1" aria-hidden="true" />
            <BilingualText en="Comment" el="Σχόλιο" compact />
          </Button>
          <Button variant="ghost" size="sm" onClick={onShare}>
            <Share2 className="icon-sm mr-1" aria-hidden="true" />
            <BilingualText en="Share" el="Κοινοποίηση" compact />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onBookmark}
            className={cn(post.isBookmarked && 'text-primary-accessible')}
            aria-label={
              post.isBookmarked
                ? bilingualAria('Remove bookmark', 'Αφαίρεση σελιδοδείκτη')
                : bilingualAria('Bookmark post', 'Σελιδοδείκτης δημοσίευσης')
            }
            aria-pressed={post.isBookmarked}
          >
            <Bookmark className={cn('icon-sm sm:mr-1', post.isBookmarked && 'fill-current')} aria-hidden="true" />
            <span className="hidden sm:inline"><BilingualText en="Save" el="Αποθήκευση" compact /></span>
          </Button>
        </CardFoot>

        {/* Comments Section */}
        {showComments && (
          <div className="flex gap-3 border-t border-border pt-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">ME</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 gap-2">
              {/* The page passed onComment={() => {}}: Send cleared the
                  box and nothing was stored - there is no comment route
                  for feed posts. Until there is, the box says so instead
                  of swallowing what someone wrote. */}
              <Textarea
                placeholder={bilingualInline('Comments on feed posts are not saved yet', 'Τα σχόλια σε δημοσιεύσεις δεν αποθηκεύονται ακόμη')}
                aria-label={bilingualAria('Comment', 'Σχόλιο')}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="min-h-[60px] resize-none"
                disabled
              />
              <Button aria-label={bilingualAria('Post comment', 'Δημοσίευση σχολίου')}
                size="sm"
                disabled
                title="Comments on feed posts are not saved yet"
                onClick={() => {
                  onComment();
                  setCommentText('');
                }}
              >
                <Send className="icon-sm" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TrendingTopics({ topics }: { topics?: Array<{ tag: string; posts: number; engagement: number; growth: number }> }) {
  const defaultTopics = [
    { tag: 'fundraising', posts: 234, engagement: 89, growth: 12 },
    { tag: 'mvp', posts: 189, engagement: 76, growth: 8 },
    { tag: 'hiring', posts: 156, engagement: 65, growth: -2 },
    { tag: 'productlaunch', posts: 142, engagement: 82, growth: 15 },
    { tag: 'mentorship', posts: 98, engagement: 71, growth: 5 },
  ];

  const topicsToShow = topics || defaultTopics;

  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="pb-3 border-b border-border">
        <h3 className="font-semibold flex items-center gap-2">
          <Flame className="icon-sm text-status-warning" />
          Trending Topics
        </h3>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-3">
          {topicsToShow.map((topic, i) => (
            <a
              key={topic.tag}
              href={`/feed?tag=${topic.tag}`}
              className="flex items-center justify-between group"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-4">{i + 1}</span>
                <span className="font-medium text-foreground group-hover:text-primary-accessible transition-colors">
                  #{topic.tag}
                </span>
                {topic.growth > 0 && (
                  <Badge variant="secondary" className="text-xs bg-status-success-bg text-status-success border-status-success-border">
                    +{topic.growth}%
                  </Badge>
                )}
              </div>
              <div className="text-right">
                <span className="text-xs text-muted-foreground">{topic.posts} posts</span>
                <div className="text-xs text-muted-foreground">{topic.engagement} engagement</div>
              </div>
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SuggestedConnections() {
  const suggestions = [
    { id: '1', name: 'Anna Kowalski', role: 'UX Designer', match: 85 },
    { id: '2', name: 'James Wilson', role: 'Backend Developer', match: 78 },
    { id: '3', name: 'Maria Santos', role: 'Growth Marketer', match: 72 },
  ];

  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="pb-3 border-b border-border">
        <h3 className="font-semibold flex items-center gap-2">
          <Users className="icon-sm text-muted-foreground" />
          Suggested Connections
        </h3>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-3">
          {suggestions.map((person) => (
            <div key={person.id} className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="text-xs bg-primary/10 text-primary-accessible">
                  {initialsOf(person.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{person.name}</p>
                <p className="text-xs text-muted-foreground truncate">{person.role}</p>
              </div>
              <Badge variant="secondary" className="text-xs">
                {person.match}%
              </Badge>
            </div>
          ))}
        </div>
        <Button asChild variant="ghost" size="sm" className="w-full mt-3">
          <Link href="/discover">
            <BilingualText en="View All" el="Προβολή όλων" compact />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function FeedPage() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'all' | 'following' | 'trending'>('all');
  const { openRailSection } = usePageRail();

  // Fetch personalized feed
  // `useInfiniteQuery` was imported and never used, and "Load More" sat below a
  // fixed first page doing nothing — while the endpoint has taken an `offset`
  // and returned `hasMore` all along. This asks for the next page it advertises.
  const PAGE_SIZE = 20;
  const {
    data: feedPages,
    isLoading: feedLoading,
    error: feedError,
    refetch: refetchFeed,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: qk('feed', 'personalized', activeTab),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => getPersonalizedFeed({
      limit: PAGE_SIZE,
      offset: pageParam as number,
      contentTypes: activeTab === 'trending' ? undefined : ['update', 'milestone', 'question', 'announcement', 'achievement'],
      refresh: activeTab === 'trending',
    }),
    getNextPageParam: (last, all) =>
      last?.hasMore ? all.reduce((n, page) => n + (page?.posts?.length ?? 0), 0) : undefined,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Whatever the reader composed this session leads; the feed follows.
  const [composed, setComposed] = useState<FeedPost[]>([]);
  useEffect(() => {
    setComposed(readComposedPosts());
  }, []);

  const feedData = feedPages
    ? { posts: [...composed, ...feedPages.pages.flatMap((page) => page?.posts ?? [])] }
    : composed.length
      ? { posts: composed }
      : undefined;

  // Fetch feed preferences
  const {
    data: preferences,
    isLoading: prefsLoading,
  } = useQuery({
    queryKey: qk('feed', 'preferences'),
    queryFn: getFeedPreferences,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Fetch trending topics
  const {
    data: trendingData,
  } = useQuery({
    queryKey: qk('feed', 'trending-topics'),
    queryFn: () => getTrendingTopics(10),
    staleTime: 15 * 60 * 1000, // 15 minutes
  });

  // Update preferences mutation
  const updatePrefsMutation = useMutation({
    mutationFn: updateFeedPreferences,
    onSuccess: () => {
      success('Feed preferences updated');
      queryClient.invalidateQueries({ queryKey: qk('feed', 'preferences') });
      refetchFeed(); // Refresh feed with new preferences
    },
  });

  // Record interaction mutation
  const recordInteractionMutation = useMutation({
    mutationFn: recordFeedInteraction,
  });

  const posts = feedData?.posts?.length
    ? feedData.posts
    : isPreviewDemo()
      ? DEMO_POSTS
      : [];

  // The API stores the post and the feed is read again; the preview demo
  // keeps it for the session (`lib/feed-demo.ts`) and says so.
  const handlePost = async (content: string, type: PostType) => {
    try {
      const { stored } = await createFeedPost({ content, type: type as FeedPost['type'] });
      if (stored) {
        await queryClient.invalidateQueries({ queryKey: qk('feed') });
        success(bilingualInline('Posted', 'Δημοσιεύτηκε'));
        return;
      }
      setComposed(readComposedPosts());
      success(
        bilingualInline('Posted', 'Δημοσιεύτηκε'),
        bilingualInline(
          'Kept for this session — this is the demo, so nothing is stored.',
          'Κρατείται για αυτή τη συνεδρία — είναι το demo, οπότε δεν αποθηκεύεται τίποτα.',
        ),
      );
    } catch {
      showError(bilingualInline('Could not post', 'Η δημοσίευση απέτυχε'));
    }
  };

  // The feed answers at once and the server catches up; the promise settles
  // with the server, so the assistant reports the like only once it is kept.
  // A failed write puts the feed back the way the server has it.
  const handleLike = async (postId: string, isCurrentlyLiked: boolean): Promise<PageControlRunResult> => {
    queryClient.setQueryData(qk('feed', 'personalized', activeTab), (old: any) => {
      if (!old) return old;
      return {
        ...old,
        posts: old.posts.map((p: FeedPost) =>
          p.id === postId
            ? { 
                ...p, 
                isLiked: !isCurrentlyLiked, 
                likes: isCurrentlyLiked ? p.likes - 1 : p.likes + 1 
              }
            : p
        ),
      };
    });
    // The endpoint toggles: the same 'like' interaction likes and unlikes.
    const result = await settle(() => recordInteractionMutation.mutateAsync({ postId, interaction: 'like' }));
    if (result) void queryClient.invalidateQueries({ queryKey: qk('feed', 'personalized', activeTab) });
    return result;
  };

  const handleBookmark = async (postId: string, isCurrentlyBookmarked: boolean): Promise<PageControlRunResult> => {
    queryClient.setQueryData(qk('feed', 'personalized', activeTab), (old: any) => {
      if (!old) return old;
      return {
        ...old,
        posts: old.posts.map((p: FeedPost) =>
          p.id === postId ? { ...p, isBookmarked: !isCurrentlyBookmarked } : p
        ),
      };
    });
    // Toggles as well; the toast now waits for the server to agree.
    const result = await settle(() => recordInteractionMutation.mutateAsync({ postId, interaction: 'bookmark' }));
    if (result) {
      void queryClient.invalidateQueries({ queryKey: qk('feed', 'personalized', activeTab) });
      return result;
    }
    success('Bookmark updated');
  };

  const [reporting, setReporting] = useState<{ id: string; name: string } | null>(null);

  // A shared link is /feed?post=<id>: bring that post into view and mark it,
  // once it is in the list.
  const [linkedPost, setLinkedPost] = useState<string | null>(null);
  useEffect(() => {
    setLinkedPost(new URLSearchParams(window.location.search).get('post'));
  }, []);
  useEffect(() => {
    if (!linkedPost) return;
    const el = document.getElementById(`post-${linkedPost}`);
    if (!el) return;
    el.setAttribute('data-linked', 'true');
    el.scrollIntoView({ block: 'start' });
    el.focus({ preventScroll: true });
  });

  const handleShare = (postId: string) => {
    // Was /feed/post/:id, which does not exist. The feed scrolls to ?post=.
    navigator.clipboard.writeText(`${window.location.origin}/feed?post=${encodeURIComponent(postId)}`);
    success('Link copied to clipboard!');
    
    // Record interaction
    recordInteractionMutation.mutate({
      postId,
      interaction: 'share',
    });
  };

  const handlePostView = (postId: string) => {
    // Record view interaction
    recordInteractionMutation.mutate({
      postId,
      interaction: 'view',
    });
  };

  const handlePreferencesUpdate = (newPrefs: Partial<FeedPreferences>) => {
    updatePrefsMutation.mutate(newPrefs);
  };

  // The rows on screen - `posts` above, demo posts included.
  usePageList([
    {
      id: 'posts',
      labelEn: 'Posts',
      labelEl: 'Αναρτήσεις',
      rows: feedLoading ? undefined : posts.map((p) =>
        [
          p.author?.displayName ?? 'Post',
          p.type,
          `"${p.content ?? ''}"`.slice(0, 60),
          `${p.likes ?? 0} likes${p.isLiked ? ' (liked)' : ''}${p.isBookmarked ? ' (saved)' : ''}`,
        ].join(' · '),
      ),
      sample: !feedData?.posts?.length && isPreviewDemo(),
    },
  ]);
  const byAuthor = (list: FeedPost[]) => rowOptions(list, (p) => p.id, (p) => p.author?.displayName ?? 'Post');
  usePageControls([
    choiceControl('feed_tab', 'Feed', 'Ροή', [
      { value: 'all', en: 'All', el: 'Όλα' },
      { value: 'following', en: 'Following', el: 'Ακολουθώ' },
      { value: 'trending', en: 'Trending', el: 'Τάσεις' },
    ], activeTab, (v) => setActiveTab(v as typeof activeTab)),
    { id: 'refresh', labelEn: 'Refresh the feed', labelEl: 'Ανανέωση ροής', writes: false, run: () => void refetchFeed() },
    {
      id: 'load_more',
      labelEn: 'Load more posts',
      labelEl: 'Φόρτωση περισσότερων αναρτήσεων',
      writes: false,
      unavailableEn: hasNextPage ? undefined : 'There are no more posts to load.',
      unavailableEl: hasNextPage ? undefined : 'Δεν υπάρχουν άλλες αναρτήσεις.',
      run: () => void fetchNextPage(),
    },
    // Like and save each flip one flag on the post; the other command flips it back.
    { id: 'like_post', labelEn: 'Like post', labelEl: 'Μου αρέσει η ανάρτηση', writes: true, options: byAuthor(posts.filter((p) => !p.isLiked)), undo: (v) => ({ control: 'unlike_post', value: v }), run: (v) => (v ? handleLike(v, false) : undefined) },
    { id: 'unlike_post', labelEn: 'Unlike post', labelEl: 'Αναίρεση «μου αρέσει»', writes: true, options: byAuthor(posts.filter((p) => p.isLiked)), undo: (v) => ({ control: 'like_post', value: v }), run: (v) => (v ? handleLike(v, true) : undefined) },
    { id: 'save_post', labelEn: 'Save post', labelEl: 'Αποθήκευση ανάρτησης', writes: true, options: byAuthor(posts.filter((p) => !p.isBookmarked)), undo: (v) => ({ control: 'unsave_post', value: v }), run: (v) => (v ? handleBookmark(v, false) : undefined) },
    { id: 'unsave_post', labelEn: 'Remove post from saved', labelEl: 'Αφαίρεση από αποθηκευμένα', writes: true, options: byAuthor(posts.filter((p) => p.isBookmarked)), undo: (v) => ({ control: 'save_post', value: v }), run: (v) => (v ? handleBookmark(v, true) : undefined) },
    { id: 'share_post', labelEn: 'Copy a link to post', labelEl: 'Αντιγραφή συνδέσμου ανάρτησης', writes: false, options: byAuthor(posts), run: (v) => { if (v) handleShare(v); } },
    {
      id: 'report_author',
      labelEn: 'Report post author',
      labelEl: 'Αναφορά συντάκτη ανάρτησης',
      writes: false,
      options: rowOptions(posts, (p) => p.id, (p) => p.author?.displayName ?? 'Post'),
      run: (v) => {
        const post = posts.find((p) => p.id === v);
        if (post) setReporting({ id: post.author.id, name: post.author.displayName });
      },
    },
  ]);

  const rail: PageRailSection[] = [
    {
      id: 'trending',
      glyph: 'chart',
      labelEn: 'Trending topics',
      labelEl: 'Τάσεις',
      content: <TrendingTopics topics={trendingData?.topics} />,
    },
    {
      id: 'suggested',
      glyph: 'people',
      labelEn: 'Suggested connections',
      labelEl: 'Προτάσεις συνδέσεων',
      content: <SuggestedConnections />,
    },
    {
      id: 'preferences',
      glyph: 'sliders',
      labelEn: 'Feed preferences',
      labelEl: 'Προτιμήσεις ροής',
      content: preferences ? (
        <div className="space-y-4">
          <div>
            <p id="feed-ctypes" className="text-sm font-medium mb-2 block">
              <BilingualText en={feedEn('content_types')} el={feedEl('content_types')} compact />
            </p>
            <div className="flex flex-wrap gap-1" role="group" aria-labelledby="feed-ctypes">
              {['update', 'milestone', 'question', 'announcement', 'achievement'].map((type) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={preferences.contentTypes.includes(type)}
                  className={cn(badgeVariants({ variant: preferences.contentTypes.includes(type) ? 'default' : 'outline' }), 'border-0 shadow-none !shadow-none cursor-pointer')}
                  onClick={() => {
                    const newTypes = preferences.contentTypes.includes(type)
                      ? preferences.contentTypes.filter(t => t !== type)
                      : [...preferences.contentTypes, type];
                    handlePreferencesUpdate({ contentTypes: newTypes });
                  }}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p id="feed-topics" className="text-sm font-medium mb-2 block">
              <BilingualText en={feedEn('topics')} el={feedEl('topics')} compact />
            </p>
            <div className="flex flex-wrap gap-1" role="group" aria-labelledby="feed-topics">
              {(preferences.topics.length > 0 ? preferences.topics : ['fundraising', 'mvp', 'hiring', 'productlaunch', 'mentorship']).map((topic) => (
                <button
                  key={topic}
                  type="button"
                  aria-pressed={preferences.topics.includes(topic)}
                  className={cn(badgeVariants({ variant: preferences.topics.includes(topic) ? 'default' : 'outline' }), 'border-0 shadow-none !shadow-none cursor-pointer')}
                  onClick={() => {
                    const newTopics = preferences.topics.includes(topic)
                      ? preferences.topics.filter(t => t !== topic)
                      : [...preferences.topics, topic];
                    handlePreferencesUpdate({ topics: newTopics });
                  }}
                >
                  #{topic}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          <BilingualText en="Preferences are unavailable right now." el="Οι προτιμήσεις δεν είναι διαθέσιμες αυτή τη στιγμή." compact wrap />
        </p>
      ),
    },
    {
      id: 'related',
      glyph: 'flag',
      labelEn: 'Linked pages',
      labelEl: 'Συνδεδεμένες σελίδες',
      content: (
        <div className="space-y-1">
          <RailAction icon={Sparkles} en="Open groups" el="Άνοιγμα κοινοτήτων" onClick={() => router.push('/groups')} />
          <RailAction icon={CalendarDays} en="Open events" el="Άνοιγμα εκδηλώσεων" onClick={() => router.push('/events')} />
          <RailAction icon={Users} en="Open members" el="Άνοιγμα μελών" onClick={() => router.push('/members')} />
        </div>
      ),
    },
  ];

  return (
    <AppShell
      showHelp
      rail={rail}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList>
              <TabsTrigger value="all"><BilingualText en="All" el="Όλα" compact /></TabsTrigger>
              <TabsTrigger value="following"><BilingualText en="Following" el="Ακολουθώ" compact /></TabsTrigger>
              <TabsTrigger value="trending"><BilingualText en="Trending" el="Τάσεις" compact /></TabsTrigger>
            </TabsList>
          </Tabs>
          {/* The label is `hidden sm:inline`, so below 640px this button had
              no accessible name — named on desktop, anonymous on a phone,
              which is why mobile /feed failed button-name (critical). A
              responsive class can hide text from the screen; it must not be
              the only thing naming the control. */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openRailSection('preferences')}
            aria-label={bilingualAria('Preferences', 'Προτιμήσεις')}
            className="gap-1"
          >
            <Settings className="icon-sm" aria-hidden="true" />
            <span className="hidden sm:inline"><BilingualText en="Preferences" el="Προτιμήσεις" compact /></span>
          </Button>
        </div>
      }
    >
      <div className="pb-10">
        {isPreviewDemo() && (!feedData?.posts?.length) && (
          <SampleDataNotice
            className="mb-6"
            surface="Feed"
            detail="There is no live Feed module yet. These posts are sample network activity so you can review the layout."
            askAiPrompt="The feed is showing sample posts. What should I do next on Discover, Matches, or Messages instead?"
          />
        )}
        {/* The reading column owns the feed; trending, suggested people and
            preferences live in the right rail, so below `lg` they come back as
            a sheet instead of a column the posts push off-screen. */}
        <div className="space-y-6">

            {/* Create Post */}
            <FeedPostComposer onPost={handlePost} />

            {/* Posts */}
            <div className="space-y-4">
              {feedLoading ? (
                // Loading skeletons
                Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="overflow-hidden shadow-sm border-border">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex gap-3">
                          <Skeleton className="h-10 w-10 rounded-full" />
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-48" />
                          </div>
                        </div>
                        <Skeleton className="h-8 w-8" />
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                      <Skeleton className="h-20 w-full mb-3" />
                      <div className="flex gap-2">
                        <Skeleton className="h-6 w-16" />
                        <Skeleton className="h-6 w-20" />
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onLike={() => void handleLike(post.id, post.isLiked)}
                  onBookmark={() => void handleBookmark(post.id, post.isBookmarked)}
                  onComment={() => {}}
                  onShare={() => handleShare(post.id)}
                  onView={() => handlePostView(post.id)}
                  onReport={() => setReporting({ id: post.author.id, name: post.author.displayName })}
                />
              ))}
            </div>

            {/* Load More — shown only when the endpoint says there is more,
                so it never promises a page that does not exist. */}
            {hasNextPage && (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => void fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  <RefreshCw className={cn('icon-sm mr-2', isFetchingNextPage && 'animate-spin')} />
                  <BilingualText
                    en={isFetchingNextPage ? 'Loading…' : 'Load More'}
                    el={isFetchingNextPage ? 'Φόρτωση…' : 'Περισσότερα'}
                    compact
                  />
                </Button>
              </div>
            )}
        </div>
      </div>
      {reporting && (
        <ReportBlockModal
          open
          onOpenChange={(open) => { if (!open) setReporting(null); }}
          userId={reporting.id}
          userName={reporting.name}
          mode="report"
        />
      )}
    </AppShell>
  );
}
