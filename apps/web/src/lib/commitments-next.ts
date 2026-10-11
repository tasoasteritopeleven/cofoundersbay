import type { CommitmentThreadSummary } from '@/lib/commitments-api';
import { CMT } from '@/lib/i18n/strings-commitments';

/**
 * What the reader has to do next on a thread, or null when it is the other
 * side's turn. One rule for the list, the founder dashboard and the
 * assistant's reading, so "waits on you" means the same thing everywhere.
 */
export function nextAction(thread: CommitmentThreadSummary): { en: string; el: string } | null {
  const name = thread.counterpart.displayName;
  if (thread.step === 'interest' && thread.role === 'owner') return { en: `${CMT.next_accept.en} ${name}`, el: `${CMT.next_accept.el} ${name}` };
  if (thread.step === 'conversation' && !thread.myConfirmed) return { en: `${CMT.next_confirm.en} ${name}`, el: `${CMT.next_confirm.el} ${name}` };
  if (thread.step === 'terms' && thread.latestTermsVersion === 0) return { en: `${CMT.next_propose.en} ${name}`, el: `${CMT.next_propose.el} ${name}` };
  if (thread.step === 'terms' && !thread.myAcceptedLatest) return { en: `${CMT.next_accept_terms.en} ${name}`, el: `${CMT.next_accept_terms.el} ${name}` };
  return null;
}

export function waitsOnMe(thread: CommitmentThreadSummary): boolean {
  return nextAction(thread) !== null;
}
