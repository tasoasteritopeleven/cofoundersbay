'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BilingualText } from '@/components/common/BilingualText';
import { Keyboard } from 'lucide-react';

type ShortcutRow = { keys: string[]; en: string; el: string; seq?: boolean };

const GLOBAL_SHORTCUTS: ShortcutRow[] = [
  { keys: ['Ctrl', 'K'], en: 'Open the command palette', el: 'Άνοιγμα παλέτας εντολών' },
  { keys: ['/'], en: 'Search — opens the command palette', el: 'Αναζήτηση — ανοίγει την παλέτα εντολών' },
  { keys: ['?'], en: 'Show this shortcut list', el: 'Εμφάνιση αυτής της λίστας' },
  { keys: ['Esc'], en: 'Close dialogs and menus', el: 'Κλείσιμο παραθύρων και μενού' },
];

const NAV_SHORTCUTS: ShortcutRow[] = [
  { keys: ['G', 'H'], seq: true, en: 'Go to Home', el: 'Μετάβαση στην αρχική' },
  { keys: ['G', 'D'], seq: true, en: 'Go to Discover', el: 'Μετάβαση στην εξερεύνηση' },
  { keys: ['G', 'P'], seq: true, en: 'Go to Profile', el: 'Μετάβαση στο προφίλ' },
  { keys: ['G', 'A'], seq: true, en: 'Go to AI Assistant', el: 'Μετάβαση στον βοηθό AI' },
  { keys: ['G', 'M'], seq: true, en: 'Go to Messages', el: 'Μετάβαση στα μηνύματα' },
  { keys: ['G', 'S'], seq: true, en: 'Go to Settings', el: 'Μετάβαση στις ρυθμίσεις' },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-2xs font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

function Row({ keys, en, el, seq }: ShortcutRow) {
  return (
    <li className="flex items-center justify-between gap-4 py-1.5">
      <span className="min-w-0 flex-1 text-sm text-foreground">
        <BilingualText en={en} el={el} compact wrap />
      </span>
      <span className="flex shrink-0 items-center gap-1">
        {keys.map((k, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && (
              seq
                ? <span className="text-2xs text-muted-foreground"><BilingualText en="then" el="μετά" compact /></span>
                : <span className="text-2xs text-muted-foreground">+</span>
            )}
            <Kbd>{k}</Kbd>
          </span>
        ))}
      </span>
    </li>
  );
}

/**
 * The `?` reference: lists only shortcuts that are actually bound — the
 * command palette advertises the same chords, so this dialog and the
 * palette can never disagree.
 */
export function KeyboardShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="icon-sm text-muted-foreground" aria-hidden="true" />
            <BilingualText en="Keyboard shortcuts" el="Συντομεύσεις πληκτρολογίου" />
          </DialogTitle>
          <DialogDescription>
            <BilingualText
              en="Press G, then the letter, to jump to a page. Letter keys never fire while you are typing."
              el="Πατήστε G και μετά το γράμμα για μετάβαση. Τα γράμματα δεν ενεργοποιούνται όσο πληκτρολογείτε."
            />
          </DialogDescription>
        </DialogHeader>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground"><BilingualText en="General" el="Γενικά" compact /></p>
          <ul className="mt-1 divide-y divide-border/60">
            {GLOBAL_SHORTCUTS.map((s) => <Row key={s.en} {...s} />)}
          </ul>
          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground"><BilingualText en="Navigate" el="Πλοήγηση" compact /></p>
          <ul className="mt-1 divide-y divide-border/60">
            {NAV_SHORTCUTS.map((s) => <Row key={s.en} {...s} />)}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
