'use client';

import { useState, useRef, useEffect } from 'react';
import { errorMessage } from '@/lib/utils';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Users, Globe, Lock, MessageCircle, Send, Loader2,
  MoreHorizontal, Trash2, Pin, Heart, ThumbsUp, Smile, RefreshCw,
  Settings, UserPlus, LogOut, CheckCircle2,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { BilingualText } from '@/components/common/BilingualText';
import { StatusText } from '@/components/common/StatusText';
import { RelativeTime } from '@/components/common/RelativeTime';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { ListEmptyState } from '@/components/common/EmptyStates';
import { STATUS } from '@/lib/semantic-colors';
import { cn, formatRelativeTime } from '@/lib/utils';
import { qk } from '@/lib/query-keys';
import {
  getGroup,
  joinGroup,
  leaveGroup,
  listGroupPosts,
  createGroupPost,
  deleteGroupPost,
  reactToGroupPost,
  listGroupComments,
  createGroupComment,
  type GroupPost,
  type GroupComment,
} from '@/lib/api';
import { bilingualAria, bilingualInline } from '@/lib/i18n/format';
import { choiceControl, rowOptions, usePageControls, usePageList, type PageControlRunResult } from '@/lib/page-controls';
import { FactLine } from '@/components/common/FactLine';
import { CardFoot, CardHead } from '@/components/common/CardAnatomy';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

const REACTIONS = ['👍', '❤️', '🔥', '🎉', '💡'];

