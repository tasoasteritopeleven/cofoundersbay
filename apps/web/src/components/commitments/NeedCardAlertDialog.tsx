'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { CommitmentKind } from '@cofounderbay/shared';
import { BilingualText } from '@/components/common/BilingualText';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { createSavedSearch, type SavedSearch } from '@/lib/api';
import { NO_CHIPS, chipSummary, chipsToSavedFilters, type CardChips } from '@/lib/need-card-wall';
import { qk } from '@/lib/query-keys';

const FREQUENCIES: Array<{ value: SavedSearch['alertFrequency']; en: string; el: string }> = [
  { value: 'weekly', en: 'Once a week', el: 'Μία φορά την εβδομάδα' },
  { value: 'daily', en: 'Once a day', el: 'Μία φορά την ημέρα' },
  { value: 'instant', en: 'Within the hour', el: 'Μέσα στην ώρα' },
];

const KIND_NAME: Record<CommitmentKind, { en: string; el: string }> = {
  cofounder: { en: 'Co-founder cards', el: 'Κάρτες συνιδρυτή' },
  equity_role: { en: 'Equity-role cards', el: 'Κάρτες ρόλου με μετοχές' },
  investor_intro: { en: 'Investor-intro cards', el: 'Κάρτες σύστασης σε επενδυτή' },
};

/**
 * "Tell me about new need cards like these": saves the Opportunities
 * filters (kinds, remote, words, and the wall's category, place, stage and
 * commitment chips) as a saved search over need cards, with
 * alerts on. The alert names only cards the person has not been shown, and
 * never their own; the search lives in /saved-searches with the others,
 * where it can be renamed, paused or deleted.
 */
export function NeedCardAlertDialog({
  open,
  onOpenChange,
  kinds,
  remoteOnly,
  search,
  chips = NO_CHIPS,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kinds: readonly CommitmentKind[];
  remoteOnly: boolean;
  search: string;
  /** The wall's chips; the API's alert reads them as categories, places, stage and commitments. */
  chips?: CardChips;
}) {
  const qc = useQueryClient();
  const { success, error } = useToast();
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState<SavedSearch['alertFrequency']>('weekly');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const base = kinds.length === 1 ? KIND_NAME[kinds[0]].en : 'Need cards';
    const narrowed = chipSummary(chips)?.en ?? '';
    setName([base, search.trim(), remoteOnly ? 'remote' : '', narrowed].filter(Boolean).join(' · ').slice(0, 80));
  }, [open, kinds, remoteOnly, search, chips]);

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createSavedSearch({
        scope: 'need_cards',
        name: name.trim(),
        query: search.trim(),
        filters: { kinds: [...kinds], ...(remoteOnly ? { remote: ['true'] } : {}), ...chipsToSavedFilters(chips) },
        alertsEnabled: true,
        alertFrequency: frequency,
      });
      await qc.invalidateQueries({ queryKey: qk('saved-searches') });
      success('Need card alert saved', 'You will hear about new cards that fit, at the pace you chose. Change it in Saved searches.');
      onOpenChange(false);
    } catch {
      error('Could not save the alert', 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle><BilingualText en="Alert me about new need cards" el="Ειδοποίηση για νέες κάρτες ανάγκης" compact /></DialogTitle>
          <DialogDescription>
            <BilingualText
              en="Saves these filters. When someone else posts a card that fits, you get one notification naming only the new ones."
              el="Αποθηκεύει αυτά τα φίλτρα. Όταν κάποιος άλλος δημοσιεύσει κάρτα που ταιριάζει, λαμβάνετε μία ειδοποίηση μόνο για τις καινούργιες."
            />
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="need-card-alert-name"><BilingualText en="Name" el="Όνομα" compact /></Label>
            <Input id="need-card-alert-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground"><BilingualText en="How often" el="Πόσο συχνά" compact /></legend>
            <div className="flex flex-wrap gap-2">
              {FREQUENCIES.map((f) => (
                <Button key={f.value} type="button" size="sm" variant={frequency === f.value ? 'default' : 'outline'} aria-pressed={frequency === f.value} onClick={() => setFrequency(f.value)}>
                  <BilingualText en={f.en} el={f.el} compact />
                </Button>
              ))}
            </div>
          </fieldset>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}><BilingualText en="Cancel" el="Ακύρωση" compact /></Button>
          <Button onClick={() => void save()} disabled={busy || !name.trim()}>
            <BilingualText en="Save alert" el="Αποθήκευση ειδοποίησης" compact />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
