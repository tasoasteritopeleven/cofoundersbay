'use client';

import { useEffect, useState } from 'react';
import { FOUNDER_UPDATE_LIMITS, FOUNDER_UPDATE_PROBLEM_COPY, readFounderUpdate } from '@cofounderbay/shared';
import { BilingualText } from '@/components/common/BilingualText';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export interface UpdateDraft {
  title: string;
  body: string;
  metrics: Array<{ label: string; value: string }>;
  asks: string[];
  visibility: 'followers' | 'public';
  milestoneId: string | null;
}

export const EMPTY_UPDATE: UpdateDraft = { title: '', body: '', metrics: [{ label: '', value: '' }], asks: [''], visibility: 'followers', milestoneId: null };

/**
 * Writes one founder update. The same rules the API applies run here first
 * (`readFounderUpdate`), so the button says why it cannot send rather than
 * the server refusing afterwards.
 */
export function UpdateComposer({ initial, busy, onSend }: { initial?: Partial<UpdateDraft> | null; busy: boolean; onSend: (draft: UpdateDraft) => Promise<boolean> }) {
  const [draft, setDraft] = useState<UpdateDraft>({ ...EMPTY_UPDATE, ...(initial ?? {}) });
  useEffect(() => {
    if (initial) setDraft((d) => ({ ...d, ...initial }));
  }, [initial]);
  const check = readFounderUpdate(draft);
  const problems = check.ok ? [] : check.problems.filter((p) => !(p === 'title' && !draft.title) && !(p === 'body' && !draft.body));
  const L = FOUNDER_UPDATE_LIMITS;

  return (
    <form
      className="space-y-4"
      aria-label="Write an update · Νέα ενημέρωση"
      onSubmit={(e) => {
        e.preventDefault();
        if (!check.ok) return;
        void onSend(draft).then((sent) => {
          if (sent) setDraft(EMPTY_UPDATE);
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="update-title"><BilingualText en="Title" el="Τίτλος" compact /></Label>
        <Input id="update-title" maxLength={L.title} placeholder="September: two pilots live" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="update-body"><BilingualText en="What moved" el="Τι άλλαξε" compact /></Label>
        <Textarea id="update-body" rows={5} maxLength={L.body} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium"><BilingualText en="Figures (optional)" el="Μεγέθη (προαιρετικά)" compact /></legend>
        {draft.metrics.map((m, i) => (
          <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input aria-label={`Figure ${i + 1} label · Μέγεθος ${i + 1}`} maxLength={L.metricLabel} placeholder="Clinics live" value={m.label} onChange={(e) => setDraft({ ...draft, metrics: draft.metrics.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
            <Input aria-label={`Figure ${i + 1} value · Τιμή ${i + 1}`} maxLength={L.metricValue} placeholder="4" value={m.value} onChange={(e) => setDraft({ ...draft, metrics: draft.metrics.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} />
          </div>
        ))}
        {draft.metrics.length < L.metrics ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setDraft({ ...draft, metrics: [...draft.metrics, { label: '', value: '' }] })}>
            <BilingualText en="Add a figure" el="Προσθήκη μεγέθους" compact />
          </Button>
        ) : null}
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium"><BilingualText en="What would help (optional)" el="Τι θα βοηθούσε (προαιρετικά)" compact /></legend>
        {draft.asks.map((a, i) => (
          <Input key={i} aria-label={`Ask ${i + 1} · Αίτημα ${i + 1}`} maxLength={L.ask} placeholder="An intro to a dental chain in Thessaloniki" value={a} onChange={(e) => setDraft({ ...draft, asks: draft.asks.map((x, j) => (j === i ? e.target.value : x)) })} />
        ))}
        {draft.asks.length < L.asks ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setDraft({ ...draft, asks: [...draft.asks, ''] })}>
            <BilingualText en="Add an ask" el="Προσθήκη αιτήματος" compact />
          </Button>
        ) : null}
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium"><BilingualText en="Who sees it" el="Ποιοι τη βλέπουν" compact /></legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Who sees it · Ποιοι τη βλέπουν">
          {(['followers', 'public'] as const).map((v) => (
            <Button
              key={v}
              type="button"
              size="sm"
              variant={draft.visibility === v ? 'default' : 'outline'}
              role="radio"
              aria-checked={draft.visibility === v}
              onClick={() => setDraft({ ...draft, visibility: v })}
            >
              <BilingualText en={v === 'public' ? 'Public link' : 'My followers'} el={v === 'public' ? 'Δημόσιος σύνδεσμος' : 'Οι ακόλουθοί μου'} compact />
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          <BilingualText
            en={draft.visibility === 'public' ? 'Followers are notified, and the update gets a link you can share on LinkedIn.' : 'Only the people who follow you see it, and they are notified.'}
            el={draft.visibility === 'public' ? 'Οι ακόλουθοι ειδοποιούνται και η ενημέρωση παίρνει σύνδεσμο για το LinkedIn.' : 'Τη βλέπουν μόνο όσοι σας ακολουθούν, και ειδοποιούνται.'}
            wrap
          />
        </p>
      </fieldset>
      {problems.length ? (
        <p role="status" className="text-sm text-destructive-accessible">
          <BilingualText en={problems.map((p) => FOUNDER_UPDATE_PROBLEM_COPY[p].en).join(' ')} el={problems.map((p) => FOUNDER_UPDATE_PROBLEM_COPY[p].el).join(' ')} wrap />
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={!check.ok || busy}>
          <BilingualText en="Send update" el="Αποστολή ενημέρωσης" compact />
        </Button>
      </div>
    </form>
  );
}
