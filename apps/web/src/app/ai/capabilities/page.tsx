'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useAskAssistant } from '@/hooks/useAskAssistant';
import { Search } from 'lucide-react';
import { listDeclarations, type ActionDeclaration } from '@cofounderbay/shared';
import { AppShell } from '@/components/layout/AppShell';
import { BilingualText } from '@/components/common/BilingualText';
import { CardHead } from '@/components/common/CardAnatomy';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { bilingualInline } from '@/lib/i18n/format';
import { useBilingualString } from '@/lib/i18n/LanguagePreferenceContext';
import { CfbGlyph } from '@/components/icons/CfbGlyph';
import { BUILDER_BTN } from '@/components/builder/BuilderStageChrome';
import { CAPABILITY_SAMPLES as SAMPLE_ASK } from '@/lib/capability-samples';
import { foldedCardClass, showAllClass } from './firstScreen';


/**
 * Generated from the shared capability contract — the same list the model is
 * offered and the same list the confirmation cards run. A hand-written page
 * would drift the moment a declaration was added; this cannot.
 */

function reversalLabel(spec: ActionDeclaration): { en: string; el: string } | null {
  const kind = spec.reversal?.kind;
  if (!kind || spec.kind === 'read') return null;
  if (kind === 'full') return { en: 'Fully reversible', el: 'Πλήρως αναστρέψιμο' };
  if (kind === 'partial') return { en: 'Partly reversible', el: 'Μερικώς αναστρέψιμο' };
  return { en: 'Cannot be undone', el: 'Δεν αναιρείται' };
}

