'use client';

import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { bilingualAria } from '@/lib/i18n/format';
import { useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';

function useSafeRouter() {
  try {
    return useRouter();
  } catch {
    return null;
  }
}

interface AIInsightButtonProps {
  prompt: string;
  agentId?: string;
  cacheKey?: string;
  context?: Record<string, unknown>;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'icon';
  size?: 'sm' | 'lg' | 'icon';
  label?: string;
  labelEl?: string;
}

export function AIInsightButton({
  prompt,
  className,
  variant = 'outline',
  size = 'sm',
  label,
  labelEl,
}: AIInsightButtonProps) {
  const router = useSafeRouter();
  const { primary } = useLanguagePreference();
  // One language, no wrap: BilingualText+compact inside a 36px-tall outline
  // button stacked "Ask" over "AI" on Greek-primary pages, and the English
  // default won the first paint. The chip still opens the same assistant.
  const visibleLabel = label
    ? (primary === 'el' && labelEl ? labelEl : label)
    : (primary === 'el' ? 'Ρωτήστε το AI' : 'Ask AI');
  const ariaLabel = label ? bilingualAria(label, labelEl) : bilingualAria('Ask AI', 'Ρωτήστε το AI');

  const openAssistant = () => {
    const params = new URLSearchParams({ q: prompt });
    const url = `/ai?${params.toString()}`;
    if (router) {
      router.push(url);
    } else if (typeof window !== 'undefined') {
      window.location.href = url;
    }
  };

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={openAssistant}
        className={cn(
          'flex items-center justify-center rounded-full p-1.5 transition-colors',
          'text-status-accent hover:bg-status-accent-bg',
          className,
        )}
        title={ariaLabel}
        aria-label={ariaLabel}
      >
        <Sparkles className="icon-sm" />
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={openAssistant}
      // The visible label is the name; repeating it here keeps the two
      // identical (SC 2.5.3) and covers the `icon` size this `size` can carry.
      // `size` is a forwarded union that may name an icon size, so the
      // compile guard asks for a name even though this branch renders text.
      aria-label={visibleLabel}
      className={cn('h-auto min-h-9 gap-1.5 whitespace-nowrap px-2.5', className)}
    >
      {visibleLabel}
    </Button>
  );
}
