'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, ExternalLink, Linkedin } from 'lucide-react';
import { BilingualText } from '@/components/common/BilingualText';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';
import { getPitchPublication, publishPitch, unpublishPitch } from '@/lib/api';
import { linkedInShareUrl } from '@/lib/commitments-links';
import { bilingualAria } from '@/lib/i18n/format';
import { qk } from '@/lib/query-keys';
import { pitchPost, useSuggestedPost } from '@/lib/share-text';

/**
 * The deck's public page, from the owner's side: publish it at /pitch/[id],
 * copy or share the link on LinkedIn, let readers write, or withdraw it.
 *
 * Publishing is explicit and reversible. The public id is not the document
 * id, speaker notes are never published, and a withdrawn deck reads as "not
 * found" while keeping its view and contact counts for a later republish.
 */
export function PitchPublication({ documentId }: { documentId?: string }) {
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();
  const suggested = useSuggestedPost();
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  const key = qk('pitch-deck', 'publication', documentId ?? '');
  const status = useQuery({ queryKey: key, queryFn: () => getPitchPublication(documentId as string), enabled: !!documentId });
  const pitch = status.data?.pitch ?? null;
  const live = !!pitch?.isPublic;
  const [allowContact, setAllowContact] = useState(true);
  useEffect(() => {
    if (pitch) setAllowContact(pitch.allowContact);
  }, [pitch]);

  const publish = useMutation({
    mutationFn: (contact: boolean) => publishPitch({ documentId: documentId as string, allowContact: contact }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk('pitch-deck') });
      success('Pitch published');
    },
    onError: () => showError('Could not publish the pitch'),
  });
  const withdraw = useMutation({
    mutationFn: () => unpublishPitch(documentId as string),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk('pitch-deck') });
      success('Pitch withdrawn');
    },
    onError: () => showError('Could not withdraw the pitch'),
  });

  if (!documentId) {
    return (
      <p className="text-sm text-muted-foreground">
        <BilingualText en="Save the deck once, then you can publish it." el="Αποθηκεύστε μία φορά την παρουσίαση και μετά μπορείτε να τη δημοσιεύσετε." wrap />
      </p>
    );
  }

  const url = pitch ? `${origin}/pitch/${encodeURIComponent(pitch.id)}` : '';
  const busy = publish.isPending || withdraw.isPending;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        <BilingualText
          en={live ? 'Anyone with the link can read the slides. Speaker notes stay private.' : 'Publish to get a link anyone can open, without an account. Speaker notes stay private.'}
          el={live ? 'Όποιος έχει τον σύνδεσμο διαβάζει τις διαφάνειες. Οι σημειώσεις ομιλητή μένουν ιδιωτικές.' : 'Δημοσιεύστε για σύνδεσμο που ανοίγει χωρίς λογαριασμό. Οι σημειώσεις ομιλητή μένουν ιδιωτικές.'}
          wrap
        />
      </p>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="pitch-allow-contact" className="min-w-0 text-sm">
          <BilingualText en="Readers can write to you" el="Οι αναγνώστες μπορούν να σας γράψουν" wrap />
        </label>
        <Switch
          id="pitch-allow-contact"
          checked={allowContact}
          disabled={busy}
          onCheckedChange={(next) => {
            setAllowContact(next);
            if (live) publish.mutate(next);
          }}
        />
      </div>
      {live ? (
        <>
          <p className="truncate rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground" title={url}>{url}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            <BilingualText en={`${pitch?.views ?? 0} views · ${pitch?.contactRequests ?? 0} messages`} el={`${pitch?.views ?? 0} προβολές · ${pitch?.contactRequests ?? 0} μηνύματα`} compact />
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard?.writeText(url).then(() => success('Link copied'), () => showError('Could not copy the link'));
              }}
            >
              <Copy className="icon-sm mr-1.5" aria-hidden="true" /><BilingualText en="Copy link" el="Αντιγραφή συνδέσμου" compact />
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={linkedInShareUrl(url)} target="_blank" rel="noopener noreferrer" onClick={() => suggested.copy(pitchPost({ title: suggested.lang === 'el' ? 'Η startup μας' : 'Our startup' }, url, suggested.lang))} aria-label={bilingualAria('Share on LinkedIn (opens a new tab)', 'Κοινοποίηση στο LinkedIn (ανοίγει νέα καρτέλα)')}>
                <Linkedin className="icon-sm mr-1.5" aria-hidden="true" /><BilingualText en="LinkedIn" el="LinkedIn" compact />
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="icon-sm mr-1.5" aria-hidden="true" /><BilingualText en="Open" el="Άνοιγμα" compact />
              </a>
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => withdraw.mutate()}>
              <BilingualText en="Withdraw" el="Απόσυρση" compact />
            </Button>
          </div>
        </>
      ) : (
        <Button size="sm" className="w-full" disabled={busy || status.isLoading} onClick={() => publish.mutate(allowContact)}>
          <BilingualText en="Publish pitch" el="Δημοσίευση παρουσίασης" compact />
        </Button>
      )}
    </div>
  );
}
