'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStoredUser } from '@/hooks/useStoredUser';
import { listNotifications } from '@/lib/api';
import { isPreviewDemo } from '@/lib/preview-demo';
import { qk } from '@/lib/query-keys';
import { readLastVisit, sinceLastVisit } from '@/lib/since-last-visit';

export function useReturnSummary() {
  const user = useStoredUser();
  const demo = user?.id ? isPreviewDemo() : false;
  const [anchor, setAnchor] = useState<{ id: string; demo: boolean; previous: number | null } | null>(null);
  const id = user?.id;
  useEffect(() => {
    setAnchor(id ? { id, demo, previous: readLastVisit(id, demo) } : null);
  }, [id, demo]);
  const previous = id && anchor?.id === id && anchor.demo === demo ? anchor.previous : null;
  const recent = useQuery({
    queryKey: qk('notifications', 'recent', id, demo),
    queryFn: () => listNotifications({ limit: 30 }),
    enabled: previous !== null,
    staleTime: 60_000,
    retry: 0,
  });
  return !recent.isError && Array.isArray(recent.data?.notifications)
    ? sinceLastVisit(recent.data.notifications, previous)
    : null;
}
