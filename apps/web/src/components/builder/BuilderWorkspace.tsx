'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowRight,
  AlertCircle,
  ChevronRight,
  MoreHorizontal,
  Trash2,
  Crown,
  Eye,
  Edit2,
  MessageSquare,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn, initialsOf } from '@/lib/utils';
import { STATUS, type StatusTone } from '@/lib/semantic-colors';
import { useBuilder } from '@/contexts/BuilderContext';
import { ActivityTimeline } from './ActivityTimeline';
import { useToast } from '@/components/ui/toast';
import type { BuilderDocument } from '@/lib/builder-api';
import { BilingualText } from '@/components/common/BilingualText';
import { PageRail, type PageRailSection } from '@/components/layout/PageRail';
import { CfbGlyph, type CfbGlyphName } from '@/components/icons/CfbGlyph';
import { BUILDER_BTN, BUILDER_STAT, BUILDER_STAT_LABEL, BuilderAskAiButton } from './BuilderStageChrome';
import {
  builderEn,
  builderEl,
  builderDocLabel,
  builderDocLabelGenitiveEl,
  builderDocDescription,
  builderDocTitleEl,
  BUILDER_DOC_TYPES,
  BUILDER_PREVIEW_HINT_EL,
} from '@/lib/i18n/strings-builder';
import { bilingualInline, bilingualAria } from '@/lib/i18n/format';
import {
  resolveBilingualPair,
  useLanguagePreference,
} from '@/lib/i18n/LanguagePreferenceContext';
import { AIInsightButton } from '@/components/ai/AIInsightButton';

function PreviewHint({ text }: { text: string }) {
  const el = BUILDER_PREVIEW_HINT_EL[text];
  if (!el) return <>{text}</>;
  return <BilingualText en={text} el={el} wrap />;
}

const MOBILE_DIALOG =
  'max-md:top-[max(0.5rem,env(safe-area-inset-top))] max-md:translate-y-0';

// ── Document type metadata ─────────────────────────────────────────────────

const DOC_GLYPH: Record<string, CfbGlyphName> = {
  idea_core: 'spark',
  business_model_canvas: 'target',
  market_analysis: 'chart',
  pitch_deck: 'builder',
  mvp_plan: 'flag',
  technical_architecture: 'sliders',
  financial_plan: 'wallet',
  prd: 'book',
  branding_kit: 'spark',
  application: 'applications',
  swot_analysis: 'chart',
  lean_canvas: 'target',
  competitive_analysis: 'shield',
  go_to_market: 'flag',
  fundraising_memo: 'wallet',
  product_roadmap: 'flag',
};

const DEFAULT_DOC_TYPES = [
  'idea_core', 'business_model_canvas', 'market_analysis', 'pitch_deck',
  'mvp_plan', 'financial_plan',
] as const;

function docGlyph(type: string): CfbGlyphName {
  return DOC_GLYPH[type] ?? 'book';
}

function docLabelEn(type: string) {
  return builderDocLabel(type, 'en');
}

/**
 * The nominative, for a name standing on its own (a tab, a card title).
 */
function docLabelEl(type: string) {
  return builderDocLabel(type, 'el');
}

// ── Role display helpers ───────────────────────────────────────────────────

const ROLE_META: Record<string, { labelKey: 'role_owner' | 'role_editor_short' | 'role_commenter_short' | 'role_viewer_short'; tone: StatusTone; icon: LucideIcon }> = {
  owner:     { labelKey: 'role_owner',           tone: 'warning', icon: Crown },
  editor:    { labelKey: 'role_editor_short',    tone: 'info',    icon: Edit2 },
  commenter: { labelKey: 'role_commenter_short', tone: 'accent',  icon: MessageSquare },
  viewer:    { labelKey: 'role_viewer_short',    tone: 'neutral', icon: Eye },
};

function roleChip(role: string) {
  return STATUS[ROLE_META[role]?.tone ?? 'neutral'].chip;
}

function docStatus(doc: BuilderDocument): 'not-started' | 'in-progress' | 'reviewed' | 'completed' {
  if (doc.status === 'approved') return 'completed';
  if (doc.status === 'review') return 'reviewed';
  if (doc.status === 'in_progress' || (doc.status === 'draft' && doc.completionPercent > 0)) return 'in-progress';
  return 'not-started';
}

function statusColor(s: string) {
  switch (s) {
    case 'completed': return 'bg-status-success-mark';
    case 'in-progress': return 'bg-status-warning-mark';
    case 'reviewed': return 'bg-status-info-mark';
    default: return 'bg-muted-foreground/30';
  }
}

function statusKey(s: string): 'status_completed' | 'status_in_progress' | 'status_reviewed' | 'status_not_started' {
  switch (s) {
    case 'completed': return 'status_completed';
    case 'in-progress': return 'status_in_progress';
    case 'reviewed': return 'status_reviewed';
    default: return 'status_not_started';
  }
}

function statusTone(s: string): StatusTone {
  switch (s) {
    case 'completed': return 'success';
    case 'in-progress': return 'warning';
    case 'reviewed': return 'info';
    default: return 'neutral';
  }
}

