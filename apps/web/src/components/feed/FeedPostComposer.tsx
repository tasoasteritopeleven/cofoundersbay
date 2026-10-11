'use client';

import { useId, useState } from 'react';
import { Award, Image as ImageIcon, Link2, MessageCircle, Send, Sparkles, Target, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualAria, bilingualInline } from '@/lib/i18n/format';
import { cn } from '@/lib/utils';

export type FeedPostType = 'update' | 'milestone' | 'question' | 'announcement' | 'achievement';

const TYPES: { type: FeedPostType; icon: typeof Sparkles; color: string; en: string; el: string }[] = [
  { type: 'update', icon: Sparkles, color: 'text-primary-accessible', en: 'Update', el: 'Ενημέρωση' },
  { type: 'milestone', icon: Target, color: 'text-status-success', en: 'Milestone', el: 'Ορόσημο' },
  { type: 'question', icon: MessageCircle, color: 'text-status-warning', en: 'Question', el: 'Ερώτηση' },
  { type: 'announcement', icon: TrendingUp, color: 'text-status-accent', en: 'Announcement', el: 'Ανακοίνωση' },
  { type: 'achievement', icon: Award, color: 'text-status-accent', en: 'Achievement', el: 'Επίτευγμα' },
];

type Props = {
  /** Page callback. May be sync or async; a throw or rejection keeps the draft. */
  onPost: (content: string, type: FeedPostType) => void | Promise<void>;
};

export function FeedPostComposer({ onPost }: Props) {
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState<FeedPostType>('update');
  const [isExpanded, setIsExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const errorId = `${useId()}-error`;

  const handleSubmit = async () => {
    if (!content.trim() || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await onPost(content, postType);
      setContent('');
      setIsExpanded(false);
    } catch (error) {
      console.error('Failed to post:', error);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    // The writer's mark beside the field; the type, attachments and Post sit
    // under it on the card's own edge, not indented beside the avatar.
    <Card>
      <CardContent className="space-y-3">
        <div className="flex gap-3">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback className="bg-primary/10 font-semibold text-primary-accessible">ME</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <Textarea
              aria-label={bilingualAria('Write a post', 'Σύνταξη δημοσίευσης')}
              placeholder={bilingualInline('Share an update, ask a question, or celebrate a milestone…', 'Μοιραστείτε νέα, κάντε μια ερώτηση ή γιορτάστε ένα ορόσημο…')}
              value={content}
              onChange={(e) => { setContent(e.target.value); if (failed) setFailed(false); }}
              onFocus={() => setIsExpanded(true)}
              aria-describedby={failed ? errorId : undefined}
              className={cn(
                'resize-none border-0 bg-transparent px-2 py-1 -mx-2 rounded-md',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                isExpanded ? 'min-h-[100px]' : 'min-h-[40px]',
              )}
            />
          </div>
        </div>

        {failed && (
          <p id={errorId} role="alert" className="text-sm text-destructive-accessible">
            <BilingualText
              en="Couldn't post. Your draft is still here, so you can try again."
              el="Η δημοσίευση απέτυχε. Το προσχέδιό σας παραμένει, ώστε να δοκιμάσετε ξανά."
              wrap
            />
          </p>
        )}

        {isExpanded && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <div className="flex min-w-0 flex-wrap gap-1" role="group" aria-label={bilingualAria('Post type', 'Τύπος δημοσίευσης')}>
              {TYPES.map(({ type, icon: Icon, color, en, el }) => (
                <Button
                  key={type}
                  variant={postType === type ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setPostType(type)}
                  aria-label={bilingualAria(en, el)}
                  aria-pressed={postType === type}
                  className="gap-1"
                >
                  <Icon className={cn('icon-sm', color)} aria-hidden="true" />
                  <span className="hidden sm:inline"><BilingualText en={en} el={el} /></span>
                </Button>
              ))}
            </div>
            <div className="ml-auto flex shrink-0 gap-2">
              {/* An image and a link need somewhere to upload to, and the
                  feed has no server yet. Disabled and labelled, rather
                  than looking available and doing nothing. */}
              <Button
                variant="ghost"
                size="sm"
                disabled
                aria-label={bilingualAria('Attach an image — not available yet', 'Επισύναψη εικόνας — μη διαθέσιμο ακόμη')}
                title={bilingualAria('Attach an image — not available yet', 'Επισύναψη εικόνας — μη διαθέσιμο ακόμη')}
              >
                <ImageIcon className="icon-sm" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled
                aria-label={bilingualAria('Attach a link — not available yet', 'Επισύναψη συνδέσμου — μη διαθέσιμο ακόμη')}
                title={bilingualAria('Attach a link — not available yet', 'Επισύναψη συνδέσμου — μη διαθέσιμο ακόμη')}
              >
                <Link2 className="icon-sm" aria-hidden="true" />
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={!content.trim() || busy} aria-busy={busy || undefined}>
                <Send className="icon-sm mr-1" aria-hidden="true" />
                {busy ? <BilingualText en="Posting…" el="Δημοσίευση…" /> : <BilingualText en="Post" el="Δημοσίευση" />}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
