'use client';

import { useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/components/common/I18nProvider';
import { bilingualAria } from '@/lib/i18n/format';
import { BilingualText } from '@/components/common/BilingualText';
import { PageHeaderSlot } from '@/components/layout/PageHeaderSlot';
import { usePopupChatOptional } from '@/contexts/PopupChatContext';

type SampleDataNoticeProps = {
  surface: string;
  detail: string;
  askAiPrompt: string;
  className?: string;
};

/** Compact honesty pill. Expands to the full note; Ask AI stays a text link. */
export function SampleDataNotice({ surface, detail, askAiPrompt, className }: SampleDataNoticeProps) {
  const { t } = useI18n();
  const popup = usePopupChatOptional();
  const [open, setOpen] = useState(false);
  const { inHeader, slot } = useContext(PageHeaderSlot);
  const title = t('{surface} is showing sample items', { surface: t(surface) });

  if (!open) {
    const pill = (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={bilingualAria(title, title)}
        className={cn(
          'inline-flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
          className,
        )}
      >
        <BilingualText en="Sample data" el="Δείγμα δεδομένων" compact />
      </button>
    );
    // In a page header the pill joins the header's meta row instead of taking
    // a row of its own above the content; until that row has mounted it
    // renders nothing, so it never flashes in the body first.
    if (inHeader) return slot ? createPortal(pill, slot) : null;
    return pill;
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-2xl border border-border bg-card px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{t(detail)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {popup ? (
          <button
            type="button"
            onClick={() => popup.ask(askAiPrompt)}
            className="text-xs font-medium text-primary-accessible hover:underline"
          >
            <BilingualText en="Ask AI" el="Ρωτήστε το AI" compact />
          </button>
        ) : (
          <Link
            href={`/ai?q=${encodeURIComponent(askAiPrompt)}`}
            className="text-xs font-medium text-primary-accessible hover:underline"
          >
            <BilingualText en="Ask AI" el="Ρωτήστε το AI" compact />
          </Link>
        )}
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={bilingualAria('Dismiss sample-data notice', 'Απόρριψη ειδοποίησης δείγματος')}
          className="rounded-xl p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X className="icon-sm" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
