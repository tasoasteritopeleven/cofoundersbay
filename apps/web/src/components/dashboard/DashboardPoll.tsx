'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BarChart3, Check } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { votePoll } from '@/lib/api';
import type { PollView } from '@/lib/api';
import { qk } from '@/lib/query-keys';

export type PollOption = { id: string; label: string; votes: number };
export type DashboardPollData = {
  id: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
  userVoted?: string | null;
};

const defaultPoll: DashboardPollData = {
  id: '1',
  question: 'What topic should we cover in the next community call?',
  options: [
    { id: 'a', label: 'Fundraising & term sheets', votes: 42 },
    { id: 'b', label: 'Product-market fit', votes: 38 },
    { id: 'c', label: 'Hiring first team', votes: 28 },
  ],
  totalVotes: 108,
};

type DashboardPollProps = {
  poll?: PollView | null;
  className?: string;
};

export function DashboardPoll({ poll: apiPoll, className }: DashboardPollProps) {
  const poll = apiPoll ?? defaultPoll;
  const isRealPoll = !!apiPoll;
  const [optimisticVote, setOptimisticVote] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();
  const voted = optimisticVote ?? poll.userVoted ?? null;

  const voteMutation = useMutation({
    mutationFn: ({ pollId, optionId }: { pollId: string; optionId: string }) =>
      votePoll(pollId, optionId),
    onMutate: ({ optionId }) => setOptimisticVote(optionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk('polls', 'active') });
      success('Vote recorded');
    },
    onError: (err) => {
      setOptimisticVote(null);
      showError(err instanceof Error ? err.message : 'Failed to vote');
    },
  });

  const handleVote = (optionId: string) => {
    if (voted || !isRealPoll) return;
    voteMutation.mutate({ pollId: poll.id, optionId });
  };

  const total = poll.options.reduce((s, o) => s + o.votes, 0) || 1;

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <BarChart3 className="icon-sm text-muted-foreground" />
          Active poll
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm font-medium text-foreground">{poll.question}</p>
        <ul className="space-y-2">
          {poll.options.map((opt) => {
            const pct = total ? Math.round((opt.votes / total) * 100) : 0;
            const isSelected = voted === opt.id;
            return (
              <li key={opt.id}>
                <button
                  type="button"
                  onClick={() => handleVote(opt.id)}
                  disabled={!!voted || voteMutation.isPending || !isRealPoll}
                  className={cn(
                    'w-full rounded-lg border p-3 text-left text-sm transition-colors',
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary-accessible'
                      : 'border-border hover:bg-secondary/60',
                    voted && !isSelected && 'cursor-default opacity-80',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      {isSelected && <Check className="icon-sm" />}
                      {opt.label}
                    </span>
                    <span className="text-muted-foreground tabular-nums">{pct}%</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/50"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted-foreground">{poll.totalVotes} votes</p>
      </CardContent>
    </Card>
  );
}
