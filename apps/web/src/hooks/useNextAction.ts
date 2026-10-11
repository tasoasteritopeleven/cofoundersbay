import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from './useSession';
import { qk } from '@/lib/query-keys';
import {
  getNextAction,
  recordNudgeDismissed,
  recordNudgeConverted,
  type NextActionResponse,
} from '@/lib/api';

interface UseNextActionOptions {
  surface?: string;
  enabled?: boolean;
}

export function useNextAction({ surface = 'dashboard', enabled = true }: UseNextActionOptions = {}) {
  const { hasSession } = useSession();
  const queryClient = useQueryClient();

  const query = useQuery<NextActionResponse>({
    queryKey: qk('next-action', surface),
    queryFn: () => getNextAction(surface),
    enabled: enabled && hasSession,
    staleTime: 10 * 60_000,
    retry: 1,
  });

  const dismissMutation = useMutation({
    mutationFn: (logId: string) => recordNudgeDismissed(logId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk('next-action') });
    },
  });

  const convertMutation = useMutation({
    mutationFn: (logId: string) => recordNudgeConverted(logId),
  });

  return {
    action: query.data?.action ?? null,
    state: query.data?.state,
    confidence: query.data?.confidence,
    isLoading: query.isLoading,
    refetch: query.refetch,
    dismiss: dismissMutation.mutate,
    convert: convertMutation.mutate,
  };
}
