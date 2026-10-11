'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import { Textarea } from '@/components/ui/textarea';
import {
  GitBranch,
  History,
  Share2,
  Loader2,
  ClipboardCheck,
  Copy,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import {
  listBranches,
  createBranch,
  listProposals,
  createShareLink,
  type ArtifactBranch,
  type ChangeProposal,
  type ArtifactShareLink,
} from '@/lib/api';
import { usePollingGuards } from '@/hooks/usePollingGuards';
import { ReviewPanel } from './ReviewPanel';
import { BranchPanel } from './BranchPanel';
import { qk } from '@/lib/query-keys';
import { BilingualText } from '@/components/common/BilingualText';
import { builderEn, builderEl } from '@/lib/i18n/strings-builder';
import { bilingualAria } from '@/lib/i18n/format';
import { useBuilderPrimaryText } from './BuilderStageChrome';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CollabToolbarProps {
  documentId: string;
  workspaceId: string;
  documentTitle?: string;
  readonly?: boolean;
  className?: string;
  onHistoryClick?: () => void;
}

// ── Share Link Dialog ─────────────────────────────────────────────────────────

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  documentId?: string;
  workspaceId?: string;
}

function ShareLinkDialog({ open, onClose, documentId, workspaceId }: ShareDialogProps) {
  const { success, error: toastError } = useToast();
  const t = useBuilderPrimaryText();
  const [label, setLabel] = useState('');
  const [permission, setPermission] = useState<'view' | 'comment' | 'suggest'>('view');
  const [expiresIn, setExpiresIn] = useState('7');
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const permissionLabel = {
    view: { en: builderEn('collab_perm_view'), el: builderEl('collab_perm_view') },
    comment: { en: builderEn('collab_perm_comment'), el: builderEl('collab_perm_comment') },
    suggest: { en: builderEn('collab_perm_suggest'), el: builderEl('collab_perm_suggest') },
  } as const;

  const expiryOptions = [
    { v: '1', en: builderEn('collab_exp_1'), el: builderEl('collab_exp_1') },
    { v: '7', en: builderEn('collab_exp_7'), el: builderEl('collab_exp_7') },
    { v: '30', en: builderEn('collab_exp_30'), el: builderEl('collab_exp_30') },
    { v: 'never', en: builderEn('collab_exp_never'), el: builderEl('collab_exp_never') },
  ] as const;

  const handleCreate = async () => {
    setLoading(true);
    try {
      const expiresAt = expiresIn !== 'never'
        ? new Date(Date.now() + Number(expiresIn) * 24 * 60 * 60 * 1000).toISOString()
        : undefined;

      const link = await createShareLink({
        documentId,
        workspaceId: !documentId ? workspaceId : undefined,
        permissions: permission,
        label: label || undefined,
        expiresAt,
      });

      const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${link.token}`;
      setGeneratedUrl(url);
      success('Share link created');
    } catch {
      toastError('Failed to create share link');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (generatedUrl) {
      navigator.clipboard.writeText(generatedUrl);
      success('Link copied to clipboard');
    }
  };

  const handleClose = () => {
    setGeneratedUrl(null);
    setLabel('');
    setPermission('view');
    setExpiresIn('7');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-md:top-[max(0.5rem,env(safe-area-inset-top))] max-md:translate-y-0">
        <DialogHeader>
          <DialogTitle>
            <BilingualText en={builderEn('collab_share_title')} el={builderEl('collab_share_title')} compact />
          </DialogTitle>
          <DialogDescription>
            <BilingualText en={builderEn('collab_share_desc')} el={builderEl('collab_share_desc')} wrap />
          </DialogDescription>
        </DialogHeader>

        {generatedUrl ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border">
              <ExternalLink className="icon-sm text-muted-foreground shrink-0" />
              <span className="text-sm truncate flex-1 font-mono">{generatedUrl}</span>
              <Button
                aria-label={bilingualAria(builderEn('collab_share_copied'), builderEl('collab_share_copied'))}
                size="sm"
                variant="ghost"
                onClick={handleCopy}
              >
                <Copy className="icon-sm" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {expiresIn !== 'never' ? (
                <BilingualText
                  en={`Share this link with anyone. Link expires in ${expiresIn} days.`}
                  el={`Κοινοποιήστε αυτόν τον σύνδεσμο. Λήγει σε ${expiresIn} ημέρες.`}
                  wrap
                />
              ) : (
                <BilingualText
                  en="Share this link with anyone. Link never expires."
                  el="Κοινοποιήστε αυτόν τον σύνδεσμο. Δεν λήγει ποτέ."
                  wrap
                />
              )}
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="label">
                <BilingualText en={builderEn('collab_share_label')} el={builderEl('collab_share_label')} compact />
              </Label>
              <Input id="label"
                placeholder={t(
                  'e.g. Investor preview, Mentor review…',
                  'π.χ. προεπισκόπηση επενδυτή, αξιολόγηση μέντορα…',
                )}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <p id="CollabToolbar-cap2-cap" className="text-sm font-medium leading-tight">
                <BilingualText en={builderEn('collab_share_permission')} el={builderEl('collab_share_permission')} compact />
              </p>
              <div role="group" aria-labelledby="CollabToolbar-cap2-cap" className="flex gap-2">
                {(['view', 'comment', 'suggest'] as const).map((p) => (
                  <Button
                    key={p}
                    size="sm"
                    variant={permission === p ? 'default' : 'outline'}
                    onClick={() => setPermission(p)}
                    className="flex-1"
                  >
                    <BilingualText en={permissionLabel[p].en} el={permissionLabel[p].el} compact />
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <p id="CollabToolbar-cap3-cap" className="text-sm font-medium leading-tight">
                <BilingualText en={builderEn('collab_expires')} el={builderEl('collab_expires')} compact />
              </p>
              <div role="group" aria-labelledby="CollabToolbar-cap3-cap" className="flex gap-2 flex-wrap">
                {expiryOptions.map((opt) => (
                  <Button
                    key={opt.v}
                    size="sm"
                    variant={expiresIn === opt.v ? 'default' : 'outline'}
                    onClick={() => setExpiresIn(opt.v)}
                    className="flex-1 min-w-[70px]"
                  >
                    <BilingualText en={opt.en} el={opt.el} compact />
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            <BilingualText
              en={generatedUrl ? builderEn('collab_done') : builderEn('collab_cancel')}
              el={generatedUrl ? builderEl('collab_done') : builderEl('collab_cancel')}
              compact
            />
          </Button>
          {!generatedUrl && (
            <Button onClick={() => void handleCreate()} disabled={loading}>
              {loading && <Loader2 className="icon-sm mr-2 animate-spin" />}
              <BilingualText en={builderEn('collab_generate_link')} el={builderEl('collab_generate_link')} compact />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Proposal Status Icon ──────────────────────────────────────────────────────

function ProposalStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'approved':
      return <CheckCircle2 className="icon-sm text-status-success" />;
    case 'changes_requested':
      return <AlertCircle className="icon-sm text-status-warning" />;
    case 'closed':
      return <XCircle className="icon-sm text-muted-foreground" />;
    default:
      return <Clock className="icon-sm text-status-info" />;
  }
}

// ── Main CollabToolbar ────────────────────────────────────────────────────────

export function CollabToolbar({
  documentId,
  workspaceId,
  documentTitle,
  readonly = false,
  className,
  onHistoryClick,
}: CollabToolbarProps) {
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();

  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showBranchPanel, setShowBranchPanel] = useState(false);
  const [showReviewPanel, setShowReviewPanel] = useState(false);
  const { apiAvailable, pollInterval } = usePollingGuards();

  // ── Data fetching ─────────────────────────────────────────────────────────

  const { data: branchesData } = useQuery({
    queryKey: qk('builder', 'branches', documentId),
    queryFn: () => listBranches(documentId),
    refetchInterval: pollInterval(30_000),
    refetchIntervalInBackground: false,
    retry: 0,
    enabled: !!documentId && apiAvailable,
  });

  const { data: proposalsData } = useQuery({
    queryKey: qk('builder', 'proposals', documentId),
    queryFn: () => listProposals(documentId),
    refetchInterval: pollInterval(30_000),
    refetchIntervalInBackground: false,
    retry: 0,
    enabled: !!documentId && apiAvailable,
  });

  const branches: ArtifactBranch[] = Array.isArray(branchesData) ? branchesData : [];
  const proposals: ChangeProposal[] = Array.isArray(proposalsData) ? proposalsData : [];

  const openBranches = branches.filter(b => b.status === 'open');
  const openProposals = proposals.filter(p => p.status === 'open' || p.status === 'changes_requested');

  return (
    <TooltipProvider>
      <div className={cn('flex min-w-0 flex-wrap items-center gap-1.5', className)}>

        {/* ── Version History ────────────────────────────────────────────── */}
        {onHistoryClick && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-muted-foreground hover:text-foreground"
                onClick={onHistoryClick}
                aria-label={bilingualAria(builderEn('collab_history'), builderEl('collab_history'))}
              >
                <History className="icon-sm mr-1.5" aria-hidden="true" />
                <span className="text-xs hidden sm:inline">
                  <BilingualText en={builderEn('collab_history')} el={builderEl('collab_history')} compact />
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <BilingualText en={builderEn('collab_history_tip')} el={builderEl('collab_history_tip')} compact />
            </TooltipContent>
          </Tooltip>
        )}

        {/* ── Draft Variants (Branches) ──────────────────────────────────── */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 text-muted-foreground hover:text-foreground relative"
              onClick={() => setShowBranchPanel(true)}
              // The label is `hidden sm:inline`: on a phone this is the only name.
              aria-label={bilingualAria(
                `${builderEn('collab_variants')}${openBranches.length ? ` (${openBranches.length} open)` : ''}`,
                `${builderEl('collab_variants')}${openBranches.length ? ` (${openBranches.length} ανοιχτές)` : ''}`,
              )}
            >
              <GitBranch className="icon-sm mr-1.5" aria-hidden="true" />
              <span className="text-xs hidden sm:inline">
                <BilingualText en={builderEn('collab_variants')} el={builderEl('collab_variants')} compact />
              </span>
              {openBranches.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-2xs text-primary-foreground flex items-center justify-center font-medium">
                  {openBranches.length}
                </span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <BilingualText
              en={`${builderEn('collab_variants_tip')} — ${openBranches.length} open`}
              el={`${builderEl('collab_variants_tip')} — ${openBranches.length} ανοιχτές`}
              compact
            />
          </TooltipContent>
        </Tooltip>

        {/* ── Review Proposals ──────────────────────────────────────────── */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 text-muted-foreground hover:text-foreground relative"
              onClick={() => setShowReviewPanel(true)}
              aria-label={bilingualAria(
                `${builderEn('collab_proposals')}${openProposals.length ? ` (${openProposals.length} pending)` : ''}`,
                `${builderEl('collab_proposals')}${openProposals.length ? ` (${openProposals.length} σε εκκρεμότητα)` : ''}`,
              )}
            >
              <ClipboardCheck className="icon-sm mr-1.5" aria-hidden="true" />
              <span className="text-xs hidden sm:inline">
                <BilingualText en={builderEn('collab_proposals')} el={builderEl('collab_proposals')} compact />
              </span>
              {openProposals.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 h-4 px-1.5 text-2xs bg-status-warning-bg text-status-warning border-status-warning-border"
                >
                  {openProposals.length}
                </Badge>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <BilingualText
              en={`${builderEn('collab_proposals_tip')} — ${openProposals.length} pending`}
              el={`${builderEl('collab_proposals_tip')} — ${openProposals.length} σε εκκρεμότητα`}
              compact
            />
          </TooltipContent>
        </Tooltip>

        {/* ── Share ─────────────────────────────────────────────────────── */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 text-muted-foreground hover:text-foreground"
              onClick={() => setShowShareDialog(true)}
              aria-label={bilingualAria(builderEn('collab_share'), builderEl('collab_share'))}
            >
              <Share2 className="icon-sm mr-1.5" aria-hidden="true" />
              <span className="text-xs hidden sm:inline">
                <BilingualText en={builderEn('collab_share')} el={builderEl('collab_share')} compact />
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <BilingualText en={builderEn('collab_share_tip')} el={builderEl('collab_share_tip')} compact />
          </TooltipContent>
        </Tooltip>

        {/* ── Dialogs / Panels ──────────────────────────────────────────── */}
        <ShareLinkDialog
          open={showShareDialog}
          onClose={() => setShowShareDialog(false)}
          documentId={documentId}
          workspaceId={workspaceId}
        />

        <BranchPanel
          open={showBranchPanel}
          onClose={() => setShowBranchPanel(false)}
          documentId={documentId}
          workspaceId={workspaceId}
          documentTitle={documentTitle}
          readonly={readonly}
        />

        <ReviewPanel
          open={showReviewPanel}
          onClose={() => setShowReviewPanel(false)}
          documentId={documentId}
          workspaceId={workspaceId}
          readonly={readonly}
        />
      </div>
    </TooltipProvider>
  );
}
