'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { GraduationCap, Calendar, Star, CircleSlash, ChevronRight } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { HelpCallout } from '@/components/common/HelpCallout';
import { BilingualText } from '@/components/common/BilingualText';
import { MetricTile } from '@/components/dashboard/MetricTile';
import { EmptyLine, SectionCard } from '@/components/dashboard/SectionCard';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { discoverMentors } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import { initialsOf } from '@/lib/utils';
import { rowOptions, usePageControls, usePageList } from '@/lib/page-controls';

const AVAILABILITY: Record<string, { en: string; el: string; variant: 'success' | 'warning' | 'secondary' }> = {
  available: { en: 'Available', el: 'Διαθέσιμος', variant: 'success' },
  limited: { en: 'Limited', el: 'Περιορισμένα', variant: 'warning' },
  unavailable: { en: 'Unavailable', el: 'Μη διαθέσιμος', variant: 'secondary' },
};

/*
 * "Jane Smith, 8 mentees, 42 sessions" and an average of 4.8 were written into
 * this file, beside a "Pending applicant" row whose button led to the user
 * list - there is no mentor-application queue in the API to review. The
 * roster is now the mentor directory `/mentorship/mentors` serves (the list
 * /coaching reads), the figures are sums over it, and the rows that ask for
 * attention are the real ones: mentors nobody has booked yet, and mentors who
 * are not taking sessions.
 */
