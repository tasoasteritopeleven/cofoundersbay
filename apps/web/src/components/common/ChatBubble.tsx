'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useMessagingUnreadCount } from '@/contexts/MessagingContext';
import { usePopupChat } from '@/contexts/PopupChatContext';
import { cn } from '@/lib/utils';
import { useDraggable } from '@/hooks/useDraggable';
import { bilingualAria } from '@/lib/i18n/format';
import { LogoIcon } from '@/components/brand/Logo';
import { usePageRail } from '@/components/layout/PageRailContext';

/**
 * Floating chat bubble shown on all pages except /messages.
 * Click opens the popup. Drag the bubble itself to move it — no extra chrome.
 * Hidden while the panel (or its minimised pill) is on screen, so the two
 * never stack in the same corner.
 */
export function ChatBubble() {
  // Read with the other contexts, above the early return below: a hook
  // called after `if (hidden) return null` runs on some renders and not
  // others, which is exactly the order change React refuses.
  const { hasRail } = usePageRail();
  const pathname = usePathname();
  const unreadMessages = useMessagingUnreadCount();
  const { isOpen, isMinimized, open, restore } = usePopupChat();
  const [mounted, setMounted] = useState(false);

  const { position, isDragging, dragHandleProps, consumeSuppressClick } = useDraggable({
    storageKey: 'cfb-chat-bubble-position',
    initialPosition: { x: 0, y: 0 },
    boundaryPadding: 20,
    activationDelayMs: 180,
    moveThresholdPx: 6,
    preventDefaultOnDown: false,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const hidden =
    !mounted ||
    isOpen ||
    pathname?.startsWith('/messages') ||
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/register') ||
    pathname?.startsWith('/onboarding') ||
    pathname?.startsWith('/auth') ||
    pathname?.startsWith('/forgot-password') ||
    pathname?.startsWith('/reset-password');

  if (hidden) return null;

  // Docked: on a page with a tools rail, the bubble lives at the foot of the
  // rail's strip, which is always empty there - floating beside the strip it
  // covered the right edge of the page (a card's Message button, the last
  // column of percentages). Without a rail it floats in the corner as before.
  const docked = hasRail;
  const size = docked ? 40 : 52;

  const unreadEn = `${unreadMessages} unread message${unreadMessages === 1 ? '' : 's'}`;
  const unreadEl = `${unreadMessages} ${unreadMessages === 1 ? 'αδιάβαστο μήνυμα' : 'αδιάβαστα μηνύματα'}`;
  const openLabel = unreadMessages > 0
    ? bilingualAria(`Open chat (${unreadEn})`, `Άνοιγμα συνομιλίας (${unreadEl})`)
    : bilingualAria('Open chat', 'Άνοιγμα συνομιλίας');
  const moveHint = bilingualAria(
    'Drag to move',
    'Σύρετε για μετακίνηση',
  );

  return (
    <div
      className={cn(
        'pointer-events-none fixed z-50 hidden transition-[right] duration-200 ease-out lg:block',
        // In the strip's column (3.25rem wide), pinned or not: the panel opens
        // to the left of the strip, so the strip's foot is free either way.
        docked ? 'bottom-4 right-[calc((3.25rem-40px)/2)]' : 'bottom-6 right-6',
      )}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
      }}
    >
      <button
        type="button"
        {...dragHandleProps}
        onClick={(e) => {
          e.stopPropagation();
          if (consumeSuppressClick()) return;
          if (isMinimized) {
            restore();
            return;
          }
          open(undefined, unreadMessages > 0 ? 'messages' : undefined);
        }}
        aria-label={`${openLabel}. ${moveHint}`}
        title={`${openLabel}. ${moveHint}`}
        aria-haspopup="dialog"
        aria-expanded={false}
        data-chat-launcher=""
        className={cn(
          'pointer-events-auto relative flex items-center justify-center rounded-full shadow-none transition-colors duration-200',
          'bg-primary text-primary-foreground hover:bg-primary/90',
          'outline-none focus-visible:ring-2 focus-visible:ring-primary-accessible focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          isDragging && 'scale-95 cursor-grabbing',
        )}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          ...dragHandleProps.style,
          cursor: isDragging ? 'grabbing' : undefined,
        }}
      >
        <LogoIcon size={docked ? 36 : 49} mono className="pointer-events-none text-primary-foreground -translate-y-[2px]" />
        {unreadMessages > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-status-danger-mark px-1 text-xs font-bold leading-none text-ink shadow-sm"
          >
            {unreadMessages > 99 ? '99+' : unreadMessages}
          </span>
        )}
      </button>
    </div>
  );
}
