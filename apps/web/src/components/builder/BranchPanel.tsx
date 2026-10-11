'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { RelativeTime } from '@/components/common/RelativeTime';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  GitBranch, Plus, X, Clock, CheckCircle2, XCircle,
  AlertCircle, Loader2, ChevronRight, GitPullRequest,
  MoreHorizontal, Merge,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import { qk } from '@/lib/query-keys';
import {
  listBranches,
  createBranch,
  closeBranch,
  createProposal,
  type ArtifactBranch,
} from '@/lib/api';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualInline } from '@/lib/i18n/format';

// ── Branch Status helpers ──────────────────────────────────────────────────

function branchStatusMeta(status: string) {
  switch (status) {
    case 'open':        return { label: 'Open',      color: 'bg-status-info-bg text-status-info border-status-info-border',    icon: GitBranch };
    case 'review':      return { label: 'In Review', color: 'bg-status-warning-bg text-status-warning border-status-warning-border', icon: Clock };
    case 'merged':      return { label: 'Merged',    color: 'bg-status-success-bg text-status-success border-status-success-border',  icon: CheckCircle2 };
    case 'closed':      return { label: 'Closed',    color: 'bg-muted text-muted-foreground border-border',     icon: XCircle };
    default:            return { label: status,      color: 'bg-muted text-muted-foreground border-border',   icon: GitBranch };
  }
}


// ── Create Branch Dialog ───────────────────────────────────────────────────

interface CreateBranchDialogProps {
  open: boolean;
  onClose: () => void;
  documentId: string;
  currentVersion: number;
  onCreated: () => void;
}

