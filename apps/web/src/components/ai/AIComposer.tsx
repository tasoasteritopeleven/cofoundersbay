'use client';

import { FormEvent, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { usePopupChatOptional } from '@/contexts/PopupChatContext';
import { ArrowRight } from 'lucide-react';
import { bilingualAria } from '@/lib/i18n/format';
import { useBilingualString } from '@/lib/i18n/LanguagePreferenceContext';
import { cn } from '@/lib/utils';

/**
 * Inline Ask AI field - an entry to the assistant, not a replacement for it.
 *
 * It asks in place: the in-page assistant opens and sends the question with
 * this page's context (its controls, rail sections and snapshot), so "show
 * only suspended users" can be done here. It used to navigate to /ai?q=,
 * which dropped that context and only pre-filled the question. /ai itself,
 * or a tree without the popup, still goes to the full page.
 */
export function AIComposer({
  prompt,
  className,
}: {
  prompt: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const popup = usePopupChatOptional();
  const sayOne = useBilingualString();
  const [value, setValue] = useState('');

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const q = value.trim() || prompt;
    if (popup && !pathname?.startsWith('/ai')) {
      popup.ask(q);
      setValue('');
      return;
    }
    router.push(`/ai?q=${encodeURIComponent(q)}`);
  }

  return (
    <form
      onSubmit={submit}
      data-ask-ai=""
      className={cn(
        'flex min-h-10 min-w-0 w-full items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 max-sm:min-h-11',
        className,
      )}
    >
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={sayOne('Ask AI…', 'Ρωτήστε το AI…')}
        aria-label={bilingualAria('Ask AI', 'Ρωτήστε το AI')}
        className="min-w-0 flex-1 self-stretch bg-transparent text-sm text-foreground shadow-none outline-none ring-0 placeholder:text-muted-foreground focus:shadow-none focus:outline-none focus:ring-0"
      />
      {/* Icon-only submit: a visible "Ask" next to the "Ask AI…" placeholder
          read as two competing controls, and the pair overflowed the header
          slot, clipping the placeholder at every width. */}
      <button
        type="submit"
        aria-label={bilingualAria('Ask AI', 'Ρωτήστε το AI')}
        className="tap-target-phone -mr-1.5 inline-flex shrink-0 items-center justify-center rounded-md p-1 text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-0"
      >
        <ArrowRight className="icon-sm" aria-hidden="true" />
      </button>
    </form>
  );
}
