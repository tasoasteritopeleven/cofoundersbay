'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, UserPlus, Check, Loader2 } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { BilingualText } from '@/components/common/BilingualText';
import { useToast } from '@/components/ui/toast';
import { bilingualInline } from '@/lib/i18n/format';
import { getOrCreateDirectConversation, sendConnectionRequest } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * "Message" and "Connect", once, for every card that shows a person.
 *
 * Both actions already existed twice over: as real API calls behind the
 * profile and match screens, and as declared assistant capabilities
 * (`start_or_send_message`, `send_connection`) that open a thread or send an
 * intro on the user's behalf. What was missing was the plain button — a dozen
 * pages drew one with nothing behind it, so the same row offered the assistant
 * a working path and the reader a dead one.
 *
 * These call exactly what the assistant's executors call and land in the same
 * place, which is the point: whichever way a person asks for the thing, the
 * thing that happens is the same.
 */

type PersonActionProps = {
  /** The person this acts on. Without one the control is not rendered. */
  userId?: string | null;
  displayName?: string;
  size?: ButtonProps['size'];
  variant?: ButtonProps['variant'];
  className?: string;
  /** Hide the label and keep the glyph, for a dense row. */
  iconOnly?: boolean;
};

export function MessageButton({
  userId,
  displayName,
  size = 'sm',
  variant = 'outline',
  className,
  iconOnly = false,
}: PersonActionProps) {
  const router = useRouter();
  const { error: toastError } = useToast();
  const [opening, setOpening] = useState(false);

  // No id, no action. A button that cannot know who it is for belongs to a
  // screen that is not ready to offer it.
  if (!userId) return null;

  const label = displayName
    ? bilingualInline(`Message ${displayName}`, `Μήνυμα στον/στην ${displayName}`)
    : bilingualInline('Message', 'Μήνυμα');

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={cn('gap-1.5', className)}
      disabled={opening}
      // Always set: with text content it enriches the name ("Message Maria"
      // instead of "Message"); icon-only it is the only name there is.
      aria-label={label}
      title={iconOnly ? label : undefined}
      onClick={async () => {
        setOpening(true);
        try {
          const { conversationId } = await getOrCreateDirectConversation(userId);
          router.push(`/messages?c=${conversationId}`);
        } catch (err) {
          toastError(
            bilingualInline('Could not open the conversation', 'Δεν άνοιξε η συνομιλία'),
            err instanceof Error ? err.message : undefined,
          );
          setOpening(false);
        }
      }}
    >
      {opening ? (
        <Loader2 className="icon-sm animate-spin" aria-hidden="true" />
      ) : (
        <MessageSquare className="icon-sm" aria-hidden="true" />
      )}
      {!iconOnly && <BilingualText en="Message" el="Μήνυμα" compact />}
    </Button>
  );
}

export function ConnectButton({
  userId,
  displayName,
  size = 'sm',
  variant = 'default',
  className,
  iconOnly = false,
}: PersonActionProps) {
  const { success, error: toastError } = useToast();
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');

  if (!userId) return null;

  const label = displayName
    ? bilingualInline(`Connect with ${displayName}`, `Σύνδεση με ${displayName}`)
    : bilingualInline('Connect', 'Σύνδεση');

  // Sent is a terminal state on this screen: an intro reaches its recipient
  // before the call returns and has no sender-side withdraw route, which is
  // why the assistant declares the same action irreversible.
  if (state === 'sent') {
    return (
      <Button
        type="button"
        size={size}
        variant="outline"
        className={cn('gap-1.5', className)}
        disabled
        // Icon-only in this state rendered a lone Check with no name at all.
        aria-label={bilingualInline('Request sent', 'Στάλθηκε')}
      >
        <Check className="icon-sm" aria-hidden="true" />
        {!iconOnly && <BilingualText en="Request sent" el="Στάλθηκε" compact />}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={cn('gap-1.5', className)}
      disabled={state === 'sending'}
      aria-label={label}
      title={iconOnly ? label : undefined}
      onClick={async () => {
        setState('sending');
        try {
          await sendConnectionRequest({ receiverId: userId });
          setState('sent');
          success(
            bilingualInline('Intro sent', 'Η σύσταση στάλθηκε'),
            displayName
              ? bilingualInline(`${displayName} will see your request.`, `Ο/Η ${displayName} θα δει το αίτημά σας.`)
              : undefined,
          );
        } catch (err) {
          setState('idle');
          toastError(
            bilingualInline('Could not send the request', 'Δεν στάλθηκε το αίτημα'),
            err instanceof Error ? err.message : undefined,
          );
        }
      }}
    >
      {state === 'sending' ? (
        <Loader2 className="icon-sm animate-spin" aria-hidden="true" />
      ) : (
        <UserPlus className="icon-sm" aria-hidden="true" />
      )}
      {!iconOnly && <BilingualText en="Connect" el="Σύνδεση" compact />}
    </Button>
  );
}
