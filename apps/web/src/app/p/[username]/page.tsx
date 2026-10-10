'use client';

import { useParams } from 'next/navigation';
import { EndorsementBasisLine } from '@/components/endorsements/EndorsementBasisLine';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { FollowButton } from '@/components/updates/FollowButton';
import {
  MapPin, Globe, Linkedin, Twitter, Github,
  Calendar, Award, Users,
  MessageSquare, UserPlus, Share2, ExternalLink, Clock,
  CheckCircle2, Star, Zap, Target, PenLine,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CardHead } from '@/components/common/CardAnatomy';
import { initialsOf } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { RoleBadge } from '@/components/common/RoleBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { Logo } from '@/components/brand/Logo';
import { getPublicProfile, getEndorsementsForUser, type PublicProfile, type EndorsementItem } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import { PersonVerifiedBadge } from '@/components/commitments/PersonVerifiedBadge';
import { BilingualText } from '@/components/common/BilingualText';
import { MainLandmark } from '@/components/layout/AppShell';
import { ProfileHero } from '@/components/profile/ProfileHero';
import { ProfileExperience } from '@/components/profile/ProfileSections';
import { formatDate } from '@/lib/i18n/format';
import { FactLine } from '@/components/common/FactLine';

function deriveProfileFields(profile: PublicProfile) {
  const rp = (profile.rolePayload ?? {}) as Record<string, unknown>;
  const nameParts = (profile.displayName ?? '').trim().split(' ');
  const firstName = nameParts[0] ?? 'User';
  const lastName = nameParts.slice(1).join(' ') || '';
  const skills = (profile.skills ?? []).map((s) => s.skillName ?? s.skillId);
  const interests = (rp.interests as string[] | undefined) ?? [];
  const achievements = (rp.achievements as string[] | undefined) ?? [];
  const connectionsCount = rp.connectionsCount as number | undefined;
  const projectsCount = rp.projectsCount as number | undefined;
  const lookingFor = (rp.lookingFor as string[] | undefined) ?? [];
  const isVerified = Boolean(rp.isVerified ?? rp.verified);
  const isAvailable = Boolean(rp.isAvailable ?? rp.available ?? rp.openToOpportunities);
  const website = (rp.website ?? rp.websiteUrl) as string | undefined;
  const linkedin = (rp.linkedin ?? rp.linkedinUrl) as string | undefined;
  const twitter = (rp.twitter ?? rp.twitterUrl) as string | undefined;
  const github = (rp.github ?? rp.githubUrl) as string | undefined;
  const joinedAt = new Date(profile.createdAt);
  return { firstName, lastName, skills, interests, achievements, lookingFor, isVerified, isAvailable, website, linkedin, twitter, github, joinedAt, connectionsCount, projectsCount };
}

/**
 * One endorsement as a row of the Endorsements section, read the way the
 * Endorsements page's card reads: who wrote it (mark, name, headline, the
 * relationship), then the skill, the quote and what the platform saw of the
 * work, all on the mark's left edge. It was a framed box inside the card
 * with the author under the quote.
 */
function EndorsementRow({ endorsement }: { endorsement: EndorsementItem }) {
  const author = endorsement.fromUser?.displayName ?? 'Member';
  return (
    <li className="space-y-3 py-4 first:pt-0 last:pb-0">
      <CardHead
        titleAs="p"
        mark={(
          <Avatar className="h-10 w-10">
            <AvatarImage src={endorsement.fromUser?.avatarUrl ?? undefined} alt="" />
            <AvatarFallback className="bg-primary/10 font-semibold text-primary-accessible">
              {initialsOf(author)}
            </AvatarFallback>
          </Avatar>
        )}
        title={author}
        subtitle={endorsement.fromUser?.headline || undefined}
        meta={endorsement.relationship ? (
          <BilingualText en={`Relationship: ${endorsement.relationship}`} el={`Σχέση: ${endorsement.relationship}`} compact wrap />
        ) : undefined}
      />
      <div className="space-y-1.5">
        {endorsement.skill ? <p className="text-xs font-medium text-muted-foreground">{endorsement.skill}</p> : null}
        <blockquote className="card-body italic text-muted-foreground">“{endorsement.content}”</blockquote>
        <EndorsementBasisLine basis={endorsement.basis} />
      </div>
    </li>
  );
}

