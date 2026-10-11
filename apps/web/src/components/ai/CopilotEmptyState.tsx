'use client';

import { CfbGlyph } from '@/components/icons/CfbGlyph';
import { BilingualText } from '@/components/common/BilingualText';
import { BUILDER_BTN } from '@/components/builder/BuilderStageChrome';
import { useBilingualString } from '@/lib/i18n/LanguagePreferenceContext';
import { bilingualAria } from '@/lib/i18n/format';
import {
  copilotStartersFor,
  type CopilotStarter,
  type CopilotStarterKind,
} from '@/lib/copilot-starters';
import { cn } from '@/lib/utils';

/**
 * Empty state for the copilot. Two equal columns of full-width rows that
 * fill the conversation pane — Look up | Change — rather than a centred
 * island. Type uses the product chrome cluster: caption kickers, ui rows.
 * On the page, the “see everything” line docks above the composer so the
 * pane is not a void between starters and the field.
 */
export function CopilotEmptyState({
  surface,
  onAsk,
  onOpenCapabilities,
}: {
  surface: 'page' | 'popup';
  onAsk: (en: string) => void;
  onOpenCapabilities: () => void;
}) {
  const isPage = surface === 'page';
  const sayOne = useBilingualString();
  const { reads, writes } = copilotStartersFor(surface);

  return (
    <div
      className={cn(
        'flex w-full min-w-0 flex-col',
        isPage ? 'min-h-full flex-1' : 'gap-3',
      )}
    >
      {isPage ? (
        <p className="type-ui mb-4 max-w-prose text-muted-foreground">
          {/* Every user reads this on /ai, so it names their workspace, not the
              showcase's company and its round. */}
          {sayOne(
            'Looks up the same data as the rest of your workspace — matches, research, fundraising and calendar.',
            'Ψάχνει τα ίδια δεδομένα με τον υπόλοιπο χώρο εργασίας σας — αντιστοιχίσεις, έρευνα, χρηματοδότηση και ημερολόγιο.',
          )}
        </p>
      ) : (
        <p className="type-caption text-muted-foreground">
          {sayOne('Look up, or change after you confirm.', 'Αναζήτηση, ή αλλαγή μετά από επιβεβαίωση.')}
        </p>
      )}
      <div
        className={cn(
          'grid w-full grid-cols-1',
          isPage
            ? 'gap-6 md:grid-cols-2 md:gap-0 md:divide-x md:divide-border/70'
            : 'gap-4',
        )}
      >
        <StarterColumn kind="read" items={reads} onAsk={onAsk} className={isPage ? 'md:pr-8 lg:pr-10' : undefined} />
        <StarterColumn kind="write" items={writes} onAsk={onAsk} className={isPage ? 'md:pl-8 lg:pl-10' : undefined} />
      </div>
      <p
        className={cn(
          'type-support text-muted-foreground',
          isPage ? 'mt-auto pt-6' : 'mt-1',
        )}
      >
        <button
          type="button"
          className="tap-target-y inline-flex items-center underline-offset-2 hover:underline"
          onClick={onOpenCapabilities}
        >
          <BilingualText
            en="See everything I can read and change"
            el="Δείτε όλα όσα μπορώ να διαβάσω και να αλλάξω"
            compact
            wrap
          />
        </button>
      </p>
    </div>
  );
}

function StarterColumn({
  kind,
  items,
  onAsk,
  className,
}: {
  kind: CopilotStarterKind;
  items: CopilotStarter[];
  onAsk: (en: string) => void;
  className?: string;
}) {
  const sayOne = useBilingualString();
  const writes = kind === 'write';

  return (
    <div className={cn('min-w-0 w-full', className)}>
      <p
        className={cn(
          'type-caption mb-2.5 font-medium uppercase tracking-wide',
          writes ? 'text-status-warning' : 'text-muted-foreground',
        )}
      >
        {writes
          ? sayOne('Changes something — asks first', 'Αλλάζει κάτι — ρωτά πρώτα')
          : sayOne('Just looks something up', 'Απλώς αναζητά κάτι')}
      </p>
      <ul className="flex w-full flex-col gap-2">
        {items.map((starter) => (
          <li key={starter.en}>
            <button
              type="button"
              onClick={() => onAsk(starter.en)}
              aria-label={bilingualAria(starter.en, starter.el)}
              className={cn(
                BUILDER_BTN,
                'type-ui flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left font-medium transition-colors',
                writes
                  ? 'border-l-2 border-l-status-warning bg-card text-foreground hover:bg-secondary'
                  : 'bg-card text-foreground hover:bg-secondary',
              )}
            >
              <CfbGlyph name={starter.glyph} className={cn('icon-sm shrink-0', writes ? 'text-status-warning' : 'opacity-80')} aria-hidden="true" />
              <span className="min-w-0 leading-snug">
                {sayOne(starter.en, starter.el)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
