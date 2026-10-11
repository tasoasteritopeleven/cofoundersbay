'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { getOrgProfile } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { OrgContent } from './OrgContent';

/**
 * The organisation page, read from the browser.
 *
 * The page reads the profile on the server. When the server cannot reach the
 * API at all - the static demo, where the showcase answers in the browser, or
 * an API that is briefly down - it used to answer 404, as though the
 * organisation did not exist. It renders this instead, which asks from the
 * browser; an API that answers "no such organisation" still gets a 404 from
 * the server.
 */
export function OrgProfileClient({ slug }: { slug: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: qk('org', 'profile', slug),
    queryFn: () => getOrgProfile(slug),
    retry: 0,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const org = data?.org;
  if (isError || !org) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
        <Building2 className="icon-xl text-muted-foreground/60" aria-hidden="true" />
        <h1 className="text-lg font-semibold">Organisation not found</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          No organisation uses this address, or it could not be loaded right now.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/discover">Discover people and organisations</Link>
        </Button>
      </div>
    );
  }

  return <OrgContent org={org} slug={slug} />;
}
