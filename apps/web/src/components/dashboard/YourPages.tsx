'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, EyeOff, Pin, PinOff, Plus, Settings2, Sparkles, X } from 'lucide-react';
import { BilingualText } from '@/components/common/BilingualText';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAskAssistant } from '@/hooks/useAskAssistant';
import { useStoredUser } from '@/hooks/useStoredUser';
import { useUsageProfile } from '@/hooks/useUsageProfile';
import { bilingualAria } from '@/lib/i18n/format';
import { useBilingualString } from '@/lib/i18n/LanguagePreferenceContext';
import { searchPages } from '@/lib/page-search';
import {
  MAX_SHORTCUTS,
  canShortcut,
  dismissSuggestion,
  acceptSuggestion,
  suggestionOutcomeCopy,
  hidePage,
  movePin,
  pageLabel,
  pinPage,
  recordVia,
  unhidePage,
  unpinPage,
  type Suggestion,
} from '@/lib/usage-profile';

const CHIP = 'h-8 gap-1.5 rounded-full px-3 text-xs';

/**
 * "Your pages" on every home, under the assistant's starting points: the
 * pages the reader pinned, then the ones they open most (docs §107). Each is
 * one click from the home and `G` then its number from anywhere. "Arrange"
 * opens the same manager Settings has.
 *
 * Nothing shows before the reader's own counts are read, and nothing here is
 * made up: an empty row says how to fill it.
 */
