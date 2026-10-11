'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  GitBranch, GitPullRequest, MessageSquare, UserPlus, Share2,
  FileText, Edit3, CheckCircle2, XCircle, RotateCcw, History,
  Settings, Star, Zap, Clock, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/api';
import { usePollingGuards } from '@/hooks/usePollingGuards';
import type { BuilderActivityLog } from '@/lib/builder-api';
import { BilingualText } from '@/components/common/BilingualText';
import { RelativeTime } from '@/components/common/RelativeTime';
import { qk } from '@/lib/query-keys';
import { builderDocTitleEl } from '@/lib/i18n/strings-builder';

/** The document title as the Greek page names it, when the product wrote it. */
function titleEl(title: unknown, fallback: string): string {
  if (typeof title !== 'string' || !title) return fallback;
  return builderDocTitleEl(title) ?? title;
}

// ── Activity type metadata ────────────────────────────────────────────────────

interface ActivityMeta {
  icon: React.ElementType;
  color: string;
  label: (activity: BuilderActivityLog) => { en: string; el: string };
}

const ACTIVITY_META: Record<string, ActivityMeta> = {
  'workspace.created':    { icon: Zap,            color: 'text-status-accent bg-status-accent-bg',  label: () => ({ en: 'created this workspace', el: 'δημιούργησε αυτόν τον χώρο εργασίας' }) },
  'workspace.updated':    { icon: Settings,        color: 'text-muted-foreground bg-muted',     label: () => ({ en: 'updated workspace settings', el: 'ενημέρωσε τις ρυθμίσεις του χώρου' }) },
  'document.created':     { icon: FileText,        color: 'text-status-info bg-status-info-bg',      label: (a) => ({ en: `created document "${a.metadata?.title ?? ''}"`, el: `δημιούργησε το έγγραφο «${titleEl(a.metadata?.title, '')}»` }) },
  'document.updated':     { icon: Edit3,           color: 'text-status-info bg-status-info-bg',      label: (a) => ({ en: `edited "${a.metadata?.title ?? 'a document'}"`, el: `επεξεργάστηκε «${titleEl(a.metadata?.title, 'ένα έγγραφο')}»` }) },
  'document.completed':   { icon: CheckCircle2,    color: 'text-status-success bg-status-success-bg',    label: (a) => ({ en: `marked "${a.metadata?.title ?? 'document'}" as complete`, el: `σήμανε «${titleEl(a.metadata?.title, 'έγγραφο')}» ως ολοκληρωμένο` }) },
  'document.archived':    { icon: XCircle,         color: 'text-muted-foreground bg-muted',     label: (a) => ({ en: `archived "${a.metadata?.title ?? 'document'}"`, el: `αρχειοθέτησε «${titleEl(a.metadata?.title, 'έγγραφο')}»` }) },
  'version.restored':     { icon: RotateCcw,       color: 'text-status-warning bg-status-warning-bg',  label: (a) => ({ en: `restored to v${a.metadata?.targetVersion}`, el: `επανέφερε στην έκδοση v${a.metadata?.targetVersion}` }) },
  'branch.created':       { icon: GitBranch,       color: 'text-status-accent bg-status-accent-bg',  label: (a) => ({ en: `created draft variant "${a.metadata?.name ?? ''}"`, el: `δημιούργησε προσχέδιο «${a.metadata?.name ?? ''}»` }) },
  'branch.closed':        { icon: XCircle,         color: 'text-muted-foreground bg-muted',     label: (a) => ({ en: `closed variant "${a.metadata?.name ?? ''}"`, el: `έκλεισε την παραλλαγή «${a.metadata?.name ?? ''}»` }) },
  'proposal.created':     { icon: GitPullRequest,  color: 'text-status-warning bg-status-warning-bg',  label: (a) => ({ en: `submitted proposal "${a.metadata?.title ?? ''}"`, el: `υπέβαλε πρόταση «${a.metadata?.title ?? ''}»` }) },
  'proposal.updated':     { icon: Edit3,           color: 'text-status-warning bg-status-warning-bg',  label: () => ({ en: 'updated a change proposal', el: 'ενημέρωσε μια πρόταση αλλαγής' }) },
  'review.requested':     { icon: GitPullRequest,  color: 'text-status-warning bg-status-warning-bg',  label: () => ({ en: 'requested a review', el: 'ζήτησε αξιολόγηση' }) },
  'review.approved':      { icon: CheckCircle2,    color: 'text-status-success bg-status-success-bg',    label: () => ({ en: 'approved a change proposal', el: 'ενέκρινε μια πρόταση αλλαγής' }) },
  'review.changes_requested': { icon: RotateCcw,   color: 'text-status-warning bg-status-warning-bg',  label: () => ({ en: 'requested changes to a proposal', el: 'ζήτησε αλλαγές σε πρόταση' }) },
  'review.closed':        { icon: XCircle,         color: 'text-status-danger bg-status-danger-bg',        label: () => ({ en: 'closed a proposal', el: 'έκλεισε μια πρόταση' }) },
  'collaborator.added':   { icon: UserPlus,        color: 'text-status-success bg-status-success-bg',      label: () => ({ en: 'added a collaborator', el: 'πρόσθεσε συνεργάτη' }) },
  'collaborator.removed': { icon: UserPlus,        color: 'text-muted-foreground bg-muted',     label: () => ({ en: 'removed a collaborator', el: 'αφαίρεσε συνεργάτη' }) },
  'share.created':        { icon: Share2,          color: 'text-status-accent bg-status-accent-bg',      label: () => ({ en: 'created a share link', el: 'δημιούργησε σύνδεσμο κοινοποίησης' }) },
  'comment.created':      { icon: MessageSquare,   color: 'text-status-accent bg-status-accent-bg',  label: () => ({ en: 'left a comment', el: 'άφησε σχόλιο' }) },
  'readiness.assessed':   { icon: Star,            color: 'text-status-warning bg-status-warning-bg',  label: () => ({ en: 'ran a readiness assessment', el: 'έτρεξε αξιολόγηση ετοιμότητας' }) },
};

