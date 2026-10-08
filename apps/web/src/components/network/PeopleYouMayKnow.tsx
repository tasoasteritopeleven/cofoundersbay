'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Compass } from 'lucide-react';
import { BilingualText } from '@/components/common/BilingualText';
import { StatusText } from '@/components/common/StatusText';
import { ConnectButton } from '@/components/common/PersonActions';
import { PersonVerifiedBadge } from '@/components/commitments/PersonVerifiedBadge';
import { rankSimilar } from '@/components/profile/ProfileSections';
import type { SearchHit } from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getMeProfile, searchProfiles, sendConnectionRequest } from '@/lib/api';
import { rowOptions, ROW_GONE, usePageControls, usePageList } from '@/lib/page-controls';
import { qk, queryKeys } from '@/lib/query-keys';
import { initialsOf } from '@/lib/utils';

/**
 * "People you may know", the way a professional network's My Network page
 * offers it, on this product's terms: ranked only by what the reader asked
 * for (the roles in their profile's "looking for") and what the two share
 * (role, skills, industry, city) - never by who viewed whom, by contacts
 * uploaded from a phone, or by a paid plan. Each card says which of those it
 * is. People already connected, or with a request either way, are left out.
 *
 * Connect is the same shared button every person card uses; the assistant
 * gets the same write as a command, and the list as rows.
 */
/** The roles a "looking for" entry asks for. */
const WANTED_ROLES: Record<string, readonly string[]> = {
  cofounder: ['cofounder', 'founder'],
  co_founder: ['cofounder', 'founder'],
  mentor: ['mentor'],
  advisor: ['mentor', 'advisor'],
  investor: ['investor', 'angel_investor'],
  angel: ['angel_investor', 'investor'],
  service_provider: ['service_provider'],
};

export function wantedRoles(lookingFor: unknown): Set<string> {
  const out = new Set<string>();
  for (const v of Array.isArray(lookingFor) ? lookingFor : []) {
    if (typeof v !== 'string') continue;
    for (const role of WANTED_ROLES[v.trim().toLowerCase()] ?? []) out.add(role);
  }
  return out;
}

/**
 * Ranks the pool: a role the reader is looking for counts most, then what
 * the two share. Someone with neither is not suggested.
 */