export function YourPagesRow() {
  const { ready, pages } = useUsageProfile();
  const [open, setOpen] = useState(false);
  if (!ready) return null;
  return (
    <nav aria-label={bilingualAria('Your pages', 'Οι σελίδες σας')} data-your-pages="" className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">
        <BilingualText en="Your pages" el="Οι σελίδες σας" compact />
      </span>
      {pages.map((page, index) => (
        <Button key={page.key} asChild variant="outline" size="sm" className={CHIP}>
          <Link
            href={page.key}
            aria-keyshortcuts={`g ${index + 1}`}
            onClick={() => recordVia('shortcut')}
          >
            {page.pinned ? <Pin className="icon-sm text-muted-foreground" aria-hidden="true" data-keep-icon="" /> : null}
            <BilingualText en={page.label.en} el={page.label.el} compact />
          </Link>
        </Button>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={`${CHIP} text-muted-foreground`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        {pages.length ? <Settings2 className="icon-sm" aria-hidden="true" data-keep-icon="" /> : <Plus className="icon-sm" aria-hidden="true" data-keep-icon="" />}
        {pages.length ? <BilingualText en="Arrange" el="Διαμόρφωση" compact /> : <BilingualText en="Pin a page" el="Καρφίτσωμα σελίδας" compact />}
      </Button>
      <YourPagesDialog open={open} onOpenChange={setOpen} />
    </nav>
  );
}

export function YourPagesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(88dvh,720px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            <BilingualText en="Your pages" el="Οι σελίδες σας" />
          </DialogTitle>
          <DialogDescription>
            <BilingualText
              en="Pinned pages stay in your order; the ones you open most follow them. Counted on this device only."
              el="Οι καρφιτσωμένες μένουν στη σειρά σας· ακολουθούν όσες ανοίγετε συχνότερα. Μετριούνται μόνο σε αυτή τη συσκευή."
              wrap
            />
          </DialogDescription>
        </DialogHeader>
        <YourPagesManager onNavigate={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function SectionTitle({ en, el }: { en: string; el: string }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      <BilingualText en={en} el={el} compact />
    </p>
  );
}

function IconAction({ label, onClick, disabled, keepFocus, children }: { label: { en: string; el: string }; onClick: () => void; disabled?: boolean; keepFocus?: boolean; children: React.ReactNode }) {
  return (
    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => { if (!disabled) onClick(); }} disabled={!keepFocus && disabled} aria-disabled={keepFocus && disabled ? true : undefined} aria-label={bilingualAria(label.en, label.el)}>
      {children}
    </Button>
  );
}

/**
 * Pin, order, hide and add the reader's pages, and answer the platform's
 * suggestions. Shared by the home's dialog and Settings.
 */
export function YourPagesManager({ onNavigate }: { onNavigate?: () => void }) {
  const sayOne = useBilingualString();
  const reader = useStoredUser();
  // The one way a page asks the assistant: in the reader's language, in place (pageAsks.test).
  const { ask: askAssistant } = useAskAssistant();
  const { ready, store, pages, suggestions } = useUsageProfile();
  const [term, setTerm] = useState('');
  const [orderNotice, setOrderNotice] = useState<{ en: string; el: string } | null>(null);
  const pinned = pages.filter((p) => p.pinned);
  const frequent = pages.filter((p) => !p.pinned);
  const full = store.pins.length >= MAX_SHORTCUTS;
  const found = useMemo(
    () => (term.trim().length > 1 ? searchPages(term, reader?.role).filter((hit) => canShortcut(hit.path) && !store.pins.includes(hit.path)).slice(0, 5) : []),
    [term, reader?.role, store.pins],
  );

  if (!ready) return null;

  function ask(suggestion: Suggestion) {
    if (!suggestion.ask) return;
    askAssistant(suggestion.ask);
    onNavigate?.();
  }

  function reorder(page: (typeof pinned)[number], step: -1 | 1) {
    const position = movePin(page.key, step);
    if (position !== undefined) {
      setOrderNotice({ en: `${page.label.en} moved to position ${position}.`, el: `${page.label.el}: μετακινήθηκε στη θέση ${position}.` });
    }
  }

  return (
    <div className="space-y-5">
      <section className="space-y-1.5" aria-label={bilingualAria('Pinned', 'Καρφιτσωμένες')}>
        <SectionTitle en={`Pinned (${pinned.length} of ${MAX_SHORTCUTS})`} el={`Καρφιτσωμένες (${pinned.length} από ${MAX_SHORTCUTS})`} />
        {pinned.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            <BilingualText en="None yet. Pin a page below and it stays first, in your order." el="Καμία ακόμη. Καρφιτσώστε μια σελίδα παρακάτω και μένει πρώτη, στη σειρά σας." wrap />
          </p>
        ) : (
          <ol className="divide-y divide-border/60">
            {pinned.map((page, index) => (
              <li key={page.key} className="flex items-center gap-1 py-1">
                <Link href={page.key} onClick={onNavigate} className="min-w-0 flex-1 truncate rounded-sm py-1.5 text-sm text-foreground hover:text-primary-accessible">
                  <BilingualText en={page.label.en} el={page.label.el} compact />
                </Link>
                <span className="hidden shrink-0 font-mono text-2xs text-muted-foreground sm:inline" aria-hidden="true">G {index + 1}</span>
                <IconAction label={{ en: `Move ${page.label.en} up`, el: `Μετακίνηση πάνω: ${page.label.el}` }} onClick={() => reorder(page, -1)} disabled={index === 0} keepFocus>
                  <ArrowUp className="icon-sm" aria-hidden="true" />
                </IconAction>
                <IconAction label={{ en: `Move ${page.label.en} down`, el: `Μετακίνηση κάτω: ${page.label.el}` }} onClick={() => reorder(page, 1)} disabled={index === pinned.length - 1} keepFocus>
                  <ArrowDown className="icon-sm" aria-hidden="true" />
                </IconAction>
                <IconAction label={{ en: `Unpin ${page.label.en}`, el: `Ξεκαρφίτσωμα: ${page.label.el}` }} onClick={() => unpinPage(page.key)}>
                  <PinOff className="icon-sm" aria-hidden="true" />
                </IconAction>
              </li>
            ))}
          </ol>
        )}
        <p role="status" className="sr-only">{orderNotice ? <BilingualText {...orderNotice} compact /> : null}</p>
      </section>

      {frequent.length > 0 ? (
        <section className="space-y-1.5" aria-label={bilingualAria('Opened most', 'Τις ανοίγετε συχνότερα')}>
          <SectionTitle en="Opened most" el="Τις ανοίγετε συχνότερα" />
          <ul className="divide-y divide-border/60">
            {frequent.map((page) => (
              <li key={page.key} className="flex items-center gap-1 py-1">
                <span className="min-w-0 flex-1">
                  <Link href={page.key} onClick={onNavigate} className="block truncate rounded-sm pt-1 text-sm text-foreground hover:text-primary-accessible">
                    <BilingualText en={page.label.en} el={page.label.el} compact />
                  </Link>
                  <span className="block text-xs text-muted-foreground">
                    <BilingualText
                      en={`${page.week} ${page.week === 1 ? 'time' : 'times'} this week`}
                      el={`${page.week} ${page.week === 1 ? 'φορά' : 'φορές'} αυτή την εβδομάδα`}
                      compact
                    />
                  </span>
                </span>
                <IconAction label={{ en: `Pin ${page.label.en}`, el: `Καρφίτσωμα: ${page.label.el}` }} onClick={() => pinPage(page.key)} disabled={full}>
                  <Pin className="icon-sm" aria-hidden="true" />
                </IconAction>
                <IconAction label={{ en: `Hide ${page.label.en} from your pages`, el: `Απόκρυψη από τις σελίδες σας: ${page.label.el}` }} onClick={() => hidePage(page.key)}>
                  <EyeOff className="icon-sm" aria-hidden="true" />
                </IconAction>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-1.5" aria-label={bilingualAria('Add a page', 'Προσθήκη σελίδας')}>
        <SectionTitle en="Add a page" el="Προσθήκη σελίδας" />
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={sayOne('Type a page name, e.g. Messages', 'Γράψτε το όνομα μιας σελίδας, π.χ. Μηνύματα')}
          aria-label={bilingualAria('Find a page to pin', 'Αναζήτηση σελίδας για καρφίτσωμα')}
          disabled={full}
        />
        {full ? (
          <p className="text-xs text-muted-foreground">
            <BilingualText en={`All ${MAX_SHORTCUTS} places are taken: unpin one to add another.`} el={`Και οι ${MAX_SHORTCUTS} θέσεις είναι πιασμένες: ξεκαρφιτσώστε μία για να προσθέσετε άλλη.`} wrap />
          </p>
        ) : null}
        {found.length > 0 ? (
          <ul className="divide-y divide-border/60">
            {found.map((hit) => (
              <li key={hit.path} className="flex items-center gap-2 py-1">
                <span className="min-w-0 flex-1 truncate text-sm">
                  <BilingualText en={hit.title} el={hit.titleEl ?? hit.title} compact />
                </span>
                <Button type="button" variant="outline" size="sm" onClick={() => { pinPage(hit.path); setTerm(''); }}>
                  <BilingualText en="Pin" el="Καρφίτσωμα" compact />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {suggestions.length > 0 ? (
        <section className="space-y-2" aria-label={bilingualAria('Suggestions from how you use the platform', 'Προτάσεις από τον τρόπο που χρησιμοποιείτε την πλατφόρμα')}>
          <SectionTitle en="Suggestions" el="Προτάσεις" />
          <ul className="space-y-2">
            {suggestions.map((suggestion) => (
              <li key={suggestion.id} className="rounded-lg border border-border p-3">
                <p className="text-sm text-foreground">
                  <BilingualText en={suggestion.title.en} el={suggestion.title.el} wrap />
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  <BilingualText en={suggestion.evidence.en} el={suggestion.evidence.el} wrap />
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {suggestion.kind === 'pin' && suggestion.page ? (
                    <Button type="button" size="sm" onClick={() => { if (!suggestion.page) return; acceptSuggestion(suggestion.id); pinPage(suggestion.page); }} disabled={full}>
                      <Pin className="icon-sm" aria-hidden="true" />
                      <BilingualText en="Pin it" el="Καρφίτσωμα" compact />
                    </Button>
                  ) : null}
                  {suggestion.ask ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => { acceptSuggestion(suggestion.id); ask(suggestion); }}>
                      <Sparkles className="icon-sm" aria-hidden="true" />
                      <BilingualText en="Try it with the assistant" el="Δοκιμάστε το με τον βοηθό" compact />
                    </Button>
                  ) : null}
                  <Button type="button" size="sm" variant="ghost" onClick={() => dismissSuggestion(suggestion.id)}>
                    <X className="icon-sm" aria-hidden="true" />
                    <BilingualText en="Not now" el="Όχι τώρα" compact />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {/* How the suggestions have fared, so the reader (and we) can tell
          whether they help (docs §107.7-8, §111). */}
      {suggestionOutcomeCopy(store) ? (
        <p className="text-xs text-muted-foreground" data-suggestion-outcomes="">
          <BilingualText en={suggestionOutcomeCopy(store)!.en} el={suggestionOutcomeCopy(store)!.el} wrap />
        </p>
      ) : null}

      {store.hidden.length > 0 ? (
        <section className="space-y-1.5" aria-label={bilingualAria('Hidden', 'Κρυμμένες')}>
          <SectionTitle en="Hidden from your pages" el="Κρυμμένες από τις σελίδες σας" />
          <ul className="divide-y divide-border/60">
            {store.hidden.map((key) => {
              const label = pageLabel(key);
              return (
                <li key={key} className="flex items-center gap-2 py-1">
                  <span className="min-w-0 flex-1 truncate text-sm"><BilingualText en={label.en} el={label.el} compact /></span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => unhidePage(key)}>
                    <BilingualText en="Show again" el="Επαναφορά" compact />
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
