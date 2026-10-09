'use client';

import { StatusText } from '@/components/common/StatusText';
import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlarmClock,
  AlertTriangle,
  ArrowUpDown,
  Ban,
  Bookmark,
  BookmarkX,
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  Clock,
  DollarSign,
  Edit2,
  ExternalLink,
  Filter,
  Flame,
  GitMerge,
  GraduationCap,
  Grid3X3,
  List,
  MapPin,
  MessageCircle,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Square,
  Star,
  Tag,
  Target,
  Trash2,
  TrendingUp,
  User,
  UserCheck,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { RailAction, RailOptions, RailStats } from '@/components/layout/RailParts';
import { usePageRail } from '@/components/layout/PageRailContext';
import { usePopupChat } from '@/contexts/PopupChatContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { bilingualAria } from '@/lib/i18n/format';
import { BilingualText } from '@/components/common/BilingualText';
import { shortlistEn, shortlistEl } from '@/lib/i18n/strings-shortlist';
import { formatDate } from '@/lib/i18n/format';
import { useBilingualString } from '@/lib/i18n/LanguagePreferenceContext';
import { qk } from '@/lib/query-keys';
import { choiceControl, rowOptions, usePageControls, usePageList } from '@/lib/page-controls';
import {
  listShortlist,
  removeFromShortlist,
  updateShortlistNote,
  getRecommendations,
  type ShortlistItem,
} from '@/lib/api';
import { FactLine } from '@/components/common/FactLine';

type ViewMode = 'list' | 'grid';
type SortBy = 'saved_newest' | 'saved_oldest' | 'name_az' | 'match_score';
type RoleFilter = 'all' | 'founder' | 'mentor' | 'investor' | 'cofounder' | 'org';
type StatusLabel = 'hot' | 'follow_up' | 'contacted' | 'not_relevant' | null;

/** The label is a key, so the tab reads in whichever language the reader chose. */
const ROLE_TABS: { value: RoleFilter; key: string; icon: React.ElementType }[] = [
  { value: 'all', key: 'role_all', icon: Bookmark },
  { value: 'founder', key: 'role_founder', icon: Target },
  { value: 'cofounder', key: 'role_cofounder', icon: UserCheck },
  { value: 'mentor', key: 'role_mentor', icon: GraduationCap },
  { value: 'investor', key: 'role_investor', icon: DollarSign },
  { value: 'org', key: 'role_org', icon: Building2 },
];

/**
 * `key` rather than `label`, so the pill reads in the reader's language. The
 * mark is an icon from the product's set: the labels carried emoji (a flame,
 * an alarm clock, a check, a no-entry sign), which render differently on every
 * platform and were the only emoji status marks in the product.
 */
const STATUS_CONFIG: Record<NonNullable<StatusLabel>, { key: string; color: string; icon: React.ElementType }> = {
  hot:          { key: 'status_hot',          color: 'bg-status-danger-bg text-status-danger', icon: Flame },
  follow_up:    { key: 'status_follow_up',    color: 'bg-status-warning-bg text-status-warning', icon: AlarmClock },
  contacted:    { key: 'status_contacted',    color: 'bg-status-success-bg text-status-success', icon: CheckCircle2 },
  not_relevant: { key: 'status_not_relevant', color: 'bg-muted text-muted-foreground', icon: Ban },
};

function ShortlistCardSkeleton({ grid }: { grid?: boolean }) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-4 space-y-3', grid && 'flex flex-col')}>
      <div className="flex items-start gap-3">
        <Skeleton className="h-12 w-12 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-52" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-8 w-full rounded-lg" />
    </div>
  );
}

function NoteEditor({
  initial, onSave, onCancel, isSaving,
}: { initial: string; onSave: (note: string) => void; onCancel: () => void; isSaving?: boolean }) {
  // Visible string slots take the reader's language, not both joined.
  const say = useBilingualString();
  const [value, setValue] = useState(initial);
  return (
    <div className="mt-2 space-y-2">
      <textarea
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={say(shortlistEn('note_placeholder'), shortlistEl('note_placeholder'))}
        rows={2}
        maxLength={500}
        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none resize-none"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => onSave(value)} disabled={isSaving}>
          <Check className="icon-sm" /> {isSaving ? say(shortlistEn('saving'), shortlistEl('saving')) : say(shortlistEn('save'), shortlistEl('save'))}
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>
          <X className="icon-sm mr-1" /> <BilingualText en={shortlistEn('cancel')} el={shortlistEl('cancel')} compact />
        </Button>
      </div>
    </div>
  );
}

