'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CommitmentKind } from '@cofounderbay/shared';
import { listCommitmentCards } from '@/lib/commitments-api';
import {
  BOARD_LIMIT,
  activeChipCount,
  applyChips,
  boardCards,
  chipOptions,
  chipsToCardFilters,
  type CardChips,
} from '@/lib/need-card-wall';
import { qk } from '@/lib/query-keys';

/** Which card kinds an opportunity type filter covers; `null` hides the section. */
export function kindsForOpportunityType(type: string): CommitmentKind[] | null {
  if (type === 'all') return ['cofounder', 'equity_role', 'investor_intro'];
  if (type === 'cofounder') return ['cofounder'];
  if (type === 'investment') return ['investor_intro'];
  if (type === 'job' || type === 'partnership') return ['equity_role'];
  return null;
}

/**
 * The need-card wall's data, for the section that draws it and the page
 * that offers its chips to the assistant, so the two show the same cards.
 *
 * The board is the newest `BOARD_LIMIT` cards; the chips' choices and counts
 * come from it. While the board holds every card, the chips filter it here.
 * Once it is full there may be more, so a chosen chip also goes to the
 * server (`listCommitmentCards` with category, place, stage, commitment)
 * and the wall shows what the server found among all cards.
 */
export function useNeedCardWall({ type, remoteOnly, search, chips }: { type: string; remoteOnly: boolean; search: string; chips: CardChips }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  const kinds = useMemo(() => kindsForOpportunityType(type), [type]);
  const boardQ = useQuery({
    queryKey: qk('commitments', 'cards', 'browse'),
    queryFn: () => listCommitmentCards({ limit: BOARD_LIMIT }),
    enabled: kinds !== null,
    staleTime: 60_000,
  });
  const full = (boardQ.data?.length ?? 0) >= BOARD_LIMIT;
  const narrowed = activeChipCount(chips) > 0;
  const serverQ = useQuery({
    queryKey: qk('commitments', 'cards', 'browse', chipsToCardFilters(chips)),
    queryFn: () => listCommitmentCards({ limit: BOARD_LIMIT, ...chipsToCardFilters(chips) }),
    enabled: kinds !== null && full && narrowed,
    staleTime: 60_000,
  });

  const board = useMemo(
    () => (kinds && now !== null ? boardCards(boardQ.data ?? [], { kinds, remoteOnly, search, now }) : []),
    [kinds, now, boardQ.data, remoteOnly, search],
  );
  const options = useMemo(() => chipOptions(board, chips), [board, chips]);
  const cards = useMemo(() => {
    if (!(full && narrowed)) return applyChips(board, chips);
    if (!kinds || now === null) return [];
    // The server's answer, held to the same board rules and chips.
    return applyChips(boardCards(serverQ.data ?? [], { kinds, remoteOnly, search, now }), chips);
  }, [full, narrowed, board, chips, kinds, now, serverQ.data, remoteOnly, search]);

  const active = full && narrowed ? serverQ : boardQ;
  return {
    kinds,
    ready: kinds !== null && now !== null,
    board,
    options,
    cards,
    /** The board is full: counts describe its newest cards, not every card. */
    full,
    isLoading: boardQ.isLoading || (full && narrowed && serverQ.isLoading),
    isError: boardQ.isError || (full && narrowed && serverQ.isError),
    refetch: () => void active.refetch(),
  };
}
