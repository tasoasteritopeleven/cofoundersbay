'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Circle } from 'lucide-react';
import {
  assessNeedCard,
  CARD_COMMITMENTS,
  CARD_STAGES,
  cardOfferChanges,
  COMMITMENT_KINDS,
  equityRequired,
  isCardCommitment,
  isCardStage,
  isCommitmentKind,
  NEED_CARD_LIMITS,
  type CommitmentKind,
  type NeedCardInput,
} from '@cofounderbay/shared';
import { AppShell } from '@/components/layout/AppShell';
import { BilingualText } from '@/components/common/BilingualText';
import { StatusText, statusEl } from '@/components/common/StatusText';
import { FormDraftNotice } from '@/components/common/FormDraftNotice';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { NeedCard } from '@/components/commitments/NeedCard';
import { ContactWarning } from '@/components/commitments/ContactWarning';
import { createCommitmentCard, commitmentRefusal, getCommitmentCard, updateCommitmentCard } from '@/lib/commitments-api';
import { CMT, kindCopy } from '@/lib/i18n/strings-commitments';
import { bilingualAria } from '@/lib/i18n/format';
import { useFormDraft } from '@/lib/form-draft';
import { qk } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import { isOwnedProject, readProjectsOverlay, resolveDemoProjects, type DemoProject, type ProjectStatus } from '@/lib/projects-demo';

const CATEGORIES = [
  'AI/ML', 'B2B SaaS', 'CleanTech', 'Community', 'Consumer', 'Developer Tools', 'E-commerce',
  'EdTech', 'FinTech', 'HealthTech', 'Logistics', 'Marketplace', 'Other',
];

const KIND_HINT: Record<CommitmentKind, { en: string; el: string }> = {
  cofounder: CMT.kind_cofounder_hint,
  equity_role: CMT.kind_equity_role_hint,
  investor_intro: CMT.kind_investor_intro_hint,
};

const EMPTY: NeedCardInput = {
  kind: 'cofounder',
  title: '',
  exists: '',
  goal: '',
  missing: '',
  offerRole: '',
  offerEquity: '',
  offerHours: null,
  offerScope: '',
  category: '',
  place: '',
  isRemote: false,
  stage: '',
  commitment: '',
  projectRef: null,
};

/** A project's facts, in the card's words: the first sentence, the open role, the place. */
function fromProject(project: DemoProject): Partial<NeedCardInput> {
  const firstSentence = (text: string) => (text.split(/(?<=[.!?])\s/)[0] ?? text).trim().slice(0, NEED_CARD_LIMITS.sentence);
  const role = project.rolesNeeded[0];
  const commitment = role?.commitment === 'Part-time' ? 'part_time' : role?.commitment === 'Full-time' ? 'full_time' : '';
  const nextMilestone = project.milestones.find((m) => m.status !== 'completed');
  return {
    title: role ? `${role.title.split('—')[0].trim()} for ${project.name}`.slice(0, NEED_CARD_LIMITS.title) : `A co-founder for ${project.name}`.slice(0, NEED_CARD_LIMITS.title),
    exists: firstSentence(project.description),
    goal: nextMilestone ? `${nextMilestone.title}.`.slice(0, NEED_CARD_LIMITS.sentence) : '',
    missing: role?.description ? firstSentence(role.description) : '',
    offerRole: role ? role.title.slice(0, NEED_CARD_LIMITS.role) : '',
    offerEquity: role?.equity ?? '',
    category: CATEGORIES.includes(project.industry) ? project.industry : '',
    place: project.location,
    stage: isCardStage(project.status as ProjectStatus) ? project.status : '',
    commitment,
    projectRef: project.id,
  };
}

function Field({
  id,
  label,
  hint,
  children,
  count,
  max,
}: {
  id: string;
  label: { en: string; el: string };
  hint?: { en: string; el: string };
  children: React.ReactNode;
  count?: number;
  max?: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}><BilingualText en={label.en} el={label.el} compact /></Label>
        {typeof count === 'number' && max ? (
          <span className={cn('text-2xs tabular-nums', count > max ? 'text-status-danger' : 'text-muted-foreground')}>{count}/{max}</span>
        ) : null}
      </div>
      {hint ? <p id={`${id}-hint`} className="text-xs text-muted-foreground"><BilingualText en={hint.en} el={hint.el} wrap /></p> : null}
      {children}
    </div>
  );
}

