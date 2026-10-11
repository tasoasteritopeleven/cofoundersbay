'use client';

import { useId, useState } from 'react';
import { Image, Link2, Hash, AtSign, Send, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn, initialsOf } from '@/lib/utils';
import { bilingualAria, bilingualInline } from '@/lib/i18n/format';
import { BilingualText } from '@/components/common/BilingualText';

type PostType = 'update' | 'ask' | 'offer' | 'hiring' | 'milestone' | 'pitch';

type CreatePostProps = {
  user: {
    displayName: string;
    avatarUrl?: string | null;
  };
  onSubmit: (data: { type: PostType; content: string; tags: string[] }) => Promise<void>;
  placeholder?: string;
};

const postTypes: { type: PostType; label: string; labelEl: string; emoji: string; description: string; descriptionEl: string }[] = [
  { type: 'update', label: 'Update', labelEl: 'Ενημέρωση', emoji: '📢', description: 'Share news or progress', descriptionEl: 'Μοιραστείτε νέα ή πρόοδο' },
  { type: 'ask', label: 'Ask', labelEl: 'Ερώτηση', emoji: '❓', description: 'Request help or advice', descriptionEl: 'Ζητήστε βοήθεια ή συμβουλή' },
  { type: 'offer', label: 'Offer', labelEl: 'Προσφορά', emoji: '🎁', description: 'Offer help or resources', descriptionEl: 'Προσφέρετε βοήθεια ή πόρους' },
  { type: 'hiring', label: 'Hiring', labelEl: 'Προσλήψεις', emoji: '👥', description: 'Looking for team members', descriptionEl: 'Αναζητάτε μέλη ομάδας' },
  { type: 'milestone', label: 'Milestone', labelEl: 'Ορόσημο', emoji: '🎉', description: 'Celebrate an achievement', descriptionEl: 'Γιορτάστε ένα επίτευγμα' },
  { type: 'pitch', label: 'Pitch', labelEl: 'Παρουσίαση', emoji: '🚀', description: 'Share your startup idea', descriptionEl: 'Μοιραστείτε την ιδέα της startup σας' },
];

const MAX_LENGTH = 1000;
const ATTACHMENTS_UNAVAILABLE = bilingualInline(
  'Not available yet: posts are text-only for now',
  'Δεν είναι διαθέσιμο ακόμη: οι αναρτήσεις είναι μόνο κείμενο προς το παρόν',
);

