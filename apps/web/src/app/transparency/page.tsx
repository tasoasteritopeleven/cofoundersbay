'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import {
  TRANSPARENCY_COPY,
  TRANSPARENCY_EVENT_KINDS,
  TRANSPARENCY_SURFACES,
  halfYearOf,
  previousHalfYear,
  type HalfYear,
  type TransparencyEventKind,
} from '@cofounderbay/shared';
import { BilingualText } from '@/components/common/BilingualText';
import { MainLandmark } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getTransparencyReport } from '@/lib/api';
import { qk } from '@/lib/query-keys';

/** `2026-H2` → "July–December 2026" / «Ιούλιος–Δεκέμβριος 2026». */
function periodLabel(key: string): { en: string; el: string } {
  const [year, half] = key.split('-H');
  return half === '1'
    ? { en: `January–June ${year}`, el: `Ιανουάριος–Ιούνιος ${year}` }
    : { en: `July–December ${year}`, el: `Ιούλιος–Δεκέμβριος ${year}` };
}

const nf = (n: number) => n.toLocaleString('en-GB');

/**
 * The half-yearly transparency report (LinkedIn comparison §6.14).
 *
 * Every figure is a count the platform recorded: refusals by the contact
 * and promise rules (kind, surface and time only, no user and no text) and
 * the moderation queue's reports. Nothing here is estimated, and a period
 * still running says so. Public, like the privacy policy that links to it.
 */
