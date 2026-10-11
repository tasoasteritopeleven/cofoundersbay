'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { ComponentErrorBoundary } from '@/components/common/ErrorBoundary';

const ChatBubble = dynamic(
  () => import('@/components/common/ChatBubble').then((mod) => mod.ChatBubble),
  { ssr: false },
);
const UnifiedChatPopup = dynamic(
  () => import('@/components/chat/UnifiedChatPopup').then((mod) => mod.UnifiedChatPopup),
  { ssr: false },
);
const CookieConsent = dynamic(
  () => import('@/components/common/CookieConsent').then((mod) => mod.CookieConsent),
  { ssr: false },
);

const HIDDEN_PREFIXES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/auth',
  '/onboarding',
  '/ai',
];

function matchesHiddenPrefix(pathname: string | null): boolean {
  if (!pathname) return false;

  return HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function GlobalFloatingUi() {
  const pathname = usePathname();

  if (matchesHiddenPrefix(pathname)) {
    return null;
  }

  return (
    <>
      <ComponentErrorBoundary>
        <ChatBubble />
        <UnifiedChatPopup />
      </ComponentErrorBoundary>
      <CookieConsent />
    </>
  );
}