function CreateBranchDialog({ open, onClose, documentId, currentVersion, onCreated }: CreateBranchDialogProps) {
  const { success, error: toastError } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await createBranch({
        documentId,
        name: name.trim(),
        description: description.trim() || undefined,
      });
      success(`Draft variant "${name}" created`);
      setName('');
      setDescription('');
      onCreated();
      onClose();
    } catch {
      toastError('Failed to create draft variant');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle><BilingualText en="New Draft Variant" el="Νέα πρόχειρη εκδοχή" compact /></DialogTitle>
          <DialogDescription>
            <BilingualText en="Create an isolated copy of this document to experiment with changes before proposing them." el="Δημιουργήστε ανεξάρτητο αντίγραφο του εγγράφου για να δοκιμάσετε αλλαγές πριν τις προτείνετε." wrap />
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="name"><BilingualText en="Name" el="Όνομα" compact /></Label>
            <Input id="name"
              placeholder="e.g. revised-financials, investor-v2..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description"><BilingualText en="Description (optional)" el="Περιγραφή (προαιρετικά)" compact /></Label>
            <Textarea id="description"
              placeholder={bilingualInline("What changes are you exploring in this variant?", "Ποιες αλλαγές δοκιμάζετε σε αυτή την εκδοχή;")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            <BilingualText en={`Branching from v${currentVersion} of the main document.`} el={`Διακλάδωση από την έκδοση v${currentVersion} του κύριου εγγράφου.`} wrap />
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}><BilingualText en="Cancel" el="Ακύρωση" compact /></Button>
          <Button onClick={handleCreate} disabled={loading || !name.trim()}>
            {loading && <Loader2 className="icon-sm mr-2 animate-spin" />}
            Create Variant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Submit Proposal Dialog ─────────────────────────────────────────────────

interface SubmitProposalDialogProps {
  open: boolean;
  onClose: () => void;
  branch: ArtifactBranch;
  onSubmitted: () => void;
}

function SubmitProposalDialog({ open, onClose, branch, onSubmitted }: SubmitProposalDialogProps) {
  const { success, error: toastError } = useToast();
  const [title, setTitle] = useState(`Changes from "${branch.name}"`);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      await createProposal({
        branchId: branch.id,
        title: title.trim(),
        description: description.trim() || undefined,
      });
      success('Change proposal submitted for review');
      onSubmitted();
      onClose();
    } catch {
      toastError('Failed to submit proposal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle><BilingualText en="Submit Change Proposal" el="Υποβολή πρότασης αλλαγής" compact /></DialogTitle>
          <DialogDescription>
            Propose the changes from &ldquo;{branch.name}&rdquo; to be merged into the main document.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="title"><BilingualText en="Proposal title" el="Τίτλος πρότασης" compact /></Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description-2"><BilingualText en="Description" el="Περιγραφή" compact /></Label>
            <Textarea id="description-2"
              placeholder={bilingualInline("Summarise the changes you've made and why…", "Συνοψίστε τις αλλαγές σας και τον λόγο…")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}><BilingualText en="Cancel" el="Ακύρωση" compact /></Button>
          <Button onClick={handleSubmit} disabled={loading || !title.trim()}>
            {loading && <Loader2 className="icon-sm mr-2 animate-spin" />}
            Submit Proposal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main BranchPanel ───────────────────────────────────────────────────────

interface BranchPanelProps {
  open: boolean;
  onClose: () => void;
  documentId: string;
  workspaceId: string;
  documentTitle?: string;
  readonly?: boolean;
}

export function BranchPanel({
  open,
  onClose,
  documentId,
  workspaceId,
  documentTitle,
  readonly = false,
}: BranchPanelProps) {
  const { error: toastError, success } = useToast();
  const queryClient = useQueryClient();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [proposalBranch, setProposalBranch] = useState<ArtifactBranch | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: qk('builder', 'branches', documentId),
    queryFn: () => listBranches(documentId),
    enabled: open && !!documentId,
  });

  const branches: ArtifactBranch[] = Array.isArray(data) ? data : [];
  const currentDocVersion: number = branches[0]?.baseVersionNum ?? 1;

  const handleClose = async (branchId: string) => {
    try {
      await closeBranch(branchId);
      success('Draft variant closed');
      queryClient.invalidateQueries({ queryKey: qk('builder', 'branches', documentId) });
    } catch {
      toastError('Failed to close variant');
    }
  };

  const openBranches = branches.filter(b => b.status === 'open' || b.status === 'review');
  const closedBranches = branches.filter(b => b.status === 'closed' || b.status === 'merged');

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent className="w-full sm:max-w-md flex flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <GitBranch className="icon-sm text-muted-foreground" />
              <BilingualText en="Draft Variants" el="Πρόχειρες εκδοχές" compact />
            </SheetTitle>
            <SheetDescription>
              Isolated copies of &ldquo;{documentTitle ?? 'this document'}&rdquo; for safe experimentation.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto mt-4 space-y-4">
            {/* Main branch indicator */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
              <GitBranch className="icon-sm text-muted-foreground" />
              <span className="text-sm font-medium">main</span>
              <Badge variant="secondary" className="text-xs ml-auto">v{currentDocVersion} · current</Badge>
            </div>

            {/* Active variants */}
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
              </div>
            ) : openBranches.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
                  Active Variants ({openBranches.length})
                </p>
                {openBranches.map(branch => {
                  const meta = branchStatusMeta(branch.status);
                  const StatusIcon = meta.icon;
                  return (
                    <div
                      key={branch.id}
                      className="p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-1">
                            <GitBranch className="icon-sm text-muted-foreground shrink-0" />
                            <span className="text-sm font-medium truncate">{branch.name}</span>
                          </div>
                          {branch.description && (
                            <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2 mb-2">{branch.description}</p>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={cn('text-xs', meta.color)}>
                              <StatusIcon className="h-2.5 w-2.5 mr-1" />
                              {meta.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              base v{branch.baseVersionNum}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              <RelativeTime date={branch.createdAt} />
                            </span>
                          </div>
                        </div>

                        {!readonly && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button aria-label="Branch actions" variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
                                <MoreHorizontal className="icon-sm" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {branch.status === 'open' && (
                                <DropdownMenuItem onClick={() => setProposalBranch(branch)}>
                                  <GitPullRequest className="icon-sm mr-2" />
                                  <BilingualText en="Submit Proposal" el="Υποβολή πρότασης" compact />
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive-accessible"
                                onClick={() => handleClose(branch.id)}
                              >
                                <XCircle className="icon-sm mr-2" />
                                <BilingualText en="Close Variant" el="Κλείσιμο εκδοχής" compact />
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>

                      {!readonly && branch.status === 'open' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-3 w-full text-xs h-7"
                          onClick={() => setProposalBranch(branch)}
                        >
                          <GitPullRequest className="icon-sm mr-1.5" />
                          <BilingualText en="Submit as Change Proposal" el="Υποβολή ως πρόταση αλλαγής" compact />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <GitBranch className="icon-xl mx-auto mb-2 opacity-30" />
                <p className="text-sm"><BilingualText en="No active variants" el="Δεν υπάρχουν ενεργές εκδοχές" compact /></p>
                <p className="text-xs mt-1"><BilingualText en="Create a variant to experiment without affecting the main document." el="Δημιουργήστε εκδοχή για πειραματισμό χωρίς να αλλάξει το κύριο έγγραφο." wrap /></p>
              </div>
            )}

            {/* Closed/merged */}
            {closedBranches.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
                  Closed / Merged ({closedBranches.length})
                </p>
                {closedBranches.map(branch => {
                  const meta = branchStatusMeta(branch.status);
                  const StatusIcon = meta.icon;
                  return (
                    <div key={branch.id} className="px-3 py-2 rounded-lg border border-border bg-muted/20">
                      <div className="flex items-center gap-2">
                        <GitBranch className="icon-sm text-muted-foreground/50" />
                        <span className="text-xs text-muted-foreground truncate flex-1">{branch.name}</span>
                        <Badge variant="outline" className={cn('text-xs', meta.color)}>
                          <StatusIcon className="h-2.5 w-2.5 mr-1" />
                          {meta.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer actions */}
          {!readonly && (
            <div className="pt-4 border-t mt-auto">
              <Button
                className="w-full"
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus className="icon-sm mr-2" />
                <BilingualText en="New Draft Variant" el="Νέα πρόχειρη εκδοχή" compact />
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <CreateBranchDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        documentId={documentId}
        currentVersion={currentDocVersion}
        onCreated={() => queryClient.invalidateQueries({ queryKey: qk('builder', 'branches', documentId) })}
      />

      {proposalBranch && (
        <SubmitProposalDialog
          open={!!proposalBranch}
          onClose={() => setProposalBranch(null)}
          branch={proposalBranch}
          onSubmitted={() => {
            queryClient.invalidateQueries({ queryKey: qk('builder', 'branches', documentId) });
            queryClient.invalidateQueries({ queryKey: qk('builder', 'proposals', documentId) });
          }}
        />
      )}
    </>
  );
}
