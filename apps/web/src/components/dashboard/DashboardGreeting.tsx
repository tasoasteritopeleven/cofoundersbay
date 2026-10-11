'use client';

import { useEffect, useState } from 'react';
import { BilingualText } from '@/components/common/BilingualText';
import { dashboardEl, dashboardEn } from '@/lib/i18n/strings-dashboard';

type Part = { en: string; el: string };

function partOfDay(hour: number): Part {
  if (hour < 12) return { en: dashboardEn('good_morning'), el: dashboardEl('good_morning') };
  if (hour < 17) return { en: dashboardEn('good_afternoon'), el: dashboardEl('good_afternoon') };
  return { en: dashboardEn('good_evening'), el: dashboardEl('good_evening') };
}

/**
 * The one line under a dashboard's title: who it is for, and what it is about.
 *
 * Every role dashboard opens with the page's name as its heading and this
 * line beneath it. The investor and mentor dashboards had put the greeting in
 * the heading itself ("Good morning, Alex Demo" as the page's h1) while the
 * incubator and provider ones set a second, larger greeting inside the body -
 * four dashboards, three hierarchies. The founder dashboard's version is the
 * model: a quiet sentence, bilingual, that does not compete with the title.
 *
 * The part of the day is resolved after mount: the server renders in its own
 * time zone, and a greeting computed there would not match the reader's clock.
 */
export function DashboardGreeting({ name, lead }: { name: string; lead: Part }) {
  const [part, setPart] = useState<Part | null>(null);
  useEffect(() => setPart(partOfDay(new Date().getHours())), []);
  const hello: Part = part ?? { en: 'Hello', el: 'Γεια σας' };
  return (
    <p className="text-sm text-muted-foreground">
      <BilingualText
        en={`${hello.en}, ${name}. ${lead.en}`}
        el={`${hello.el}, ${name}. ${lead.el}`}
        stacked
        wrap
        secondaryFrom="lg"
      />
    </p>
  );
}
