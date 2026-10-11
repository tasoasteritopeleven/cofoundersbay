'use client';

import { useQuery } from '@tanstack/react-query';
import { OPEN_TO_COPY } from '@cofounderbay/shared';
import { BilingualText } from '@/components/common/BilingualText';
import { useStoredUser } from '@/hooks/useStoredUser';
import { getOpenToFor } from '@/lib/open-to-api';
import { qk } from '@/lib/query-keys';

/**
 * Someone's "Open to" signal on their profile, when its visibility lets this
 * reader see it: a line of text, never a badge or a frame. Nothing renders
 * when there is nothing to show, so an absent line says nothing either way.
 */
export function OpenToLine({ userId }: { userId: string }) {
  const me = useStoredUser();
  const kinds = useQuery({ queryKey: qk('open-to', userId), queryFn: () => getOpenToFor(userId), enabled: !!me?.id && !!userId });
  const list = kinds.data ?? [];
  if (!list.length) return null;
  return (
    <p className="text-sm text-muted-foreground">
      <BilingualText
        en={`Open to: ${list.map((k) => OPEN_TO_COPY[k].en.toLowerCase()).join(', ')}`}
        el={`Ανοιχτός/ή σε: ${list.map((k) => OPEN_TO_COPY[k].el.toLowerCase()).join(', ')}`}
        wrap
      />
    </p>
  );
}