function readinessLevelKey(level: string | undefined): 'ready_level_ready' | 'ready_level_developing' | 'ready_level_early' | null {
  if (level === 'ready') return 'ready_level_ready';
  if (level === 'developing') return 'ready_level_developing';
  if (level === 'early') return 'ready_level_early';
  return null;
}

function readinessStatusKey(status: string): 'ready_st_exc' | 'ready_st_good' | 'ready_st_work' | 'ready_st_crit' | null {
  if (status === 'excellent') return 'ready_st_exc';
  if (status === 'good') return 'ready_st_good';
  if (status === 'needs-work') return 'ready_st_work';
  if (status === 'critical') return 'ready_st_crit';
  return null;
}

function visibilityKey(v: string): 'visibility_private' | 'visibility_team' | 'visibility_organization' | 'visibility_public' | null {
  if (v === 'private') return 'visibility_private';
  if (v === 'team') return 'visibility_team';
  if (v === 'organization') return 'visibility_organization';
  if (v === 'public') return 'visibility_public';
  return null;
}

/** The title as the Greek page names it: product-written titles translate, founder-written ones stay. */
function DocTitle({ title, wrap = false }: { title: string; wrap?: boolean }) {
  const el = builderDocTitleEl(title);
  if (!el || el === title) return <>{title}</>;
  return <BilingualText en={title} el={el} compact wrap={wrap} />;
}

const BUILDER_REVIEW_DISMISS_KEY = 'cfb_builder_review_dismissed_v1';

function dimensionKey(d: string): 'dim_team' | 'dim_market' | 'dim_product' | 'dim_business' | 'dim_funding' | 'dim_execution' | null {
  const map: Record<string, 'dim_team' | 'dim_market' | 'dim_product' | 'dim_business' | 'dim_funding' | 'dim_execution'> = {
    team: 'dim_team', market: 'dim_market', product: 'dim_product',
    business: 'dim_business', funding: 'dim_funding', execution: 'dim_execution',
  };
  return map[d] ?? null;
}

function DimensionLabel({ d }: { d: string }) {
  const key = dimensionKey(d);
  if (!key) return <span>{d}</span>;
  return <BilingualText en={builderEn(key)} el={builderEl(key)} compact />;
}

function dimensionColor(score: number) {
  if (score >= 80) return STATUS.success.text;
  if (score >= 60) return STATUS.info.text;
  if (score >= 40) return STATUS.warning.text;
  return STATUS.danger.text;
}

function readinessStatusText(status: string) {
  if (status === 'excellent' || status === 'good') return STATUS.success.text;
  if (status === 'needs-work') return STATUS.warning.text;
  if (status === 'critical') return STATUS.danger.text;
  return 'text-muted-foreground';
}

/** Same reading as the document list: a draft with anything in it is in progress. */
function docStatusChip(doc: BuilderDocument) {
  switch (docStatus(doc)) {
    case 'completed': return STATUS.success.chip;
    case 'reviewed': return STATUS.info.chip;
    case 'in-progress': return STATUS.warning.chip;
    default: return STATUS.neutral.chip;
  }
}

function usePrimaryText() {
  const { primary, showSecondary } = useLanguagePreference();
  return (en: string, el: string) => resolveBilingualPair(en, el, primary, showSecondary).primaryText;
}

// ── Invite Collaborator Dialog ─────────────────────────────────────────────

interface InviteDialogProps {
  open: boolean;
  onClose: () => void;
  onInvite: (userId: string, role: string) => Promise<void>;
}

