'use client';

import Link from 'next/link';
import { Mail, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { bilingualInline } from '@/lib/i18n/format';

export type NewsletterItem = {
  id: string;
  title: string;
  excerpt?: string;
  date?: string;
  href?: string;
};

const defaultAnnouncements: NewsletterItem[] = [
  { id: '1', title: 'Community update: Q1 priorities', excerpt: 'Roadmap and upcoming features.', date: 'Feb 12', href: '#' },
  { id: '2', title: 'New matching algorithm', excerpt: 'Improved relevance for co-founder suggestions.', date: 'Feb 8', href: '#' },
];

type DashboardNewsletterProps = {
  items?: NewsletterItem[] | null;
  className?: string;
};

export function DashboardNewsletter({
  items = defaultAnnouncements,
  className,
}: DashboardNewsletterProps) {
  const list = items ?? defaultAnnouncements;

  return (
    <Card className={cn('', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Mail className="icon-sm text-muted-foreground" />
          Announcements & newsletter
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {list.slice(0, 3).map((item) => (
            <li key={item.id}>
              <Link
                href={item.href ?? '#'}
                className="block rounded-lg border border-border bg-card/60 p-3 text-sm transition-colors hover:bg-secondary/60"
              >
                <p className="font-medium text-foreground">{item.title}</p>
                {item.excerpt && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {item.excerpt}
                  </p>
                )}
                {item.date && (
                  <p className="text-xs text-muted-foreground mt-0.5">{item.date}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input
            placeholder={bilingualInline("Your email", "Το email σας")}
            className="flex-1 text-sm"
            type="email"
            aria-label="Newsletter email"
            disabled
            title="The newsletter has no subscription service yet"
          />
          <Button aria-label="Subscribe" size="sm" className="shrink-0" disabled title="The newsletter has no subscription service yet">
            <ArrowRight className="icon-sm" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