function ShortlistCard({
  item, onRemove, onUpdateNote, isSelected, onToggleSelect, compareMode, matchScore,
}: {
  item: ShortlistItem;
  onRemove: (userId: string) => void;
  onUpdateNote: (userId: string, note: string) => Promise<void>;
  isSelected: boolean;
  onToggleSelect: (userId: string) => void;
  compareMode: boolean;
  /** The engine's score for this pairing, when it has one. Undefined is shown
   *  as no badge — never as a number. */
  matchScore?: number;
}) {
  // Visible string slots take the reader's language, not both joined.
  const say = useBilingualString();
  const [editingNote, setEditingNote] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [statusLabel, setStatusLabel] = useState<StatusLabel>(null);
  const profile = item.profile;

  async function handleSaveNote(note: string) {
    setSavingNote(true);
    try { await onUpdateNote(item.userId, note); setEditingNote(false); }
    finally { setSavingNote(false); }
  }


  return (
    <div className={cn(
      'group rounded-xl border bg-card p-4 transition-all hover:shadow-sm',
      isSelected ? 'border-primary ring-1 ring-primary/30' : 'border-border hover:border-border',
    )}>
      <div className="flex items-start gap-3">
        {/* Checkbox (compare mode) */}
        {compareMode && (
          <button
            type="button"
            role="checkbox"
            aria-checked={isSelected}
            aria-label={bilingualAria(`Compare ${profile?.displayName ?? 'this profile'}`, `Σύγκριση: ${profile?.displayName ?? 'αυτό το προφίλ'}`)}
            onClick={() => onToggleSelect(item.userId)}
            className="mt-1 shrink-0"
          >
            {isSelected
              ? <CheckSquare className="icon-sm text-muted-foreground" />
              : <Square className="icon-sm text-muted-foreground" />}
          </button>
        )}

        {/* Avatar */}
        <Link
          href={`/profiles/${item.userId}`}
          className="shrink-0"
          aria-label={profile?.displayName || say(shortlistEn('view_profile'), shortlistEl('view_profile'))}
        >
          {profile?.avatarUrl ? (
            <img src={profile.avatarUrl} alt={profile.displayName ?? ''} className="h-10 w-10 rounded-full object-cover ring-2 ring-border/50 hover:ring-primary/40 transition-all" loading="lazy" decoding="async" referrerPolicy="no-referrer" width={40} height={40} />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted ring-2 ring-border/50">
              <User className="icon-md text-muted-foreground" />
            </div>
          )}
        </Link>

        {/* Details */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link href={`/profiles/${item.userId}`} className="text-sm font-semibold text-foreground hover:text-primary-accessible transition-colors">
                  {profile?.displayName ?? 'Unknown'}
                </Link>
                {/* Match score badge — only for pairings the engine has scored. */}
                {matchScore != null && (
                  <span className={cn(
                    'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-2xs font-semibold',
                    matchScore >= 85 ? 'bg-status-success-bg text-status-success'
                      : matchScore >= 70 ? 'bg-status-info-bg text-status-info'
                      : 'bg-muted text-muted-foreground',
                  )}>
                    <Sparkles className="h-2.5 w-2.5" />
                    {matchScore}%{' '}
                    <BilingualText en={shortlistEn('match_suffix')} el={shortlistEl('match_suffix')} compact />
                  </span>
                )}
                {statusLabel && (
                  <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium', STATUS_CONFIG[statusLabel].color)}>
                    {(() => { const Icon = STATUS_CONFIG[statusLabel].icon; return <Icon className="h-3 w-3" aria-hidden="true" />; })()}
                    <BilingualText
                      en={shortlistEn(STATUS_CONFIG[statusLabel].key)}
                      el={shortlistEl(STATUS_CONFIG[statusLabel].key)}
                      compact
                    />
                  </span>
                )}
              </div>
              {profile?.headline && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{profile.headline}</p>}
              {(profile?.role || profile?.location) && (
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  {profile?.role && (
                    <div className="flex items-center gap-1 text-2xs text-muted-foreground">
                      <Briefcase className="icon-sm" />
                      <span ><StatusText value={profile.role} /></span>
                    </div>
                  )}
                  {profile?.location && (
                    <div className="flex items-center gap-1 text-2xs text-muted-foreground">
                      <MapPin className="icon-sm" />
                      {profile.location}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions — quiet but always visible: hover-only controls do not
                exist on touch, and a saved person is not a guessing game. */}
            <div className="flex items-center gap-1 shrink-0 transition-opacity">
              <button onClick={() => setEditingNote((v) => !v)} title={say(shortlistEn('note_edit'), shortlistEl('note_edit'))} aria-label={say(shortlistEn('note_edit'), shortlistEl('note_edit'))} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                <Edit2 className="icon-sm" />
              </button>
              <Link href={`/messages?to=${item.userId}`} title={say(shortlistEn('message'), shortlistEl('message'))} aria-label={say(shortlistEn('message'), shortlistEl('message'))} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                <MessageCircle className="icon-sm" />
              </Link>
              <Link href={`/profiles/${item.userId}`} title={say(shortlistEn('view_profile'), shortlistEl('view_profile'))} aria-label={say(shortlistEn('view_profile'), shortlistEl('view_profile'))} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                <ExternalLink className="icon-sm" />
              </Link>
              <button onClick={() => onRemove(item.userId)} title={say(shortlistEn('remove'), shortlistEl('remove'))} aria-label={say(shortlistEn('remove'), shortlistEl('remove'))} className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive-accessible transition-colors">
                <Trash2 className="icon-sm" />
              </button>
            </div>
          </div>

          {/* Skills */}
          {profile?.skills && profile.skills.length > 0 && (
            <FactLine className="mt-2" items={[...profile.skills.slice(0, 5), profile.skills.length > 5 ? `+${profile.skills.length - 5}` : null]} />
          )}

          {/* Working state: the label the reader gave this person, their note
              and the housekeeping line are their own band, not a fourth stray
              row under the identity block. */}
          <div className="mt-3 space-y-2 border-t border-border/60 pt-2.5">
            {/* Status label picker */}
            <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label={bilingualAria(shortlistEn('label'), shortlistEl('label'))}>
              <span className="text-2xs text-muted-foreground font-medium"><BilingualText en={shortlistEn('label')} el={shortlistEl('label')} compact /></span>
              {(Object.entries(STATUS_CONFIG) as [NonNullable<StatusLabel>, typeof STATUS_CONFIG[NonNullable<StatusLabel>]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  aria-pressed={statusLabel === key}
                  onClick={() => setStatusLabel(statusLabel === key ? null : key)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs transition-all',
                    statusLabel === key ? cfg.color : 'border-border text-muted-foreground hover:border-border',
                  )}
                >
                  <cfg.icon className="h-3 w-3" aria-hidden="true" />
                  <BilingualText en={shortlistEn(cfg.key)} el={shortlistEl(cfg.key)} compact />
                </button>
              ))}
            </div>

            {/* Note */}
            {!editingNote && item.note && (
              <div className="flex items-start gap-1.5 rounded-lg bg-muted/50 px-3 py-2">
                <Tag className="mt-0.5 icon-sm shrink-0 text-muted-foreground" />
                <p className="text-xs text-foreground/80 flex-1">{item.note}</p>
              </div>
            )}
            {editingNote && (
              <NoteEditor initial={item.note ?? ''} onSave={handleSaveNote} onCancel={() => setEditingNote(false)} isSaving={savingNote} />
            )}

            {/* Footer */}
            <div className="flex items-center justify-between">
            <p className="text-2xs text-muted-foreground flex items-center gap-1">
              <Clock className="icon-sm" />
              {/* The date itself stays pinned to UTC, as every date in the
                  product is; only the word around it changes language. */}
              <BilingualText
                en={shortlistEn('saved_on').replace('{date}', formatDate(item.savedAt, 'en'))}
                el={shortlistEl('saved_on').replace('{date}', formatDate(item.savedAt, 'el'))}
                compact
              />
            </p>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" className="h-6 gap-1 text-2xs px-2 text-muted-foreground hover:text-foreground" asChild>
                <Link href={`/matches/compare?ids=${item.userId}`}>
                  <GitMerge className="icon-sm" /> <BilingualText en={shortlistEn('compare')} el={shortlistEl('compare')} compact />
                </Link>
              </Button>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ShortlistPage() {
  // Visible string slots take the reader's language, not both joined.
  const say = useBilingualString();
  const qc = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('saved_newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { openRailSection } = usePageRail();
  const { ask } = usePopupChat();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: qk('shortlist'),
    queryFn: () => listShortlist({ limit: 100 }),
    staleTime: 30_000,
  });

  const rawItems = data?.items ?? [];

  /*
   * Match scores come from the engine's own recommendation pass — the same
   * numbers the /matches cards show — rather than being generated here. The
   * row that used to carry `Math.floor(60 + Math.random() * 35)` showed a
   * different percentage on every render and disagreed with /matches about
   * the same person. People the engine has not scored simply get no badge.
   */
  const { data: recommended } = useQuery({
    queryKey: qk('recommendations', 'for-shortlist'),
    queryFn: () => getRecommendations({ limit: 100 }),
    staleTime: 5 * 60_000,
    retry: 0,
  });

  const matchScores = useMemo(() => {
    const map = new Map<string, number>();
    for (const hit of recommended?.suggestions ?? []) {
      if (hit.matchScore != null) map.set(hit.userId, hit.matchScore);
    }
    return map;
  }, [recommended]);

  const filtered = useMemo(() => {
    let items = [...rawItems];
    if (roleFilter !== 'all') {
      items = items.filter((i) => {
        const r = i.profile?.role ?? '';
        if (roleFilter === 'founder') return r.includes('founder') || r === 'existing_founder' || r === 'aspiring_founder';
        if (roleFilter === 'cofounder') return r.includes('cofounder') || r === 'technical_talent';
        if (roleFilter === 'mentor') return r === 'mentor' || r === 'advisor' || r === 'coach';
        if (roleFilter === 'investor') return r.includes('investor') || r === 'angel_investor' || r === 'vc_analyst' || r === 'vc_scout';
        if (roleFilter === 'org') return r.includes('admin') || r.includes('org');
        return true;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter((i) =>
        (i.profile?.displayName ?? '').toLowerCase().includes(q) ||
        (i.profile?.headline ?? '').toLowerCase().includes(q) ||
        (i.profile?.location ?? '').toLowerCase().includes(q) ||
        (i.profile?.skills ?? []).some((s) => s.toLowerCase().includes(q))
      );
    }
    if (sortBy === 'name_az') items.sort((a, b) => (a.profile?.displayName ?? '').localeCompare(b.profile?.displayName ?? ''));
    else if (sortBy === 'saved_oldest') items.sort((a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime());
    // "Sort by match score" used to fall through to this default, so the option
    // did nothing. Unscored pairings sort last rather than as zero.
    else if (sortBy === 'match_score') {
      items.sort((a, b) => (matchScores.get(b.userId) ?? -1) - (matchScores.get(a.userId) ?? -1));
    }
    else items.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
    return items;
  }, [rawItems, roleFilter, searchQuery, sortBy, matchScores]);

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = { all: rawItems.length };
    rawItems.forEach((i) => {
      const r = i.profile?.role ?? 'unknown';
      if (r.includes('founder')) counts.founder = (counts.founder ?? 0) + 1;
      if (r.includes('cofounder') || r === 'technical_talent') counts.cofounder = (counts.cofounder ?? 0) + 1;
      if (r === 'mentor' || r === 'advisor' || r === 'coach') counts.mentor = (counts.mentor ?? 0) + 1;
      if (r.includes('investor') || r === 'vc_scout' || r === 'vc_analyst') counts.investor = (counts.investor ?? 0) + 1;
      if (r.includes('admin')) counts.org = (counts.org ?? 0) + 1;
    });
    return counts;
  }, [rawItems]);

  const removeMut = useMutation({
    mutationFn: removeFromShortlist,
    onMutate: async (userId) => {
      await qc.cancelQueries({ queryKey: qk('shortlist') });
      qc.setQueryData(qk('shortlist'), (old: typeof data) => ({
        ...old, items: (old?.items ?? []).filter((i) => i.userId !== userId),
      }));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk('shortlist') }),
  });

  const handleUpdateNote = useCallback(async (userId: string, note: string) => {
    await updateShortlistNote(userId, note);
    qc.setQueryData(qk('shortlist'), (old: typeof data) => ({
      ...old, items: (old?.items ?? []).map((i) => i.userId === userId ? { ...i, note } : i),
    }));
  }, [qc]);

  const handleRemove = useCallback((userId: string) => removeMut.mutate(userId), [removeMut]);

  const toggleSelect = useCallback((userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else if (next.size < 3) next.add(userId);
      return next;
    });
  }, []);

  /*
   * "Average match" was the constant '74%' on any non-empty shortlist. It is
   * the mean of the engine's scores for the people saved here, over the ones
   * it has scored; a dash when it has scored none.
   */
  const scoredSaved = rawItems.map((i) => matchScores.get(i.userId)).filter((n): n is number => n != null);
  const avgMatch = scoredSaved.length ? Math.round(scoredSaved.reduce((a, b) => a + b, 0) / scoredSaved.length) : null;

  // Offered to the assistant: role, sort, layout and compare, and each
  // card's Remove - the same setters and mutation.
  usePageList([
    {
      id: 'shortlist',
      labelEn: 'Saved profiles',
      labelEl: 'Αποθηκευμένα προφίλ',
      rows: isLoading ? undefined : filtered.map((i) => {
        const score = matchScores.get(i.userId);
        return `${i.profile?.displayName ?? 'Member'} · ${i.profile?.role ?? 'member'}${i.profile?.headline ? ` · ${i.profile.headline}` : ''}${score != null ? ` · match ${score}%` : ''}${i.note ? ` · note: ${i.note}` : ''}`;
      }),
      total: rawItems.length,
    },
  ]);
  usePageControls([
    choiceControl('role_filter', 'Role filter', 'Φίλτρο ρόλου', ROLE_TABS.map((t) => ({ value: t.value, en: shortlistEn(t.key), el: shortlistEl(t.key) })), roleFilter, (v) => setRoleFilter(v as RoleFilter)),
    choiceControl('sort', 'Sort saved profiles', 'Ταξινόμηση αποθηκευμένων', [
      { value: 'saved_newest', en: shortlistEn('sort_newest'), el: shortlistEl('sort_newest') },
      { value: 'saved_oldest', en: shortlistEn('sort_oldest'), el: shortlistEl('sort_oldest') },
      { value: 'name_az', en: shortlistEn('sort_name'), el: shortlistEl('sort_name') },
      { value: 'match_score', en: shortlistEn('sort_match'), el: shortlistEl('sort_match') },
    ], sortBy, (v) => setSortBy(v as SortBy)),
    choiceControl('view', 'Shortlist layout', 'Διάταξη λίστας', [
      { value: 'list', en: 'List', el: 'Λίστα' },
      { value: 'grid', en: 'Grid', el: 'Πλέγμα' },
    ], viewMode, (v) => setViewMode(v as ViewMode)),
    choiceControl('compare_mode', 'Compare mode', 'Λειτουργία σύγκρισης', [
      { value: 'off', en: 'Off', el: 'Ανενεργή' },
      { value: 'on', en: 'On', el: 'Ενεργή' },
    ], compareMode ? 'on' : 'off', (v) => { setCompareMode(v === 'on'); if (v !== 'on') setSelectedIds(new Set()); }),
    { id: 'remove_saved', labelEn: 'Remove from shortlist', labelEl: 'Αφαίρεση από τα αποθηκευμένα', writes: true, options: rowOptions(filtered, (i) => i.userId, (i) => i.profile?.displayName ?? 'Member'), run: async (v) => { if (v) await removeMut.mutateAsync(v); } },
  ]);

  /*
   * The column leads with the search, the sort, the layout and compare, and
   * the saved people. The four figures and the role filter are auxiliary, so
   * they live in the rail.
   */
  const rail: PageRailSection[] = [
    {
      id: 'summary',
      glyph: 'bookmark',
      labelEn: 'Your shortlist',
      labelEl: 'Η λίστα σας',
      content: (
        <RailStats
          items={[
            { key: 'stat_total', label: shortlistEn('stat_total'), labelEl: shortlistEl('stat_total'), value: rawItems.length, icon: Bookmark, tone: 'bg-primary/10 text-primary-accessible' },
            { key: 'stat_notes', label: shortlistEn('stat_notes'), labelEl: shortlistEl('stat_notes'), value: rawItems.filter((i) => i.note).length, icon: Tag, tone: 'bg-status-warning-bg text-status-warning' },
            { key: 'stat_avg_match', label: shortlistEn('stat_avg_match'), labelEl: shortlistEl('stat_avg_match'), value: avgMatch == null ? '—' : `${avgMatch}%`, icon: Sparkles, tone: 'bg-status-success-bg text-status-success' },
            { key: 'stat_roles', label: shortlistEn('stat_roles'), labelEl: shortlistEl('stat_roles'), value: new Set(rawItems.map((i) => i.profile?.role)).size, icon: TrendingUp, tone: 'bg-status-info-bg text-status-info' },
          ]}
        />
      ),
    },
    {
      id: 'filters',
      glyph: 'sliders',
      labelEn: 'Filters',
      labelEl: 'Φίλτρα',
      badge: roleFilter !== 'all' ? 1 : null,
      content: (
        <div className="space-y-4">
          <RailOptions
            title="Role"
            titleEl="Ρόλος"
            options={ROLE_TABS.map(({ value, key, icon }) => ({ value, en: shortlistEn(key), el: shortlistEl(key), icon, count: roleCounts[value] }))}
            value={roleFilter}
            onChange={setRoleFilter}
          />
          {roleFilter !== 'all' && (
            <RailAction icon={X} en="Clear filters" el="Καθαρισμός φίλτρων" onClick={() => setRoleFilter('all')} />
          )}
        </div>
      ),
    },
  ];

  return (
    <AppShell
      showHelp
      rail={rail}
      askAi="I have saved profiles. Who should I reach out to first, and what should I write?"
      title={shortlistEn('page_title')}
      titleEl={shortlistEl('page_title')}
      description={shortlistEn('page_description')}
      descriptionEl={shortlistEl('page_description')}
    >
      <div className="space-y-6 pb-10">

        {/* Toolbar */}
        <div className="space-y-3">
          {/* Search + sort + view */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder={say(shortlistEn('search_placeholder'), shortlistEl('search_placeholder'))}
                aria-label={say(shortlistEn('search_placeholder'), shortlistEl('search_placeholder'))}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
              {/* w-44 is 176px, and "Newest first · Νεότερα πρώτα" is 76px past that. */}
              <SelectTrigger aria-label={bilingualAria('Sort by', 'Ταξινόμηση')} className="h-9 w-auto min-w-[11rem] text-sm">
                <ArrowUpDown className="mr-1.5 icon-sm text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="saved_newest"><BilingualText en={shortlistEn('sort_newest')} el={shortlistEl('sort_newest')} compact /></SelectItem>
                <SelectItem value="saved_oldest"><BilingualText en={shortlistEn('sort_oldest')} el={shortlistEl('sort_oldest')} compact /></SelectItem>
                <SelectItem value="name_az"><BilingualText en={shortlistEn('sort_name')} el={shortlistEl('sort_name')} compact /></SelectItem>
                <SelectItem value="match_score"><BilingualText en={shortlistEn('sort_match')} el={shortlistEl('sort_match')} compact /></SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center rounded-lg border border-border p-0.5">
              <button type="button" aria-label={bilingualAria('List view', 'Προβολή λίστας')} aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')} className={cn('rounded-xl p-1.5 transition-colors', viewMode === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                <List className="icon-sm" aria-hidden="true" />
              </button>
              <button type="button" aria-label={bilingualAria('Grid view', 'Προβολή πλέγματος')} aria-pressed={viewMode === 'grid'} onClick={() => setViewMode('grid')} className={cn('rounded-xl p-1.5 transition-colors', viewMode === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                <Grid3X3 className="icon-sm" aria-hidden="true" />
              </button>
            </div>
            <Button
              variant={compareMode ? 'default' : 'outline'}
              size="sm"
              className="h-9 gap-1.5"
              onClick={() => { setCompareMode((v) => !v); setSelectedIds(new Set()); }}
            >
              <GitMerge className="icon-sm" />
              <BilingualText
                en={shortlistEn(compareMode ? 'compare_cancel' : 'compare_start')}
                el={shortlistEl(compareMode ? 'compare_cancel' : 'compare_start')}
                compact
              />
            </Button>
          </div>

        </div>

        {/* Compare action bar */}
        {compareMode && selectedIds.size >= 2 && (
          <div className="flex items-center justify-between rounded-xl border border-primary/15 bg-primary/5 px-4 py-3">
            <p className="text-sm font-medium text-foreground">
              <BilingualText
                en={shortlistEn('selected_max').replace('{n}', String(selectedIds.size))}
                el={shortlistEl('selected_max').replace('{n}', String(selectedIds.size))}
                compact
              />
            </p>
            <Button size="sm" className="gap-1.5" asChild>
              <Link href={`/matches/compare?ids=${Array.from(selectedIds).join(',')}`}>
                <GitMerge className="icon-sm" /><BilingualText en={shortlistEn('compare_now')} el={shortlistEl('compare_now')} compact /></Link>
            </Button>
          </div>
        )}

        {/* Content */}
        {isError ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card py-16 text-center">
            <AlertTriangle className="icon-xl text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground"><BilingualText en={shortlistEn('load_failed')} el={shortlistEl('load_failed')} compact /></p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}><BilingualText en={shortlistEn('retry')} el={shortlistEl('retry')} compact /></Button>
          </div>
        ) : isLoading ? (
          <div className={cn('gap-3', viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2' : 'space-y-3')}>
            {Array.from({ length: 4 }).map((_, i) => <ShortlistCardSkeleton key={i} grid={viewMode === 'grid'} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card/50 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <BookmarkX className="h-7 w-7 text-primary-accessible" />
            </div>
            <div>
              <p className="font-medium text-foreground">
                {rawItems.length === 0
                  ? <BilingualText en="No saved profiles yet" el="Δεν υπάρχουν αποθηκευμένα προφίλ ακόμα" />
                  : <BilingualText en="No profiles match" el="Κανένα προφίλ δεν ταιριάζει" />}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {rawItems.length === 0
                  ? <BilingualText en="Save profiles from Matches or Members to revisit them here." el="Αποθηκεύστε προφίλ από τις Αντιστοιχίσεις ή τα Μέλη για να τα βρίσκετε εδώ." wrap />
                  : roleFilter !== 'all'
                    ? <BilingualText en="The role filter in the side panel may be hiding people." el="Το φίλτρο ρόλου στο πλευρικό πάνελ ίσως κρύβει άτομα." wrap />
                    : <BilingualText en="Try a different search." el="Δοκιμάστε διαφορετική αναζήτηση." wrap />}
              </p>
            </div>
            {rawItems.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {roleFilter !== 'all' && (
                  <Button size="sm" variant="secondary" onClick={() => openRailSection('filters')}>
                    <BilingualText en="Show filters" el="Εμφάνιση φίλτρων" compact />
                  </Button>
                )}
                {searchQuery && (
                  <Button size="sm" variant="ghost" onClick={() => setSearchQuery('')}>
                    <BilingualText en="Clear search" el="Καθαρισμός αναζήτησης" compact />
                  </Button>
                )}
              </div>
            )}
            {rawItems.length === 0 && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button size="sm" className="gap-1.5" asChild>
                  <Link href="/matches"><BilingualText en={shortlistEn('browse_matches')} el={shortlistEl('browse_matches')} compact /></Link>
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" type="button" onClick={() => ask('I have no saved profiles. Who from my matches should I shortlist first?')}>
                  <Sparkles className="h-3.5 w-3.5 text-status-accent" aria-hidden="true" />
                  <BilingualText en="Ask AI" el="Ρωτήστε το AI" compact />
                </Button>
              </div>
            )}
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              <BilingualText
                en={shortlistEn('showing_of').replace('{shown}', String(filtered.length)).replace('{total}', String(rawItems.length))}
                el={shortlistEl('showing_of').replace('{shown}', String(filtered.length)).replace('{total}', String(rawItems.length))}
                compact
              />
            </p>
            <div className={cn(viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : 'space-y-3')}>
              {filtered.map((item) => (
                <ShortlistCard
                  key={item.id}
                  item={item}
                  onRemove={handleRemove}
                  onUpdateNote={handleUpdateNote}
                  isSelected={selectedIds.has(item.userId)}
                  onToggleSelect={toggleSelect}
                  compareMode={compareMode}
                  matchScore={matchScores.get(item.userId)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