function InviteCollaboratorDialog({ open, onClose, onInvite }: InviteDialogProps) {
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('viewer');
  const [loading, setLoading] = useState(false);
  const t = usePrimaryText();

  const handleSubmit = async () => {
    if (!userId.trim()) return;
    setLoading(true);
    try {
      await onInvite(userId.trim(), role);
      setUserId('');
      setRole('viewer');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={MOBILE_DIALOG}>
        <DialogHeader>
          <DialogTitle>
            <BilingualText en={builderEn('invite_title')} el={builderEl('invite_title')} />
          </DialogTitle>
          <DialogDescription>
            <BilingualText en={builderEn('invite_desc')} el={builderEl('invite_desc')} />
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="invite-user">
              <BilingualText en={builderEn('user_id')} el={builderEl('user_id')} compact />
            </Label>
            <Input
              id="invite-user"
              placeholder={t(builderEn('user_ph'), builderEl('user_ph'))}
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              aria-label={bilingualAria(builderEn('user_id'), builderEl('user_id'))}
              className="min-h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-role">
              <BilingualText en={builderEn('role')} el={builderEl('role')} compact />
            </Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="invite-role" className="min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="editor">{t(builderEn('role_editor'), builderEl('role_editor'))}</SelectItem>
                <SelectItem value="commenter">{t(builderEn('role_commenter'), builderEl('role_commenter'))}</SelectItem>
                <SelectItem value="viewer">{t(builderEn('role_viewer'), builderEl('role_viewer'))}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="min-h-11 w-full sm:w-auto" onClick={onClose}>
            <BilingualText en={builderEn('cancel')} el={builderEl('cancel')} compact />
          </Button>
          <Button className="min-h-11 w-full sm:w-auto" onClick={handleSubmit} disabled={loading || !userId.trim()}>
            {loading && <Loader2 className="icon-sm mr-2 animate-spin" />}
            <BilingualText en={builderEn('send_invite')} el={builderEl('send_invite')} compact />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Create Document Dialog ─────────────────────────────────────────────────

interface CreateDocDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (type: string, title: string) => Promise<void>;
}

function CreateDocumentDialog({ open, onClose, onCreate }: CreateDocDialogProps) {
  const [docType, setDocType] = useState('custom');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const t = usePrimaryText();

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      await onCreate(docType, title.trim());
      setTitle('');
      setDocType('custom');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={MOBILE_DIALOG}>
        <DialogHeader>
          <DialogTitle>
            <BilingualText en={builderEn('create_doc')} el={builderEl('create_doc')} />
          </DialogTitle>
          <DialogDescription>
            <BilingualText en={builderEn('create_doc_desc')} el={builderEl('create_doc_desc')} />
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="docType">
              <BilingualText en={builderEn('doc_type')} el={builderEl('doc_type')} compact />
            </Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger id="docType" aria-label={builderEn('doc_type')} className="min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(BUILDER_DOC_TYPES).map((k) => (
                  <SelectItem key={k} value={k}>{t(docLabelEn(k), docLabelEl(k))}</SelectItem>
                ))}
                <SelectItem value="custom">{t(builderEn('custom_doc'), builderEl('custom_doc'))}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="title">
              <BilingualText en={builderEn('title')} el={builderEl('title')} compact />
            </Label>
            <Input id="title"
              placeholder={t(builderEn('title_ph'), builderEl('title_ph'))}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              aria-label={bilingualAria(builderEn('title'), builderEl('title'))}
              className="min-h-11"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="min-h-11 w-full sm:w-auto" onClick={onClose}>
            <BilingualText en={builderEn('cancel')} el={builderEl('cancel')} compact />
          </Button>
          <Button className="min-h-11 w-full sm:w-auto" onClick={handleSubmit} disabled={loading || !title.trim()}>
            {loading && <Loader2 className="icon-sm mr-2 animate-spin" />}
            <BilingualText en={builderEn('create')} el={builderEl('create')} compact />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main BuilderWorkspace Component ───────────────────────────────────────

const DOC_TO_TAB: Record<string, string> = {
  idea_core: 'idea-core',
  business_model_canvas: 'bmc',
  market_analysis: 'market',
  pitch_deck: 'pitch-deck',
  mvp_plan: 'mvp',
  financial_plan: 'financials',
  application: 'applications',
};

export type BuilderWorkspaceDialog = 'invite' | 'create' | null;

