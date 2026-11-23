'use client';

import { FailedLine } from '@/components/dashboard/SectionCard';
import { HomeNextStep } from '@/components/dashboard/HomeNextStep';
import { useAskAssistant } from '@/hooks/useAskAssistant';
import type { homeContinuation } from '@/lib/home-continuation';

export function HomeContinue({ continuation, retry, busy }: {
  continuation: ReturnType<typeof homeContinuation>;
  retry: () => void;
  busy: boolean;
}) {
  const { ask } = useAskAssistant();
  const { target, boardsFailed, milestonesFailed } = continuation;
  return (
    <>
      {target ? (
        <HomeNextStep
          kickerEn="Continue"
          kickerEl="Συνεχίστε"
          titleEn={target.en}
          titleEl={target.el}
          href={target.href}
          actionEn="Continue"
          actionEl="Συνέχεια"
          askEn="Ask"
          askEl="Ρωτήστε"
          onAsk={() => ask(target.ask)}
        />
      ) : null}
      {boardsFailed || milestonesFailed ? (
        <FailedLine
          en={boardsFailed && milestonesFailed ? 'Research boards and milestones could not be read just now.' : boardsFailed ? 'Research boards could not be read just now.' : 'Milestones could not be read just now.'}
          el={boardsFailed && milestonesFailed ? 'Δεν ήταν δυνατή η ανάγνωση των πινάκων έρευνας και των ορόσημων.' : boardsFailed ? 'Δεν ήταν δυνατή η ανάγνωση των πινάκων έρευνας.' : 'Δεν ήταν δυνατή η ανάγνωση των ορόσημων.'}
          onRetry={retry}
          busy={busy}
        />
      ) : null}
    </>
  );
}
