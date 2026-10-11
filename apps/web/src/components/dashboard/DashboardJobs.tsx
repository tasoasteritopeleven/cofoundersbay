'use client';

import Link from 'next/link';
import { Briefcase, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { JobPostingView } from '@/lib/api';

export type JobOffer = {
  id: string;
  title: string;
  company?: string;
  role?: string;
  location?: string;
  href?: string;
};

const defaultJobs: JobOffer[] = [
  { id: '1', title: 'Technical Co-Founder', company: 'Stealth SaaS', role: 'Founder', location: 'Remote', href: '/discover' },
  { id: '2', title: 'Growth Lead', company: 'Seed Stage', role: 'Founder', location: 'Athens', href: '/discover' },
  { id: '3', title: 'CPO / Product', company: 'B2B Startup', role: 'Founder', location: 'Remote', href: '/discover' },
];

function mapApiJobsToOffers(jobs: JobPostingView[]): JobOffer[] {
  return jobs.map((j) => ({
    id: j.id,
    title: j.title,
    company: j.creator.displayName,
    role: j.role ?? undefined,
    location: j.isRemote ? 'Remote' : j.location ?? undefined,
    href: j.href ?? '/discover',
  }));
}

type DashboardJobsProps = {
  jobs?: JobPostingView[] | null;
  className?: string;
};

export function DashboardJobs({ jobs, className }: DashboardJobsProps) {
  const list = jobs?.length ? mapApiJobsToOffers(jobs) : defaultJobs;

  return (
    <Card className={cn('', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Briefcase className="icon-sm text-muted-foreground" />
          Current job offers
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/discover">
            View all <ArrowRight className="ml-1 icon-sm" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {list.slice(0, 4).map((job) => (
            <li key={job.id}>
              <Link
                href={job.href ?? '/discover'}
                className="block rounded-lg border border-border bg-card/60 p-3 text-sm transition-colors hover:bg-secondary/60"
              >
                <p className="font-medium text-foreground">{job.title}</p>
                {(job.company || job.location) && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {[job.company, job.location].filter(Boolean).join(' · ')}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
