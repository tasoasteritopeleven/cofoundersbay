'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, BookmarkCheck, Loader2 } from 'lucide-react';
import type { SavedItemKind, SavedItemView } from '@cofounderbay/shared';
import { BilingualText } from '@/components/common/BilingualText';
import { Button, type ButtonProps } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { bilingualAria, bilingualInline } from '@/lib/i18n/format';
import { qk } from '@/lib/query-keys';
import { listSavedItems, saveItem, unsaveItem } from '@/lib/saved-items-api';
import { cn } from '@/lib/utils';

/** The reader's saved ids of one kind, from one shared cache entry. */
export function useSavedItems(kind: SavedItemKind) {
  const query = useQuery({
    queryKey: qk('saved-items', kind),
    queryFn: () => listSavedItems(kind),
    staleTime: 60_000,
    retry: 0,
  });
  const ids = new Set((query.data ?? []).map((i) => i.itemId));
  return { items: query.data ?? [], ids, isLoading: query.isLoading };
}

/** Save and unsave as one pair of writes, for the button and the assistant alike. */
export function useSaveToggle(kind: SavedItemKind) {
  const queryClient = useQueryClient();
  const key = qk('saved-items', kind);
  const mutation = useMutation({
    mutationFn: async ({ itemId, save }: { itemId: string; save: boolean }) => {
      if (save) await saveItem(kind, itemId);
      else await unsaveItem(kind, itemId);
      return { itemId, save };
    },
    onSuccess: ({ itemId, save }) => {
      queryClient.setQueryData<SavedItemView[]>(key, (prev = []) =>
        save ? (prev.some((i) => i.itemId === itemId) ? prev : [{ kind, itemId, title: '', savedAt: new Date().toISOString() }, ...prev]) : prev.filter((i) => i.itemId !== itemId),
      );
      void queryClient.invalidateQueries({ queryKey: qk('saved-items') });
    },
  });
  return mutation;
}

/**
 * "Save" on a listing or a job, stored for the reader (`/api/saved-items`).
 * It replaces buttons that showed "Saved on this device" and stored nothing.
 */
export function SaveItemButton({
  kind,
  itemId,
  title,
  size = 'sm',
  className,
}: {
  kind: SavedItemKind;
  itemId: string;
  title: string;
  size?: ButtonProps['size'];
  className?: string;
}) {
  const { ids } = useSavedItems(kind);
  const toggle = useSaveToggle(kind);
  const { success, error } = useToast();
  const saved = ids.has(itemId);
  const pending = toggle.isPending && toggle.variables?.itemId === itemId;
  const label = saved
    ? bilingualAria(`Remove “${title}” from saved`, `Αφαίρεση του «${title}» από τα αποθηκευμένα`)
    : bilingualAria(`Save “${title}”`, `Αποθήκευση του «${title}»`);
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      aria-pressed={saved}
      aria-label={label}
      disabled={pending}
      className={cn('gap-1.5 text-xs', className)}
      onClick={() =>
        toggle.mutate(
          { itemId, save: !saved },
          {
            onSuccess: ({ save }) => success(save ? 'Saved' : 'Removed from saved', save ? 'Find it under Saved on this page.' : undefined),
            onError: (err) => error(bilingualInline('Could not update saved items', 'Δεν ενημερώθηκαν τα αποθηκευμένα'), err instanceof Error ? err.message : undefined),
          },
        )
      }
    >
      {pending ? <Loader2 className="icon-sm animate-spin" aria-hidden="true" /> : saved ? <BookmarkCheck className="icon-sm" aria-hidden="true" /> : <Bookmark className="icon-sm" aria-hidden="true" />}
      {saved ? <BilingualText en="Saved" el="Αποθηκευμένο" compact /> : <BilingualText en="Save" el="Αποθήκευση" compact />}
    </Button>
  );
}