export function BuilderWorkspace({
  onOpenStage,
  dialog,
  onDialogChange,
  extraRailSections,
}: {
  onOpenStage?: (tab: string) => void;
  /** Controlled from the page, whose context bar carries Invite and New document. */
  dialog?: BuilderWorkspaceDialog;
  onDialogChange?: (next: BuilderWorkspaceDialog) => void;
  /**
   * Page-level rail sections merged after this workspace's own, so the page
   * renders one rail instead of a second <PageRail> stacked at right:0.
   */
  extraRailSections?: PageRailSection[];
} = {}) {
  const {
    workspace,
    documents,
    collaborators,
    readinessAssessment,
    isLoadingWorkspaces,
    isLoadingDocuments,
    assessReadiness,
    createDocument,
    addCollaborator,
    removeCollaborator,
    selectDocument,
  } = useBuilder();

  const { success, error: toastError } = useToast();
  const [localDialog, setLocalDialog] = useState<BuilderWorkspaceDialog>(null);
  const openDialog = dialog === undefined ? localDialog : dialog;
  const setDialog = onDialogChange ?? setLocalDialog;
  const showInviteDialog = openDialog === 'invite';
  const showCreateDocDialog = openDialog === 'create';
  const setShowInviteDialog = (open: boolean) => setDialog(open ? 'invite' : null);
  const setShowCreateDocDialog = (open: boolean) => setDialog(open ? 'create' : null);
  const [assessingReadiness, setAssessingReadiness] = useState(false);
  // Hidden until storage is read, so a dismissed nudge does not flash back.
  const [reviewDismissed, setReviewDismissed] = useState(true);

  useEffect(() => {
    setReviewDismissed(localStorage.getItem(BUILDER_REVIEW_DISMISS_KEY) === 'true');
  }, []);

  // Auto-assess readiness when workspace loads and no assessment exists
  useEffect(() => {
    if (workspace && !readinessAssessment && !assessingReadiness) {
      setAssessingReadiness(true);
      assessReadiness().finally(() => setAssessingReadiness(false));
    }
  }, [workspace?.id]);

  // ── Derived stats ────────────────────────────────────────────────────────

  // Every count on the page derives from `docStatus`, so the review nudge, the
  // rail and the cards cannot disagree about what is in progress.
  const docStatuses = documents.map(docStatus);
  const completedDocs = docStatuses.filter((s) => s === 'completed').length;
  const inProgressDocs = docStatuses.filter((s) => s === 'in-progress' || s === 'reviewed').length;
  const overallCompletion = documents.length
    ? Math.round(documents.reduce((s, d) => s + d.completionPercent, 0) / documents.length)
    : 0;

  const overallReadiness = readinessAssessment?.overallScore ?? 0;
  const readinessDimensions = readinessAssessment?.dimensions ?? [];

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleInvite = useCallback(async (userId: string, role: string) => {
    try {
      await addCollaborator(userId, role);
      success(bilingualInline(builderEn('toast_collab_added'), builderEl('toast_collab_added')));
    } catch {
      toastError(bilingualInline(builderEn('toast_collab_failed'), builderEl('toast_collab_failed')));
      throw new Error('invite failed');
    }
  }, [addCollaborator, success, toastError]);

  const handleCreateDoc = useCallback(async (type: string, title: string) => {
    try {
      const doc = await createDocument(type as any, title);
      success(bilingualInline(builderEn('toast_doc_created'), builderEl('toast_doc_created')));
      selectDocument(doc.id);
      const tab = DOC_TO_TAB[type];
      if (tab && onOpenStage) onOpenStage(tab);
    } catch {
      toastError(bilingualInline(builderEn('toast_doc_failed'), builderEl('toast_doc_failed')));
      throw new Error('create failed');
    }
  }, [createDocument, selectDocument, onOpenStage, success, toastError]);

  const openDocument = useCallback((doc: BuilderDocument) => {
    selectDocument(doc.id);
    const tab = DOC_TO_TAB[doc.type];
    if (tab && onOpenStage) onOpenStage(tab);
  }, [selectDocument, onOpenStage]);

  const handleRemoveCollaborator = useCallback(async (collaboratorId: string) => {
    try {
      await removeCollaborator(collaboratorId);
      success(bilingualInline(builderEn('toast_removed'), builderEl('toast_removed')));
    } catch {
      toastError(bilingualInline(builderEn('toast_remove_failed'), builderEl('toast_remove_failed')));
    }
  }, [removeCollaborator, success, toastError]);

  const handleReassess = async () => {
    setAssessingReadiness(true);
    try {
      await assessReadiness();
      success(bilingualInline(builderEn('toast_reassessed'), builderEl('toast_reassessed')));
    } catch {
      toastError(bilingualInline(builderEn('toast_assess_failed'), builderEl('toast_assess_failed')));
    } finally {
      setAssessingReadiness(false);
    }
  };

  // ── Loading skeleton ────────────────────────────────────────────────────

  if (isLoadingWorkspaces) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="min-w-0">
              <CardContent>
                <Skeleton className="mb-2 h-7 w-12" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3"><Skeleton className="h-5 w-32" /></CardHeader>
              <CardContent><Skeleton className="mb-2 h-3 w-full" /><Skeleton className="h-3 w-3/4" /></CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  /*
   * What sits around the building, rather than being it.
   *
   * Stage tabs, Quick Actions and the document inventory are the page.
   * Totals, readiness bars and the team used to live in a second tab row
   * inside Overview — two Overviews, two Readinesses. They belong in the
   * rail, one column wide: `lg:grid-cols-4` is a viewport query, so four
   * tiles in an 18rem rail were four cramped columns.
   */
  const rail: PageRailSection[] = [
    {
      id: 'summary',
      glyph: 'chart',
      labelEn: 'Workspace summary',
      labelEl: 'Σύνοψη χώρου εργασίας',
      badge: `${overallCompletion}%`,
      content: (
        <div className="builder-overview-stats grid grid-cols-1 gap-2">
          <div className="rounded-xl border border-border bg-card/80 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className={BUILDER_STAT}>{overallCompletion}%</div>
                <div className={cn(BUILDER_STAT_LABEL, 'mt-0.5 text-muted-foreground')}>
                  <BilingualText en={builderEn('completion')} el={builderEl('completion')} compact wrap />
                </div>
              </div>
              <CfbGlyph name="builder" className="icon-sm shrink-0 text-muted-foreground/70" />
            </div>
            <Progress value={overallCompletion} className="mt-2 h-1.5" />
          </div>
          <div className="rounded-xl border border-border bg-card/80 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className={cn(BUILDER_STAT, dimensionColor(overallReadiness))}>
                  {assessingReadiness ? <Loader2 className="icon-sm animate-spin" /> : `${overallReadiness}%`}
                </div>
                <div className={cn(BUILDER_STAT_LABEL, 'mt-0.5 text-muted-foreground')}>
                  <BilingualText en={builderEn('readiness')} el={builderEl('readiness')} compact wrap />
                </div>
              </div>
              <CfbGlyph name="award" className="icon-sm shrink-0 text-muted-foreground/70" />
            </div>
            <Progress value={overallReadiness} className="mt-2 h-1.5" />
          </div>
          <div className="rounded-xl border border-border bg-card/80 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className={cn(BUILDER_STAT, completedDocs > 0 ? STATUS.success.text : 'text-foreground')}>{completedDocs}</div>
                <div className={cn(BUILDER_STAT_LABEL, 'mt-0.5 text-muted-foreground')}>
                  <BilingualText en={builderEn('completed')} el={builderEl('completed')} compact wrap />
                </div>
                <div className="mt-1.5 text-xs text-muted-foreground">
                  {inProgressDocs}{' '}
                  <BilingualText en={builderEn('in_progress')} el={builderEl('in_progress')} compact />
                </div>
              </div>
              <CfbGlyph name="flag" className="icon-sm shrink-0 text-muted-foreground/70" />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card/80 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className={cn(BUILDER_STAT, 'text-foreground')}>{collaborators.length}</div>
                <div className={cn(BUILDER_STAT_LABEL, 'mt-0.5 text-muted-foreground')}>
                  <BilingualText en={builderEn('collaborators')} el={builderEl('collaborators')} compact wrap />
                </div>
                <div className="mt-2 flex min-h-5 -space-x-1.5">
                  {collaborators.slice(0, 4).map((c) => (
                    <Avatar key={c.id} className="h-5 w-5 border-2 border-background">
                      <AvatarImage src={c.user.avatarUrl} />
                      <AvatarFallback className="text-2xs">{initialsOf(c.user?.displayName ?? 'U').charAt(0)}</AvatarFallback>
                    </Avatar>
                  ))}
                </div>
              </div>
              <CfbGlyph name="people" className="icon-sm shrink-0 text-muted-foreground/70" />
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'readiness',
      glyph: 'target',
      labelEn: 'Readiness progress',
      labelEl: 'Πρόοδος ετοιμότητας',
      badge: `${overallReadiness}%`,
      content: (
        <div className="builder-overview-type space-y-3">
          <p className="page-stat-label leading-relaxed text-muted-foreground">
            {readinessAssessment ? (() => {
              const levelKey = readinessLevelKey(readinessAssessment.readinessLevel);
              return (
                <>
                  <BilingualText en={builderEn('overall_readiness_line')} el={builderEl('overall_readiness_line')} compact />{' '}
                  <span className={cn('font-semibold tabular-nums', dimensionColor(overallReadiness))}>{overallReadiness}%</span>
                  {levelKey && (
                    <>
                      {' · '}
                      <BilingualText en={builderEn(levelKey)} el={builderEl(levelKey)} compact />
                    </>
                  )}
                </>
              );
            })() : (
              <BilingualText en={builderEn('run_to_see')} el={builderEl('run_to_see')} wrap />
            )}
          </p>
          <div className="space-y-3">
            {readinessDimensions.map((dim) => {
              const stKey = dim.status ? readinessStatusKey(dim.status) : null;
              return (
                <div key={dim.dimension} className="space-y-1">
                  <div className="flex justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate text-muted-foreground">
                      <DimensionLabel d={dim.dimension} />
                    </span>
                    <span className={cn('shrink-0 font-medium tabular-nums', dimensionColor(dim.score))}>{dim.score}%</span>
                  </div>
                  <Progress value={dim.score} className="h-1.5" />
                  {stKey && (
                    <p className={cn('text-2xs font-medium', readinessStatusText(dim.status))}>
                      <BilingualText en={builderEn(stKey)} el={builderEl(stKey)} compact />
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          {assessingReadiness && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="icon-sm animate-spin" />
              <BilingualText en={builderEn('assessing')} el={builderEl('assessing')} compact />
            </div>
          )}
          <div className="grid grid-cols-1 gap-2">
            <Button
              size="sm"
              variant="outline"
              className={`${BUILDER_BTN} w-full`}
              onClick={() => void handleReassess()}
              disabled={assessingReadiness}
            >
              {assessingReadiness ? (
                <Loader2 className="icon-sm mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="icon-sm mr-1.5" />
              )}
              <BilingualText
                en={assessingReadiness ? builderEn('assessing_short') : builderEn('reassess')}
                el={assessingReadiness ? builderEl('assessing_short') : builderEl('reassess')}
                compact
              />
            </Button>
            {onOpenStage && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto min-h-9 w-full justify-between gap-1.5 whitespace-normal py-1.5 text-left"
                onClick={() => onOpenStage('readiness')}
              >
                <BilingualText en="Score in Builder" el="Βαθμολογία στο Builder" compact wrap />
                <ArrowRight className="icon-sm shrink-0" />
              </Button>
            )}
            <Button asChild variant="ghost" size="sm" className="h-auto min-h-9 w-full justify-between gap-1.5 whitespace-normal py-1.5 text-left">
              <Link href="/readiness">
                <BilingualText en={builderEn('full_readiness_report')} el={builderEl('full_readiness_report')} compact wrap />
                <ArrowRight className="icon-sm shrink-0" />
              </Link>
            </Button>
          </div>
        </div>
      ),
    },
    {
      id: 'team',
      glyph: 'people',
      labelEn: builderEn('tab_team'),
      labelEl: builderEl('tab_team'),
      badge: collaborators.length || null,
      content: (
        <div className="builder-overview-type space-y-3">
          <div className="space-y-2">
            <p className="page-stat-label text-muted-foreground">
              <BilingualText en={builderEn('team_members')} el={builderEl('team_members')} compact />
            </p>
            <Button size="sm" variant="outline" className={`${BUILDER_BTN} w-full`} onClick={() => setShowInviteDialog(true)}>
              <BilingualText en={builderEn('invite')} el={builderEl('invite')} compact />
            </Button>
          </div>
          {collaborators.length === 0 ? (
            <div className="py-4 text-center text-muted-foreground">
              <CfbGlyph name="people" className="mx-auto mb-2 icon-sm text-muted-foreground/50" />
              <p className="mb-2 text-xs">
                <BilingualText en={builderEn('no_collab')} el={builderEl('no_collab')} wrap />
              </p>
              <Button size="sm" onClick={() => setShowInviteDialog(true)}>
                <BilingualText en={builderEn('invite_first')} el={builderEl('invite_first')} compact />
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {collaborators.map((collab) => {
                const roleMeta = ROLE_META[collab.role] ?? ROLE_META.viewer;
                const RoleIcon = roleMeta.icon;
                return (
                  <div key={collab.id} className="flex items-start justify-between gap-2 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarImage src={collab.user.avatarUrl} />
                        <AvatarFallback className="text-xs">
                          {initialsOf(collab.user?.displayName ?? 'U')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium">
                          {collab.user?.displayName ?? collab.user.email}
                        </div>
                        <div className="truncate text-2xs text-muted-foreground" title={collab.user.email}>{collab.user.email}</div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Badge
                        variant="outline"
                        className={cn('flex items-center gap-1 border px-1.5 text-2xs', roleChip(collab.role))}
                      >
                        <RoleIcon className="h-2.5 w-2.5" />
                        <BilingualText en={builderEn(roleMeta.labelKey)} el={builderEl(roleMeta.labelKey)} compact />
                      </Badge>
                      {collab.role !== 'owner' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              aria-label={bilingualAria(builderEn('remove'), builderEl('remove'))}
                            >
                              <MoreHorizontal className="icon-sm" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-destructive-accessible"
                              onClick={() => void handleRemoveCollaborator(collab.id)}
                            >
                              <Trash2 className="icon-sm mr-2" />
                              <BilingualText en={builderEn('remove')} el={builderEl('remove')} compact />
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {workspace && (
            <div className="space-y-2 border-t border-border pt-3">
              <p className="flex items-center gap-1.5 text-xs font-medium">
                <CfbGlyph name="sliders" className="icon-sm" />
                <BilingualText en={builderEn('workspace_settings')} el={builderEl('workspace_settings')} compact />
              </p>
              <div className="grid grid-cols-1 gap-2 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">
                    <BilingualText en={builderEn('startup')} el={builderEl('startup')} compact />
                  </span>
                  <span className="min-w-0 truncate font-medium">{workspace.startupName ?? workspace.name}</span>
                </div>
                {workspace.industry && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">
                      <BilingualText en={builderEn('industry')} el={builderEl('industry')} compact />
                    </span>
                    <span className="min-w-0 truncate font-medium capitalize">{workspace.industry}</span>
                  </div>
                )}
                {workspace.stage && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">
                      <BilingualText en={builderEn('stage')} el={builderEl('stage')} compact />
                    </span>
                    <Badge variant="secondary" className="text-2xs capitalize">{workspace.stage}</Badge>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">
                    <BilingualText en={builderEn('visibility')} el={builderEl('visibility')} compact />
                  </span>
                  <Badge variant="outline" className="text-2xs">
                    {visibilityKey(workspace.visibility)
                      ? <BilingualText en={builderEn(visibilityKey(workspace.visibility)!)} el={builderEl(visibilityKey(workspace.visibility)!)} compact />
                      : workspace.visibility}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </div>
      ),
    },
  ];

  const blockers = readinessAssessment?.blockers ?? [];
  const nextMilestones = readinessAssessment?.nextMilestones ?? [];
  const showReviewNudge = !reviewDismissed && inProgressDocs >= 2;
  const dismissReview = () => {
    setReviewDismissed(true);
    localStorage.setItem(BUILDER_REVIEW_DISMISS_KEY, 'true');
  };

  return (
    <div className="min-w-0 space-y-6 overflow-x-clip">
      <PageRail sections={extraRailSections ? [...rail, ...extraRailSections] : rail} />

      <Card className="min-w-0">
        <CardHeader className="flex flex-col gap-2 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <CardTitle>
              <BilingualText en={builderEn('quick_actions')} el={builderEl('quick_actions')} compact />
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              <BilingualText
                en={builderEn('quick_actions_hint')}
                el={builderEl('quick_actions_hint')}
                compact
                wrap
              />
            </p>
          </div>
          <AIInsightButton
            className="h-8 w-full sm:ml-auto sm:w-auto"
            prompt={`Startup Builder is ${overallCompletion}% complete and ${overallReadiness}% ready. Documents: ${documents.map((d) => `${d.title} ${d.completionPercent}%`).join(', ') || 'none yet'}. Recommend the next artifact (Idea Core, BMC, interviews, pitch, MVP, financials) and draft the first section.`}
          />
        </CardHeader>
        {/* Two columns keep each percentage beside its name instead of a
            full content width away from it. */}
        <CardContent>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {DEFAULT_DOC_TYPES.map((type) => {
            const existing = documents.find((d) => d.type === type);
            const labelEn = docLabelEn(type);
            const labelEl = builderDocLabelGenitiveEl(type);
            return (
              <Button
                key={type}
                className="chip h-auto w-full justify-between rounded-md bg-secondary/30 px-3 py-1.5 text-foreground"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (existing) selectDocument(existing.id);
                  const tab = DOC_TO_TAB[type];
                  if (tab && onOpenStage) onOpenStage(tab);
                  else if (!existing) setShowCreateDocDialog(true);
                }}
              >
                <span className="flex min-w-0 items-start gap-2 text-left leading-snug">
                  <CfbGlyph name={docGlyph(type)} className="mt-0.5 icon-sm shrink-0 text-muted-foreground" />
                  <BilingualText
                    en={`${existing ? builderEn('edit') : builderEn('start')} ${labelEn}`}
                    el={`${existing ? builderEl('edit') : builderEl('start')} ${labelEl}`}
                    compact
                    wrap
                  />
                </span>
                {existing ? (
                  <Badge
                    variant="secondary"
                    className={cn('shrink-0 border text-xs tabular-nums', docStatusChip(existing))}
                  >
                    {existing.completionPercent}%
                  </Badge>
                ) : (
                  <ChevronRight className="icon-sm shrink-0 text-muted-foreground" />
                )}
              </Button>
            );
          })}
          </div>
        </CardContent>
      </Card>

      {/* A gap and the step that closes it read as one thought, side by side. */}
      {(blockers.length > 0 || nextMilestones.length > 0) && (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CfbGlyph name="spark" className={cn('icon-sm', STATUS.warning.icon)} />
              <BilingualText en={builderEn('gaps_and_next')} el={builderEl('gaps_and_next')} compact />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                'grid grid-cols-1 gap-5',
                blockers.length > 0 && nextMilestones.length > 0 && 'md:grid-cols-2 md:gap-0 md:divide-x md:divide-border/60',
              )}
            >
              {blockers.length > 0 && (
                <section className={cn('min-w-0 space-y-2.5', nextMilestones.length > 0 && 'md:pr-6')}>
                  <p className={cn('type-caption font-medium uppercase tracking-wide', STATUS.danger.text)}>
                    <BilingualText en={builderEn('critical_gaps')} el={builderEl('critical_gaps')} compact />
                  </p>
                  <ul className="space-y-2">
                    {blockers.slice(0, 3).map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs leading-snug text-foreground">
                        <AlertCircle className={cn('icon-sm mt-0.5 shrink-0', STATUS.danger.icon)} aria-hidden="true" />
                        <span className="min-w-0"><PreviewHint text={b} /></span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {nextMilestones.length > 0 && (
                <section className={cn('min-w-0 space-y-2.5', blockers.length > 0 && 'md:pl-6')}>
                  <p className="type-caption font-medium uppercase tracking-wide text-muted-foreground">
                    <BilingualText en={builderEn('next_steps')} el={builderEl('next_steps')} compact />
                  </p>
                  <ul className="space-y-2">
                    {nextMilestones.slice(0, 6).map((milestone, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs leading-snug text-foreground">
                        <ChevronRight className="icon-sm mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="min-w-0"><PreviewHint text={milestone} /></span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <section className="min-w-0 space-y-3" aria-labelledby="builder-documents-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 id="builder-documents-heading" className="page-section font-semibold text-foreground">
            <BilingualText en={builderEn('tab_documents')} el={builderEl('tab_documents')} compact />
          </h2>
          {documents.length > 0 && (
            <p className="type-caption tabular-nums text-muted-foreground">
              <BilingualText
                en={`${inProgressDocs} in progress · ${completedDocs} completed`}
                el={`${inProgressDocs} σε εξέλιξη · ${completedDocs} ολοκληρωμένα`}
                compact
              />
            </p>
          )}
        </div>

        {showReviewNudge && (
          <div className={cn('flex flex-col gap-2 rounded-xl border px-3.5 py-2.5 sm:flex-row sm:items-center', STATUS.warning.border, STATUS.warning.bg)}>
            <div className="flex min-w-0 flex-1 items-start gap-2.5">
              <CfbGlyph name="award" className={cn('icon-sm mt-0.5 shrink-0', STATUS.warning.icon)} aria-hidden="true" />
              <p className="min-w-0 max-w-[75ch] text-xs leading-snug">
                <span className="font-semibold text-foreground">
                  <BilingualText
                    en={`An expert can review your ${inProgressDocs} drafts now.`}
                    el={`Ένας ειδικός μπορεί να αξιολογήσει τώρα τα ${inProgressDocs} προσχέδια.`}
                    compact
                    wrap
                  />
                </span>{' '}
                <span className="text-muted-foreground">
                  <BilingualText
                    en="Early feedback from an investor, mentor or industry specialist is cheapest before the documents are finished."
                    el="Η έγκαιρη ανατροφοδότηση από επενδυτή, μέντορα ή ειδικό κλάδου κοστίζει λιγότερο πριν ολοκληρωθούν τα έγγραφα."
                    compact
                    wrap
                  />
                </span>
              </p>
            </div>
            <div className="flex shrink-0 items-center justify-end gap-1">
              <Button asChild variant="ghost" size="sm" className={cn('h-8 gap-1 text-xs font-semibold hover:bg-status-warning-bg', STATUS.warning.text)}>
                <Link href="/expert-reviews">
                  <BilingualText en="Get review" el="Αξιολόγηση" compact /> <ArrowRight className="icon-sm" aria-hidden="true" />
                </Link>
              </Button>
              <button
                type="button"
                onClick={dismissReview}
                className="tap-target-phone inline-flex items-center justify-center rounded-lg p-1.5 text-muted-foreground/60 transition-colors hover:bg-muted/60 hover:text-muted-foreground focus-ring"
                title={bilingualAria('Dismiss', 'Απόρριψη')}
                aria-label={bilingualAria('Dismiss expert-review suggestion', 'Απόρριψη πρότασης αξιολόγησης')}
              >
                <X className="icon-sm" />
              </button>
            </div>
          </div>
        )}

      {isLoadingDocuments ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3"><Skeleton className="h-5 w-32" /></CardHeader>
              <CardContent><Skeleton className="mb-2 h-3 w-full" /><Skeleton className="h-3 w-3/4" /></CardContent>
            </Card>
          ))}
        </div>
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CfbGlyph name="book" className="mx-auto mb-3 icon-lg text-muted-foreground/50" />
            <p className="mb-4 text-muted-foreground">
              <BilingualText en={builderEn('no_docs')} el={builderEl('no_docs')} />
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button size="sm" className={BUILDER_BTN} onClick={() => setShowCreateDocDialog(true)}>
                <BilingualText en={builderEn('create_first')} el={builderEl('create_first')} compact />
              </Button>
              <BuilderAskAiButton
                labelEn={builderEn('ask_ai_plan')}
                labelEl={builderEl('ask_ai_plan')}
                prompt={`Startup Builder is ${overallCompletion}% complete and ${overallReadiness}% ready. Recommend the next artifact and draft the first section.`}
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {documents.map((doc) => {
            const status = docStatus(doc);
            const sk = statusKey(status);
            return (
              <Card
                key={doc.id}
                role="button"
                tabIndex={0}
                className="group cursor-pointer border-border transition-colors hover:border-border hover:bg-muted/20"
                onClick={() => openDocument(doc)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openDocument(doc);
                  }
                }}
              >
                <CardHeader className="pb-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <CfbGlyph name={docGlyph(doc.type)} className="mt-0.5 icon-sm shrink-0 text-muted-foreground" />
                    <CardTitle className="min-w-0 leading-snug"><DocTitle title={doc.title} wrap /></CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {doc.description ? (
                    <p className="line-clamp-2 text-xs text-muted-foreground"><PreviewHint text={doc.description} /></p>
                  ) : builderDocDescription(doc.type, 'en') ? (
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      <BilingualText
                        en={builderDocDescription(doc.type, 'en')}
                        el={builderDocDescription(doc.type, 'el')}
                      />
                    </p>
                  ) : null}
                  <div className="flex items-center gap-2.5">
                    <Progress
                      value={doc.completionPercent}
                      className="h-1 flex-1"
                      aria-label={bilingualAria(`${docLabelEn(doc.type)} completion`, `Ολοκλήρωση: ${docLabelEl(doc.type)}`)}
                    />
                    <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">{doc.completionPercent}%</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="text-xs">
                        v{doc.version}
                      </Badge>
                      {/* Named, not a bare coloured dot: the state is readable without a legend. */}
                      <Badge variant="outline" className={cn('gap-1.5 border text-2xs font-medium', STATUS[statusTone(status)].chip)}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', statusColor(status))} aria-hidden="true" />
                        <BilingualText en={builderEn(sk)} el={builderEl(sk)} compact />
                      </Badge>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground transition-colors group-hover:text-primary-accessible">
                      <BilingualText en={builderEn('open')} el={builderEl('open')} compact /> <ArrowRight className="icon-sm" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <Card
            className="cursor-pointer border border-dashed border-border bg-transparent transition-colors hover:border-border hover:bg-muted/30"
            onClick={() => setShowCreateDocDialog(true)}
          >
            <CardContent className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                <BilingualText en={builderEn('add_document')} el={builderEl('add_document')} compact />
              </p>
            </CardContent>
          </Card>
        </div>
      )}
      </section>

      {workspace && (
        <ActivityTimeline
          workspaceId={workspace.id}
          limit={15}
          heading={
            <h2 className="page-section font-semibold text-foreground">
              <BilingualText en={builderEn('recent_activity')} el={builderEl('recent_activity')} compact />
            </h2>
          }
        />
      )}

      <InviteCollaboratorDialog
        open={showInviteDialog}
        onClose={() => setShowInviteDialog(false)}
        onInvite={handleInvite}
      />
      <CreateDocumentDialog
        open={showCreateDocDialog}
        onClose={() => setShowCreateDocDialog(false)}
        onCreate={handleCreateDoc}
      />
    </div>
  );
}