export default function TransparencyPage() {
  // The period list depends on today's date: computed after mount so a
  // prerendered page never disagrees with the reader's clock.
  const [periods, setPeriods] = useState<HalfYear[]>([]);
  const [period, setPeriod] = useState<string | null>(null);
  useEffect(() => {
    const current = halfYearOf(Date.now());
    const list = [current];
    while (list.length < 4 && list[list.length - 1].key > '2025-H1') list.push(previousHalfYear(list[list.length - 1]));
    setPeriods(list);
    setPeriod(current.key);
  }, []);

  const report = useQuery({
    queryKey: qk('transparency', period ?? 'current'),
    queryFn: () => getTransparencyReport(period ?? undefined),
    enabled: period !== null,
    staleTime: 10 * 60_000,
    retry: 0,
  });
  const data = report.data;
  const label = useMemo(() => (period ? periodLabel(period) : null), [period]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="icon-sm" />
            <span className="text-sm font-medium"><span className="hidden sm:inline">Back to </span>CoFounderBay</span>
          </Link>
          <Button variant="ghost" size="sm" className="whitespace-nowrap px-2 text-xs sm:px-3" asChild>
            <Link href="/privacy"><BilingualText en="Privacy policy" el="Πολιτική απορρήτου" compact /></Link>
          </Button>
        </div>
      </header>

      <MainLandmark className="mx-auto max-w-4xl space-y-8 px-4 py-12">
        <section className="space-y-3">
          <h1 className="text-2xl font-semibold text-foreground">
            <BilingualText en="Transparency report" el="Αναφορά διαφάνειας" compact />
          </h1>
          <p className="text-muted-foreground">
            <BilingualText
              en="What our safety rules refused and what members reported, counted every half year. Every figure is something the platform recorded; none is an estimate. A refusal is stored as its kind, where it happened and when, with no user and no text."
              el="Τι απέρριψαν οι κανόνες ασφαλείας μας και τι ανέφεραν τα μέλη, μετρημένα ανά εξάμηνο. Κάθε αριθμός είναι κάτι που κατέγραψε η πλατφόρμα· κανένας δεν είναι εκτίμηση. Μια απόρριψη καταγράφεται ως είδος, σημείο και χρόνος, χωρίς χρήστη και χωρίς κείμενο."
              wrap
            />
          </p>
          {periods.length > 1 ? (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Period · Περίοδος">
              {periods.map((p) => {
                const l = periodLabel(p.key);
                return (
                  <Button key={p.key} size="sm" variant={p.key === period ? 'default' : 'outline'} aria-pressed={p.key === period} onClick={() => setPeriod(p.key)}>
                    <BilingualText en={l.en} el={l.el} compact />
                  </Button>
                );
              })}
            </div>
          ) : null}
        </section>

        {report.isError ? (
          <p role="alert" className="text-sm text-status-danger">
            <BilingualText en="The report could not be loaded. Please try again later." el="Η αναφορά δεν φορτώθηκε. Δοκιμάστε ξανά αργότερα." wrap />
          </p>
        ) : !data || !label ? null : (
          <>
            <p className="text-sm text-muted-foreground">
              <BilingualText
                en={`${label.en}${data.inProgress ? ' — so far; this period is still running.' : '.'}${data.sample ? ' Sample figures in the preview demo.' : ''}`}
                el={`${label.el}${data.inProgress ? ' — μέχρι στιγμής· η περίοδος είναι σε εξέλιξη.' : '.'}${data.sample ? ' Ενδεικτικοί αριθμοί στην προεπισκόπηση.' : ''}`}
                wrap
              />
            </p>

            <section aria-labelledby="refusals-heading" className="space-y-4">
              <h2 id="refusals-heading" className="text-lg font-semibold text-foreground">
                <BilingualText en="Refused by the rules" el="Απορρίψεις από τους κανόνες" compact />
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {TRANSPARENCY_EVENT_KINDS.map((kind: TransparencyEventKind) => {
                  const bucket = data.refusals[kind];
                  const copy = TRANSPARENCY_COPY[kind];
                  return (
                    <Card key={kind}>
                      <CardContent className="space-y-3">
                        <p className="text-sm font-medium text-foreground"><BilingualText en={copy.en} el={copy.el} compact /></p>
                        <p className="page-stat text-3xl font-bold tabular-nums text-foreground">{nf(bucket.total)}</p>
                        <p className="text-xs text-muted-foreground"><BilingualText en={copy.hintEn} el={copy.hintEl} wrap /></p>
                        {bucket.total > 0 ? (
                          <dl className="space-y-1 border-t border-border pt-3 text-sm">
                            {TRANSPARENCY_SURFACES.filter((s) => (bucket.bySurface[s] ?? 0) > 0).map((s) => (
                              <div key={s} className="flex items-baseline justify-between gap-3">
                                <dt className="text-muted-foreground"><BilingualText en={TRANSPARENCY_COPY.surfaces[s].en} el={TRANSPARENCY_COPY.surfaces[s].el} compact /></dt>
                                <dd className="font-medium tabular-nums text-foreground">{nf(bucket.bySurface[s] ?? 0)}</dd>
                              </div>
                            ))}
                          </dl>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground"><BilingualText en={TRANSPARENCY_COPY.notCounted.en} el={TRANSPARENCY_COPY.notCounted.el} wrap /></p>
            </section>

            <section aria-labelledby="reports-heading" className="space-y-4">
              <h2 id="reports-heading" className="text-lg font-semibold text-foreground">
                <BilingualText en="Reports and blocks" el="Αναφορές και αποκλεισμοί" compact />
              </h2>
              <Card>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                    {[
                      { en: 'Reports received', el: 'Αναφορές που λάβαμε', value: data.reports.received },
                      { en: 'Acted on', el: 'Με ενέργεια', value: data.reports.resolved },
                      { en: 'Dismissed', el: 'Απορρίφθηκαν', value: data.reports.dismissed },
                      { en: 'Still open', el: 'Ανοιχτές ακόμη', value: data.reports.open },
                      { en: 'Members blocked by members', el: 'Αποκλεισμοί από μέλη', value: data.blocks },
                    ].map((f) => (
                      <div key={f.en} className="min-w-0 space-y-1">
                        <dt className="text-xs text-muted-foreground"><BilingualText en={f.en} el={f.el} compact wrap /></dt>
                        <dd className="text-xl font-bold tabular-nums text-foreground">{nf(f.value)}</dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>
              <p className="text-xs text-muted-foreground">
                <BilingualText
                  en="Reports are counted when they were filed; acted-on and dismissed when they were decided. Still open is the queue at the end of the period."
                  el="Οι αναφορές μετρώνται όταν υποβλήθηκαν· όσες είχαν ενέργεια ή απορρίφθηκαν, όταν αποφασίστηκαν. Οι ανοιχτές είναι η ουρά στο τέλος της περιόδου."
                  wrap
                />
              </p>
            </section>
          </>
        )}
      </MainLandmark>
    </div>
  );
}
