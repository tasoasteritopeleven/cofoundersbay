'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ENDORSEMENT_BASIS_COPY,
  isEndorsementBasis,
  readEducation,
  readExperience,
  spanOf,
  type EducationEntry,
  type ExperienceEntry,
} from '@cofounderbay/shared';
import { BilingualText } from '@/components/common/BilingualText';
import { RelativeTime } from '@/components/common/RelativeTime';
import { StatusText } from '@/components/common/StatusText';
import { OutcomeChip } from '@/components/commitments/OutcomeChip';
import { PersonVerifiedBadge } from '@/components/commitments/PersonVerifiedBadge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getEndorsementsForUser, searchProfiles, type SearchHit } from '@/lib/api';
import { listCommitmentCards } from '@/lib/commitments-api';
import { qk } from '@/lib/query-keys';
import { getMyUpdates, getUpdatesBy } from '@/lib/updates-api';
import { initialsOf } from '@/lib/utils';

/**
 * The profile sections a professional profile reads in, adapted to what this
 * platform knows: Activity is founder updates and need cards (no feed of
 * likes), Experience and Education are what the person entered or imported
 * from LinkedIn (nothing inferred), and the rail's "Similar profiles" comes
 * from shared role, skills and industry - never from who viewed whom, which
 * this product keeps out of view (LinkedIn comparison §7).
 */

/**
 * A section card: the title on the card ladder (no size of its own), an
 * optional action at its right, and rows under it without frames of their
 * own - every row starts on the title's left edge.
 */