function PostingGuide() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const { success } = useToast();
  const editId = params?.get('edit') ?? '';
  const projectParam = params?.get('project') ?? '';
  const kindParam = params?.get('kind') ?? '';

  const [form, setForm] = useState<NeedCardInput>(() => ({ ...EMPTY, kind: isCommitmentKind(kindParam) ? kindParam : 'cofounder' }));
  const [original, setOriginal] = useState<NeedCardInput | null>(null);
  const [projects, setProjects] = useState<DemoProject[]>([]);
  const [loaded, setLoaded] = useState(!editId);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ en: string; el: string } | null>(null);

  // Projects live in this browser until a projects API exists: read after mount.
  useEffect(() => {
    const owned = resolveDemoProjects(readProjectsOverlay()).filter((p) => isOwnedProject(p));
    setProjects(owned);
    if (projectParam && !editId) {
      const project = resolveDemoProjects(readProjectsOverlay()).find((p) => p.id === projectParam);
      if (project) setForm((f) => ({ ...f, ...fromProject(project) }));
    }
  }, [projectParam, editId]);

  useEffect(() => {
    if (!editId) return;
    let live = true;
    getCommitmentCard(editId)
      .then((card) => {
        if (!live) return;
        const values: NeedCardInput = {
          kind: card.kind,
          title: card.title,
          exists: card.exists,
          goal: card.goal,
          missing: card.missing,
          offerRole: card.offer.role,
          offerEquity: card.offer?.equity ?? '',
          offerHours: card.offer?.hoursPerWeek || null,
          offerScope: card.offer.scope,
          category: card.category,
          place: card.place ?? '',
          isRemote: card.isRemote,
          stage: card.stage,
          commitment: card.commitment,
          projectRef: card.projectRef,
        };
        setForm(values);
        setOriginal(values);
      })
      .catch((err) => setError(commitmentRefusal(err)))
      .finally(() => live && setLoaded(true));
    return () => {
      live = false;
    };
  }, [editId]);

  // A card the assistant drafted (draft_need_card): fields arrive filled and
  // the person still reads them and presses Publish.
  const draft = useFormDraft(
    'need_card',
    (f) => {
      setForm((current) => {
        const next = { ...current };
        for (const key of ['title', 'exists', 'goal', 'missing', 'offerRole', 'offerEquity', 'offerScope', 'category', 'place', 'projectRef'] as const) {
          if (typeof f[key] === 'string') (next as Record<string, unknown>)[key] = f[key];
        }
        if (isCommitmentKind(f.kind)) next.kind = f.kind;
        if (isCardStage(f.stage)) next.stage = f.stage;
        if (isCardCommitment(f.commitment)) next.commitment = f.commitment;
        if (typeof f.offerHours === 'string' && Number(f.offerHours) > 0) next.offerHours = Math.round(Number(f.offerHours));
        if (typeof f.isRemote === 'boolean') next.isRemote = f.isRemote;
        return next;
      });
    },
    loaded,
  );

  const assessment = useMemo(() => assessNeedCard(form), [form]);
  const failing = assessment.checks.filter((c) => c.required && !c.ok);
  const newVersion = original ? cardOfferChanges(original, form).length > 0 : false;
  const set = <K extends keyof NeedCardInput>(key: K) => (value: NeedCardInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const text = (key: 'title' | 'exists' | 'goal' | 'missing' | 'offerRole' | 'offerEquity' | 'offerScope' | 'place') => ({
    value: form[key] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(key)(e.target.value),
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!assessment.ready || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      if (editId) {
        const { card } = await updateCommitmentCard(editId, form);
        success('Card updated', newVersion ? 'The offer changed, so this is a new version.' : undefined);
        await qc.invalidateQueries({ queryKey: qk('commitments') });
        router.push(`/commitments/${encodeURIComponent(card.id || editId)}`);
      } else {
        const card = await createCommitmentCard(form);
        success('Need card published');
        await qc.invalidateQueries({ queryKey: qk('commitments') });
        router.push(`/commitments/${encodeURIComponent(card.id)}`);
      }
    } catch (err) {
      setError(commitmentRefusal(err));
      setSubmitting(false);
    }
  }

  const preview = {
    kind: form.kind,
    title: form.title,
    exists: form.exists,
    goal: form.goal,
    missing: form.missing,
    offer: { role: form.offerRole, equity: form.offerEquity || null, hoursPerWeek: form.offerHours ?? 0, scope: form.offerScope },
    category: form.category,
    place: form.place || null,
    isRemote: form.isRemote,
    stage: form.stage,
    commitment: form.commitment,
  };

  return (
    <AppShell showHelp title={editId ? CMT.guide_edit_title.en : undefined} titleEl={editId ? CMT.guide_edit_title.el : undefined} askAi="Draft my need card from my workspace: what exists, the outcome, who is missing and what I offer.">
      <div className="space-y-6">
        <p className="max-w-2xl text-sm text-muted-foreground">
          <BilingualText en={CMT.guide_intro.en} el={CMT.guide_intro.el} wrap />
          <span className="ml-2 inline-flex rounded-full bg-muted px-2 py-0.5 text-2xs font-medium text-muted-foreground">
            <BilingualText en={CMT.two_minutes.en} el={CMT.two_minutes.el} compact />
          </span>
        </p>
        <FormDraftNotice filled={draft.filled} onDismiss={draft.dismiss} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
          <form onSubmit={submit} className="min-w-0 space-y-6" aria-label={bilingualAria(CMT.guide_title.en, CMT.guide_title.el)}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base"><BilingualText en={CMT.kind.en} el={CMT.kind.el} compact /></CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div role="radiogroup" aria-label={bilingualAria(CMT.kind.en, CMT.kind.el)} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {COMMITMENT_KINDS.map((k) => {
                    const on = form.kind === k;
                    const copy = kindCopy(k);
                    return (
                      <button
                        key={k}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        disabled={Boolean(editId)}
                        onClick={() => set('kind')(k)}
                        className={cn(
                          'min-h-11 rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                          on ? 'border-primary bg-primary/10 font-medium text-foreground' : 'border-border hover:bg-accent',
                        )}
                      >
                        <BilingualText en={copy.en} el={copy.el} compact wrap />
                        <span className="mt-0.5 block text-xs font-normal text-muted-foreground"><BilingualText en={KIND_HINT[k].en} el={KIND_HINT[k].el} compact wrap /></span>
                      </button>
                    );
                  })}
                </div>
                {!editId ? (
                  <Field id="from-project" label={CMT.from_project}>
                    <Select
                      value={form.projectRef ?? 'none'}
                      onValueChange={(v) => {
                        if (v === 'none') return setForm((f) => ({ ...f, projectRef: null }));
                        const project = projects.find((p) => p.id === v);
                        if (project) setForm((f) => ({ ...f, ...fromProject(project) }));
                      }}
                    >
                      <SelectTrigger id="from-project"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none"><BilingualText en={CMT.from_project_none.en} el={CMT.from_project_none.el} compact /></SelectItem>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                ) : null}
                <Field id="card-title" label={{ en: 'Title', el: 'Τίτλος' }} count={form.title.length} max={NEED_CARD_LIMITS.title}>
                  <Input id="card-title" {...text('title')} maxLength={NEED_CARD_LIMITS.title} placeholder="Technical co-founder for Harbor" />
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base"><BilingualText en="Three sentences" el="Τρεις προτάσεις" compact /></CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(
                  [
                    ['exists', CMT.exists, CMT.exists_hint, CMT.exists_example],
                    ['goal', CMT.goal, CMT.goal_hint, CMT.goal_example],
                    ['missing', CMT.missing, CMT.missing_hint, CMT.missing_example],
                  ] as const
                ).map(([key, label, hint, example]) => (
                  <Field key={key} id={`card-${key}`} label={label} hint={hint} count={form[key].length} max={NEED_CARD_LIMITS.sentence}>
                    <Textarea
                      id={`card-${key}`}
                      {...text(key)}
                      maxLength={NEED_CARD_LIMITS.sentence + 20}
                      className="min-h-16"
                      placeholder={example.en}
                      aria-describedby={`card-${key}-hint`}
                    />
                  </Field>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base"><BilingualText en={CMT.offer.en} el={CMT.offer.el} compact /></CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field id="offer-role" label={CMT.offer_role}>
                  <Input id="offer-role" {...text('offerRole')} maxLength={NEED_CARD_LIMITS.role} placeholder="CTO and co-founder" />
                </Field>
                <Field id="offer-equity" label={equityRequired(form.kind) ? CMT.offer_equity : CMT.offer_equity_terms}>
                  <Input id="offer-equity" {...text('offerEquity')} maxLength={NEED_CARD_LIMITS.equity} placeholder={equityRequired(form.kind) ? '8–12%' : 'Pre-seed via SAFE'} />
                </Field>
                <Field id="offer-hours" label={CMT.offer_hours}>
                  <Input
                    id="offer-hours"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={80}
                    value={form.offerHours ?? ''}
                    onChange={(e) => set('offerHours')(e.target.value === '' ? null : Math.round(Number(e.target.value)))}
                  />
                </Field>
                <Field id="offer-commitment" label={CMT.commitment}>
                  <Select value={form.commitment || undefined} onValueChange={set('commitment')}>
                    <SelectTrigger id="offer-commitment"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {CARD_COMMITMENTS.map((c) => (
                        <SelectItem key={c} value={c}><StatusText value={c} /></SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="sm:col-span-2">
                  <Field id="offer-scope" label={CMT.offer_scope} count={form.offerScope.length} max={NEED_CARD_LIMITS.scope}>
                    <Textarea id="offer-scope" {...text('offerScope')} maxLength={NEED_CARD_LIMITS.scope + 20} className="min-h-16" placeholder="Own the platform and hire the first two engineers." />
                  </Field>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base"><BilingualText en={CMT.filters.en} el={CMT.filters.el} compact /></CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field id="card-category" label={CMT.category}>
                  <Select value={form.category || undefined} onValueChange={set('category')}>
                    <SelectTrigger id="card-category"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{statusEl(c) ? <StatusText value={c} /> : c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field id="card-stage" label={CMT.stage}>
                  <Select value={form.stage || undefined} onValueChange={set('stage')}>
                    <SelectTrigger id="card-stage"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {CARD_STAGES.map((s) => (
                        <SelectItem key={s} value={s}><StatusText value={s} /></SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field id="card-place" label={CMT.place}>
                  <Input id="card-place" {...text('place')} maxLength={80} placeholder="Athens, Greece" />
                </Field>
                <div className="flex items-center gap-3 self-end pb-2">
                  <Switch id="card-remote" aria-label={bilingualAria(CMT.remote.en, CMT.remote.el)} checked={form.isRemote} onCheckedChange={(v) => set('isRemote')(Boolean(v))} />
                  <Label htmlFor="card-remote"><BilingualText en={CMT.remote.en} el={CMT.remote.el} compact /></Label>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <ContactWarning text={[form.title, form.exists, form.goal, form.missing, form.offerRole, form.offerEquity, form.offerScope, form.place].join('\n')} promises />
              {original ? (
                <p className="text-xs text-muted-foreground"><BilingualText en={CMT.new_version_note.en} el={CMT.new_version_note.el} wrap /></p>
              ) : null}
              {error ? (
                <p role="alert" className="text-sm text-status-danger"><BilingualText en={error.en} el={error.el} wrap /></p>
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={!assessment.ready || submitting || !loaded}>
                  <BilingualText en={editId ? CMT.save_changes.en : CMT.publish.en} el={editId ? CMT.save_changes.el : CMT.publish.el} compact />
                </Button>
                <Button type="button" variant="ghost" asChild>
                  <Link href={editId ? `/commitments/${encodeURIComponent(editId)}` : '/commitments'}><BilingualText en="Cancel" el="Ακύρωση" compact /></Link>
                </Button>
                <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
                  {assessment.ready ? (
                    <BilingualText en={CMT.ready.en} el={CMT.ready.el} compact />
                  ) : (
                    <BilingualText en={`${failing.length} ${CMT.checks_left.en}`} el={`${failing.length} ${CMT.checks_left.el}`} compact />
                  )}
                </p>
              </div>
            </div>
          </form>

          <aside className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:self-start" aria-label={bilingualAria(CMT.preview.en, CMT.preview.el)}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground"><BilingualText en={CMT.preview.en} el={CMT.preview.el} compact /></CardTitle>
              </CardHeader>
              <CardContent>
                <NeedCard card={preview} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between gap-2 text-sm">
                  <BilingualText en={CMT.quality.en} el={CMT.quality.el} compact />
                  <span className="tabular-nums text-muted-foreground">{assessment.score}/100</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {assessment.checks.map((check) => (
                    <li key={check.id} className="flex items-start gap-2 text-sm">
                      <span data-keep-icon="" className={cn('mt-0.5 shrink-0', check.ok ? 'text-status-success' : 'text-muted-foreground')}>
                        {check.ok ? <Check className="h-4 w-4" aria-hidden /> : <Circle className="h-4 w-4" aria-hidden />}
                      </span>
                      <span className={cn('min-w-0', check.ok ? 'text-muted-foreground' : 'text-foreground')}>
                        <BilingualText en={check.en} el={check.el} compact wrap />
                        {!check.required ? <span className="text-2xs text-muted-foreground"> · <BilingualText en="advice" el="συμβουλή" compact /></span> : null}
                        <span className="sr-only">{check.ok ? ' — done' : ' — to do'}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

export default function NewNeedCardPage() {
  return (
    <Suspense fallback={null}>
      <PostingGuide />
    </Suspense>
  );
}
