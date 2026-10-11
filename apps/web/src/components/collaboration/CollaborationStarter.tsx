'use client';

/**
 * CollaborationStarter
 *
 * Surfaces actionable next-steps when a connection has been accepted.
 * The goal is to bridge the gap between "connected" and "actively collaborating"
 * by providing a structured, low-friction workflow prompt.
 *
 * Modes:
 *   - inline: compact card embedded in a connection list row
 *   - banner: full-width suggestion bar (e.g. for the Connected tab header)
 *   - modal: shown after accepting a connection request
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MessageCircle,
  FolderPlus,
  Target,
  Calendar,
  ChevronRight,
  X,
  Sparkles,
  Handshake,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { BilingualText } from '@/components/common/BilingualText';
import { CardHead } from '@/components/common/CardAnatomy';
import { StatusText } from '@/components/common/StatusText';
import { getOrCreateDirectConversation } from '@/lib/api';
import { bilingualAria } from '@/lib/i18n/format';
import { cn, initialsOf } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CollaborationStarterProps = {
  /** The user the current person just connected with */
  otherUser: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    role?: string;
    headline?: string | null;
  };
  /** Whether this is a freshly accepted connection (triggers the modal) */
  justAccepted?: boolean;
  /** Inline or banner display mode */
  mode?: 'inline' | 'banner' | 'modal';
  /** External dismiss handler (for modal or banner) */
  onDismiss?: () => void;
  className?: string;
};

// ─── Action definitions ───────────────────────────────────────────────────────