export function rankSuggested(
  hits: readonly SearchHit[],
  person: { userId: string; role?: string | null; skills: readonly string[]; industries: readonly string[]; location?: string | null; lookingFor?: unknown },
  viewerId: string | null,
  limit: number,
): Array<{ hit: SearchHit; shared: string[]; wanted: boolean }> {
  const wanted = wantedRoles(person.lookingFor);
  const similar = new Map(rankSimilar(hits, person, viewerId, hits.length).map((r, i) => [r.hit.userId, { ...r, rank: i }]));
  return hits
    .filter((h) => h.userId && h.userId !== person.userId && h.userId !== viewerId)
    .map((hit) => {
      const sim = similar.get(hit.userId);
      const isWanted = wanted.has(String(hit.role ?? ''));
      const score = (isWanted ? 100 : 0) + (sim ? 50 - sim.rank : 0);
      return { hit, shared: sim?.shared ?? [], wanted: isWanted, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.hit.displayName.localeCompare(b.hit.displayName))
    .slice(0, limit)
    .map(({ hit, shared, wanted: w }) => ({ hit, shared, wanted: w }));
}

export function PeopleYouMayKnow({ excludeIds, limit = 6 }: { excludeIds: ReadonlySet<string>; limit?: number }) {
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: queryKeys.me.profile(), queryFn: getMeProfile, staleTime: 5 * 60_000, retry: 1 });
  const profile = me.data?.profile ?? null;
  const viewerId = profile?.userId ?? null;
  const pool = useQuery({
    queryKey: qk('members', 'suggested', viewerId ?? ''),
    queryFn: () => searchProfiles({ limit: 40 }),
    enabled: !!viewerId,
    staleTime: 5 * 60_000,
    retry: 0,
  });

  const suggested = useMemo(() => {
    if (!profile) return [];
    const payload = (profile.rolePayload ?? {}) as Record<string, unknown>;
    const industries = Array.isArray(payload.industries) ? (payload.industries as unknown[]).filter((v): v is string => typeof v === 'string') : [];
    const hits = (pool.data?.hits ?? []).filter((h) => h.userId && !excludeIds.has(h.userId));
    return rankSuggested(
      hits,
      {
        userId: profile.userId,
        role: profile.role,
        skills: (profile.skills ?? []).map((s) => s.skillName),
        industries,
        location: profile.location,
        lookingFor: payload.lookingFor,
      },
      viewerId,
      limit,
    );
  }, [profile, pool.data, excludeIds, viewerId, limit]);

  usePageList([
    {
      id: 'people_you_may_know',
      labelEn: 'People you may know',
      labelEl: 'Ίσως γνωρίζετε',
      rows: pool.isLoading || me.isLoading ? undefined : suggested.map(({ hit, shared, wanted }) => `${hit.displayName}${hit.headline ? ` · ${hit.headline}` : ''}${wanted ? ` · a role you are looking for (${hit.role})` : ''}${shared.length ? ` · in common: ${shared.join(', ')}` : ''}`),
    },
  ]);
  usePageControls([
    {
      id: 'connect_suggested',
      labelEn: 'Send a connection request to someone you may know',
      labelEl: 'Αίτημα σύνδεσης σε κάποιον που ίσως γνωρίζετε',
      writes: true,
      options: rowOptions(suggested, ({ hit }) => hit.userId, ({ hit }) => hit.displayName),
      unavailableEn: suggested.length ? undefined : 'No one is suggested right now.',
      unavailableEl: suggested.length ? undefined : 'Δεν υπάρχει πρόταση αυτή τη στιγμή.',
      run: async (value) => {
        const row = suggested.find(({ hit }) => hit.userId === value);
        if (!row) return ROW_GONE;
        await sendConnectionRequest({ receiverId: row.hit.userId });
        // The person moves to Sent and leaves this list.
        await queryClient.invalidateQueries({ queryKey: qk('connections') });
      },
    },
  ]);

  if (me.isLoading || pool.isLoading || !suggested.length) return null;

  return (
    <Card aria-labelledby="pymk-title">
      <CardHeader className="border-b border-border">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle id="pymk-title" className="text-lg">
              <BilingualText en="People you may know" el="Ίσως γνωρίζετε" compact />
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              <BilingualText en="By the roles you are looking for and what you share (skills, industry, city) - never by who viewed whom." el="Με βάση τους ρόλους που αναζητάτε και όσα μοιράζεστε (δεξιότητες, κλάδος, πόλη) - ποτέ με το ποιος είδε ποιον." wrap />
            </p>
          </div>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-primary-accessible" asChild>
            <Link href="/discover"><Compass className="icon-sm" aria-hidden="true" /><BilingualText en="Find more" el="Βρείτε περισσότερους" compact /></Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* People in columns 32px apart, each on its column's axis: a frame
            per person drew a card inside the card. */}
        <ul className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
          {suggested.map(({ hit, shared, wanted }) => (
            <li key={hit.userId} className="flex min-w-0 flex-col gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <Avatar className="h-12 w-12 shrink-0">
                  <AvatarImage src={hit.avatarUrl ?? undefined} alt="" />
                  <AvatarFallback className="bg-primary/10 text-sm text-primary-accessible" data-keep-icon="">{initialsOf(hit.displayName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-1.5">
                    <Link href={`/profiles/${hit.userId}`} className="truncate text-sm font-medium text-foreground hover:text-primary-accessible">{hit.displayName}</Link>
                    <PersonVerifiedBadge userId={hit.userId} />
                  </div>
                  {hit.headline ? <p className="line-clamp-2 text-xs text-muted-foreground">{hit.headline}</p> : <p className="text-xs text-muted-foreground"><StatusText value={hit.role} /></p>}
                  {wanted ? (
                    <p className="mt-1 text-xs text-primary-accessible">
                      <BilingualText en="A role you are looking for:" el="Ρόλος που αναζητάτε:" compact />{' '}<StatusText value={hit.role} />
                    </p>
                  ) : null}
                  {shared.length ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      <BilingualText en={`In common: ${shared.join(', ')}`} el={`Κοινά: ${shared.join(', ')}`} compact wrap />
                    </p>
                  ) : null}
                </div>
              </div>
              <ConnectButton userId={hit.userId} displayName={hit.displayName} variant="outline" className="w-full" />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
