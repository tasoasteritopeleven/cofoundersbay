'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus, ChevronRight, CheckCircle2, Download, X,
} from 'lucide-react';
import { useDemoData } from '@/contexts/DemoDataContext';
import { AppShell } from '@/components/layout/AppShell';
import { NonGuaranteeNote } from '@/components/commitments/NonGuaranteeNote';
import type { PageRailSection } from '@/components/layout/PageRail';
import { BilingualText } from '@/components/common/BilingualText';
import { CardFoot, CardHead } from '@/components/common/CardAnatomy';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useModalA11y } from '@/hooks/useModalA11y';
import { useHydrated } from '@/components/common/RelativeTime';
import { STATUS, type StatusTone } from '@/lib/semantic-colors';
import { CfbGlyph, type CfbGlyphName } from '@/components/icons/CfbGlyph';
import { usePopupChat } from '@/contexts/PopupChatContext';
import { useToast } from '@/components/ui/toast';
import { bilingualAria, formatShortDate } from '@/lib/i18n/format';
import { useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';
import { BUILDER_BTN } from '@/components/builder/BuilderStageChrome';
import {
  fundraisingEn,
  fundraisingEl,
  useFundraisingPrimaryText,
  INVESTOR_STATUS_KEYS,
  ROUND_STATUS_KEYS,
  DOC_STATUS_KEYS,
  DOC_CATEGORY_KEYS,
  INVESTOR_TYPE_EL,
} from '@/lib/i18n/strings-fundraising';
import {
  PIPELINE_STAGES,
  DOC_CATEGORIES,
  INVESTOR_TYPES,
  listFundraisingLeads,
  listFundraisingDocs,
  addFundraisingLead,
  moveFundraisingLead,
  markFundraisingDocStatus,
  fundraisingPipelineStats,
  fundraisingRoundView,
  fmtMoney,
  daysUntil,
  readFundraisingOverlay,
  resolveFundraisingLeads,
  resolveFundraisingDocs,
  type InvestorLead,
  type InvestorStatus,
  type DataRoomDoc,
  type DocStatus,
} from '@/lib/fundraising-demo';
import { choiceControl, usePageControls, usePageList } from '@/lib/page-controls';

const ROUND_TONE: Record<string, StatusTone> = {
  planning: 'neutral',
  active: 'success',
  closing: 'warning',
  closed: 'info',
};

const INVESTOR_TONE: Record<InvestorStatus, StatusTone> = {
  prospect: 'neutral',
  contacted: 'info',
  meeting: 'accent',
  dd: 'warning',
  committed: 'success',
  passed: 'danger',
};

const DOC_TONE: Record<DocStatus, StatusTone> = {
  draft: 'warning',
  ready: 'success',
  shared: 'info',
};

const DOC_GLYPH: Record<DocStatus, CfbGlyphName> = {
  draft: 'book',
  ready: 'award',
  shared: 'discover',
};

const HARBOR_ASK =
  "Propose who to contact next on Harbor's $750K seed (Athens Tech Angels committed $375K; remaining $375K; warm intro from Athens founder networks). Use Idea Core, the pitch deck, Research, and data-room gaps.";
const GENERIC_ASK =
  'Help me pick who to contact next from Builder artefacts and data-room gaps.';

function statusLabel(status: InvestorStatus) {
  const key = INVESTOR_STATUS_KEYS[status];
  return key
    ? <BilingualText en={fundraisingEn(key)} el={fundraisingEl(key)} compact />
    : status;
}

/**
 * The ask behind a lead's message and details buttons.
 *
 * It used to state Harbor's round for every lead: "Draft a next-step note for
 * {lead} on Harbor's $750K seed (Athens Tech Angels, $375K committed)". Outside
 * the showcase a founder adds their own contacts here, so the assistant was
 * briefed with another company's raise and asked to write to a real investor
 * about it. The round facts belong to the showcase only, exactly as the page's
 * own `askAi` already gates them on `harborLive`.
 */
function leadAskPrompt(lead: InvestorLead, harborLive: boolean) {
  return harborLive
    ? `Draft a next-step note for ${lead.name} on Harbor's $750K seed (Athens Tech Angels, $375K committed).`
    : `Draft a next-step note for ${lead.name}. Use only my saved round details, pitch deck and data room; ask me for anything missing rather than inventing amounts or commitments.`;
}

function LeadName({ lead, className, as: Tag = 'p' }: { lead: InvestorLead; className?: string; as?: 'p' | 'span' }) {
  // A kanban card truncates by design; a pipeline row wraps, or a long
  // Greek half ran 33px past the row on a phone.
  const truncating = className?.includes('truncate') ?? false;
  return (
    <Tag className={cn(Tag === 'span' && 'block', className)}>
      {lead.nameEl
        ? <BilingualText en={lead.name} el={lead.nameEl} compact wrap={!truncating} />
        : lead.name}
    </Tag>
  );
}

function AddLeadModal({
  open,
  defaultStatus,
  onClose,
  onCreated,
}: {
  open: boolean;
  defaultStatus: InvestorStatus;
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useFundraisingPrimaryText();
  const { success } = useToast();
  const [name, setName] = useState('');
  const panelRef = useModalA11y<HTMLFormElement>(open, onClose);
  const [firm, setFirm] = useState('');
  const [type, setType] = useState<string>('Angel');
  const [stage, setStage] = useState('Pre-Seed / Seed');
  const [checkSize, setCheckSize] = useState('$25K–$150K');
  const [status, setStatus] = useState<InvestorStatus>(defaultStatus);
  const [notes, setNotes] = useState('');

  if (!open) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    addFundraisingLead({
      name: name.trim(),
      firm: firm.trim() || undefined,
      type,
      stage,
      checkSize,
      status,
      notes: notes.trim() || undefined,
    });
    success('Contact added', 'It now appears in Pipeline and Kanban.');
    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      {/* `useModalA11y` gives this the four behaviours Radix would: focus in
          on open, Tab trapped, Escape closes, scroll locked and focus
          returned. Without them a keyboard user opened this and kept tabbing
          through the page behind it. */}
      <form
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fundraising-modal-title"
        tabIndex={-1}
        onSubmit={submit}
        className="relative w-full max-w-lg space-y-4 overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-none"
        data-surface="overlay"
      >
        <div className="flex items-center justify-between">
          <h2 id="fundraising-modal-title" className="page-section font-semibold">
            <BilingualText en={fundraisingEn('modal_new')} el={fundraisingEl('modal_new')} />
          </h2>
          <button type="button" onClick={onClose} className={cn(BUILDER_BTN, 'inline-flex h-11 w-11 items-center justify-center text-muted-foreground hover:bg-muted sm:h-9 sm:w-9')} aria-label={bilingualAria('Close dialog', 'Κλείσιμο παραθύρου')}>
            <X className="icon-sm" />
          </button>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name"><BilingualText en={fundraisingEn('field_name')} el={fundraisingEl('field_name')} compact /> *</Label>
          <Input id="name" className={BUILDER_BTN} required value={name} onChange={(e) => setName(e.target.value)} placeholder={t(fundraisingEn('name_ph'), fundraisingEl('name_ph'))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="firm"><BilingualText en={fundraisingEn('field_firm')} el={fundraisingEl('field_firm')} compact /></Label>
            <Input id="firm" className={BUILDER_BTN} value={firm} onChange={(e) => setFirm(e.target.value)} placeholder={t(fundraisingEn('firm_ph'), fundraisingEl('firm_ph'))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="type"><BilingualText en={fundraisingEn('field_type')} el={fundraisingEl('field_type')} compact /></Label>
            <select id="type" className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
              {INVESTOR_TYPES.map((item) => (
                <option key={item} value={item}>
                  {t(item, INVESTOR_TYPE_EL[item] ?? item)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="stage"><BilingualText en={fundraisingEn('field_stage')} el={fundraisingEl('field_stage')} compact /></Label>
            <Input id="stage" className={BUILDER_BTN} value={stage} onChange={(e) => setStage(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="checkSize"><BilingualText en={fundraisingEn('field_check')} el={fundraisingEl('field_check')} compact /></Label>
            <Input id="checkSize" className={BUILDER_BTN} value={checkSize} onChange={(e) => setCheckSize(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="status"><BilingualText en={fundraisingEn('field_status')} el={fundraisingEl('field_status')} compact /></Label>
          <select id="status" className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value as InvestorStatus)}>
            {PIPELINE_STAGES.map((s) => (
              <option key={s} value={s}>{t(fundraisingEn(INVESTOR_STATUS_KEYS[s]), fundraisingEl(INVESTOR_STATUS_KEYS[s]))}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes"><BilingualText en={fundraisingEn('field_notes')} el={fundraisingEl('field_notes')} compact /></Label>
          <textarea id="notes" className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t(fundraisingEn('notes_ph'), fundraisingEl('notes_ph'))} />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className={BUILDER_BTN} onClick={onClose}>
            <BilingualText en={fundraisingEn('cancel')} el={fundraisingEl('cancel')} compact />
          </Button>
          <Button type="submit" className={BUILDER_BTN} disabled={!name.trim()}>
            <BilingualText en={fundraisingEn('save')} el={fundraisingEl('save')} compact />
          </Button>
        </div>
      </form>
    </div>
  );
}

function RoundCard({
  round,
  onAdd,
}: {
  round: ReturnType<typeof fundraisingRoundView>;
  onAdd: () => void;
}) {
  const { primary } = useLanguagePreference();
  // The page is prerendered, so "days left" computed during render is frozen
  // at build time — the client hydrates with a different day count (#418).
  // Until the browser has its own clock the tile shows the fixed closing
  // date, which renders identically on both sides.
  const hydrated = useHydrated();
  const pct = Math.round((round.raised / round.target) * 100);
  const remaining = round.target - round.raised;
  const days = hydrated ? daysUntil(round.closingDate) : null;
  const roundKey = ROUND_STATUS_KEYS[round.status];

  const figures = [
    { label: 'stat_investors' as const, value: round.investors.toString() },
    { label: 'stat_committed_amt' as const, value: fmtMoney(round.raised, round.currency) },
    { label: 'stat_closing' as const, value: !round.closingDate ? null : days === null ? formatShortDate(round.closingDate, primary) : days < 0 ? 'overdue' : `${days}` },
    { label: 'lead_investor' as const, value: round.leadInvestor ?? '' },
  ];

  // The round's name is the card's title and everything inside reads under
  // it: the figures sit on the body step, their labels on the caption step.
  // They used to match or outrank the name ("$375K raised", "Athens Tech
  // Angels" at the title's size and weight).
  return (
    <Card>
      <CardContent className="space-y-4">
        <CardHead
          titleAs="h2"
          title={round.nameEl ? <BilingualText en={round.name} el={round.nameEl} /> : round.name}
          subtitle={(
            <>
              {round.type} · {round.valuation ? `${fmtMoney(round.valuation, round.currency)} ` : null}
              {round.valuation
                ? <BilingualText en={fundraisingEn('pre_money')} el={fundraisingEl('pre_money')} compact />
                : <BilingualText en={fundraisingEn('valuation_tbd')} el={fundraisingEl('valuation_tbd')} compact />}
            </>
          )}
          aside={(
            <Badge variant="outline" className={cn('border', STATUS[ROUND_TONE[round.status]].chip)}>
              {roundKey ? <BilingualText en={fundraisingEn(roundKey)} el={fundraisingEl(roundKey)} compact /> : round.status}
            </Badge>
          )}
        />

        <div className="space-y-1.5">
          <div className="card-body flex justify-between gap-3 tabular-nums">
            <span className="font-medium">{fmtMoney(round.raised, round.currency)} <BilingualText en={fundraisingEn('raised')} el={fundraisingEl('raised')} compact /></span>
            <span className="text-muted-foreground">{fmtMoney(round.target, round.currency)} <BilingualText en={fundraisingEn('target')} el={fundraisingEl('target')} compact /></span>
          </div>
          <Progress value={pct} className="h-2" />
          <div className="flex justify-between gap-3 text-xs text-muted-foreground tabular-nums">
            <span>
              <BilingualText en={`${pct}% ${fundraisingEn('of_target')}`} el={`${pct}% ${fundraisingEl('of_target')}`} compact />
            </span>
            <span>{fmtMoney(remaining, round.currency)} <BilingualText en={fundraisingEn('remaining')} el={fundraisingEl('remaining')} compact /></span>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3 sm:grid-cols-4">
          {figures.map((s) => (
            <div key={s.label} className="min-w-0">
              <dt className="text-xs text-muted-foreground">
                <BilingualText en={fundraisingEn(s.label)} el={fundraisingEl(s.label)} compact wrap />
              </dt>
              <dd className="card-body mt-0.5 break-words font-medium tabular-nums">
                {s.label === 'stat_closing' && s.value === 'overdue'
                  ? <BilingualText en={fundraisingEn('overdue')} el={fundraisingEl('overdue')} compact />
                  : s.label === 'stat_closing' && s.value === null
                    ? <BilingualText en={fundraisingEn('closing_tbd')} el={fundraisingEl('closing_tbd')} compact />
                    : s.label === 'stat_closing' && s.value
                      ? /^\d+$/.test(s.value)
                        // One text node with the count inside, so a locale can
                        // put the number where its grammar wants it.
                        ? s.value === '1'
                          ? <BilingualText en={fundraisingEn('days_left_one')} el={fundraisingEl('days_left_one')} compact />
                          : <BilingualText
                              en={fundraisingEn('days_left').replace('{count}', s.value)}
                              el={fundraisingEl('days_left').replace('{count}', s.value)}
                              compact
                            />
                        : s.value
                      : s.label === 'lead_investor' && !s.value
                        ? <BilingualText en={fundraisingEn('none_yet')} el={fundraisingEl('none_yet')} compact />
                        : s.value}
              </dd>
            </div>
          ))}
        </dl>

        <CardFoot>
          <Button size="sm" variant="outline" className={BUILDER_BTN} onClick={onAdd}>
            <BilingualText en={fundraisingEn('add_investor')} el={fundraisingEl('add_investor')} compact />
          </Button>
        </CardFoot>
      </CardContent>
    </Card>
  );
}

function PipelineView({
  leads,
  onAdd,
  onMove,
}: {
  leads: InvestorLead[];
  onAdd: (status: InvestorStatus) => void;
  onMove: (id: string, status: InvestorStatus) => void;
}) {
  const { primary } = useLanguagePreference();
  const byStage = PIPELINE_STAGES.reduce<Record<InvestorStatus, InvestorLead[]>>((acc, s) => {
    acc[s] = leads.filter((l) => l.status === s);
    return acc;
  }, {} as Record<InvestorStatus, InvestorLead[]>);

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-3">
        {PIPELINE_STAGES.map((stage) => {
          const items = byStage[stage];
          const colors = STATUS[INVESTOR_TONE[stage]];
          return (
            <div key={stage} className="w-56 shrink-0">
              <div className={cn('mb-2 flex items-center justify-between rounded-xl border px-2.5 py-1.5', colors.chip)}>
                <span className="page-stat-label font-semibold">{statusLabel(stage)}</span>
                <Badge variant="secondary" size="sm" className="rounded-full px-1.5">{items.length}</Badge>
              </div>
              <div className="space-y-2">
                {items.map((lead) => (
                  <Card key={lead.id} className="transition-colors hover:border-primary/30">
                    <CardContent className="space-y-2">
                      <CardHead
                        mark={(
                          <Avatar className="h-8 w-8 rounded-xl">
                            <AvatarFallback className="rounded-xl bg-primary/10 text-xs font-semibold text-primary-accessible">
                              {lead.name[0]}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        titleAs="h4"
                        title={<LeadName lead={lead} as="span" className="truncate" />}
                        subtitle={lead.firm ? <span className="block truncate">{lead.firm}</span> : undefined}
                        aside={lead.isVerified ? <CfbGlyph name="award" className={cn('icon-sm', STATUS.info.icon)} /> : undefined}
                      />
                      <p className="text-xs text-muted-foreground">
                        {lead.checkSizeEl
                          ? <BilingualText en={lead.checkSize} el={lead.checkSizeEl} compact />
                          : lead.checkSize}
                      </p>
                      {lead.notes && (
                        <p className="card-body line-clamp-2 text-muted-foreground">
                          {lead.notesEl
                            ? <BilingualText en={lead.notes} el={lead.notesEl} wrap />
                            : lead.notes}
                        </p>
                      )}
                      {lead.lastContact && (
                        <p className="text-xs text-muted-foreground">
                          <BilingualText en={fundraisingEn('last_contact')} el={fundraisingEl('last_contact')} compact />
                          : {formatShortDate(lead.lastContact, primary)}
                        </p>
                      )}
                      <select
                        className="w-full rounded-md border border-border bg-background px-2 py-1"
                        value={lead.status}
                        onChange={(e) => onMove(lead.id, e.target.value as InvestorStatus)}
                        aria-label={bilingualAria(fundraisingEn('move_to'), fundraisingEl('move_to'))}
                      >
                        {PIPELINE_STAGES.map((s) => (
                          <option key={s} value={s}>
                            {primary === 'el' ? fundraisingEl(INVESTOR_STATUS_KEYS[s]) : fundraisingEn(INVESTOR_STATUS_KEYS[s])}
                          </option>
                        ))}
                      </select>
                    </CardContent>
                  </Card>
                ))}
                <Button variant="ghost" size="sm" className={cn('h-7 w-full border border-dashed border-border text-xs text-muted-foreground', BUILDER_BTN)} onClick={() => onAdd(stage)}>
                  <Plus className="icon-sm mr-1" />
                  <BilingualText en={fundraisingEn('add_to_stage')} el={fundraisingEl('add_to_stage')} compact />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DataRoomView({
  docs,
  onChange,
}: {
  docs: DataRoomDoc[];
  onChange: () => void;
}) {
  const { primary } = useLanguagePreference();
  const { success } = useToast();
  const [catFilter, setCatFilter] = useState('All');
  const filtered = catFilter === 'All' ? docs : docs.filter((d) => d.category === catFilter);
  const ready = docs.filter((d) => d.status === 'ready' || d.status === 'shared').length;
  const required = docs.filter((d) => d.isRequired);
  const requiredReady = required.filter((d) => d.status === 'ready' || d.status === 'shared').length;

  return (
    <div className="space-y-4">
      <Card className="rounded-xl">
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="page-stat-label font-semibold"><BilingualText en={fundraisingEn('dr_health')} el={fundraisingEl('dr_health')} compact /></p>
              <p className="mt-0.5 text-2xs text-muted-foreground">
                {requiredReady}/{required.length} <BilingualText en={fundraisingEn('dr_required')} el={fundraisingEl('dr_required')} compact />
                {' · '}
                {ready}/{docs.length} <BilingualText en={fundraisingEn('dr_total')} el={fundraisingEl('dr_total')} compact />
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="page-stat text-xl font-bold tabular-nums text-primary-accessible">{docs.length ? Math.round((ready / docs.length) * 100) : 0}%</p>
                <p className="text-2xs text-muted-foreground"><BilingualText en={fundraisingEn('dr_complete')} el={fundraisingEl('dr_complete')} compact /></p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className={cn('h-8 gap-1.5 text-xs', BUILDER_BTN)}
                onClick={() => {
                  void navigator.clipboard?.writeText(`${window.location.origin}/share/data-room-seed`).catch(() => undefined);
                  success('Data room link copied', 'Tokenised link — nothing is public unless you send it.');
                }}
              >
                <CfbGlyph name="discover" className="icon-sm" />
                <BilingualText en={fundraisingEn('share_room')} el={fundraisingEl('share_room')} compact />
              </Button>
            </div>
          </div>
          <Progress value={docs.length ? (ready / docs.length) * 100 : 0} className="mt-3 h-2" />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {DOC_CATEGORIES.map((c) => {
          const key = DOC_CATEGORY_KEYS[c];
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCatFilter(c)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                catFilter === c ? 'border-primary bg-primary/15 text-primary-accessible' : 'border-border text-muted-foreground hover:border-primary/40',
              )}
            >
              {key ? <BilingualText en={fundraisingEn(key)} el={fundraisingEl(key)} compact /> : c}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          <BilingualText en={fundraisingEn('empty_docs')} el={fundraisingEl('empty_docs')} />
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((doc) => {
            const docKey = DOC_STATUS_KEYS[doc.status];
            const title = doc.nameEl
              ? <BilingualText en={doc.name} el={doc.nameEl} compact />
              : doc.name;
            return (
              <Card key={doc.id} className="rounded-xl transition-colors hover:border-primary/20">
                <CardContent className="flex items-center gap-3">
                  <div className="shrink-0 text-muted-foreground">
                    <CfbGlyph name="book" className="icon-sm" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {doc.href
                          ? <Link href={doc.href} className="underline-offset-4 hover:underline">{title}</Link>
                          : title}
                      </p>
                      {doc.isRequired && (
                        <Badge variant="secondary" size="sm" className={cn('rounded-full', STATUS.danger.chip)}>
                          <BilingualText en={fundraisingEn('required')} el={fundraisingEl('required')} compact />
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-2xs text-muted-foreground">
                      <span>{DOC_CATEGORY_KEYS[doc.category] ? <BilingualText en={fundraisingEn(DOC_CATEGORY_KEYS[doc.category])} el={fundraisingEl(DOC_CATEGORY_KEYS[doc.category])} compact /> : doc.category}</span>
                      {doc.lastUpdated && (
                        <span>· <BilingualText en={fundraisingEn('updated')} el={fundraisingEl('updated')} compact /> {formatShortDate(doc.lastUpdated, primary)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className={cn('flex items-center gap-1 text-xs font-medium', STATUS[DOC_TONE[doc.status]].text)}>
                      <CfbGlyph name={DOC_GLYPH[doc.status]} className="icon-sm" />
                      {docKey ? <BilingualText en={fundraisingEn(docKey)} el={fundraisingEl(docKey)} compact /> : doc.status}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn('h-7 w-7 p-0', BUILDER_BTN)}
                        // It never uploaded anything: it marks the row ready in this
                        // browser, and now says so instead of "Upload queued".
                        aria-label={bilingualAria(fundraisingEn('mark_ready'), fundraisingEl('mark_ready'))}
                        title={bilingualAria(fundraisingEn('mark_ready'), fundraisingEl('mark_ready'))}
                        disabled={doc.status !== 'draft'}
                        onClick={() => {
                          markFundraisingDocStatus(doc.id, 'ready');
                          onChange();
                          success('Marked ready', 'The document is marked ready in this browser.');
                        }}
                      >
                        <CheckCircle2 className="icon-sm" />
                      </Button>
                      {/* "Download started" was a toast with no file behind it. A
                          document with a link opens there; one without says why
                          nothing can be downloaded. */}
                      {doc.href ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn('h-7 w-7 p-0', BUILDER_BTN)}
                          aria-label={bilingualAria(fundraisingEn('download'), fundraisingEl('download'))}
                          asChild
                        >
                          <Link href={doc.href}><Download className="icon-sm" /></Link>
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn('h-7 w-7 p-0', BUILDER_BTN)}
                          aria-label={bilingualAria(fundraisingEn('download'), fundraisingEl('download'))}
                          title={bilingualAria(fundraisingEn('no_file'), fundraisingEl('no_file'))}
                          disabled
                        >
                          <Download className="icon-sm" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InvestorListView({
  leads,
  onMove,
  harborLive,
}: {
  leads: InvestorLead[];
  onMove: (id: string, status: InvestorStatus) => void;
  /** Only the showcase may brief the assistant with Harbor's round. */
  harborLive: boolean;
}) {
  const { primary } = useLanguagePreference();
  const { ask } = usePopupChat();
  const router = useRouter();

  if (leads.length === 0) return null;

  return (
    <div className="space-y-2">
      {leads.map((lead) => {
        const colors = STATUS[INVESTOR_TONE[lead.status]];
        return (
          <Card key={lead.id} className="transition-colors hover:border-primary/20">
            {/* The Endorsements card: mark, name and the line under it, the
                note on the mark's edge, then a foot with the last contact
                and the controls. The controls wrap on a phone instead of
                squeezing the name (measured at 360px, the identity column
                once collapsed to 18px); nothing is hidden or removed. */}
            <CardContent className="space-y-3">
              <CardHead
                mark={(
                  <Avatar className="h-10 w-10 rounded-xl">
                    <AvatarFallback className="rounded-xl bg-primary/10 font-semibold text-primary-accessible">{lead.name[0]}</AvatarFallback>
                  </Avatar>
                )}
                title={<LeadName lead={lead} as="span" />}
                titleAs="h3"
                subtitle={(
                  <>
                    {lead.firm ? `${lead.firm} · ` : ''}
                    <BilingualText en={lead.type} el={INVESTOR_TYPE_EL[lead.type] ?? lead.type} compact />
                    {' · '}
                    {lead.checkSizeEl
                      ? <BilingualText en={lead.checkSize} el={lead.checkSizeEl} compact />
                      : lead.checkSize}
                  </>
                )}
                aside={lead.isVerified ? <CfbGlyph name="award" className={cn('icon-sm', STATUS.info.icon)} /> : undefined}
              />
              {lead.notes && (
                <p className="card-body line-clamp-2 text-muted-foreground">
                  {lead.notesEl
                    ? <BilingualText en={lead.notes} el={lead.notesEl} wrap />
                    : lead.notes}
                </p>
              )}
              <CardFoot meta={lead.lastContact ? formatShortDate(lead.lastContact, primary) : undefined}>
                <select
                  className={cn('rounded-full border bg-transparent px-2 py-1', colors.chip)}
                  value={lead.status}
                  onChange={(e) => onMove(lead.id, e.target.value as InvestorStatus)}
                  aria-label={bilingualAria(fundraisingEn('move_to'), fundraisingEl('move_to'))}
                >
                  {PIPELINE_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {primary === 'el' ? fundraisingEl(INVESTOR_STATUS_KEYS[s]) : fundraisingEn(INVESTOR_STATUS_KEYS[s])}
                    </option>
                  ))}
                </select>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn('h-7 w-7 gap-1 p-0 sm:w-auto sm:px-2', BUILDER_BTN)}
                  aria-label={bilingualAria(fundraisingEn('message'), fundraisingEl('message'))}
                  onClick={() => ask(leadAskPrompt(lead, harborLive))}
                >
                  <CfbGlyph name="messages" className="icon-sm" />
                  <span className="hidden sm:inline text-xs"><BilingualText en={fundraisingEn('message')} el={fundraisingEl('message')} compact /></span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn('h-7 w-7 gap-1 p-0 sm:w-auto sm:px-2', BUILDER_BTN)}
                  aria-label={bilingualAria(fundraisingEn('view_details'), fundraisingEl('view_details'))}
                  onClick={() => {
                    if (lead.href) router.push(lead.href);
                    else ask(leadAskPrompt(lead, harborLive));
                  }}
                >
                  <CfbGlyph name="discover" className="icon-sm" />
                  <span className="hidden sm:inline text-xs"><BilingualText en={fundraisingEn('view_details')} el={fundraisingEl('view_details')} compact /></span>
                </Button>
              </CardFoot>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function FundraisingPage() {
  const { showDemoData } = useDemoData();
  const { ask } = usePopupChat();
  const [tick, setTick] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [addStatus, setAddStatus] = useState<InvestorStatus>('prospect');
  const { success } = useToast();

  // The overlay lives in sessionStorage: the server cannot see it, so reading
  // it during the first client render produced different leads/docs/statuses
  // than the prerendered HTML — a hydration mismatch plus a visible pop-in of
  // rows. Until hydration the page renders the overlay-free seed state
  // (identical to the server); the overlay applies one frame later.
  const hydrated = useHydrated();
  const leads = useMemo(() => {
    const all = hydrated ? listFundraisingLeads() : resolveFundraisingLeads();
    if (showDemoData) return all;
    const createdIds = new Set(readFundraisingOverlay().created.map((l) => l.id));
    return all.filter((l) => createdIds.has(l.id));
  }, [hydrated, showDemoData, tick]);
  const docs = useMemo(
    () => (showDemoData ? (hydrated ? listFundraisingDocs() : resolveFundraisingDocs()) : []),
    [hydrated, showDemoData, tick],
  );
  const stats = fundraisingPipelineStats(leads);
  const round = showDemoData ? fundraisingRoundView(leads) : null;
  const harborLive = showDemoData && leads.some((l) => l.id === 'ata');
  const askAi = harborLive ? HARBOR_ASK : GENERIC_ASK;

  function refresh() {
    setTick((n) => n + 1);
  }

  function openAdd(status: InvestorStatus = 'prospect') {
    setAddStatus(status);
    setAddOpen(true);
  }

  function handleMove(id: string, status: InvestorStatus) {
    moveFundraisingLead(id, status);
    refresh();
    success('Stage updated', 'Pipeline and Kanban stay in lockstep.');
  }

  const [view, setView] = useState('pipeline');
  const stageName = (st: InvestorStatus) => {
    const key = INVESTOR_STATUS_KEYS[st];
    return { en: key ? fundraisingEn(key) : st, el: key ? fundraisingEl(key) : st };
  };
  usePageList([
    {
      id: 'leads',
      labelEn: 'Investor leads',
      labelEl: 'Υποψήφιοι επενδυτές',
      rows: leads.map((l) => `${l.name}${l.firm ? ` (${l.firm})` : ''} · ${stageName(l.status).en} · ${l.checkSize}`),
      sample: showDemoData,
    },
  ]);
  usePageControls([
    choiceControl('fundraising_view', 'Fundraising view', 'Προβολή γύρου', [
      { value: 'pipeline', en: 'Pipeline', el: 'Pipeline' },
      { value: 'kanban', en: 'Kanban', el: 'Kanban' },
      { value: 'dataroom', en: 'Data room', el: 'Data room' },
    ], view, setView),
    {
      // Opens the form at the chosen stage; nothing is stored until the
      // reader saves it there, so this is a view control, not a command -
      // as a command its card said "Done" over an empty form.
      id: 'add_lead',
      labelEn: 'Open the form to add an investor lead',
      labelEl: 'Άνοιγμα φόρμας νέου υποψήφιου επενδυτή',
      writes: false,
      options: PIPELINE_STAGES.map((st) => ({ value: st, labelEn: stageName(st).en, labelEl: stageName(st).el })),
      run: (value) => openAdd((value as InvestorStatus) ?? 'prospect'),
    },
    // One command per stage, over the leads not already in it: the same move
    // the stage selector on each row makes. Leads are kept in this browser
    // (the fundraising overlay), so the move is stored data.
    ...PIPELINE_STAGES.map((st) => ({
      id: `move_to_${st}`,
      labelEn: `Move lead to ${stageName(st).en}`,
      labelEl: `Μετακίνηση επενδυτή σε ${stageName(st).el}`,
      writes: true,
      options: leads.filter((l) => l.status !== st).map((l) => ({ value: l.id, labelEn: l.name, labelEl: l.nameEl ?? l.name })),
      // A move sets the lead's one status in the browser overlay; moving it
      // back to where it was restores it.
      undo: (value?: string) => {
        const prior = leads.find((l) => l.id === value)?.status;
        return prior && prior !== st && PIPELINE_STAGES.includes(prior) ? { control: `move_to_${prior}`, value } : undefined;
      },
      run: (value?: string) => { if (value) handleMove(value, st); },
    })),
  ]);

  /*
   * The page rail: the pipeline totals and the resource links are about the
   * page, not the pipeline itself. The column keeps the round, the views and
   * the actions that change them.
   */
  const rail: PageRailSection[] = [
    {
      id: 'round',
      glyph: 'chart',
      labelEn: 'Round totals',
      labelEl: 'Σύνολα γύρου',
      badge: stats.active || null,
      content: (
        <div className="space-y-2">
          {[
            { glyph: 'people' as const, label: 'stat_leads' as const, value: stats.total, count: stats.total, tone: 'accent' as const },
            { glyph: 'messages' as const, label: 'stat_active' as const, value: stats.active, count: stats.active, tone: 'warning' as const },
            { glyph: 'award' as const, label: 'stat_committed' as const, value: stats.committed, count: stats.committed, tone: 'success' as const },
            { glyph: 'chart' as const, label: 'stat_conversion' as const, value: stats.total ? `${stats.conversion}%` : '—', count: null, tone: 'info' as const },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-3 rounded-lg border border-border p-3">
              <div className={cn('shrink-0 rounded-xl p-2', STATUS[s.tone].bg)}>
                <CfbGlyph name={s.glyph} className={cn('icon-sm', STATUS[s.tone].icon)} />
              </div>
              <div className="min-w-0">
                <p className="page-stat text-lg font-bold tabular-nums">{s.value}</p>
                <p className="page-stat-label text-2xs leading-snug text-muted-foreground">
                  <BilingualText
                    en={fundraisingEn(s.label)}
                    el={fundraisingEl(s.count === 1 ? (`${s.label}_one` as typeof s.label) : s.label)}
                    compact
                    wrap
                  />
                </p>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'resources',
      glyph: 'book',
      labelEn: 'Resources',
      labelEl: 'Πόροι',
      content: (
        <div className="space-y-0.5">
          {[
            { title: 'res_playbook' as const, desc: 'res_playbook_desc' as const, href: '/learning', glyph: 'book' as const },
            { title: 'res_find' as const, desc: 'res_find_desc' as const, href: '/investors', glyph: 'discover' as const },
            { title: 'res_ready' as const, desc: 'res_ready_desc' as const, href: '/readiness', glyph: 'chart' as const },
            { title: 'res_deck' as const, desc: 'res_deck_desc' as const, href: '/builder/pitch-deck', glyph: 'builder' as const },
            { title: 'link_idea' as const, href: '/builder?tab=idea-core', glyph: 'builder' as const },
            { title: 'link_research' as const, href: '/research', glyph: 'research' as const },
            { title: 'link_milestones' as const, href: '/milestones', glyph: 'flag' as const },
            { title: 'link_projects' as const, href: '/projects', glyph: 'briefcase' as const },
          ].map((r) => (
            <Link key={r.href} href={r.href} className="group flex items-center justify-between rounded-lg px-2.5 py-2 transition-colors hover:bg-muted/70">
              <div className="flex min-w-0 items-center gap-2.5">
                <CfbGlyph name={r.glyph} className="icon-sm shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-medium transition-colors group-hover:text-primary-accessible">
                    <BilingualText en={fundraisingEn(r.title)} el={fundraisingEl(r.title)} compact wrap />
                  </p>
                  {'desc' in r && r.desc ? (
                  <p className="text-2xs text-muted-foreground">
                    <BilingualText en={fundraisingEn(r.desc)} el={fundraisingEl(r.desc)} compact wrap />
                  </p>
                  ) : null}
                </div>
              </div>
              <ChevronRight className="icon-sm shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100" />
            </Link>
          ))}
        </div>
      ),
    },
  ];

  const emptyCta = (
    <div className="flex flex-wrap justify-center gap-2">
      <Button size="sm" className={BUILDER_BTN} onClick={() => openAdd()}>
        <BilingualText en={fundraisingEn('add_lead')} el={fundraisingEl('add_lead')} compact />
      </Button>
      <Button size="sm" variant="outline" className={BUILDER_BTN} asChild>
        <Link href="/investors"><BilingualText en={fundraisingEn('find_investors')} el={fundraisingEl('find_investors')} compact /></Link>
      </Button>
    </div>
  );

  return (
    <AppShell
      showHelp
      rail={rail}
      askAi={askAi}
      contentClassName="builder-copy overflow-x-clip"
      actions={
        <Button size="sm" variant="outline" className={cn('gap-1.5', BUILDER_BTN)} onClick={() => openAdd()}>
          <BilingualText en={fundraisingEn('add_lead')} el={fundraisingEl('add_lead')} compact />
        </Button>
      }
    >
      <div className="space-y-6">
        {round ? (
          <RoundCard round={round} onAdd={() => openAdd('committed')} />
        ) : (
          <Card className="rounded-xl border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <CfbGlyph name="wallet" className="icon-lg text-muted-foreground/50" />
              <p className="page-section font-semibold"><BilingualText en={fundraisingEn('empty_round_title')} el={fundraisingEl('empty_round_title')} /></p>
              <p className="max-w-sm text-sm text-muted-foreground"><BilingualText en={fundraisingEn('empty_round_hint')} el={fundraisingEl('empty_round_hint')} /></p>
              <Button size="sm" className={BUILDER_BTN} onClick={() => ask(askAi)}>
                <BilingualText en={fundraisingEn('ask_ai')} el={fundraisingEl('ask_ai')} compact />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* The round totals moved to the page rail ('round' section). */}

        <Tabs value={view} onValueChange={setView}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <TabsList className="rounded-xl">
              <TabsTrigger value="pipeline" className="rounded-xl">
                <BilingualText en={fundraisingEn('tab_pipeline')} el={fundraisingEl('tab_pipeline')} compact />
                <Badge variant="secondary" size="sm" className="ml-1.5 rounded-full px-1.5">{stats.total}</Badge>
              </TabsTrigger>
              <TabsTrigger value="kanban" className="rounded-xl">
                <BilingualText en={fundraisingEn('tab_kanban')} el={fundraisingEl('tab_kanban')} compact />
              </TabsTrigger>
              <TabsTrigger value="dataroom" className="rounded-xl">
                <BilingualText en={fundraisingEn('tab_dataroom')} el={fundraisingEl('tab_dataroom')} compact />
                <Badge variant="secondary" size="sm" className="ml-1.5 rounded-full px-1.5">{docs.length}</Badge>
              </TabsTrigger>
            </TabsList>
            {/* Find investors / Add lead live in the page header actions -
                rendering them here again was the same control twice. */}
          </div>

          <TabsContent value="pipeline" className="mt-4">
            {leads.length === 0 ? (
              <Card className="rounded-xl border-dashed">
                <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                  <CfbGlyph name="people" className="icon-lg text-muted-foreground/50" />
                  <p className="page-section font-semibold"><BilingualText en={fundraisingEn('empty_pipeline_title')} el={fundraisingEl('empty_pipeline_title')} /></p>
                  <p className="max-w-sm text-sm text-muted-foreground"><BilingualText en={fundraisingEn('empty_pipeline_hint')} el={fundraisingEl('empty_pipeline_hint')} /></p>
                  {emptyCta}
                </CardContent>
              </Card>
            ) : (
              <InvestorListView leads={leads} onMove={handleMove} harborLive={harborLive} />
            )}
          </TabsContent>
          <TabsContent value="kanban" className="mt-4">
            <PipelineView leads={leads} onAdd={openAdd} onMove={handleMove} />
          </TabsContent>
          <TabsContent value="dataroom" className="mt-4">
            <DataRoomView docs={docs} onChange={refresh} />
          </TabsContent>
        </Tabs>

        {/* Resources moved to the page rail ('resources' section). */}
        {/* Round size, committed amounts and check sizes appear above. */}
        <NonGuaranteeNote />
      </div>

      {addOpen && (
        <AddLeadModal
          key={addStatus}
          open
          defaultStatus={addStatus}
          onClose={() => setAddOpen(false)}
          onCreated={refresh}
        />
      )}
    </AppShell>
  );
}
