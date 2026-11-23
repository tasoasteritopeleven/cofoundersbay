'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { BilingualText } from '@/components/common/BilingualText';
import { listMilestones, type Milestone } from '@/lib/api';
import { listCommitmentThreads, type CommitmentThreadSummary } from '@/lib/commitments-api';
import { nextAction, waitsOnMe } from '@/lib/commitments-next';
import { useInvestorFollowUps, type FollowUpLead } from '@/lib/follow-ups';
import { isMilestoneOverdue } from '@/lib/milestone-order';
import { PREVIEW_MILESTONE_EL } from '@/lib/i18n/strings-milestones';
import { qk } from '@/lib/query-keys';

export type LiveNotice = { key: string; href: string; en: string; el: string; entityId?: string };

/**
 * What is due now, worked out from the data rather than sent: finishing the
 * milestone, answering the person or moving the follow-up takes the line away,
 * so it never outlives what it was about. A source that could not be read adds
 * nothing, which is the same as the page saying nothing about it.
 */
export function liveNotices({ followUps, milestones, threads }: {
  followUps: FollowUpLead[];
  milestones: Milestone[];
  threads: CommitmentThreadSummary[];
}): LiveNotice[] {
  const notices: LiveNotice[] = [];
  const waiting = threads.filter(waitsOnMe);
  const first = waiting[0];
  const step = first ? nextAction(first) : null;
  if (first && step) {
    notices.push(waiting.length === 1
      ? { key: 'commitment', href: `/commitments/${encodeURIComponent(first.cardId)}?thread=${encodeURIComponent(first.id)}`, en: step.en, el: step.el }
      : { key: 'commitment', href: '/commitments', en: `${waiting.length} commitments are waiting on you`, el: `Δεσμεύσεις που σας περιμένουν: ${waiting.length}` });
  }
  if (followUps.length > 0) {
    notices.push({
      key: 'follow-up',
      href: '/fundraising',
      en: followUps.length === 1 ? `Follow-up due with ${followUps[0].name}` : `${followUps.length} investor follow-ups are due`,
      el: followUps.length === 1 ? `Έφτασε το follow-up με ${followUps[0].nameEl ?? followUps[0].name}` : `Έφτασαν ${followUps.length} follow-up επενδυτών`,
    });
  }
  const late = milestones.filter((milestone) => isMilestoneOverdue(milestone));
  if (late.length > 0) {
    notices.push({
      key: 'milestone',
      href: '/milestones',
      entityId: late.length === 1 ? late[0].id : undefined,
      en: late.length === 1 ? `Overdue milestone: ${late[0].title}` : `${late.length} milestones are overdue`,
      el: late.length === 1 ? `Εκπρόθεσμο ορόσημο: ${PREVIEW_MILESTONE_EL[late[0].title]?.title ?? late[0].title}` : `Εκπρόθεσμα ορόσημα: ${late.length}`,
    });
  }
  return notices;
}

/** What is due now and who reads it: the notifications page and the home, from the same answers. */
export function useLiveNotices(): { notices: LiveNotice[]; followUps: FollowUpLead[] } {
  const { due } = useInvestorFollowUps();
  // The keys the milestones page and the home read, so they share one answer.
  const { data: milestones } = useQuery({
    queryKey: qk('milestones', 'all', 'all'),
    queryFn: () => listMilestones({ limit: 100 }),
    staleTime: 30_000,
    retry: 0,
  });
  const { data: threads } = useQuery({
    queryKey: qk('commitments', 'threads', 'all'),
    queryFn: () => listCommitmentThreads('all'),
    staleTime: 30_000,
    retry: 0,
  });
  return { notices: liveNotices({ followUps: due, milestones: milestones?.milestones ?? [], threads: threads ?? [] }), followUps: due };
}

export function LiveNotices() {
  const { notices } = useLiveNotices();
  if (notices.length === 0) return null;
  return (
    <div className="space-y-2" data-live-notices="">
      {notices.map((notice) => (
        <Link
          key={notice.key}
          href={notice.href}
          className="flex items-center justify-between gap-3 rounded-xl border border-status-warning-border bg-status-warning-bg px-4 py-3 text-sm text-foreground transition-colors hover:border-primary/40"
        >
          <span className="min-w-0"><BilingualText en={notice.en} el={notice.el} compact wrap /></span>
          <span className="shrink-0 font-medium"><BilingualText en="Open" el="Άνοιγμα" compact /></span>
        </Link>
      ))}
    </div>
  );
}