type CollabAction = {
  id: string;
  label: string;
  labelEl: string;
  description: string;
  descriptionEl: string;
  icon: React.ElementType;
  variant: 'default' | 'outline' | 'secondary';
  href?: string;
  onClick?: () => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function CollaborationStarter({
  otherUser,
  justAccepted = false,
  mode = 'inline',
  onDismiss,
  className,
}: CollaborationStarterProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [open, setOpen] = useState(justAccepted && mode === 'modal');

  const handleMessage = async () => {
    setLoading('message');
    try {
      const { conversationId } = await getOrCreateDirectConversation(otherUser.id);
      router.push(`/messages?c=${conversationId}`);
    } catch {
      router.push(`/messages?to=${otherUser.id}`);
    } finally {
      setLoading(null);
    }
  };

  const actions: CollabAction[] = [
    {
      id: 'message',
      label: 'Send a message',
      labelEl: 'Αποστολή μηνύματος',
      description: 'Start the conversation',
      descriptionEl: 'Ξεκινήστε τη συζήτηση',
      icon: MessageCircle,
      variant: 'default',
      onClick: handleMessage,
    },
    {
      id: 'project',
      label: 'Create a project',
      labelEl: 'Δημιουργία project',
      description: 'Collaborate on something together',
      descriptionEl: 'Συνεργαστείτε σε κάτι μαζί',
      icon: FolderPlus,
      variant: 'outline',
      href: `/projects/create?collaborator=${otherUser.id}`,
    },
    {
      id: 'milestone',
      label: 'Set a goal',
      labelEl: 'Ορισμός στόχου',
      description: 'Define a shared first milestone',
      descriptionEl: 'Ορίστε ένα πρώτο κοινό ορόσημο',
      icon: Target,
      variant: 'outline',
      href: `/milestones/new?with=${otherUser.id}`,
    },
    {
      id: 'schedule',
      label: 'Schedule a call',
      labelEl: 'Προγραμματισμός κλήσης',
      description: 'Find a time to meet',
      descriptionEl: 'Βρείτε χρόνο να συναντηθείτε',
      icon: Calendar,
      variant: 'outline',
      href: `/messages?to=${otherUser.id}&action=schedule`,
    },
  ];

  const handleAction = async (action: CollabAction) => {
    if (action.onClick) {
      await action.onClick();
      return;
    }
    if (action.href) {
      router.push(action.href);
    }
  };

  // ── Modal mode (post-accept flow) ──────────────────────────────────────────
  if (mode === 'modal') {
    return (
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) onDismiss?.(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              <BilingualText
                en={`You\u2019re connected with ${otherUser.displayName}!`}
                el={`Συνδεθήκατε με ${otherUser.displayName}!`}
                compact
                wrap
              />
            </DialogTitle>
            <DialogDescription>
              <BilingualText en="Ready to start collaborating?" el="Έτοιμοι να ξεκινήσετε τη συνεργασία;" wrap />
            </DialogDescription>
          </DialogHeader>

          {/* The person as their card shows them: the mark, the name and the
              headline under it, on one left edge. */}
          <div className="rounded-xl border border-border p-4">
            <CardHead
              titleAs="p"
              mark={(
                <div className="relative">
                  <Avatar className="h-10 w-10 ring-2 ring-status-success">
                    <AvatarImage src={otherUser.avatarUrl ?? undefined} alt="" />
                    <AvatarFallback className="bg-primary/20 text-primary-accessible font-semibold text-sm">
                      {initialsOf(otherUser.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <span data-keep-icon="" className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-status-success-mark text-ink">
                    <Handshake className="icon-sm" aria-hidden="true" />
                  </span>
                </div>
              )}
              title={otherUser.displayName}
              subtitle={otherUser.headline || undefined}
              meta={otherUser.role ? <StatusText value={otherUser.role} /> : undefined}
            />
          </div>

          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground mb-3">
              <BilingualText en="What would you like to do next?" el="Τι θα θέλατε να κάνετε στη συνέχεια;" wrap />
            </p>
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={() => handleAction(action)}
                  disabled={loading === action.id}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3',
                    'text-left transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm',
                    'focus-visible:outline-none',
                    loading === action.id && 'opacity-60 pointer-events-none',
                  )}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary">
                    <Icon className="h-4.5 w-4.5 text-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      <BilingualText en={action.label} el={action.labelEl} compact wrap />
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <BilingualText en={action.description} el={action.descriptionEl} compact wrap />
                    </p>
                  </div>
                  <ChevronRight className="icon-sm text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-3 border-t border-border">
            <p className="min-w-0 text-xs text-muted-foreground">
              <BilingualText en="You can always do this later from your connections" el="Μπορείτε να το κάνετε αργότερα από τις συνδέσεις σας" wrap />
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setOpen(false); onDismiss?.(); }}
            >
              <BilingualText en="Maybe later" el="Ίσως αργότερα" compact />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Banner mode ────────────────────────────────────────────────────────────
  if (mode === 'banner') {
    return (
      <div className={cn(
        'flex items-center gap-3 rounded-xl border border-status-success-border bg-status-success-bg px-4 py-3',
        className,
      )}>
        <Sparkles className="icon-sm shrink-0 text-status-success" />
        <p className="min-w-0 flex-1 text-sm text-foreground">
          <BilingualText
            en={`New connection: ${otherUser.displayName} accepted your request.`}
            el={`Νέα σύνδεση: ${otherUser.displayName} αποδέχτηκε το αίτημά σας.`}
            wrap
          />
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs gap-1"
            onClick={handleMessage}
            disabled={loading === 'message'}
          >
            <MessageCircle className="icon-sm" />
            <BilingualText en="Message" el="Μήνυμα" compact />
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" asChild>
            <Link href={`/projects/create?collaborator=${otherUser.id}`}>
              <FolderPlus className="icon-sm" />
              <BilingualText en="Collaborate" el="Συνεργασία" compact />
            </Link>
          </Button>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={bilingualAria('Dismiss', 'Απόρριψη')}
          >
            <X className="icon-sm" />
          </button>
        )}
      </div>
    );
  }

  // ── Inline mode (default — the foot of a connection card) ──────────────────
  // It sits under the connection's card as that card's foot: its first word
  // on the card's left edge (16px on a phone, 24px from sm, the card's own
  // padding), the next steps beside it.
  return (
    <div className={cn(
      'flex flex-wrap items-center gap-2 rounded-b-xl border-t border-border bg-muted/30 px-4 py-3 sm:px-6',
      className,
    )}>
      <span className="mr-1 text-xs text-muted-foreground">
        <BilingualText en="Next step:" el="Επόμενο βήμα:" compact />
      </span>
      <Button
        size="sm"
        variant="secondary"
        className="gap-1"
        onClick={handleMessage}
        disabled={loading === 'message'}
      >
        <MessageCircle className="icon-sm" />
        <BilingualText en="Message" el="Μήνυμα" compact />
      </Button>
      <Button size="sm" variant="outline" className="gap-1" asChild>
        <Link href={`/projects/create?collaborator=${otherUser.id}`}>
          <FolderPlus className="icon-sm" />
          <BilingualText en="Start project" el="Έναρξη project" compact />
        </Link>
      </Button>
      <Button size="sm" variant="ghost" className="gap-1 text-muted-foreground" asChild>
        <Link href={`/milestones/new?with=${otherUser.id}`}>
          <Target className="icon-sm" />
          <BilingualText en="Set milestone" el="Ορισμός ορόσημου" compact />
        </Link>
      </Button>
    </div>
  );
}

// ─── Post-Accept Modal trigger wrapper ────────────────────────────────────────

/**
 * Rendered by the connections page after a successful `accept` mutation.
 * Automatically opens the modal and clears itself when dismissed.
 */
export function PostAcceptCollaborationModal({
  otherUser,
  onDismiss,
}: {
  otherUser: CollaborationStarterProps['otherUser'];
  onDismiss: () => void;
}) {
  return (
    <CollaborationStarter
      otherUser={otherUser}
      justAccepted
      mode="modal"
      onDismiss={onDismiss}
    />
  );
}
