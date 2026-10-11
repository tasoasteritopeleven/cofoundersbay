'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMentorDashboardStats } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import {
  Star,
  Search,
  Filter,
  ThumbsUp,
  MessageSquare,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/common/EmptyState';
import { useDemoData } from '@/contexts/DemoDataContext';
import { cn } from '@/lib/utils';
import { MENTOR_DEMO_REVIEWS } from '@/lib/demo/mentor-world';
import { choiceControl, usePageControls, usePageList } from '@/lib/page-controls';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualInline } from '@/lib/i18n/format';
import { formatDate } from '@/lib/i18n/format';
import { CardHead, CardFoot } from '@/components/common/CardAnatomy';

type Review = {
  id: string;
  mentee: string;
  menteeAvatar?: string;
  rating: number;
  comment: string;
  date: string;
  sessionType: string;
  helpful: number;
};

function StarRating({ rating }: { rating: number }) {
  return (
    // data-keep-icon: inside a card the decorative-icon rule hides every
    // bare glyph, and these stars are the rating itself.
    <div data-keep-icon="" className="flex gap-0.5" role="img" aria-label={bilingualInline(`${rating} of 5 stars`, `${rating} από 5 αστέρια`)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            'h-4 w-4',
            star <= rating ? 'fill-status-warning text-status-warning' : 'text-muted-foreground/30'
          )}
        />
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <Card className="transition-all hover:border-primary/20">
      <CardContent className="space-y-3">
        <CardHead
          mark={(
            <Avatar className="h-10 w-10">
              <AvatarImage src={review.menteeAvatar} alt="" />
              <AvatarFallback className="bg-primary/10 font-semibold text-primary-accessible">{review.mentee[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
          )}
          title={review.mentee}
          subtitle={review.sessionType}
          meta={<StarRating rating={review.rating} />}
        />
        {/* The quote starts on the avatar's edge, as on Endorsements. */}
        <p className="card-body text-muted-foreground">{review.comment}</p>
        <CardFoot meta={review.date || undefined}>
          {/* Neither had a handler, and reviews have no helpful count or
              reply field to write - the same as on the provider side. */}
          <Button variant="ghost" size="sm" disabled title={bilingualInline('Reviews cannot be marked helpful yet', 'Οι αξιολογήσεις δεν μπορούν ακόμη να σημειωθούν ως χρήσιμες')}>
            <ThumbsUp className="mr-1 icon-sm" aria-hidden="true" />
            <BilingualText en={`Helpful (${review.helpful})`} el={`Χρήσιμο (${review.helpful})`} compact />
          </Button>
          <Button variant="ghost" size="sm" disabled title={bilingualInline('Replies to reviews are not stored yet', 'Οι απαντήσεις σε αξιολογήσεις δεν αποθηκεύονται ακόμη')}>
            <MessageSquare className="mr-1 icon-sm" aria-hidden="true" />
            <BilingualText en="Reply" el="Απάντηση" compact />
          </Button>
        </CardFoot>
      </CardContent>
    </Card>
  );
}

// The mentees whose sessions /mentor/earnings lists (demo/mentor-world),
// dated relative to today rather than to March 2025. The date is stamped from
// `now`, which is set after mount: the page is prerendered, and a date worked
// out at build time disagreed with the browser once the day changed (#418).
function sampleReviews(now: number | null): Review[] {
  return MENTOR_DEMO_REVIEWS.map((r) => ({
    id: r.id,
    mentee: r.mentee,
    rating: r.rating,
    comment: r.comment,
    date: now == null ? '' : formatDate(now - r.ago * 86_400_000, 'en', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    sessionType: r.sessionType,
    helpful: r.helpful,
  }));
}

export default function MentorReviewsPage() {
  const { showDemoData } = useDemoData();
  const [search, setSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState<string>('all');

  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  const reviews = useMemo(() => (showDemoData ? sampleReviews(now) : []), [showDemoData, now]);
  // The four side figures were constants (48 sessions, 92% response rate, 15
  // repeat mentees, 43 helpful votes) that disagreed with the mentor
  // dashboard. They are the dashboard's own counts now, and helpful votes are
  // summed from the reviews on this page.
  const { data: stats } = useQuery({
    queryKey: qk('mentorships', 'dashboard', 'mentor'),
    queryFn: getMentorDashboardStats,
    retry: 0,
  });
  const helpfulVotes = reviews.reduce((sum, r) => sum + (r.helpful ?? 0), 0);

  const filteredReviews = reviews.filter((r) => {
    const matchesSearch =
      !search ||
      r.mentee.toLowerCase().includes(search.toLowerCase()) ||
      r.comment.toLowerCase().includes(search.toLowerCase());
    const matchesRating =
      ratingFilter === 'all' || r.rating === parseInt(ratingFilter);
    return matchesSearch && matchesRating;
  });

  const avgRating = (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1);
  const ratingDistribution = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: reviews.filter((r) => r.rating === rating).length,
    percentage: (reviews.filter((r) => r.rating === rating).length / reviews.length) * 100,
  }));

  // Offered to the assistant, above the empty return: the rating filter;
  // the reviews on screen go out as a list.
  usePageList([
    {
      id: 'reviews',
      labelEn: 'Reviews',
      labelEl: 'Κριτικές',
      rows: filteredReviews.map((r) => `${r.rating}★ · ${r.mentee} · ${r.sessionType} · "${r.comment}"`),
      total: reviews.length,
      sample: showDemoData,
    },
  ]);
  usePageControls([
    choiceControl('rating_filter', 'Rating filter', 'Φίλτρο βαθμολογίας', [
      { value: 'all', en: 'All ratings', el: 'Όλες οι βαθμολογίες' },
      ...[5, 4, 3, 2, 1].map((n) => ({ value: String(n), en: `${n} stars`, el: `${n} αστέρια` })),
    ], ratingFilter, setRatingFilter),
  ]);

  if (!showDemoData && reviews.length === 0) {
    return (
      <AppShell showHelp title="Reviews" titleEl="Αξιολογήσεις" description="Feedback from your mentoring sessions" descriptionEl="Σχόλια από τις συνεδρίες καθοδήγησής σας">
        <EmptyState
          illustration="default"
          title="No reviews yet"
          description="Reviews will appear here after your mentees complete sessions and leave feedback."
          askAiPrompt="I have no mentor reviews yet. What should I do in sessions so mentees leave useful feedback?"
        />
      </AppShell>
    );
  }

  return (
    <AppShell showHelp title="Reviews" titleEl="Αξιολογήσεις" description="Feedback from your mentoring sessions" descriptionEl="Σχόλια από τις συνεδρίες καθοδήγησής σας">
      <div className="space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-3xl font-bold">{avgRating}</p>
                  <StarRating rating={Math.round(parseFloat(avgRating))} />
                  <p className="text-sm text-muted-foreground mt-1"><BilingualText en={`${reviews.length} reviews`} el={`${reviews.length} αξιολογήσεις`} compact /></p>
                </div>
                <div className="flex-1 space-y-2">
                  {ratingDistribution.map((item) => (
                    <div key={item.rating} data-keep-icon="" className="flex items-center gap-2">
                      <span className="text-sm w-3">{item.rating}</span>
                      <Star className="icon-sm fill-status-warning text-status-warning" />
                      <Progress value={item.percentage} className="h-2 flex-1" />
                      <span className="text-xs text-muted-foreground w-6">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground"><BilingualText en="Sessions given" el="Συνεδρίες που δόθηκαν" compact /></p>
                  <p className="page-stat text-xl font-bold tabular-nums">{stats?.totalSessions ?? '\u2014'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground"><BilingualText en="Active mentees" el="Ενεργοί καθοδηγούμενοι" compact /></p>
                  <p className="page-stat text-xl font-bold tabular-nums">{stats?.activeMentees ?? '\u2014'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground"><BilingualText en="Mentorships completed" el="Ολοκληρωμένες καθοδηγήσεις" compact wrap /></p>
                  <p className="page-stat text-xl font-bold tabular-nums">{stats?.completedMentorships ?? '\u2014'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground"><BilingualText en="Helpful votes" el="Ψήφοι «χρήσιμο»" compact /></p>
                  <p className="page-stat text-xl font-bold tabular-nums">{helpfulVotes}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" />
            <Input
              aria-label={bilingualInline("Search mentor reviews", "Αναζήτηση αξιολογήσεων μεντόρων")}
              placeholder={bilingualInline("Search reviews…", "Αναζήτηση αξιολογήσεων…")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={ratingFilter} onValueChange={setRatingFilter}>
            <SelectTrigger aria-label="Rating. Βαθμολογία" className="w-full sm:w-[150px]">
              <SelectValue placeholder={bilingualInline("Rating", "Βαθμολογία")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all"><BilingualText en="All Ratings" el="Όλες οι βαθμολογίες" compact /></SelectItem>
              <SelectItem value="5"><BilingualText en="5 stars" el="5 αστέρια" compact /></SelectItem>
              <SelectItem value="4"><BilingualText en="4 stars" el="4 αστέρια" compact /></SelectItem>
              <SelectItem value="3"><BilingualText en="3 stars" el="3 αστέρια" compact /></SelectItem>
              <SelectItem value="2"><BilingualText en="2 stars" el="2 αστέρια" compact /></SelectItem>
              <SelectItem value="1"><BilingualText en="1 star" el="1 αστέρι" compact /></SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Reviews List */}
        <div className="space-y-3">
          {filteredReviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
          {filteredReviews.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Star className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" aria-hidden="true" />
                <h3 className="font-medium"><BilingualText en="No reviews found" el="Δεν βρέθηκαν αξιολογήσεις" compact /></h3>
                <p className="text-sm text-muted-foreground mt-1">
                  <BilingualText en="Try adjusting your filters" el="Δοκιμάστε άλλα φίλτρα" compact />
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
