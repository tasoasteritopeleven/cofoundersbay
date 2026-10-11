'use client';

import { X } from 'lucide-react';
import { BilingualText } from '@/components/common/BilingualText';
import { CfbGlyph } from '@/components/icons/CfbGlyph';
import { bilingualAria } from '@/lib/i18n/format';

/**
 * Says the assistant filled the form, and that nothing is saved yet.
 *
 * The person is about to read fields they did not type; the notice is what
 * keeps that from feeling like the form changed under them. Rendered only
 * while there is a draft to talk about.
 */
export function FormDraftNotice({ filled, onDismiss }: { filled: readonly string[]; onDismiss: () => void }) {
  if (filled.length === 0) return null;
  const n = filled.length;
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm"
    >
      <CfbGlyph name="spark" className="icon-sm mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <p className="min-w-0 flex-1 leading-snug">
        <BilingualText
          en={`The assistant filled in ${n} ${n === 1 ? 'field' : 'fields'} from your conversation. Review them and change anything, then submit - nothing is saved until you do.`}
          el={`Ο βοηθός συμπλήρωσε ${n} ${n === 1 ? 'πεδίο' : 'πεδία'} από τη συζήτησή σας. Ελέγξτε τα και αλλάξτε ό,τι θέλετε, μετά υποβάλετε - τίποτα δεν αποθηκεύεται πριν το κάνετε.`}
          wrap
        />
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="-m-1 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-ring"
        aria-label={bilingualAria('Dismiss', 'Απόρριψη')}
      >
        <X className="icon-sm" aria-hidden="true" />
      </button>
    </div>
  );
}
