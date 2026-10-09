'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FactLine } from '@/components/common/FactLine';

type BlogCard = {
  id: string;
  title: string;
  excerpt?: string;
  href?: string;
};

const defaultMomentum = {
  title: 'Build your founder story with a standout profile',
  description: 'Showcase traction, skills, and vision. Connect with talent that aligns to your mission and timeline.',
  badges: ['Founder', 'Mentor', 'Investor', 'Org'],
};

const defaultBlog: BlogCard[] = [
  { id: '1', title: 'How we matched 500+ co-founders', excerpt: 'Behind the algorithm.', href: '#' },
  { id: '2', title: 'Community call recap: Q1 priorities', excerpt: 'Notes and recordings.', href: '#' },
];

type DashboardHeroProps = {
  momentum?: { title: string; description: string; badges?: string[] } | null;
  blogCards?: BlogCard[] | null;
  className?: string;
};

export function DashboardHero({
  momentum = defaultMomentum,
  blogCards = defaultBlog,
  className,
}: DashboardHeroProps) {
  const mom = momentum ?? defaultMomentum;
  const blog = blogCards ?? defaultBlog;

  return (
    <section className={className}>
      <Card className="bg-hero-radial">
        <CardHeader>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="icon-sm text-muted-foreground" />
            Momentum
          </div>
          <CardTitle className="font-display text-2xl">{mom.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>{mom.description}</p>
          {mom.badges && mom.badges.length > 0 && (
            <FactLine items={mom.badges} />
          )}
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" asChild>
              <Link href="/discover">Explore Discover</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/profile">View profile</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">From the blog</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {blog.map((b) => (
            <Link
              key={b.id}
              href={b.href ?? '#'}
              className="block rounded-lg border border-border p-3 text-sm transition-colors hover:bg-secondary/60"
            >
              <p className="font-medium text-foreground">{b.title}</p>
              {b.excerpt && <p className="text-xs text-muted-foreground mt-0.5">{b.excerpt}</p>}
            </Link>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