const DEFAULT_META: ActivityMeta = {
  icon: Clock,
  color: 'text-muted-foreground bg-muted',
  label: (a) => ({ en: a.action.replace('.', ' '), el: a.action.replace('.', ' ') }),
};

/** Written in sentence case: `capitalize` title-cased the Greek into "Χώρος Εργασίας". */
const ENTITY_LABEL: Record<string, { en: string; el: string }> = {
  document: { en: 'Document', el: 'Έγγραφο' },
  workspace: { en: 'Workspace', el: 'Χώρος εργασίας' },
  branch: { en: 'Variant', el: 'Παραλλαγή' },
  proposal: { en: 'Proposal', el: 'Πρόταση' },
  comment: { en: 'Comment', el: 'Σχόλιο' },
};

function getActivityMeta(action: string): ActivityMeta {
  return ACTIVITY_META[action] ?? DEFAULT_META;
}

// ── API call ─────────────────────────────────────────────────────────────────

async function getActivityLog(
  workspaceId: string,
  limit = 30,
): Promise<BuilderActivityLog[]> {
  const result = await apiRequest<{ activities: BuilderActivityLog[] }>(
    `/api/builder/workspaces/${workspaceId}/activity?limit=${limit}`,
  );
  return Array.isArray(result?.activities) ? result.activities : [];
}

// ── ActivityTimeline component ───────────────────────────────────────────────

interface ActivityTimelineProps {
  workspaceId: string;
  limit?: number;
  compact?: boolean;
  className?: string;
  /** Shares the row with Refresh, so the button is not left floating over the list. */
  heading?: React.ReactNode;
}

export function ActivityTimeline({
  workspaceId,
  limit = 20,
  compact = false,
  className,
  heading,
}: ActivityTimelineProps) {
  const { apiAvailable, pollInterval } = usePollingGuards();
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: qk('builder', 'activity-log', workspaceId, limit),
    queryFn: () => getActivityLog(workspaceId, limit),
    refetchInterval: pollInterval(60_000),
    refetchIntervalInBackground: false,
    retry: 0,
    enabled: !!workspaceId && apiAvailable,
  });

  const activities: BuilderActivityLog[] = data ?? [];

  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        {heading}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-7 w-7 rounded-full shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className={className}>
        {heading}
        <div className="text-center py-8 text-muted-foreground">
          <History className="icon-xl mx-auto mb-2 opacity-30" />
          <p className="text-sm">
            <BilingualText en="No activity yet" el="Δεν υπάρχει ακόμη δραστηριότητα" />
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-0.5', className)}>
      <div className={cn('mb-3 flex items-center gap-2', heading ? 'justify-between' : 'justify-end')}>
        {heading}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn('icon-sm mr-1.5', isFetching && 'animate-spin')} />
          <BilingualText en="Refresh" el="Ανανέωση" compact />
        </Button>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[13px] top-0 bottom-0 w-px bg-border/60" />

        <div className="space-y-0">
          {activities.map((activity, idx) => {
            const meta = getActivityMeta(activity.action);
            const Icon = meta.icon;
            const isLast = idx === activities.length - 1;
            const phrase = meta.label(activity);
            const entity = activity.entityType ? ENTITY_LABEL[activity.entityType] : undefined;

            return (
              <div
                key={activity.id}
                className={cn(
                  'flex items-start gap-3 relative pl-1',
                  !isLast && 'pb-4',
                )}
              >
                {/* Icon bubble */}
                <div
                  className={cn(
                    'h-7 w-7 rounded-full flex items-center justify-center shrink-0 z-10 relative border-2 border-background',
                    meta.color,
                  )}
                >
                  <Icon className="icon-sm" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-0.5">
                  {compact ? (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {activity.user && (
                        <span className="font-medium text-foreground">
                          {activity.user.displayName}&nbsp;
                        </span>
                      )}
                      <BilingualText en={phrase.en} el={phrase.el} compact wrap />
                      <span className="text-muted-foreground ml-1.5">
                        <RelativeTime date={activity.createdAt} />
                      </span>
                    </p>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-sm text-foreground leading-snug">
                            {activity.user && (
                              <span className="font-medium">{activity.user.displayName}&nbsp;</span>
                            )}
                            <span className="text-muted-foreground">
                              <BilingualText en={phrase.en} el={phrase.el} wrap />
                            </span>
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0 mt-0.5">
                          <RelativeTime date={activity.createdAt} />
                        </span>
                      </div>

                      {activity.entityType && (
                        <Badge
                          variant="secondary"
                          className="text-2xs h-4 px-1.5 mt-1.5"
                        >
                          {entity
                            ? <BilingualText en={entity.en} el={entity.el} compact />
                            : activity.entityType}
                        </Badge>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
