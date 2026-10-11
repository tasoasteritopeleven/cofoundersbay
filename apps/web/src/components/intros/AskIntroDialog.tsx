'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { INTRO_LIMITS, INTRO_RELATION_COPY, type IntroRelation } from '@cofounderbay/shared';
import { BilingualText } from '@/components/common/BilingualText';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { useStoredUser } from '@/hooks/useStoredUser';
import { commitmentRefusal } from '@/lib/commitments-api';
import { getIntroPaths, requestIntro } from '@/lib/intros-api';
import { qk } from '@/lib/query-keys';

const relations = (list: IntroRelation[]) => ({
  en: list.map((r) => INTRO_RELATION_COPY[r].en).join(', '),
  el: list.map((r) => INTRO_RELATION_COPY[r].el).join(', '),
});

/**
 * "Ask for an introduction" on a person's profile.
 *
 * Shows who among the reader's own connections, mentors and cohort-mates
 * also knows this person, and which of the reader's open need cards it would
 * be for. The request goes to the intermediary, who decides whether to
 * forward it; nothing reaches the person until they do.
 */
export function AskIntroButton({ targetId, targetName, className }: { targetId: string; targetName: string; className?: string }) {
  const me = useStoredUser();
  const [open, setOpen] = useState(false);
  if (!me?.id || me.id === targetId) return null;
  return (
    <>
      <Button size="sm" variant="outline" className={className} onClick={() => setOpen(true)}>
        <BilingualText en="Ask for an introduction" el="Ζητήστε σύσταση" compact />
      </Button>
      {open ? <AskIntroDialog open={open} onOpenChange={setOpen} targetId={targetId} targetName={targetName} /> : null}
    </>
  );
}

export function AskIntroDialog({ open, onOpenChange, targetId, targetName }: { open: boolean; onOpenChange: (v: boolean) => void; targetId: string; targetName: string }) {
  const queryClient = useQueryClient();
  const { success } = useToast();
  const paths = useQuery({ queryKey: qk('intros', 'paths', targetId), queryFn: () => getIntroPaths(targetId), enabled: open });
  const [intermediaryId, setIntermediaryId] = useState('');
  const [cardId, setCardId] = useState('');
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState<{ en: string; el: string } | null>(null);
  const data = paths.data;

  useEffect(() => {
    if (!data) return;
    if (!intermediaryId && data.paths[0]) setIntermediaryId(data.paths[0].intermediary.id);
    if (!cardId && data.cards[0]) setCardId(data.cards[0].id);
  }, [data, intermediaryId, cardId]);

  const send = useMutation({
    mutationFn: () => requestIntro({ intermediaryId, targetId, cardId, note }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk('intros') });
      success('Introduction requested');
      onOpenChange(false);
    },
    onError: (err) => {
      const r = commitmentRefusal(err);
      setProblem({ en: r.en, el: r.el });
    },
  });

  const ready = data && !data.direct && data.paths.length > 0 && data.cards.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle><BilingualText en={`An introduction to ${targetName}`} el={`Σύσταση στον/στην ${targetName}`} compact /></DialogTitle>
          <DialogDescription>
            <BilingualText
              en="Someone you both know decides whether to forward it. If they do and the answer is yes, the conversation continues on your need card."
              el="Κάποιος που γνωρίζετε και οι δύο αποφασίζει αν θα την προωθήσει. Αν το κάνει και η απάντηση είναι ναι, η συζήτηση συνεχίζει στην κάρτα ανάγκης σας."
              wrap
            />
          </DialogDescription>
        </DialogHeader>

        {paths.isLoading ? (
          <p className="text-sm text-muted-foreground"><BilingualText en="Looking for people you both know…" el="Αναζήτηση κοινών γνωστών…" compact /></p>
        ) : !data ? (
          <p className="text-sm text-muted-foreground"><BilingualText en="Introductions are not available right now." el="Οι συστάσεις δεν είναι διαθέσιμες αυτή τη στιγμή." wrap /></p>
        ) : data.direct ? (
          <p className="text-sm text-muted-foreground"><BilingualText en="You already know them directly. Send them a message or point them to your need card." el="Τον/τη γνωρίζετε ήδη άμεσα. Στείλτε μήνυμα ή δείξτε την κάρτα ανάγκης σας." wrap /></p>
        ) : !data.paths.length ? (
          <p className="text-sm text-muted-foreground"><BilingualText en="Nobody you know on CoFounderBay knows them yet. Connections, mentoring and shared cohorts are what count." el="Κανείς από όσους γνωρίζετε στο CoFounderBay δεν τον/τη γνωρίζει ακόμη. Μετρούν οι συνδέσεις, η καθοδήγηση και οι κοινοί κύκλοι." wrap /></p>
        ) : !data.cards.length ? (
          <div className="space-y-3 text-sm text-muted-foreground">
            <BilingualText en="An introduction is for one of your open need cards, and you have none yet." el="Η σύσταση αφορά μία από τις ανοιχτές κάρτες ανάγκης σας, και δεν έχετε ακόμη." wrap />
            <Button asChild size="sm" variant="outline"><Link href="/commitments/new"><BilingualText en="Write a need card" el="Νέα κάρτα ανάγκης" compact /></Link></Button>
          </div>
        ) : (
          <form
            id="ask-intro-form"
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (ready && note.trim()) send.mutate();
            }}
          >
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-foreground"><BilingualText en="Who introduces you" el="Ποιος σας συστήνει" compact /></legend>
              {data.paths.map((p) => {
                const mine = relations(p.toRequester);
                const theirs = relations(p.toTarget);
                return (
                  <label key={p.intermediary.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-2 has-[:checked]:border-primary/40">
                    <input type="radio" name="intro-intermediary" className="mt-1" checked={intermediaryId === p.intermediary.id} onChange={() => setIntermediaryId(p.intermediary.id)} />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">{p.intermediary.displayName}</span>
                      <span className="block text-xs text-muted-foreground">
                        <BilingualText en={`You: ${mine.en} · ${targetName}: ${theirs.en}`} el={`Εσείς: ${mine.el} · ${targetName}: ${theirs.el}`} wrap />
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
            <div className="space-y-1.5">
              <Label htmlFor="intro-card"><BilingualText en="For which need card" el="Για ποια κάρτα ανάγκης" compact /></Label>
              <select id="intro-card" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={cardId} onChange={(e) => setCardId(e.target.value)}>
                {data.cards.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="intro-note"><BilingualText en="Why this introduction, and why now" el="Γιατί αυτή η σύσταση και γιατί τώρα" compact /></Label>
              <Textarea id="intro-note" rows={4} maxLength={INTRO_LIMITS.note} value={note} onChange={(e) => setNote(e.target.value)} />
              <p className="text-xs text-muted-foreground"><BilingualText en="No email or phone: the conversation stays on the platform until you both confirm." el="Χωρίς email ή τηλέφωνο: η συζήτηση μένει στην πλατφόρμα μέχρι να επιβεβαιώσετε και οι δύο." wrap /></p>
            </div>
            {problem ? <p role="alert" className="text-sm text-destructive-accessible"><BilingualText en={problem.en} el={problem.el} wrap /></p> : null}
          </form>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}><BilingualText en="Cancel" el="Ακύρωση" compact /></Button>
          {ready ? (
            <Button type="submit" form="ask-intro-form" disabled={!intermediaryId || !cardId || !note.trim() || send.isPending}>
              <BilingualText en="Send to the intermediary" el="Αποστολή στον ενδιάμεσο" compact />
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
