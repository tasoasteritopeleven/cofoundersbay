'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  History, RotateCcw, Clock, User, Loader2, ChevronRight,
  GitCommitHorizontal, AlertCircle,
} from 'lucide-react';
import { cn, initialsOf } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import { qk } from '@/lib/query-keys';
import {
  listDocumentVersions,
  restoreDocumentVersion,
  type BuilderDocumentVersion,
} from '@/lib/api';
import { BilingualText } from '@/components/common/BilingualText';
import { builderEn, builderEl } from '@/lib/i18n/strings-builder';
import { bilingualAria } from '@/lib/i18n/format';

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string, locale: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(locale, { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString(locale, { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' });
}

function VersionCard({
  v,
  current,
  onRestore,
  restoring,
}: {
  v: BuilderDocumentVersion;
  current: boolean;
  onRestore: (v: BuilderDocumentVersion) => void;
  restoring: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border transition-colors group',
        current
          ? 'border-primary/30 bg-primary/5'
          : 'border-border hover:border-border hover:bg-muted/40',
      )}
    >
      {/* Version icon */}
      <div className={cn(
        'mt-0.5 p-1.5 rounded-md shrink-0',
        current ? 'bg-primary/20 text-primary-accessible' : 'bg-muted text-muted-foreground',
      )}>
        <GitCommitHorizontal className="icon-sm" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground">
            {v.versionLabel ?? `v${v.version}`}
          </span>
          {current && (
            <Badge variant="outline" className="text-2xs px-1.5 py-0 border-primary/40 text-primary-accessible">
              <BilingualText en="Current" el="Τρέχουσα" compact />
            </Badge>
          )}
        </div>

        {v.changesSummary && (
          <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">{v.changesSummary}</p>
        )}

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="icon-sm" />
            <BilingualText en={fmtDate(v.createdAt, 'en-GB')} el={fmtDate(v.createdAt, 'el-GR')} compact />
          </span>
          {v.changedBy ? (
            <span className="flex items-center gap-1">
              <Avatar className="h-3.5 w-3.5">
                <AvatarImage src={v.changedBy?.avatarUrl ?? undefined} />
                <AvatarFallback className="text-2xs">
                  {initialsOf(v.changedBy?.displayName ?? 'U').charAt(0)}
                </AvatarFallback>
              </Avatar>
              {v.changedBy.displayName}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <User className="icon-sm" />
              <BilingualText en="System" el="Σύστημα" compact />
            </span>
          )}
        </div>
      </div>

      {/* Restore button */}
      {!current && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 shrink-0 text-xs"
          onClick={() => onRestore(v)}
          disabled={restoring}
          aria-label={bilingualAria(builderEn('hist_restore'), builderEl('hist_restore'))}
        >
          {restoring ? <Loader2 className="icon-sm animate-spin" /> : <RotateCcw className="icon-sm mr-1" />}
          <BilingualText en={builderEn('hist_restore')} el={builderEl('hist_restore')} compact />
        </Button>
      )}
    </div>
  );
}

// ── Main VersionHistoryDrawer ──────────────────────────────────────────────────

interface VersionHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  documentId: string;
  documentTitle?: string;
  currentVersion?: number;
  onRestored?: () => void;
}

export function VersionHistoryDrawer({
  open,
  onClose,
  documentId,
  documentTitle,
  currentVersion,
  onRestored,
}: VersionHistoryDrawerProps) {
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();
  const [confirmVersion, setConfirmVersion] = useState<BuilderDocumentVersion | null>(null);

  const { data: versions = [], isLoading, error } = useQuery({
    queryKey: qk('builder', 'document-versions', documentId),
    queryFn: () => listDocumentVersions(documentId),
    enabled: open && !!documentId,
    staleTime: 10_000,
  });

  const restoreMutation = useMutation({
    mutationFn: (v: BuilderDocumentVersion) =>
      restoreDocumentVersion({ documentId, targetVersion: v.version }),
    onSuccess: () => {
      success('Version restored');
      queryClient.invalidateQueries({ queryKey: qk('builder', 'document-versions', documentId) });
      queryClient.invalidateQueries({ queryKey: qk('builder') });
      setConfirmVersion(null);
      onRestored?.();
    },
    onError: () => {
      toastError('Failed to restore version');
      setConfirmVersion(null);
    },
  });

  const handleRestoreClick = (v: BuilderDocumentVersion) => setConfirmVersion(v);
  const handleConfirmRestore = () => {
    if (confirmVersion) restoreMutation.mutate(confirmVersion);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
          <SheetHeader className="shrink-0">
            <SheetTitle className="flex items-center gap-2">
              <History className="icon-sm" />
              <BilingualText en="Version History" el="Ιστορικό εκδόσεων" compact />
            </SheetTitle>
            {documentTitle && (
              <SheetDescription className="truncate">
                {documentTitle}
              </SheetDescription>
            )}
          </SheetHeader>

          <div className="flex-1 overflow-y-auto space-y-2 mt-4 pr-0.5">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-3 border rounded-lg space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                <AlertCircle className="icon-xl text-destructive/50" />
                <p className="text-sm text-muted-foreground"><BilingualText en="Failed to load version history" el="Δεν ήταν δυνατή η φόρτωση του ιστορικού" compact /></p>
              </div>
            ) : versions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <GitCommitHorizontal className="h-10 w-10 text-muted-foreground/30" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground"><BilingualText en="No saved versions yet" el="Δεν υπάρχουν αποθηκευμένες εκδόσεις ακόμα" compact /></p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <BilingualText en="Versions are saved automatically when you create draft variants or request reviews." el="Οι εκδόσεις αποθηκεύονται αυτόματα όταν δημιουργείτε εκδοχές ή ζητάτε αξιολόγηση." wrap />
                  </p>
                </div>
              </div>
            ) : (
              versions.map((v) => (
                <VersionCard
                  key={v.id}
                  v={v}
                  current={v.version === currentVersion}
                  onRestore={handleRestoreClick}
                  restoring={restoreMutation.isPending && confirmVersion?.id === v.id}
                />
              ))
            )}
          </div>

          {versions.length > 0 && (
            <div className="shrink-0 pt-3 border-t mt-3">
              <p className="text-xs text-muted-foreground text-center">
                {versions.length} · <BilingualText en={builderEn('hist_footer')} el={builderEl('hist_footer')} wrap />
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Restore Confirmation Dialog */}
      <Dialog open={!!confirmVersion} onOpenChange={() => setConfirmVersion(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <BilingualText en={builderEn('hist_restore_title')} el={builderEl('hist_restore_title')} compact />
            </DialogTitle>
            <DialogDescription>
              <BilingualText
                en={`${builderEn('hist_restore_body')} (${confirmVersion?.versionLabel ?? `v${confirmVersion?.version ?? ''}`}).`}
                el={`${builderEl('hist_restore_body')} (${confirmVersion?.versionLabel ?? `v${confirmVersion?.version ?? ''}`}).`}
                wrap
              />
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmVersion(null)}>
              <BilingualText en="Cancel" el="Ακύρωση" compact />
            </Button>
            <Button
              onClick={handleConfirmRestore}
              disabled={restoreMutation.isPending}
              className="gap-2"
            >
              {restoreMutation.isPending && <Loader2 className="icon-sm animate-spin" />}
              <RotateCcw className="icon-sm" />
              <BilingualText en={builderEn('hist_restore_cta')} el={builderEl('hist_restore_cta')} compact />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