export default function MentorshipManagementPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: qk('mentors', 'admin'),
    queryFn: () => discoverMentors({ limit: 100 }),
    staleTime: 60_000,
    retry: 0,
  });

  const mentors = data?.mentors ?? [];
  const sessions = mentors.reduce((sum, m) => sum + (m.sessionCount ?? 0), 0);
  const rated = mentors.filter((m) => m.rating != null && m.reviewCount > 0);
  const reviews = rated.reduce((sum, m) => sum + m.reviewCount, 0);
  // Weighted by reviews, so one five-star review does not outvote twenty.
  const avg = reviews ? rated.reduce((sum, m) => sum + (m.rating ?? 0) * m.reviewCount, 0) / reviews : null;
  const unbooked = mentors.filter((m) => !m.sessionCount);
  const unavailable = mentors.filter((m) => m.availabilityStatus === 'unavailable');
  const sorted = [...mentors].sort((a, b) => (b.sessionCount ?? 0) - (a.sessionCount ?? 0));
  const dash = '—';

  const router = useRouter();
  usePageControls([
    {
      id: 'open_mentor',
      labelEn: 'Open a mentor\'s profile',
      labelEl: 'Άνοιγμα προφίλ μέντορα',
      writes: false,
      options: rowOptions(sorted, (m) => m.userId, (m) => m.displayName),
      unavailableEn: mentors.length === 0 ? 'No mentor profiles yet.' : undefined,
      unavailableEl: mentors.length === 0 ? 'Δεν υπάρχουν προφίλ μεντόρων ακόμα.' : undefined,
      run: (value) => { if (value) router.push(`/profiles/${value}`); },
    },
  ]);
  usePageList([
    {
      id: 'mentors',
      labelEn: 'Mentor roster',
      labelEl: 'Κατάλογος μεντόρων',
      rows: isLoading
        ? undefined
        : sorted.map((m) => `${m.displayName} · ${m.sessionCount ?? 0} sessions · ${m.availabilityStatus}${m.rating != null && m.reviewCount > 0 ? ` · ${m.rating.toFixed(1)}★ (${m.reviewCount})` : ''}`),
      total: mentors.length,
      sample: false,
    },
  ]);

  return (
    <AppShell
      title="Mentorship management"
      titleEl="Διαχείριση καθοδήγησης"
      description="The mentor directory: who is available, who is booked, and how their sessions are rated."
      descriptionEl="Ο κατάλογος μεντόρων: ποιος είναι διαθέσιμος, ποιος έχει κρατήσεις και πώς αξιολογούνται οι συνεδρίες."
      showHelp
    >
      <HelpCallout id="admin-mentorship" title="Mentorship oversight" titleEl="Εποπτεία καθοδήγησης">
        <p>
          A mentor with no sessions has not been booked yet - worth a nudge or a featured slot. Ratings are averaged
          over reviews, so a mentor with many reviews weighs more than one with a single rating.
        </p>
        <p lang="el" className="mt-2 text-muted-foreground">
          Ένας μέντορας χωρίς συνεδρίες δεν έχει κλειστεί ακόμα - αξίζει μια υπενθύμιση ή προβολή. Οι βαθμολογίες
          σταθμίζονται με τις κριτικές, οπότε όποιος έχει πολλές κριτικές μετρά περισσότερο από όποιον έχει μία.
        </p>
      </HelpCallout>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MetricTile icon={GraduationCap} label="Mentors" labelEl="Μέντορες" value={isLoading ? dash : mentors.length} href="/coaching" />
        <MetricTile icon={Calendar} label="Sessions held" labelEl="Συνεδρίες" value={isLoading ? dash : sessions} caption="All time, across the directory" captionEl="Συνολικά, σε όλο τον κατάλογο" />
        <MetricTile
          icon={Star}
          label="Average rating"
          labelEl="Μέση βαθμολογία"
          value={isLoading ? dash : avg != null ? avg.toFixed(1) : dash}
          caption={reviews ? `From ${reviews} reviews` : 'No reviews yet'}
          captionEl={reviews ? `Από ${reviews} κριτικές` : 'Καμία κριτική ακόμα'}
        />
        <MetricTile
          icon={CircleSlash}
          label="Not yet booked"
          labelEl="Χωρίς κράτηση"
          value={isLoading ? dash : unbooked.length}
          caption={unavailable.length ? `${unavailable.length} not taking sessions` : 'Everyone is taking sessions'}
          captionEl={unavailable.length ? `${unavailable.length} δεν δέχονται συνεδρίες` : 'Όλοι δέχονται συνεδρίες'}
        />
      </div>

      <SectionCard title="Mentor roster" titleEl="Κατάλογος μεντόρων" icon={GraduationCap} className="mt-6" action={{ href: '/coaching', label: 'Public directory', labelEl: 'Δημόσιος κατάλογος' }}>
        {isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}
        {!isLoading && isError && mentors.length === 0 && (
          <EmptyLine en="The mentor directory could not be loaded." el="Ο κατάλογος μεντόρων δεν φορτώθηκε." />
        )}
        {!isLoading && !isError && mentors.length === 0 && (
          <EmptyLine en="No mentor profiles yet." el="Δεν υπάρχουν προφίλ μεντόρων ακόμα." />
        )}
        {sorted.map((m) => {
          const availability = AVAILABILITY[m.availabilityStatus] ?? AVAILABILITY.available;
          return (
            <Link
              key={m.id}
              href={`/profiles/${m.userId}`}
              className="group flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:border-primary/30 hover:bg-muted/30 focus-ring sm:flex-nowrap"
            >
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarFallback className="bg-muted text-foreground">{initialsOf(m.displayName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 basis-48">
                <p className="truncate text-sm font-medium">{m.displayName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {m.headline ?? m.skills?.slice(0, 3).join(' · ')}
                </p>
              </div>
              <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                <BilingualText
                  en={`${m.sessionCount ?? 0} sessions${m.rating != null && m.reviewCount > 0 ? ` · ${m.rating.toFixed(1)}★ (${m.reviewCount})` : ''}${m.isFree ? ' · free' : m.hourlyRate ? ` · ${m.currency ?? 'EUR'} ${m.hourlyRate}/h` : ''}`}
                  el={`${m.sessionCount ?? 0} συνεδρίες${m.rating != null && m.reviewCount > 0 ? ` · ${m.rating.toFixed(1)}★ (${m.reviewCount})` : ''}${m.isFree ? ' · δωρεάν' : m.hourlyRate ? ` · ${m.currency ?? 'EUR'} ${m.hourlyRate}/ώρα` : ''}`}
                  compact
                />
              </p>
              <Badge variant={availability.variant} size="sm" className="shrink-0">
                <BilingualText en={availability.en} el={availability.el} compact />
              </Badge>
              <ChevronRight className="icon-sm shrink-0 text-muted-foreground/60 group-hover:text-foreground" aria-hidden="true" />
            </Link>
          );
        })}
      </SectionCard>
    </AppShell>
  );
}