function CapabilityCard({ spec }: { spec: ActionDeclaration }) {
  const sample = SAMPLE_ASK[spec.id];
  // The example opens the assistant in the reader's language; it always
  // sent the English sentence, under a Greek "Δοκίμασε: «…»".
  const { hrefFor } = useAskAssistant();
  const reversal = reversalLabel(spec);
  const writes = spec.writes;

  // One state at the head's right (whether it writes); how far it can be
  // taken back is the caption under the title, and the explanation of it
  // sits with the description on the card's left edge.
  return (
    <Card>
      <CardContent className="space-y-3">
        <CardHead
          title={<BilingualText en={spec.label.en} el={spec.label.el} compact wrap />}
          meta={reversal ? <BilingualText en={reversal.en} el={reversal.el} compact wrap /> : undefined}
          aside={writes ? (
            <Badge variant="outline" className="border-status-warning-border/60 bg-status-warning-bg text-status-warning">
              <BilingualText en="Writes" el="Γράφει" compact />
            </Badge>
          ) : (
            <Badge variant="secondary">
              <BilingualText en="Looks up" el="Αναζητά" compact />
            </Badge>
          )}
        />
        <p className="card-body text-muted-foreground">
          <BilingualText en={spec.description.en} el={spec.description.el} wrap />
        </p>
        {spec.reversal && spec.kind === 'mutation' && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            <BilingualText en={spec.reversal.explanation.en} el={spec.reversal.explanation.el} wrap />
          </p>
        )}
        {sample && (
          <Button asChild variant="ghost" size="sm" className={`h-auto min-h-11 w-fit justify-start px-0 py-1.5 text-xs lg:px-0 hover:bg-transparent hover:underline ${BUILDER_BTN}`}>
            <Link href={spec.id === 'get_event_reconnect' ? '/events' : hrefFor(sample)}>
              {spec.id === 'get_event_reconnect'
                ? <BilingualText en={`Open an event and ask: “${sample.en}”`} el={`Ανοίξτε μια εκδήλωση και ρωτήστε: «${sample.el}»`} compact wrap />
                : <BilingualText en={`Try: “${sample.en}”`} el={`Δοκίμασε: «${sample.el}»`} compact wrap />}
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/** Everything a reader might type to find a capability, in both languages. */
function haystack(spec: ActionDeclaration): string {
  const sample = SAMPLE_ASK[spec.id];
  return [spec.label.en, spec.label.el, spec.description.en, spec.description.el, sample?.en, sample?.el]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase();
}

export default function AICapabilitiesPage() {
  const sayOne = useBilingualString();
  const capabilities = useMemo(() => listDeclarations(), []);
  /*
   * Close to a hundred cards on one page (9.093px) with no way to find one:
   * the field narrows both lists by name, description or sample ask
   * (docs §91).
   */
  const [query, setQuery] = useState('');
  const [readsOpen, setReadsOpen] = useState(false);
  const [mutationsOpen, setMutationsOpen] = useState(false);
  const searching = query.trim().length > 0;
  const q = query.trim().toLocaleLowerCase();
  const shown = q ? capabilities.filter((spec) => haystack(spec).includes(q)) : capabilities;
  const reads = shown.filter((spec) => spec.kind === 'read');
  const mutations = shown.filter((spec) => spec.kind === 'mutation');

  return (
    <AppShell>
      <div className="max-w-[84rem]">
        {/* "Back to the assistant" went to /ai, as "Open assistant" beside
            the intro does (docs §91). */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <p className="max-w-2xl text-sm text-muted-foreground">
            <BilingualText
              en="Every capability below is declared once, offered to the model, and confirmed by you before anything is written."
              el="Κάθε δυνατότητα δηλώνεται μία φορά, προσφέρεται στο μοντέλο και επιβεβαιώνεται από εσάς πριν γραφτεί οτιδήποτε."
              wrap
            />
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className={`gap-2 ${BUILDER_BTN}`}>
              <Link href="/ai">
                <CfbGlyph name="spark" className="icon-sm" />
                <BilingualText en="Open assistant" el="Άνοιγμα βοηθού" compact />
              </Link>
            </Button>
            <Button asChild variant="ghost" className={BUILDER_BTN}>
              <Link href="/settings/ai">
                <BilingualText en="AI preferences" el="Προτιμήσεις AI" compact />
              </Link>
            </Button>
          </div>
        </div>

        <div className="relative mb-8 max-w-xl">
          <Search className="absolute left-3 top-1/2 icon-sm -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={bilingualInline('Search what the assistant can do', 'Αναζήτηση στις δυνατότητες του βοηθού')}
            placeholder={sayOne('Search what the assistant can do…', 'Αναζήτηση στις δυνατότητες του βοηθού…')}
            className="pl-9"
          />
        </div>
        <p className="sr-only" role="status" aria-live="polite">
          {q ? <BilingualText en={`${shown.length} capabilities match`} el={`${shown.length} δυνατότητες ταιριάζουν`} compact /> : null}
        </p>

        {q && shown.length === 0 ? (
          <div className="mb-10 space-y-3 rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            <p>
              <BilingualText
                en={`Nothing matches “${query.trim()}”. Ask the assistant in your own words: it may still do it through the page you are on.`}
                el={`Τίποτα δεν ταιριάζει με «${query.trim()}». Ρωτήστε τον βοηθό με δικά σας λόγια: μπορεί να το κάνει μέσα από τη σελίδα όπου βρίσκεστε.`}
                wrap
              />
            </p>
            <Button size="sm" variant="outline" onClick={() => setQuery('')}>
              <BilingualText en="Clear the search" el="Καθαρισμός αναζήτησης" compact />
            </Button>
          </div>
        ) : null}

        {reads.length > 0 ? (
        <section className="mb-10">
          <h2 className="page-section mb-1 font-semibold">
            <BilingualText en="Looks something up" el="Αναζητά κάτι" compact />
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            <BilingualText
              en={`${reads.length} reads — answers a question from the same APIs the pages use.`}
              el={`${reads.length} αναγνώσεις — απαντούν με τα ίδια API που χρησιμοποιούν οι σελίδες.`}
              wrap
            />
          </p>
          <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {reads.map((spec, index) => (
              <div key={spec.id} className={foldedCardClass(index, readsOpen, searching)}>
                <CapabilityCard spec={spec} />
              </div>
            ))}
          </div>
          {showAllClass(reads.length, readsOpen, searching) ? (
            <Button type="button" variant="outline" size="sm" className={showAllClass(reads.length, readsOpen, searching) ?? undefined} onClick={() => setReadsOpen(true)}>
              <BilingualText en={`Show all ${reads.length}`} el={`Όλες οι ${reads.length}`} compact />
            </Button>
          ) : null}
        </section>
        ) : null}

        {mutations.length > 0 ? (
        <section>
          <h2 className="page-section mb-1 font-semibold">
            <BilingualText en="Changes something you own" el="Αλλάζει κάτι δικό σας" compact />
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            <BilingualText
              en={`${mutations.length} actions — each waits for your confirm. Reversible ones offer Undo after they run.`}
              el={`${mutations.length} ενέργειες — η καθεμία περιμένει επιβεβαίωση. Οι αναστρέψιμες προσφέρουν Αναίρεση αφού εκτελεστούν.`}
              wrap
            />
          </p>
          <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {mutations.map((spec, index) => (
              <div key={spec.id} className={foldedCardClass(index, mutationsOpen, searching)}>
                <CapabilityCard spec={spec} />
              </div>
            ))}
          </div>
          {showAllClass(mutations.length, mutationsOpen, searching) ? (
            <Button type="button" variant="outline" size="sm" className={showAllClass(mutations.length, mutationsOpen, searching) ?? undefined} onClick={() => setMutationsOpen(true)}>
              <BilingualText en={`Show all ${mutations.length}`} el={`Όλες οι ${mutations.length}`} compact />
            </Button>
          ) : null}
        </section>
        ) : null}
      </div>
    </AppShell>
  );
}