function PostCard({
  post,
  groupId,
  isMember,
  currentUserId,
  onDelete,
  onReact,
}: {
  post: GroupPost;
  groupId: string;
  isMember: boolean;
  currentUserId: string | null;
  onDelete: (postId: string) => void;
  onReact: (postId: string, emoji: string) => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const { error: toastError } = useToast();

  const commentsQuery = useQuery({
    queryKey: qk('groups', 'comments', post.id),
    queryFn: () => listGroupComments(groupId, post.id, { limit: 20 }),
    enabled: showComments,
    staleTime: 30_000,
  });

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setSubmittingComment(true);
    try {
      await createGroupComment(groupId, post.id, newComment.trim());
      setNewComment('');
      commentsQuery.refetch();
    } catch (e: unknown) {
      toastError('Error', errorMessage(e, 'Failed to add comment'));
    } finally {
      setSubmittingComment(false);
    }
  };

  const isOwn = currentUserId && post.author?.id === currentUserId;

  // A post reads like every card: the author's mark and name with the time
  // under it, the post on the mark's edge, then the reactions in the foot.
  return (
    <Card className="transition-all hover:border-primary/20">
      <CardContent className="space-y-3">
        {post.isPinned && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-primary-accessible">
            <Pin className="icon-sm" aria-hidden="true" />
            <BilingualText en="Pinned post" el="Καρφιτσωμένη δημοσίευση" compact />
          </p>
        )}

        <CardHead
          mark={(
            <Avatar className="h-10 w-10">
              <AvatarImage src={post.author?.avatarUrl ?? undefined} alt="" />
              <AvatarFallback className="bg-primary/10 font-semibold text-primary-accessible">{post.author?.displayName?.[0]?.toUpperCase() ?? 'U'}</AvatarFallback>
            </Avatar>
          )}
          title={post.author?.displayName ?? <BilingualText en="Member" el="Μέλος" compact />}
          subtitle={<RelativeTime date={post.createdAt} format={formatRelativeTime} />}
          asideStays
          aside={isOwn ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={bilingualAria('Delete post', 'Διαγραφή ανάρτησης')}
              onClick={() => onDelete(post.id)}
              className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive-accessible"
            >
              <Trash2 className="icon-sm" aria-hidden="true" />
            </Button>
          ) : undefined}
        />

        <p className="card-body whitespace-pre-wrap text-foreground/90 first-letter:uppercase">{post.content}</p>

        {/* Media */}
        {(post.mediaUrls?.length ?? 0) > 0 && (
          <div className={cn('grid grid-cols-1 gap-2', (post.mediaUrls?.length ?? 0) > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
            {(post.mediaUrls ?? []).map((url, i) => (
              <img key={i} src={url} alt="" className="max-h-64 w-full rounded-lg object-cover" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
            ))}
          </div>
        )}

        {/* Reactions and comments: framed controls, so their edge is the
            card's axis rather than a ghost button's padding. */}
        <CardFoot>
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={bilingualAria('React', 'Αντίδραση')}
              aria-expanded={showReactions}
              onClick={() => setShowReactions((p) => !p)}
              className={cn('gap-1.5', post.myReaction && 'border-primary/30 bg-primary/10 text-primary-accessible')}
            >
              {post.myReaction ?? <Heart className="icon-sm" aria-hidden="true" />}
              {post.reactionCount > 0 && <span className="tabular-nums">{post.reactionCount}</span>}
            </Button>
            {showReactions && (
              <div className="absolute bottom-full left-0 z-10 mb-1 flex items-center gap-1 rounded-xl border border-border bg-popover p-1.5 shadow-xl">
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    aria-label={bilingualAria(`React ${emoji}`, `Αντίδραση ${emoji}`)}
                    onClick={() => {
                      onReact(post.id, emoji);
                      setShowReactions(false);
                    }}
                    className="rounded-md p-1.5 text-base transition-colors hover:bg-accent"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* The count and the verb read as one phrase: "6 Comment" put a
              number in front of an imperative. */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={showComments}
            onClick={() => setShowComments((p) => !p)}
            className="gap-1.5"
          >
            <MessageCircle className="icon-sm" aria-hidden="true" />
            {showComments
              ? <BilingualText en="Hide comments" el="Απόκρυψη σχολίων" compact />
              : post.commentCount === 0
                ? <BilingualText en="Comment" el="Σχόλιο" compact />
                : <BilingualText en={`${post.commentCount} ${post.commentCount === 1 ? 'comment' : 'comments'}`} el={`${post.commentCount} ${post.commentCount === 1 ? 'σχόλιο' : 'σχόλια'}`} compact />}
          </Button>
        </CardFoot>

        {/* Comments */}
        {showComments && (
          <div className="space-y-3">
            {commentsQuery.isLoading && (
              <div className="flex justify-center py-4"><Loader2 className="icon-md animate-spin text-primary/50" /></div>
            )}
            {(commentsQuery.data?.comments ?? []).map((c) => (
              <div key={c.id} className="flex items-start gap-2.5">
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={c.author?.avatarUrl ?? undefined} alt="" />
                  <AvatarFallback className="text-2xs">{c.author?.displayName?.[0]?.toUpperCase() ?? 'U'}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 rounded-xl bg-secondary/40 px-3 py-2">
                  <span className="text-xs font-semibold">{c.author?.displayName}</span>
                  <span className="ml-2 text-2xs text-muted-foreground"><RelativeTime date={c.createdAt} format={formatRelativeTime} /></span>
                  <p className="mt-0.5 break-words text-xs text-foreground/90">{c.content}</p>
                </div>
              </div>
            ))}
            {isMember && (
              <div className="flex items-center gap-2">
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAddComment()}
                  aria-label={bilingualAria('Write a comment', 'Γράψτε ένα σχόλιο')}
                  placeholder={bilingualInline("Write a comment…", "Γράψτε ένα σχόλιο…")}
                  className="min-w-0 flex-1 rounded-xl border border-input bg-secondary/40 px-3 py-2 text-xs outline-none"
                />
                <Button aria-label={bilingualAria('Send comment', 'Αποστολή σχολίου')}
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  disabled={submittingComment || !newComment.trim()}
                  onClick={handleAddComment}
                >
                  {submittingComment ? <Loader2 className="icon-sm animate-spin" /> : <Send className="icon-sm" />}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function GroupDetailPage() {
  const params = useParams<{ groupId: string }>();
  const groupId = params?.groupId;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();
  const [newPost, setNewPost] = useState('');
  const [submittingPost, setSubmittingPost] = useState(false);
  const [togglingMembership, setTogglingMembership] = useState(false);
  const [activeSection, setActiveSection] = useState<'feed' | 'members'>('feed');
  // `?section=members` - how the admin directory's "Manage Members" lands
  // here. Read after mount (not via useSearchParams) so the first render
  // matches the server's and no Suspense boundary is needed.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('section') === 'members') setActiveSection('members');
  }, []);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const user = JSON.parse(localStorage.getItem('user') ?? '{}');
        setCurrentUserId(user?.id ?? null);
      } catch {}
    }
  }, []);

  const groupQuery = useQuery({
    queryKey: qk('groups', 'one', groupId),
    queryFn: () => getGroup(groupId!),
    staleTime: 60_000,
    enabled: !!groupId,
  });

  const postsQuery = useQuery({
    queryKey: qk('groups', 'posts', groupId),
    queryFn: () => listGroupPosts(groupId!, { limit: 20 }),
    staleTime: 30_000,
    enabled: !!groupId,
  });

  const group = groupQuery.data?.group;
  const isMember = groupQuery.data?.isMember ?? false;
  const memberRole = groupQuery.data?.memberRole;

  const handleToggleMembership = async (): Promise<PageControlRunResult> => {
    if (!group) return { error: 'The group has not loaded.' };
    setTogglingMembership(true);
    try {
      if (isMember) {
        await leaveGroup(group.id);
        success('Left group', `You've left ${group.name}.`);
      } else {
        await joinGroup(group.id);
        success('Joined!', `Welcome to ${group.name}!`);
      }
      queryClient.invalidateQueries({ queryKey: qk('groups', 'one', groupId) });
      queryClient.invalidateQueries({ queryKey: qk('groups') });
    } catch (e: unknown) {
      toastError(isMember ? 'Could not leave the group' : 'Could not join the group', errorMessage(e, 'Something went wrong.'));
      return { error: errorMessage(e, isMember ? 'You are still a member.' : 'You did not join.') };
    } finally {
      setTogglingMembership(false);
    }
  };

  const handleCreatePost = async () => {
    if (!newPost.trim() || !group) return;
    setSubmittingPost(true);
    try {
      await createGroupPost(group.id, { content: newPost.trim() });
      setNewPost('');
      queryClient.invalidateQueries({ queryKey: qk('groups', 'posts', groupId) });
    } catch (e: unknown) {
      toastError('Error', errorMessage(e, 'Failed to create post.'));
    } finally {
      setSubmittingPost(false);
    }
  };

  const handleDeletePost = async (postId: string): Promise<PageControlRunResult> => {
    if (!group) return { error: 'The group has not loaded.' };
    try {
      await deleteGroupPost(group.id, postId);
      queryClient.invalidateQueries({ queryKey: qk('groups', 'posts', groupId) });
      success('Post deleted', '');
    } catch (e: unknown) {
      toastError('Could not delete the post', errorMessage(e, 'Failed to delete post.'));
      return { error: errorMessage(e, 'The post could not be deleted.') };
    }
  };

  const handleReact = async (postId: string, emoji: string) => {
    if (!group) return;
    try {
      await reactToGroupPost(group.id, postId, emoji);
      queryClient.invalidateQueries({ queryKey: qk('groups', 'posts', groupId) });
    } catch {}
  };

  /*
   * The page's own buttons, offered to the assistant. Neither membership
   * command names an undo: `GroupsService.joinGroup` creates the row as a
   * plain member and fires the community-join automation, and `leaveGroup`
   * deletes the row outright - so leaving after a join leaves the automation's
   * effects behind, and joining after a leave loses the old role and join date.
   */
  const feed = postsQuery.data?.posts ?? [];
  const ownPosts = currentUserId ? feed.filter((p) => p.author?.id === currentUserId) : [];
  const groupMembers = group?.members ?? [];
  usePageControls([
    choiceControl('group_section', 'Group section', 'Ενότητα κοινότητας', [
      { value: 'feed', en: 'Feed', el: 'Ροή' },
      { value: 'members', en: 'Members', el: 'Μέλη' },
    ], activeSection, (v) => setActiveSection(v as typeof activeSection)),
    {
      id: isMember ? 'leave_group' : 'join_group',
      labelEn: isMember ? 'Leave this group' : 'Join this group',
      labelEl: isMember ? 'Αποχώρηση από την κοινότητα' : 'Συμμετοχή στην κοινότητα',
      writes: true,
      unavailableEn: !group ? 'The group has not loaded.' : memberRole === 'owner' ? 'The owner cannot leave; transfer ownership first.' : undefined,
      unavailableEl: !group ? 'Η κοινότητα δεν έχει φορτωθεί.' : memberRole === 'owner' ? 'Ο ιδιοκτήτης δεν μπορεί να αποχωρήσει· μεταβιβάστε πρώτα την ιδιοκτησία.' : undefined,
      run: handleToggleMembership,
    },
    {
      id: 'delete_own_post',
      labelEn: 'Delete one of my posts in this group',
      labelEl: 'Διαγραφή ανάρτησής μου στην κοινότητα',
      writes: true,
      options: rowOptions(ownPosts, (p) => p.id, (p) => (p.content ?? '').slice(0, 60)),
      unavailableEn: ownPosts.length === 0 ? 'You have no posts in this group.' : undefined,
      unavailableEl: ownPosts.length === 0 ? 'Δεν έχετε αναρτήσεις σε αυτή την κοινότητα.' : undefined,
      run: (value) => (value ? handleDeletePost(value) : undefined),
    },
    {
      id: 'open_member',
      labelEn: 'Open a member\'s profile',
      labelEl: 'Άνοιγμα προφίλ μέλους',
      writes: false,
      options: rowOptions(groupMembers, (m) => m.userId, (m) => m.user?.displayName ?? m.userId),
      unavailableEn: groupMembers.length === 0 ? 'No members are listed.' : undefined,
      unavailableEl: groupMembers.length === 0 ? 'Δεν εμφανίζονται μέλη.' : undefined,
      run: (value) => { if (value) router.push(`/profiles/${value}`); },
    },
  ]);
  usePageList([
    {
      id: 'group_posts',
      labelEn: 'Group posts',
      labelEl: 'Αναρτήσεις κοινότητας',
      rows: postsQuery.data ? feed.map((p) => `${p.author?.displayName ?? '—'}: ${(p.content ?? '').slice(0, 120)}`) : undefined,
      total: feed.length,
      sample: false,
    },
    {
      id: 'group_members',
      labelEn: 'Group members',
      labelEl: 'Μέλη κοινότητας',
      rows: group ? groupMembers.map((m) => `${m.user?.displayName ?? m.userId} · ${m.role}`) : undefined,
      total: group?.memberCount ?? groupMembers.length,
      sample: false,
    },
  ]);

  if (groupQuery.isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="icon-xl animate-spin text-primary/50" />
        </div>
      </AppShell>
    );
  }

  if (groupQuery.isError || !group) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-muted-foreground"><BilingualText en="Group not found" el="Η κοινότητα δεν βρέθηκε" compact /></p>
          <Button variant="outline" onClick={() => router.push('/groups')}><BilingualText en="Back to Groups" el="Πίσω στις κοινότητες" compact /></Button>
        </div>
      </AppShell>
    );
  }

  const posts = postsQuery.data?.posts ?? [];

  return (
    <AppShell>
      {/* Cover / Header */}
      <div className="space-y-6">
        <button
          onClick={() => router.push('/groups')}
          type="button"
          className="-ml-2 flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-ring sm:min-h-9"
        >
          <ArrowLeft className="icon-sm" aria-hidden="true" />
          <BilingualText en="Back to Groups" el="Πίσω στις κοινότητες" compact />
        </button>

        {/* The page's hero: its name is the page's display title and its
            mark a hero's, so the card ladder does not apply to it. */}
        <div data-card-hero="" className="rounded-2xl border border-border bg-card/70 overflow-hidden">
          {group.coverImageUrl ? (
            <div
              className="h-40 w-full bg-cover bg-center"
              style={{ backgroundImage: `url(${group.coverImageUrl})` }}
            />
          ) : null}

          {/* Without a cover the header starts at the card's edge: a blank
              band under an avatar half-sitting on it read as a missing image. */}
          <div className={cn('relative px-4 pb-5 sm:px-6', group.coverImageUrl ? '-mt-8' : 'pt-5')}>
            {/* On a phone the join button drops under the name instead of
                being pushed off the card's right edge. */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex min-w-0 items-end gap-4">
                {/* The community's mark, as on its card in the directory. */}
                <div data-card-mark="" data-keep-icon className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border-2 border-card bg-muted">
                  {group.avatarUrl ? (
                    <img src={group.avatarUrl} alt="" className="h-full w-full rounded-xl object-cover" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                  ) : (
                    <Users className="h-7 w-7 text-primary-accessible" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0 pb-1">
                  <h2 className="font-display text-xl sm:text-2xl xl:text-3xl font-semibold">{group.name}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      {group.privacy === 'public' ? <Globe className="icon-sm" /> : <Lock className="icon-sm" />}
                      <StatusText value={group.privacy} />
                    </div>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="icon-sm" />
                      <BilingualText en={`${group.memberCount.toLocaleString('en-GB')} members`} el={`${group.memberCount.toLocaleString('el-GR')} μέλη`} compact />
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MessageCircle className="icon-sm" />
                      <BilingualText en={`${group.postCount.toLocaleString('en-GB')} posts`} el={`${group.postCount.toLocaleString('el-GR')} δημοσιεύσεις`} compact />
                    </span>
                  </div>
                </div>
              </div>

              <Button
                variant={isMember ? 'outline' : 'default'}
                className="w-full gap-2 shrink-0 sm:w-auto"
                disabled={togglingMembership}
                onClick={() => void handleToggleMembership()}
              >
                {togglingMembership ? (
                  <Loader2 className="icon-sm animate-spin" />
                ) : isMember ? (
                  <><CheckCircle2 className={cn('icon-sm', STATUS.success.icon)} aria-hidden="true" /> <BilingualText en="Joined" el="Μέλος" compact /></>
                ) : (
                  <><UserPlus className="icon-sm" aria-hidden="true" /> <BilingualText en="Join Group" el="Συμμετοχή" compact /></>
                )}
              </Button>
            </div>

            {group.description && (
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-2xl">{group.description}</p>
            )}

            {/* Category first, then tags: one line of descriptors. */}
            <FactLine
              className="mt-3"
              items={[group.category ? <StatusText key="category" value={group.category} /> : null, ...(group.tags ?? []).map((tag) => `#${tag}`)]}
            />

          </div>
        </div>

        {/* Section tabs */}
        <div className="flex gap-1 rounded-xl border border-border bg-card/70 p-1 w-fit">
          {(['feed', 'members'] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={activeSection === s}
              onClick={() => setActiveSection(s)}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-ring',
                activeSection === s
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {s === 'feed' ? <BilingualText en="Feed" el="Ροή" compact /> : <BilingualText en="Members" el="Μέλη" compact />}
              {s === 'members' && (
                <span className="ml-1.5 text-xs">({group.memberCount})</span>
              )}
            </button>
          ))}
        </div>

        {/* Feed section */}
        {activeSection === 'feed' && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-4">
              {/* Create post */}
              {isMember && (
                <Card>
                  <CardContent className="space-y-3">
                    <Textarea
                      value={newPost}
                      onChange={(e) => setNewPost(e.target.value)}
                      aria-label={bilingualAria('Share something with the group', 'Μοιραστείτε κάτι με την κοινότητα')}
                      placeholder={bilingualInline("Share something with the group…", "Μοιραστείτε κάτι με την κοινότητα…")}
                      className="resize-none"
                      rows={3}
                    />
                    <div className="flex justify-end">
                      <Button
                        className="gap-2"
                        disabled={submittingPost || !newPost.trim()}
                        onClick={handleCreatePost}
                      >
                        {submittingPost ? <Loader2 className="icon-sm animate-spin" /> : <Send className="icon-sm" />}
                        <BilingualText en="Post" el="Δημοσίευση" compact />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Posts */}
              {postsQuery.isLoading && (
                <div className="flex justify-center py-12">
                  <Loader2 className="icon-lg animate-spin text-primary/50" />
                </div>
              )}

              {postsQuery.isError && (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <p className="text-sm text-muted-foreground"><BilingualText en="Failed to load posts" el="Δεν φορτώθηκαν οι δημοσιεύσεις" compact /></p>
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => postsQuery.refetch()}>
                    <RefreshCw className="icon-sm" aria-hidden="true" /> <BilingualText en="Retry" el="Δοκιμάστε ξανά" compact />
                  </Button>
                </div>
              )}

              {!postsQuery.isLoading && !postsQuery.isError && posts.length === 0 && (
                <ListEmptyState
                  icon={MessageCircle}
                  tone="primary"
                  variant="dashed"
                  size="compact"
                  title={<BilingualText en="No posts yet" el="Δεν υπάρχουν ακόμη δημοσιεύσεις" wrap />}
                  description={isMember
                    ? <BilingualText en="Be the first to start a discussion — share an update, ask a question, or post a resource." el="Ξεκινήστε πρώτοι τη συζήτηση — μοιραστείτε νέα, κάντε μια ερώτηση ή δημοσιεύστε έναν πόρο." wrap />
                    : <BilingualText en="Join this community to read and start discussions." el="Γίνετε μέλος για να διαβάζετε και να ξεκινάτε συζητήσεις." wrap />}
                />
              )}

              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  groupId={group.id}
                  isMember={isMember}
                  currentUserId={currentUserId}
                  onDelete={handleDeletePost}
                  onReact={handleReact}
                />
              ))}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Rules: a section card; each rule's title and sentence
                  start on the card's axis, the number in front of the title. */}
              {(group.rules?.length ?? 0) > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle><BilingualText en="Group Rules" el="Κανόνες κοινότητας" compact /></CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ol className="space-y-2">
                      {(group.rules ?? []).map((rule, i) => (
                        <li key={i} className="text-xs text-muted-foreground">
                          <p className="font-medium text-foreground"><span className="tabular-nums">{i + 1}.</span> {rule.title}</p>
                          {rule.description && <p className="mt-0.5">{rule.description}</p>}
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              )}

              {/* Recent members: rows without a frame of their own. */}
              {groupMembers.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle><BilingualText en={`Members (${group.memberCount})`} el={`Μέλη (${group.memberCount})`} compact /></CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <ul className="space-y-2">
                      {groupMembers.slice(0, 6).map((m) => (
                        <li key={m.userId} className="flex items-center gap-2">
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarImage src={m.user?.avatarUrl ?? undefined} alt="" />
                            <AvatarFallback className="text-2xs">{m.user?.displayName?.[0]?.toUpperCase() ?? 'U'}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium">{m.user?.displayName ?? <BilingualText en="Member" el="Μέλος" compact />}</p>
                            {m.role !== 'member' && (
                              <p className="text-2xs text-primary-accessible"><StatusText value={m.role} /></p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                    {group.memberCount > 6 && (
                      <button
                        type="button"
                        onClick={() => setActiveSection('members')}
                        className="rounded-md text-xs text-primary-accessible hover:underline focus-ring"
                      >
                        <BilingualText en={`View all ${group.memberCount} members →`} el={`Όλα τα ${group.memberCount} μέλη →`} compact />
                      </button>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Members section: a section card whose people are rows on its
            axis, not a box each. */}
        {activeSection === 'members' && (
          <Card>
            <CardHeader>
              <CardTitle><BilingualText en={`All Members (${group.memberCount})`} el={`Όλα τα μέλη (${group.memberCount})`} compact /></CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {groupMembers.map((m) => (
                  <button
                    type="button"
                    key={m.userId}
                    className="axis-row flex items-center gap-3 rounded-md py-2 text-left transition-colors hover:bg-accent focus-ring"
                    onClick={() => router.push(`/profiles/${m.userId}`)}
                  >
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={m.user?.avatarUrl ?? undefined} alt="" />
                      <AvatarFallback className="bg-primary/10 font-semibold text-primary-accessible">{m.user?.displayName?.[0]?.toUpperCase() ?? 'U'}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{m.user?.displayName ?? <BilingualText en="Member" el="Μέλος" compact />}</span>
                      {m.user?.headline && (
                        <span className="block truncate text-xs text-muted-foreground">{m.user.headline}</span>
                      )}
                      {m.role !== 'member' && (
                        <span className="block text-2xs font-medium text-primary-accessible"><StatusText value={m.role} /></span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
