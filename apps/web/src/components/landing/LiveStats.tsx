'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BilingualText } from '@/components/common/BilingualText';
import { getPublicStats, type PublicStats } from '@/lib/api';
import { qk } from '@/lib/query-keys';

/**
 * The landing page's counts, measured by `GET /api/public/stats` (the demo
 * world answers it with the demo's own people). Nothing numeric renders
 * while loading or when the endpoint is unreachable: a number that is not
 * measured is worse than no number.
 */
export function usePublicStats() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const query = useQuery({
    queryKey: qk('public-stats'),
    queryFn: getPublicStats,
    enabled: mounted,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  return query.data ?? null;
}

const number = (n: number) => n.toLocaleString();

/** The hero's three-tile strip. Absent until the counts arrive. */
export function LiveStatsStrip() {
  const stats = usePublicStats();
  if (!stats) return null;
  const items: Array<{ value: string; label: { en: string; el: string } }> = [
    { value: number(stats.members), label: { en: 'Members', el: 'Μέλη' } },
    { value: number(stats.connections), label: { en: 'Accepted connections', el: 'Αποδεκτές συνδέσεις' } },
    { value: number(stats.events), label: { en: 'Events listed', el: 'Εκδηλώσεις' } },
  ];
  return (
    <div className="mt-8 w-full animate-fade-in sm:mt-16" style={{ animationDelay: '400ms' }}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-6">
        {items.map(({ value, label }) => (
          <div key={label.en} className="rounded-xl border border-border bg-card/50 px-3 py-3 text-center backdrop-blur-sm sm:p-4">
            <p className="landing-stat font-display font-bold text-foreground">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              <BilingualText en={label.en} el={label.el} compact />
            </p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-2xs text-muted-foreground">
        <BilingualText en="Live counts · measured today" el="Μετρημένα σήμερα" compact />
      </p>
    </div>
  );
}

const TILES: Array<{ key: keyof Omit<PublicStats, 'measuredAt'>; label: { en: string; el: string }; sub: { en: string; el: string } }> = [
  { key: 'members', label: { en: 'Registered Members', el: 'Εγγεγραμμένα μέλη' }, sub: { en: 'founders, mentors & investors', el: 'ιδρυτές, μέντορες & επενδυτές' } },
  { key: 'connections', label: { en: 'Accepted Connections', el: 'Αποδεκτές συνδέσεις' }, sub: { en: 'requests both people accepted', el: 'αιτήματα που αποδέχτηκαν και οι δύο' } },
  { key: 'mentors', label: { en: 'Mentors Available', el: 'Διαθέσιμοι μέντορες' }, sub: { en: 'mentor, advisor, coach & course roles', el: 'ρόλοι μέντορα, συμβούλου & coach' } },
  { key: 'events', label: { en: 'Events Listed', el: 'Εκδηλώσεις' }, sub: { en: 'online & in-person', el: 'διαδικτυακές & δια ζώσης' } },
  { key: 'organizations', label: { en: 'Organizations', el: 'Οργανισμοί' }, sub: { en: 'incubators, accelerators & programmes here', el: 'θερμοκοιτίδες, επιταχυντές & προγράμματα εδώ' } },
];

/**
 * The "By the numbers" section with its heading. The heading and the grid
 * arrive together, so an unreachable endpoint leaves no titled empty band.
 * Every label says what is counted: "Successful connections - meaningful
 * introductions" and "Partner organisations" claimed more than an accepted
 * request or an active organisation row.
 */
export function LiveStatsSection({ heading }: { heading: ReactNode }) {
  const stats = usePublicStats();
  if (!stats) return null;
  return (
    <section className="border-t border-border bg-primary/[0.03] px-6 py-20 sm:px-8 lg:px-12 xl:px-16">
      <div className="mx-auto w-full">
        {heading}
        <LiveStatsGrid />
      </div>
    </section>
  );
}

/** The "By the numbers" grid. Absent until the counts arrive. */
export function LiveStatsGrid() {
  const stats = usePublicStats();
  if (!stats) return null;
  return (
    <>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {TILES.map(({ key, label, sub }, index) => (
          <div
            key={key}
            className="animate-fade-in rounded-2xl border border-border bg-card/80 p-6 text-center backdrop-blur-sm"
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <p className="font-display text-4xl font-bold text-primary-accessible">{number(stats[key])}</p>
            <p className="mt-2 font-semibold text-foreground"><BilingualText en={label.en} el={label.el} compact /></p>
            <p className="mt-1 text-xs text-muted-foreground"><BilingualText en={sub.en} el={sub.el} wrap /></p>
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        <BilingualText en="Live counts, measured today" el="Μετρημένα σήμερα" wrap />
      </p>
    </>
  );
}