function SectionCard({ id, titleEn, titleEl, action, children }: { id: string; titleEn: string; titleEl: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-20" aria-labelledby={`${id}-title`}>
      <CardHeader>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <CardTitle id={`${id}-title`}>
            <BilingualText en={titleEn} el={titleEl} compact />
          </CardTitle>
          {action}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// ── Activity ────────────────────────────────────────────────────────────────

/**
 * What the person has published here, newest first: founder updates (as far
 * as the reader may read them) and their need cards with where each stands.
 * The author's own view uses the caches /updates and /commitments fill.
 */
export function ProfileActivity({ userId, own }: { userId: string; own: boolean }) {
  const mine = useQuery({ queryKey: qk('founder-updates', 'mine'), queryFn: getMyUpdates, enabled: own, retry: 0, staleTime: 60_000 });
  const theirs = useQuery({ queryKey: qk('founder-updates', 'by', userId), queryFn: () => getUpdatesBy(userId), enabled: !own && !!userId, retry: 0, staleTime: 60_000 });
  const myCards = useQuery({ queryKey: qk('commitments', 'cards', 'mine'), queryFn: () => listCommitmentCards({ mine: true }), enabled: own, retry: 0 });
  const theirCards = useQuery({ queryKey: qk('commitments', 'cards', 'owner', userId), queryFn: () => listCommitmentCards({ owner: userId }), enabled: !own && !!userId, retry: 0 });

  const updates = (own ? mine.data : theirs.data?.updates) ?? [];
  const following = own ? null : theirs.data?.following ?? null;
  // Cards that still take interest first; settled ones after, as the board orders them.
  const cards = [...((own ? myCards.data : theirCards.data) ?? [])].sort(
    (a, b) => Number(b.outcome === 'open' || b.outcome === 'in_discussion') - Number(a.outcome === 'open' || a.outcome === 'in_discussion'),
  );
  const loading = own ? mine.isLoading || myCards.isLoading : theirs.isLoading || theirCards.isLoading;
  const empty = !loading && !updates.length && !cards.length;

  return (
    <SectionCard
      id="activity"
      titleEn="Activity"
      titleEl="Δραστηριότητα"
      action={
        updates.length || own ? (
          <Button variant="ghost" size="sm" className="h-8 text-xs text-primary-accessible" asChild>
            <Link href="/updates"><BilingualText en="All updates" el="Όλες οι ενημερώσεις" compact /></Link>
          </Button>
        ) : null
      }
    >
      {loading ? (
        <p className="text-sm text-muted-foreground"><BilingualText en="Loading…" el="Φόρτωση…" compact /></p>
      ) : empty ? (
        <div className="space-y-3 text-muted-foreground">
          <p className="card-body">
            {own ? (
              <BilingualText en="Nothing published yet. A monthly update or a need card is what people here read first." el="Τίποτα δημοσιευμένο ακόμη. Μια μηνιαία ενημέρωση ή μια κάρτα ανάγκης είναι ό,τι διαβάζουν πρώτα εδώ." wrap />
            ) : (
              <BilingualText en="No public activity yet." el="Καμία δημόσια δραστηριότητα ακόμη." wrap />
            )}
          </p>
          {own ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" asChild>
                <Link href="/updates"><BilingualText en="Write an update" el="Γράψτε ενημέρωση" compact /></Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href="/commitments/new"><BilingualText en="Write a need card" el="Γράψτε κάρτα ανάγκης" compact /></Link>
              </Button>
            </div>
          ) : following === false ? (
            <p className="text-xs"><BilingualText en="Updates sent to followers appear once you follow." el="Οι ενημερώσεις για ακολούθους εμφανίζονται όταν ακολουθείτε." wrap /></p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-5">
          {updates.length ? (
            <section aria-label="Updates · Ενημερώσεις" className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground"><BilingualText en="Founder updates" el="Ενημερώσεις ιδρυτή" compact /></p>
              <ul className="divide-y divide-border">
                {updates.slice(0, 3).map((u) => (
                  <li key={u.id} className="min-w-0 py-2.5 first:pt-0 last:pb-0">
                    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <p className="min-w-0 break-words text-sm font-medium text-foreground first-letter:uppercase">{u.title}</p>
                      {u.createdAt ? <span className="shrink-0 text-xs text-muted-foreground"><RelativeTime date={u.createdAt} /></span> : null}
                    </div>
                    <p className="card-body line-clamp-2 text-muted-foreground">{u.body}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {cards.length ? (
            <section aria-label="Need cards · Κάρτες ανάγκης" className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground"><BilingualText en="Need cards" el="Κάρτες ανάγκης" compact /></p>
              <ul className="divide-y divide-border">
                {cards.slice(0, 3).map((c) => (
                  <li key={c.id} className="flex min-w-0 items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                    <Link href={`/commitments/${c.id}`} className="min-w-0 truncate text-sm font-medium text-foreground hover:text-primary-accessible">
                      {c.title}
                    </Link>
                    <OutcomeChip outcome={c.outcome} reason={c.closedReason} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </SectionCard>
  );
}

// ── Experience and education ────────────────────────────────────────────────

function OrgMark({ name }: { name: string }) {
  // Organisations are rounded squares; people are circles (AGENTS.md).
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-semibold text-muted-foreground" aria-hidden="true" data-keep-icon="">
      {initialsOf(name || '·')}
    </span>
  );
}

/**
 * `org` names the mark: the company for a role, the school for a degree. A
 * row, not a card: the organisation's mark, and beside it the role over the
 * company over the years, a step under the section's title.
 */
function EntryRow({ title, sub, org, span }: { title: string; sub: string; org: string; span: { en: string; el: string } }) {
  return (
    <li className="flex min-w-0 items-start gap-x-3 py-3 first:pt-0 last:pb-0">
      <OrgMark name={org || title || sub} />
      <div className="min-w-0">
        <p className="break-words text-sm font-medium text-foreground">{title || sub}</p>
        {title && sub ? <p className="card-body break-words text-muted-foreground">{sub}</p> : null}
        {span.en ? <p className="text-xs text-muted-foreground"><BilingualText en={span.en} el={span.el} compact /></p> : null}
      </div>
    </li>
  );
}

/**
 * Experience and Education from `rolePayload`. On someone else's profile an
 * empty section is left out; on one's own it says how to fill it.
 */
export function ProfileExperience({ payload, own }: { payload: Record<string, unknown> | null | undefined; own: boolean }) {
  const experience: ExperienceEntry[] = useMemo(() => readExperience(payload?.experience), [payload]);
  const education: EducationEntry[] = useMemo(() => readEducation(payload?.education), [payload]);
  if (!own && !experience.length && !education.length) return null;
  const edit = own ? (
    <Button variant="ghost" size="sm" className="h-8 text-xs text-primary-accessible" asChild>
      <Link href="/profile/edit#experience"><BilingualText en="Edit" el="Επεξεργασία" compact /></Link>
    </Button>
  ) : null;
  return (
    <>
      {experience.length || own ? (
        <SectionCard id="experience" titleEn="Experience" titleEl="Εμπειρία" action={edit}>
          {experience.length ? (
            <ul className="divide-y divide-border">
              {experience.map((e, i) => <EntryRow key={`${e.company}-${e.title}-${i}`} title={e.title} sub={e.company} org={e.company} span={spanOf(e)} />)}
            </ul>
          ) : (
            <p className="card-body text-muted-foreground">
              <BilingualText
                en="Add the roles you have held, or bring them from LinkedIn on the edit page; nothing is saved until you press Save."
                el="Προσθέστε τους ρόλους που είχατε ή φέρτε τους από το LinkedIn στη σελίδα επεξεργασίας· τίποτα δεν αποθηκεύεται πριν πατήσετε Αποθήκευση."
                wrap
              />
            </p>
          )}
        </SectionCard>
      ) : null}
      {education.length ? (
        <SectionCard id="education" titleEn="Education" titleEl="Εκπαίδευση">
          <ul className="divide-y divide-border">
            {education.map((e, i) => <EntryRow key={`${e.school}-${i}`} title={e.school} sub={e.degree} org={e.school} span={spanOf(e, false)} />)}
          </ul>
        </SectionCard>
      ) : null}
    </>
  );
}

// ── Rail: similar profiles ──────────────────────────────────────────────────

const lc = (v: string) => v.trim().toLowerCase();

/** Ranks by what two people share; never by who viewed whom. */
export function rankSimilar(
  hits: readonly SearchHit[],
  person: { userId: string; role?: string | null; skills: readonly string[]; industries: readonly string[]; location?: string | null },
  viewerId: string | null,
  limit = 4,
): Array<{ hit: SearchHit; shared: string[] }> {
  const skills = new Set(person.skills.map(lc));
  const industries = new Set(person.industries.map(lc));
  const city = lc(person.location ?? '').split(',')[0];
  return hits
    .filter((h) => h.userId && h.userId !== person.userId && h.userId !== viewerId)
    .map((hit) => {
      const sharedSkills = (hit.skillNames ?? []).filter((s) => skills.has(lc(s)));
      const sharedIndustries = (hit.industries ?? []).filter((s) => industries.has(lc(s)));
      const sameCity = Boolean(city) && lc(hit.location ?? '').startsWith(city);
      const score = sharedSkills.length * 2 + sharedIndustries.length * 2 + (sameCity ? 1 : 0) + (hit.role === person.role ? 1 : 0);
      return { hit, shared: [...sharedSkills, ...sharedIndustries].slice(0, 3), score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.hit.displayName.localeCompare(b.hit.displayName))
    .slice(0, limit)
    .map(({ hit, shared }) => ({ hit, shared }));
}

export function SimilarProfiles({
  person,
  viewerId,
}: {
  person: { userId: string; role?: string | null; skills: readonly string[]; industries: readonly string[]; location?: string | null };
  viewerId: string | null;
}) {
  const roles = person.role ? [person.role] : undefined;
  const q = useQuery({
    queryKey: qk('members', 'similar', person.userId, person.role ?? ''),
    queryFn: () => searchProfiles({ roles, limit: 30 }),
    enabled: !!person.userId,
    staleTime: 5 * 60_000,
    retry: 0,
  });
  const ranked = useMemo(() => rankSimilar(q.data?.hits ?? [], person, viewerId), [q.data, person, viewerId]);
  return (
    <div className="space-y-3">
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground"><BilingualText en="Looking…" el="Αναζήτηση…" compact /></p>
      ) : ranked.length ? (
        <ul className="space-y-3">
          {ranked.map(({ hit, shared }) => (
            <li key={hit.userId} className="flex min-w-0 items-start gap-3">
              <Avatar className="h-9 w-9">
                <AvatarImage src={hit.avatarUrl ?? undefined} />
                <AvatarFallback className="bg-primary/10 text-xs text-primary-accessible">{initialsOf(hit.displayName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-x-1.5">
                  <Link href={`/profiles/${hit.userId}`} className="truncate text-sm font-medium text-foreground hover:text-primary-accessible">{hit.displayName}</Link>
                  <PersonVerifiedBadge userId={hit.userId} />
                </div>
                {hit.headline ? <p className="line-clamp-1 text-xs text-muted-foreground">{hit.headline}</p> : null}
                <p className="text-xs text-muted-foreground">
                  {shared.length ? (
                    <BilingualText en={`In common: ${shared.join(', ')}`} el={`Κοινά: ${shared.join(', ')}`} compact wrap />
                  ) : (
                    <StatusText value={hit.role} />
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground"><BilingualText en="No similar profiles yet." el="Κανένα παρόμοιο προφίλ ακόμη." wrap /></p>
      )}
      <p className="text-xs text-muted-foreground">
        <BilingualText en="By shared role, skills, industry and city - never by who viewed whom." el="Με κοινό ρόλο, δεξιότητες, κλάδο και πόλη - ποτέ με το ποιος είδε ποιον." wrap />
      </p>
      <Button variant="outline" size="sm" className="w-full" asChild>
        <Link href="/discover"><BilingualText en="Find more people" el="Βρείτε περισσότερους" compact /></Link>
      </Button>
    </div>
  );
}

// ── Rail: recommendations (approved endorsements) ───────────────────────────

/** What others wrote and the person approved, with the relationship the platform can see. */
export function ProfileRecommendations({ userId }: { userId: string }) {
  const q = useQuery({ queryKey: qk('endorsements', 'received', userId, 'approved'), queryFn: () => getEndorsementsForUser(userId), enabled: !!userId, retry: 0, staleTime: 60_000 });
  const items = (q.data?.endorsements ?? []).filter((e) => e.isApproved !== false);
  return (
    <div className="space-y-3">
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground"><BilingualText en="Loading…" el="Φόρτωση…" compact /></p>
      ) : items.length ? (
        <ul className="space-y-3">
          {items.slice(0, 3).map((e) => {
            const basis = (e.basis ?? []).filter(isEndorsementBasis);
            return (
              <li key={e.id} className="min-w-0 space-y-1">
                <p className="text-sm text-foreground">
                  <span className="font-medium">{e.fromUser?.displayName ?? 'Member'}</span>
                  {e.skill ? <span className="text-muted-foreground"> · {e.skill}</span> : null}
                </p>
                {e.content ? <p className="line-clamp-3 text-sm text-muted-foreground">“{e.content}”</p> : null}
                {basis.length ? (
                  <p className="text-xs text-status-success">
                    <BilingualText
                      en={basis.map((b) => ENDORSEMENT_BASIS_COPY[b].en).join(' · ')}
                      el={basis.map((b) => ENDORSEMENT_BASIS_COPY[b].el).join(' · ')}
                      compact
                      wrap
                    />
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground"><BilingualText en="No recommendations yet." el="Καμία σύσταση ακόμη." wrap /></p>
      )}
      {items.length > 3 ? (
        <p className="text-xs text-muted-foreground"><BilingualText en={`${items.length} in all`} el={`${items.length} συνολικά`} compact /></p>
      ) : null}
    </div>
  );
}