export function CreatePost({ user, onSubmit, placeholder = "What's on your mind?" }: CreatePostProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState<PostType>('update');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const baseId = useId();
  const contentId = `${baseId}-content`;
  const tagsId = `${baseId}-tags`;
  const tagsHintId = `${baseId}-tags-hint`;
  const countId = `${baseId}-count`;
  const errorId = `${baseId}-error`;
  const attachHintId = `${baseId}-attach-hint`;
  const current = postTypes.find((p) => p.type === postType);
  const tooLong = content.length > MAX_LENGTH;

  const handleSubmit = async () => {
    if (!content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(false);
    try {
      await onSubmit({ type: postType, content: content.trim(), tags });
      setContent('');
      setTags([]);
      setTagInput('');
      setIsExpanded(false);
    } catch (error) {
      // Keep the draft (content, type, tags) and the dialog open so the author can retry.
      console.error('Failed to create post:', error);
      setSubmitError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addTag = () => {
    const tag = tagInput.trim().replace(/^#/, '');
    if (tag && !tags.includes(tag) && tags.length < 5) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  return (
    <>
      {/* Collapsed view */}
      <Card
        className={cn(
          'cursor-pointer transition-colors hover:border-primary/30',
          isExpanded && 'hidden'
        )}
        onClick={() => setIsExpanded(true)}
      >
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user.avatarUrl || undefined} />
              <AvatarFallback className="bg-primary/20 text-primary-accessible">
                {initialsOf(user.displayName)}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setIsExpanded(true); }}
              className="flex-1 rounded-full bg-secondary/60 px-4 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {placeholder}
            </button>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2 border-t border-border pt-3">
            {postTypes.slice(0, 4).map((pt) => (
              // Each opens the composer already set to its type; before, they
              // relied on the click bubbling to the card and the type was lost.
              <Button
                key={pt.type}
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={(e) => { e.stopPropagation(); setPostType(pt.type); setIsExpanded(true); }}
              >
                <span aria-hidden="true">{pt.emoji}</span> <BilingualText en={pt.label} el={pt.labelEl} />
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Expanded dialog */}
      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="icon-md text-muted-foreground" />
              <BilingualText en="Create Post" el="Νέα ανάρτηση" />
            </DialogTitle>
            <DialogDescription className="sr-only"><BilingualText en="Write and publish a post to the feed." el="Συντάξτε και δημοσιεύστε μια ανάρτηση στη ροή." /></DialogDescription>
          </DialogHeader>

          {/* Post type selector */}
          <div className="grid grid-cols-3 gap-2" role="group" aria-label={bilingualAria('Post type', 'Τύπος ανάρτησης')}>
            {postTypes.map((pt) => (
              <button
                key={pt.type}
                type="button"
                aria-pressed={postType === pt.type}
                onClick={() => setPostType(pt.type)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-lg border p-3 transition-colors',
                  postType === pt.type
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                )}
              >
                <span className="text-xl" aria-hidden="true">{pt.emoji}</span>
                <span className="text-xs font-medium"><BilingualText en={pt.label} el={pt.labelEl} /></span>
              </button>
            ))}
          </div>

          {/* User info */}
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user.avatarUrl || undefined} />
              <AvatarFallback className="bg-primary/20 text-primary-accessible">
                {initialsOf(user.displayName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-foreground">{user.displayName}</p>
              <p className="text-xs text-muted-foreground">
                <BilingualText en={`Posting as ${current?.label ?? ''}`} el={`Ανάρτηση ως ${current?.labelEl ?? ''}`} />
              </p>
            </div>
          </div>

          {/* Content */}
          <label htmlFor={contentId} className="sr-only">
            {bilingualAria('Post content', 'Περιεχόμενο ανάρτησης')}
          </label>
          <Textarea
            id={contentId}
            placeholder={current ? bilingualInline(current.description, current.descriptionEl) : placeholder}
            value={content}
            onChange={(e) => { setContent(e.target.value); if (submitError) setSubmitError(false); }}
            aria-describedby={submitError ? `${countId} ${errorId}` : countId}
            aria-invalid={tooLong || undefined}
            rows={5}
            className="resize-none"
            autoFocus
          />

          {/* Tags */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" aria-hidden="true" />
                <label htmlFor={tagsId} className="sr-only">
                  {bilingualAria('Tags', 'Ετικέτες')}
                </label>
                <input
                  id={tagsId}
                  aria-describedby={tagsHintId}
                  type="text"
                  placeholder={bilingualInline("Add tags (press Enter)", "Προσθήκη ετικετών (πατήστε Enter)")}
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  className="w-full rounded-lg border border-border bg-transparent py-2 pl-9 pr-4 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <Button variant="secondary" size="sm" onClick={addTag} disabled={!tagInput.trim()}>
                <BilingualText en="Add" el="Προσθήκη" />
              </Button>
            </div>
            <p id={tagsHintId} className="sr-only">
              {bilingualAria(`Press Enter to add. Up to 5 tags, ${tags.length} added.`, `Πατήστε Enter για προσθήκη. Έως 5 ετικέτες, ${tags.length} προστέθηκαν.`)}
            </p>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    #{tag}
                    <button aria-label={bilingualAria(`Remove tag ${tag}`, `Αφαίρεση ετικέτας ${tag}`)} type="button" onClick={() => removeTag(tag)} className="ml-1 hover:text-destructive-accessible">
                      <X className="icon-sm" aria-hidden="true" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {submitError && (
            <p id={errorId} role="alert" className="text-sm text-destructive-accessible">
              <BilingualText
                en="Your post couldn't be published. Your draft is kept, so you can try again."
                el="Η ανάρτηση δεν δημοσιεύτηκε. Το προσχέδιό σας διατηρήθηκε, ώστε να δοκιμάσετε ξανά."
                wrap
              />
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="flex items-center gap-1" role="group" aria-label={bilingualAria('Attachments', 'Συνημμένα')} aria-describedby={attachHintId}>
              <span id={attachHintId} className="sr-only">{ATTACHMENTS_UNAVAILABLE}</span>
              <Button aria-label={bilingualAria('Add image', 'Προσθήκη εικόνας')} title={ATTACHMENTS_UNAVAILABLE} variant="ghost" size="icon" className="h-9 w-9" disabled>
                <Image className="icon-sm" aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9" disabled title={ATTACHMENTS_UNAVAILABLE} aria-label={bilingualAria('Add link', 'Προσθήκη συνδέσμου')}>
                <Link2 className="icon-sm" aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9" disabled title={ATTACHMENTS_UNAVAILABLE} aria-label={bilingualAria('Mention someone', 'Αναφορά σε κάποιον')}>
                <AtSign className="icon-sm" aria-hidden="true" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <span id={countId} className={cn('text-xs', tooLong ? 'text-destructive-accessible' : 'text-muted-foreground')}>
                {content.length}/{MAX_LENGTH}
                {tooLong && <span className="sr-only">{bilingualAria(' Over the character limit.', ' Υπέρβαση ορίου χαρακτήρων.')}</span>}
              </span>
              <Button
                onClick={handleSubmit}
                disabled={!content.trim() || tooLong || isSubmitting}
                aria-busy={isSubmitting || undefined}
              >
                {isSubmitting ? <BilingualText en="Posting…" el="Δημοσίευση…" /> : <BilingualText en="Post" el="Δημοσίευση" />}
              </Button>
              <span role="status" aria-live="polite" className="sr-only">
                {isSubmitting ? bilingualAria('Publishing your post…', 'Δημοσίευση της ανάρτησής σας…') : ''}
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