function EndorsementsSkeleton() {
  return (
    <div className="divide-y divide-border">
      {[1, 2].map((i) => (
        <div key={i} className="space-y-3 py-4 first:pt-0 last:pb-0">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

function ProfilePageSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card><CardContent className="pt-6"><div className="flex gap-6"><Skeleton className="h-28 w-28 rounded-full shrink-0" /><div className="flex-1 space-y-3"><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-72" /><Skeleton className="h-4 w-32" /></div></div></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-5 w-24" /></CardHeader><CardContent className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-5 w-32" /></CardHeader><CardContent><div className="flex flex-wrap gap-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-6 w-20 rounded-full" />)}</div></CardContent></Card>
        </div>
        <div className="space-y-4">
          <Card><CardContent className="pt-6"><div className="grid grid-cols-3 gap-4">{[1,2,3].map(i => <div key={i} className="text-center"><Skeleton className="h-8 w-12 mx-auto mb-1" /><Skeleton className="h-3 w-16 mx-auto" /></div>)}</div></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-5 w-20" /></CardHeader><CardContent><div className="flex flex-wrap gap-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-6 w-16 rounded-full" />)}</div></CardContent></Card>
        </div>
      </div>
    </div>
  );
}

export default function PublicProfilePage() {
  const params = useParams();
  const username = params?.username as string;

  const { data: profile, isLoading: profileLoading, isError } = useQuery({
    queryKey: qk('public-profile', username),
    queryFn: () => getPublicProfile(username),
    staleTime: 60_000,
    retry: 1,
    enabled: !!username,
  });

  const derived = profile ? deriveProfileFields(profile) : null;

  const { data: endorsementsData, isLoading: endorsementsLoading } = useQuery({
    queryKey: qk('endorsements', profile?.userId),
    queryFn: () => getEndorsementsForUser(profile!.userId),
    enabled: !!profile?.userId,
    staleTime: 60_000,
  });

  const endorsements = endorsementsData?.endorsements ?? [];

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2" aria-label="CoFounderBay home">
              <Logo size="sm" />
            </Link>
          </div>
        </header>
        <ProfilePageSkeleton />
      </div>
    );
  }

  if (isError || !profile || !derived) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center">
        <div className="text-center space-y-4 p-8">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Users className="icon-xl text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold text-foreground"><BilingualText en="Profile not found" el="Το προφίλ δεν βρέθηκε" compact /></h2>
          <p className="text-muted-foreground"><BilingualText en="This profile doesn&apos;t exist or may have been removed." el="Αυτό το προφίλ δεν υπάρχει ή έχει αφαιρεθεί." wrap /></p>
          <Button variant="outline" asChild>
            <Link href="/discover"><BilingualText en="Browse Profiles" el="Περιήγηση προφίλ" compact /></Link>
          </Button>
        </div>
      </div>
    );
  }

  const { firstName, lastName, skills, interests, achievements, lookingFor, isVerified, isAvailable, website, linkedin, twitter, github, joinedAt } = derived;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2" aria-label="CoFounderBay home">
            <Logo size="sm" />
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/login"><BilingualText en="Sign In" el="Σύνδεση" compact /></Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/register"><BilingualText en="Join Free" el="Εγγραφή δωρεάν" compact /></Link>
            </Button>
          </div>
        </div>
      </header>

      <MainLandmark className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* The same top card as the signed-in profiles (ProfileHero), with
                the actions a visitor without an account can take. */}
            <ProfileHero
              headingLevel="h1"
              name={`${firstName} ${lastName}`.trim()}
              avatarUrl={profile.avatarUrl}
              nameBadge={
                // The platform's badge when a check stands behind it; otherwise
                // the profile's own flag, labelled as what it is: self-declared.
                <PersonVerifiedBadge
                  userId={username}
                  fallback={isVerified ? (
                    <span title="Self-declared on the profile, not checked by the platform · Δηλωμένο στο προφίλ, χωρίς έλεγχο από την πλατφόρμα" className="inline-flex items-center">
                      <CheckCircle2 className="icon-md text-primary-accessible" aria-hidden="true" />
                      <span className="sr-only">Self-declared on the profile, not checked by the platform · Δηλωμένο στο προφίλ, χωρίς έλεγχο από την πλατφόρμα</span>
                    </span>
                  ) : null}
                />
              }
              headline={profile.headline ?? undefined}
              meta={[
                profile.location ? <><MapPin className="icon-sm" aria-hidden="true" />{profile.location}</> : null,
                profile.timezone ? <><Clock className="icon-sm" aria-hidden="true" />{profile.timezone}</> : null,
                <><Calendar className="icon-sm" aria-hidden="true" /><BilingualText en={`Member since ${formatDate(joinedAt, 'en', { month: 'long', year: 'numeric' })}`} el={`Μέλος από ${formatDate(joinedAt, 'el', { month: 'long', year: 'numeric' })}`} compact /></>,
              ]}
              openTo={isAvailable ? (
                <Badge className="bg-status-success-bg text-status-success border-status-success-border">
                  <Zap className="icon-sm mr-1" />
                  <BilingualText en="Open to Opportunities" el="Ανοιχτός/ή σε ευκαιρίες" compact />
                </Badge>
              ) : null}
              aside={<RoleBadge role={profile.role} />}
              actions={
                <>
                  <Button className="gap-2" asChild>
                    <Link href={`/register?action=message&user=${username}`}>
                      <MessageSquare className="icon-sm" />
                      <BilingualText en="Message" el="Μήνυμα" compact />
                    </Link>
                  </Button>
                  <Button variant="outline" className="gap-2" asChild>
                    <Link href={`/register?action=connect&user=${username}`}>
                      <UserPlus className="icon-sm" />
                      <BilingualText en="Connect" el="Σύνδεση" compact />
                    </Link>
                  </Button>
                  {profile?.userId ? <FollowButton userId={profile.userId} /> : null}
                  {/* Had no handler. */}
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Share profile · Κοινοποίηση προφίλ"
                    onClick={() => {
                      const url = window.location.href;
                      if (navigator.share) void navigator.share({ url }).catch(() => {});
                      else void navigator.clipboard?.writeText(url);
                    }}
                  >
                    <Share2 className="icon-sm" aria-hidden="true" />
                  </Button>
                </>
              }
            />

            {/* About */}
            <Card>
              <CardHeader>
                <CardTitle><BilingualText en="About" el="Σχετικά" compact /></CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {(profile.bio ?? '').split('\n\n').map((p, i) => (
                    <p key={i} className="card-body text-muted-foreground">{p}</p>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Looking For */}
            {lookingFor.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="icon-md text-muted-foreground" aria-hidden="true" />
                    <BilingualText en="Looking For" el="Αναζητά" compact />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <FactLine className="text-sm text-foreground" items={lookingFor} />
                </CardContent>
              </Card>
            )}

            {/* Experience and education, as the editor and the LinkedIn import store them. */}
            <ProfileExperience payload={profile.rolePayload as Record<string, unknown> | null} own={false} />

            {/* Endorsements / Testimonials */}
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <Star className="icon-md text-status-warning" aria-hidden="true" />
                    <BilingualText en="Endorsements" el="Συστάσεις" compact />
                  </CardTitle>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
                    <Link href={`/register?action=endorse&user=${username}`}>
                      <PenLine className="icon-sm" />
                      <BilingualText en="Write Endorsement" el="Γράψτε σύσταση" compact />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {endorsementsLoading ? (
                  <EndorsementsSkeleton />
                ) : endorsements.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {endorsements.map((endorsement) => (
                      <EndorsementRow key={endorsement.id} endorsement={endorsement} />
                    ))}
                  </ul>
                ) : (
                  <div>
                    <p className="card-body text-muted-foreground">
                      <BilingualText en="No endorsements yet" el="Δεν υπάρχουν συστάσεις ακόμα" compact />
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      <BilingualText en={`Be the first to endorse ${firstName}`} el={`Γράψτε πρώτοι σύσταση για ${firstName}`} wrap />
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-4">
            {/* Stats */}
            <Card>
              <CardContent className="pt-6">
                {/* Label and figure on one row: three centred columns did not
                    fit this sidebar ("ConnectionsProjects" ran together). */}
                <dl className="divide-y divide-border/50 text-sm">
                  {[
                    { label: 'Connections', labelEl: 'Συνδέσεις', value: derived?.connectionsCount ?? '—' },
                    { label: 'Projects', labelEl: 'Έργα', value: derived?.projectsCount ?? '—' },
                    { label: 'Endorsements', labelEl: 'Συστάσεις', value: endorsementsLoading ? '—' : endorsements.length },
                  ].map((row) => (
                    <div key={row.label} className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0">
                      <dt className="text-muted-foreground"><BilingualText en={row.label} el={row.labelEl} compact /></dt>
                      <dd className="font-semibold tabular-nums text-foreground">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>

            {/* Skills */}
            <Card>
              <CardHeader>
                <CardTitle><BilingualText en="Skills" el="Δεξιότητες" compact /></CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {skills.length === 0 && <p className="text-sm text-muted-foreground"><BilingualText wrap en="No skills listed" el="Δεν έχουν καταχωριστεί δεξιότητες" compact /></p>}
                  <FactLine className="text-sm text-foreground" items={skills} />
                </div>
              </CardContent>
            </Card>

            {/* Interests */}
            <Card>
              <CardHeader>
                <CardTitle><BilingualText en="Interests" el="Ενδιαφέροντα" compact /></CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {interests.length === 0 && <p className="text-sm text-muted-foreground"><BilingualText wrap en="No interests listed" el="Δεν έχουν καταχωριστεί ενδιαφέροντα" compact /></p>}
                  <FactLine className="text-sm text-foreground" items={interests} />
                </div>
              </CardContent>
            </Card>

            {/* Achievements */}
            {achievements.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="icon-md text-status-warning" aria-hidden="true" />
                    <BilingualText en="Achievements" el="Επιτεύγματα" compact />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {achievements.map((achievement, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <Award className="icon-sm text-status-warning shrink-0" aria-hidden="true" />
                        <span className="text-muted-foreground first-letter:uppercase">{achievement}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Links */}
            <Card>
              <CardHeader>
                <CardTitle><BilingualText en="Links" el="Σύνδεσμοι" compact /></CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!website && !linkedin && !twitter && !github && (
                  <p className="text-sm text-muted-foreground"><BilingualText wrap en="No links added" el="Δεν έχουν προστεθεί σύνδεσμοι" compact /></p>
                )}
                {website && (
                  <a href={website} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <Globe className="icon-sm" />
                    <span className="truncate">{website.replace(/^https?:\/\//, '')}</span>
                    <ExternalLink className="icon-sm ml-auto shrink-0" />
                  </a>
                )}
                {linkedin && (
                  <a href={linkedin} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <Linkedin className="icon-sm" />
                    <span>LinkedIn</span>
                    <ExternalLink className="icon-sm ml-auto shrink-0" />
                  </a>
                )}
                {twitter && (
                  <a href={twitter} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <Twitter className="icon-sm" />
                    <span>Twitter / X</span>
                    <ExternalLink className="icon-sm ml-auto shrink-0" />
                  </a>
                )}
                {github && (
                  <a href={github} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <Github className="icon-sm" />
                    <span>GitHub</span>
                    <ExternalLink className="icon-sm ml-auto shrink-0" />
                  </a>
                )}
              </CardContent>
            </Card>

            {/* CTA: a section card - the question as its title, the line
                under it, the one action. */}
            <Card>
              <CardHeader>
                <CardTitle>
                  <BilingualText en={`Want to connect with ${firstName}?`} el={`Θέλετε να συνδεθείτε με ${firstName};`} compact wrap />
                </CardTitle>
                <CardDescription>
                  <BilingualText en={`Join CoFounderBay to message and connect with founders like ${firstName}.`} el={`Εγγραφείτε στο CoFounderBay για μηνύματα και συνδέσεις με ιδρυτές όπως ${firstName}.`} wrap />
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" asChild>
                  <Link href="/register"><BilingualText en="Join CoFounderBay free" el="Εγγραφείτε δωρεάν στο CoFounderBay" compact wrap /></Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </MainLandmark>

      {/* Footer */}
      <footer className="border-t border-border mt-12 py-8">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} CoFounderBay. All rights reserved.</p>
          <div className="flex items-center justify-center gap-4 mt-2">
            <Link href="/terms" className="hover:text-foreground transition-colors"><BilingualText en="Terms" el="Όροι" compact /></Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors"><BilingualText en="Privacy" el="Απόρρητο" compact /></Link>
            <Link href="/help" className="hover:text-foreground transition-colors"><BilingualText en="Help" el="Βοήθεια" compact /></Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
