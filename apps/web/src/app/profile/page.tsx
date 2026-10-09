'use client';

import { SkillEvidencePanel } from '@/components/profile/SkillEvidencePanel';
import { AvatarVerifiedMark, OwnOpenToPill, VerificationPanel, useMyTrust } from '@/components/profile/ProfileTrust';
import { VerifiedBadge } from '@/components/commitments/VerifiedBadge';
import { ProfileHero } from '@/components/profile/ProfileHero';
import { ProfileActivity, ProfileExperience, SimilarProfiles } from '@/components/profile/ProfileSections';
import { StatusText } from '@/components/common/StatusText';
import { cn } from '@/lib/utils';

import { calculateProfileCompletion } from '@/components/common/ProfileCompletion';
import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MapPin,
  Clock,
  Globe,
  Linkedin,
  Github,
  Twitter,
  Edit,
  Share2,
  Briefcase,
  GraduationCap,
  TrendingUp,
  Building2,
  Languages,
  CheckCircle,
  AlertCircle,
  Target,
  Rocket,
  Users,
  DollarSign,
  Star,
  Award,
  Activity,
  ExternalLink,
  FolderOpen,
  Plus,
  BarChart3,
  Calendar,
  MessageSquare,
  User,
  Settings as SettingsIcon,
} from 'lucide-react';
import { getMeProfile, getDashboardActivity, listConnectionRequests, getEndorsementsForUser } from '@/lib/api';
import { queryKeys, qk } from '@/lib/query-keys';
import { isPreviewDemo } from '@/lib/preview-demo';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { RailAction, RailStats } from '@/components/layout/RailParts';
import { usePageControls, usePageList } from '@/lib/page-controls';
import { useMyBadges } from '@/hooks/useGamification';
import { formatDate } from '@/lib/i18n/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RoleBadge } from '@/components/common/RoleBadge';
import { BilingualText } from '@/components/common/BilingualText';
import { SkillChip } from '@/components/common/SkillChip';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { ContributionGraph } from '@/components/shared/ContributionGraph';
import { AIInsightButton } from '@/components/ai/AIInsightButton';
import { profileEn, profileEl } from '@/lib/i18n/strings-profile';
import { bilingualAria, bilingualInline } from '@/lib/i18n/format';
import { profilePost, useSuggestedPost } from '@/lib/share-text';
import { linkedInShareUrl } from '@/lib/commitments-links';
import { FactLine } from '@/components/common/FactLine';

type ProfileData = Awaited<ReturnType<typeof getMeProfile>>['profile'];

const UserIcon = User;

/*
 * One completeness measure. This card counted six equal items (three skills
 * or more) and read 67% while /profile/edit weighed seven items (one skill,
 * social links) and read 80% for the same profile. Both now read
 * calculateProfileCompletion, the weighted list the edit page and its
 * "missing items" use; only the labels are this page's, in both languages.
 */
const COMPLETION_LABEL: Record<string, { en: string; el: string }> = {
  basic: { en: profileEn('display_name'), el: profileEl('display_name') },
  skills: { en: 'Skills', el: 'Δεξιότητες' },
  bio: { en: profileEn('bio'), el: profileEl('bio') },
  headline: { en: profileEn('headline'), el: profileEl('headline') },
  location: { en: profileEn('location'), el: profileEl('location') },
  avatar: { en: profileEn('avatar'), el: profileEl('avatar') },
  links: { en: 'Social links', el: 'Σύνδεσμοι' },
};

function completionOf(profile: NonNullable<ProfileData>) {
  const fields = calculateProfileCompletion(profile as unknown as Record<string, unknown>);
  const items = fields.map((f) => ({
    done: f.completed,
    labelEn: COMPLETION_LABEL[f.id]?.en ?? f.label,
    labelEl: COMPLETION_LABEL[f.id]?.el ?? f.label,
  }));
  const total = fields.reduce((sum, f) => sum + f.weight, 0);
  const pct = total ? Math.round((fields.filter((f) => f.completed).reduce((sum, f) => sum + f.weight, 0) / total) * 100) : 0;
  return { items, pct, missing: items.filter((i) => !i.done).length };
}

/*
 * Rail panels. These were four cards in a hand-built 320px column beside the
 * profile; the rail now owns that column, so each panel is its content only -
 * the rail section supplies the heading, and a card inside the rail would be a
 * frame inside a frame.
 */
function ProfileCompletionPanel({ profile }: { profile: NonNullable<ProfileData> }) {
  const { items, pct } = completionOf(profile);

  return (
    <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            <BilingualText en={profileEn('profile_completion')} el={profileEl('profile_completion')} compact wrap />
          </p>
          <span className="text-sm font-semibold tabular-nums text-foreground">{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {items.map((item) => (
            <div
              key={item.labelEn}
              /* Done reads as quiet text with a tick; what is missing carries
                 the only emphasis, because it is the only part asking for
                 something. A lilac chip on every finished item made the
                 completed half the loudest thing in the panel. */
              className={`flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-xs leading-snug ${
                item.done
                  ? 'text-muted-foreground'
                  : 'bg-secondary/70 text-foreground'
              }`}
            >
              {item.done
                ? <CheckCircle className="mt-0.5 icon-sm shrink-0 text-status-success" />
                : <AlertCircle className="mt-0.5 icon-sm shrink-0 text-muted-foreground" />}
              {/* `wrap`: two chips per row in a 320px rail leaves about 100px of
                  text, and "Display name · Εμφανιζόμενο όνομα" is 130px. */}
              <BilingualText en={item.labelEn} el={item.labelEl} compact wrap />
            </div>
          ))}
        </div>
        {pct < 100 && (
          <Button size="sm" variant="secondary" className="w-full gap-2 mt-1" asChild>
            <Link href="/profile/edit">
              <Edit className="icon-sm" />
              <BilingualText en={profileEn('complete_profile')} el={profileEl('complete_profile')} />
            </Link>
          </Button>
        )}
    </div>
  );
}

const ROLE_ICONS: Record<string, React.ElementType> = {
  founder: Rocket,
  mentor: GraduationCap,
  investor: TrendingUp,
  org: Building2,
};

function RoleDetails({ role, payload }: { role: string; payload: Record<string, unknown> }) {
  const Icon = ROLE_ICONS[role] ?? Briefcase;

  const renderList = (arr: unknown, label: React.ReactNode): React.ReactNode => {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return (
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <FactLine className="text-sm text-foreground" items={(arr as string[]).map((item) => <StatusText key={item} value={item} />)} />
      </div>
    );
  };

  const renderValue = (val: unknown, label: React.ReactNode): React.ReactNode => {
    if (!val || (typeof val === 'string' && !val.trim())) return null;
    return (
      <div className="space-y-0.5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        {/* Enum values ("idea", "full_time") read as words; free text passes through. */}
        <p className="text-sm text-foreground">{typeof val === 'string' ? <StatusText value={val} /> : String(val)}</p>
      </div>
    );
  };

  const linkEntries = payload.links && typeof payload.links === 'object'
    ? (
        [
          { key: 'websiteUrl', icon: Globe, label: <BilingualText en={profileEn('website')} el={profileEl('website')} compact /> },
          // Brand names are proper nouns — intentionally not translated.
          { key: 'linkedinUrl', icon: Linkedin, label: profileEn('linkedin') },
          { key: 'githubUrl', icon: Github, label: profileEn('github') },
          { key: 'twitterUrl', icon: Twitter, label: profileEn('twitter_x') },
        ] as { key: string; icon: React.ElementType; label: React.ReactNode }[]
      ).reduce<React.ReactNode[]>((acc, { key, icon: Icon2, label }) => {
        const url = (payload.links as Record<string, unknown>)[key];
        if (typeof url !== 'string' || !url.trim()) return acc;
        const href = url.startsWith('http') ? url : `https://${url}`;
        acc.push(
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          >
            <Icon2 className="icon-sm" />
            {label}
          </a>
        );
        return acc;
      }, [])
    : null;

  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="pb-3 border-b border-border">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Icon className="icon-md text-muted-foreground" />
          <BilingualText
            en={`${role.charAt(0).toUpperCase() + role.slice(1)} ${profileEn('details_suffix')}`}
            el={`${profileEl(role as 'founder' | 'mentor' | 'investor' | 'org') || role} — ${profileEl('details_suffix')}`}
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        {role === 'founder' && (
          <>
            {renderValue(payload.stage, <BilingualText en={profileEn('startup_stage')} el={profileEl('startup_stage')} stacked />)}
            {renderValue(payload.commitment, <BilingualText en={profileEn('commitment')} el={profileEl('commitment')} stacked />)}
            {renderList(payload.rolesSought, <BilingualText en={profileEn('looking_for')} el={profileEl('looking_for')} stacked />)}
            {renderList(payload.industries ?? (payload.industry ? [payload.industry] : []), <BilingualText en={profileEn('industries')} el={profileEl('industries')} stacked />)}
          </>
        )}
        {role === 'mentor' && (
          <>
            {renderList(payload.expertiseAreas, <BilingualText en={profileEn('expertise_areas')} el={profileEl('expertise_areas')} stacked />)}
            {renderValue(payload.availability, <BilingualText en={profileEn('availability')} el={profileEl('availability')} stacked />)}
            {renderValue(payload.meetingPreferences, <BilingualText en={profileEn('meeting_preference')} el={profileEl('meeting_preference')} stacked />)}
            {renderValue(payload.hourlyRate, <BilingualText en={profileEn('rate')} el={profileEl('rate')} stacked />)}
          </>
        )}
        {role === 'investor' && (
          <>
            {renderList(payload.investmentFocus, <BilingualText en={profileEn('investment_focus')} el={profileEl('investment_focus')} stacked />)}
            {renderList(payload.stages, <BilingualText en={profileEn('investment_stages')} el={profileEl('investment_stages')} stacked />)}
            {renderValue(payload.typicalCheckSize ?? [payload.checkSizeMin, payload.checkSizeMax].filter(Boolean).join(' – '), <BilingualText en={profileEn('check_size')} el={profileEl('check_size')} stacked />)}
            {renderList(payload.geography, <BilingualText en={profileEn('geography')} el={profileEl('geography')} stacked />)}
          </>
        )}
        {role === 'org' && (
          <>
            {renderValue(payload.organizationType, <BilingualText en={profileEn('organization_type')} el={profileEl('organization_type')} stacked />)}
            {renderList(payload.programTypes, <BilingualText en={profileEn('programs')} el={profileEl('programs')} stacked />)}
          </>
        )}
        {linkEntries && linkEntries.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <BilingualText en={profileEn('links')} el={profileEl('links')} />
            </p>
            <div className="flex flex-wrap gap-2">
              {linkEntries}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { success } = useToast();
  // The skills card showed six and offered to show all of them; the rest were
  // unreachable because the offer had no handler behind it.
  const [showAllSkills, setShowAllSkills] = React.useState(false);

  // Verification and "Open to" as Settings holds them (shared cache keys).
  const trust = useMyTrust();
  const { data: meData, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: queryKeys.me.profile(),
    queryFn: getMeProfile,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  /*
   * The activity grid plots the account's own recorded activity, bucketed by
   * day. Before this it rendered `generateDemoData`, so the profile showed a
   * year of invented contributions that changed on every render.
   */
  const { data: activityPage } = useQuery({
    queryKey: qk('dashboard', 'activity', 'profile-graph'),
    queryFn: () => getDashboardActivity({ limit: 200 }),
    staleTime: 5 * 60_000,
    retry: 0,
  });

  const activityByDay = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of activityPage?.items ?? []) {
      const day = item.createdAt.slice(0, 10);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    return Array.from(counts, ([date, count]) => ({ date, count }));
  }, [activityPage]);

  React.useEffect(() => {
    if (isPreviewDemo()) return;
    if (error) { router.replace('/login'); return; }
    if (meData && !meData.hasCompletedOnboarding) { router.replace('/onboarding'); }
  }, [meData, error, router]);

  const profile = meData?.profile ?? null;
  const meId = profile?.userId;

  /*
   * The activity tiles printed a literal '0' for all four figures, for every
   * account, whatever it had done. Each now reads the endpoint the page that
   * owns the figure reads (same cache keys, so a write there updates this),
   * and shows a dash while it has nothing - never an invented zero. Posts has
   * no per-author count endpoint, so it says so instead of guessing.
   */
  const { data: acceptedConnections } = useQuery({
    queryKey: qk('connections', 'accepted', 'for-endorsements'),
    queryFn: () => listConnectionRequests({ type: 'accepted', limit: 50 }),
    enabled: !!meId,
    staleTime: 5 * 60_000,
    retry: 0,
  });
  const { data: receivedEndorsements } = useQuery({
    queryKey: qk('endorsements', 'received', meId),
    queryFn: () => getEndorsementsForUser(meId!, { includeUnapproved: true }),
    enabled: !!meId,
    staleTime: 60_000,
    retry: 0,
  });
  const { data: badges } = useMyBadges();

  const suggested = useSuggestedPost();
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  const publicUrl = profile && origin ? `${origin}/p/${encodeURIComponent(profile.userId)}` : '';

  const handleShare = () => {
    if (!profile) return;
    const url = `${window.location.origin}/profiles/${profile.userId}`;
    navigator.clipboard.writeText(url).then(() =>
      success(bilingualInline(profileEn('link_copied'), profileEl('link_copied')), bilingualInline(profileEn('link_copied_desc'), profileEl('link_copied_desc')))
    );
  };

  const completion = profile ? completionOf(profile) : null;

  usePageControls([
    {
      id: 'copy_profile_link',
      labelEn: profileEn('copy_link'),
      labelEl: profileEl('copy_link'),
      writes: false,
      run: handleShare,
      ...(profile ? {} : { unavailableEn: 'The profile has not loaded yet', unavailableEl: 'Το προφίλ δεν έχει φορτώσει ακόμη' }),
    },
    { id: 'edit_profile', labelEn: profileEn('edit_profile'), labelEl: profileEl('edit_profile'), writes: false, run: () => router.push('/profile/edit') },
    { id: 'open_settings', labelEn: 'Open account settings', labelEl: 'Άνοιγμα ρυθμίσεων λογαριασμού', writes: false, run: () => router.push('/settings') },
    { id: 'open_reputation', labelEn: profileEn('view_reputation'), labelEl: profileEl('view_reputation'), writes: false, run: () => router.push('/reputation') },
    ...(profile?.skills && profile.skills.length > 6
      ? [{ id: 'toggle_all_skills', labelEn: 'Show all skills', labelEl: 'Εμφάνιση όλων των δεξιοτήτων', writes: false, run: () => setShowAllSkills((v: boolean) => !v) }]
      : []),
  ]);
  // What the page shows, so "what is my profile missing?" is answered from
  // the same list the rail draws rather than from a guess.
  usePageList([
    {
      id: 'skills',
      labelEn: 'Skills',
      labelEl: 'Δεξιότητες',
      rows: profile ? (profile.skills ?? []).map((s) => [s.skillName, s.level].filter(Boolean).join(' · ')) : undefined,
      total: profile?.skills?.length,
      sample: isPreviewDemo(),
    },
    {
      id: 'missing',
      labelEn: 'Missing from the profile',
      labelEl: 'Λείπουν από το προφίλ',
      rows: completion ? completion.items.filter((i) => !i.done).map((i) => i.labelEn) : undefined,
      total: completion?.missing,
      sample: isPreviewDemo(),
    },
  ]);

  if (isLoading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-4 w-80">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </div>
    );
  if (!profile) {
    // Reached when the query has settled but carries no profile. This used to be a
    // permanent dead end: a centred "Preparing your profile…" with no retry, no
    // error and no way out, on a query that was never going to run again inside
    // its 5-minute staleTime. It is a real state (a hydrated cache entry can hold
    // null, and an unreachable API resolves to nothing), so it needs an exit —
    // never a label that implies work still in progress when none is.
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            {isFetching ? (
              <BilingualText en={profileEn('preparing_profile')} el={profileEl('preparing_profile')} />
            ) : (
              <BilingualText
                en="We could not load your profile."
                el="Δεν μπορέσαμε να φορτώσουμε το προφίλ σας."
              />
            )}
          </p>
          {!isFetching && (
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <BilingualText en="Try again" el="Δοκιμάστε ξανά" compact />
              </Button>
              <Button asChild size="sm">
                <Link href="/profile/edit">
                  <BilingualText en="Complete your profile" el="Ολοκληρώστε το προφίλ σας" compact />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const rolePayload = (profile.rolePayload ?? {}) as Record<string, unknown>;
  const dash = '—';
  // `/gamification/users/me/badges` answers with earned badges only.
  const earnedBadges = badges?.length;

  const rail: PageRailSection[] = [
    {
      id: 'completion',
      glyph: 'chart',
      labelEn: 'Profile strength',
      labelEl: 'Πληρότητα προφίλ',
      badge: completion && completion.missing > 0 ? completion.missing : null,
      content: <ProfileCompletionPanel profile={profile} />,
    },
    {
      id: 'activity',
      glyph: 'people',
      labelEn: profileEn('activity_reputation'),
      labelEl: profileEl('activity_reputation'),
      content: (
        <div className="space-y-4">
          <RailStats
            items={[
              { key: 'connections', label: profileEn('connections'), labelEl: profileEl('connections'), value: acceptedConnections ? acceptedConnections.connections?.length ?? 0 : dash, icon: Users },
              { key: 'endorsements', label: profileEn('endorsements'), labelEl: profileEl('endorsements'), value: receivedEndorsements ? receivedEndorsements.endorsements?.length ?? 0 : dash, icon: Star },
              { key: 'achievements', label: profileEn('achievements'), labelEl: profileEl('achievements'), value: earnedBadges ?? dash, icon: Award },
              { key: 'posts', label: profileEn('posts'), labelEl: profileEl('posts'), value: dash, icon: MessageSquare },
            ]}
          />
          <div>
            <p className="px-0.5 pb-2 text-xs font-medium text-muted-foreground">
              <BilingualText en={profileEn('activity_graph')} el={profileEl('activity_graph')} compact />
            </p>
            <div className="-mx-1 overflow-hidden">
              <ContributionGraph weeks={18} colorScheme="primary" size="sm" showDays={false} data={activityByDay} />
            </div>
          </div>
          <RailAction icon={Award} en={profileEn('view_reputation')} el={profileEl('view_reputation')} onClick={() => router.push('/reputation')} />
        </div>
      ),
    },
    {
      id: 'verification',
      glyph: 'shield',
      labelEn: profileEn('verification'),
      labelEl: profileEl('verification'),
      content: <VerificationPanel email={profile.email} verification={trust.verification} />,
    },
    {
      id: 'similar',
      glyph: 'people',
      labelEn: 'Similar profiles',
      labelEl: 'Παρόμοια προφίλ',
      content: (
        <SimilarProfiles
          person={{
            userId: profile.userId,
            role: profile.role,
            skills: (profile.skills ?? []).map((s) => s.skillName),
            industries: Array.isArray(rolePayload.industries) ? (rolePayload.industries as string[]) : [],
            location: profile.location,
          }}
          viewerId={profile.userId}
        />
      ),
    },
    {
      id: 'account',
      glyph: 'sliders',
      labelEn: 'Account',
      labelEl: 'Λογαριασμός',
      content: (
        <div className="space-y-1">
          <RailAction icon={SettingsIcon} en={profileEn('settings')} el={profileEl('settings')} onClick={() => router.push('/settings')} />
        </div>
      ),
    },
  ];

  return (
    <AppShell
      rail={rail}
    >
      <div className="space-y-6 pb-10">
        {/* The top card: who, how verified, what they do, where, what they
            are open to, and the actions on one's own profile, in one place
            (ProfileHero, shared with everyone else's profile). */}
        <ProfileHero
          name={profile.displayName}
          avatarUrl={profile.avatarUrl}
          avatarMark={<AvatarVerifiedMark methods={trust.methods} />}
          nameBadge={<VerifiedBadge methods={trust.methods} />}
          headline={
            profile.headline ? (
              profile.headline
            ) : (
              <span className="italic">
                <BilingualText en={profileEn('no_headline_set')} el={profileEl('no_headline_set')} />
              </span>
            )
          }
          meta={[
            profile.location ? <><MapPin className="icon-sm" aria-hidden="true" />{profile.location}</> : null,
            profile.timezone ? <><Clock className="icon-sm" aria-hidden="true" />{profile.timezone}</> : null,
            profile.languages?.length ? <><Languages className="icon-sm" aria-hidden="true" />{profile.languages.join(', ')}</> : null,
            // It printed the current year for everyone ("Joined 2026" on a 2024
            // account); the profile carries its own date.
            profile.createdAt ? (
              <>
                <Calendar className="icon-sm" aria-hidden="true" />
                <BilingualText
                  en={`Joined ${formatDate(profile.createdAt, 'en', { month: 'short', year: 'numeric' })}`}
                  el={`Μέλος από ${formatDate(profile.createdAt, 'el', { month: 'short', year: 'numeric' })}`}
                  compact
                />
              </>
            ) : null,
          ]}
          openTo={<OwnOpenToPill openTo={trust.openTo} />}
          aside={<RoleBadge role={profile.role} className="text-sm px-3 py-1" />}
          actions={
            <>
              <Button size="sm" className="gap-2" asChild>
                <Link href="/profile/edit">
                  <Edit className="icon-sm" />
                  <BilingualText en={profileEn('edit_profile')} el={profileEl('edit_profile')} />
                </Link>
              </Button>
              <Button variant="outline" size="sm" onClick={handleShare} className="gap-2 hidden sm:flex">
                <Share2 className="icon-sm" />
                <BilingualText en={profileEn('share_profile')} el={profileEl('share_profile')} />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleShare} className="sm:hidden" title={bilingualAria(profileEn('copy_link'), profileEl('copy_link'))} aria-label={bilingualAria(profileEn('copy_link'), profileEl('copy_link'))}>
                <Share2 className="icon-sm" />
              </Button>
              {/* The public page (/p/…) carries the Open Graph preview LinkedIn
                  shows; the suggested post text is copied for pasting. */}
              {publicUrl ? (
                <Button variant="outline" size="sm" className="gap-2" asChild>
                  <a
                    href={linkedInShareUrl(publicUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => suggested.copy(profilePost(publicUrl, suggested.lang))}
                    aria-label={bilingualAria('Share your public profile on LinkedIn (opens a new tab)', 'Κοινοποίηση του δημόσιου προφίλ στο LinkedIn (ανοίγει νέα καρτέλα)')}
                  >
                    <Linkedin className="icon-sm" aria-hidden="true" />
                    <BilingualText en="LinkedIn" el="LinkedIn" compact />
                  </a>
                </Button>
              ) : null}
            </>
          }
        />

        {/* One reading column. Completion, activity, verification and the
            settings link lived in a hand-built 320px column beside this one,
            which repeated the header's Edit Profile and Share (as "Copy
            Link") and ran 315px longer than the profile it sat next to. They
            are the page rail's sections now: one place for what supports the
            profile, and the profile itself gets the width. */}
        <div className="grid grid-cols-1 gap-6">
          <div className="space-y-6">
            {/* Bio */}
            <Card className="animate-fade-in stagger-1 shadow-sm border-border">
              <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <UserIcon className="icon-md text-muted-foreground" />
                    <BilingualText en={profileEn('about')} el={profileEl('about')} />
                  </CardTitle>
                  <AIInsightButton
                    prompt={`Review my profile as a ${profile.role} and give me 3 specific tips to improve my positioning and appeal to the right collaborators:\nHeadline: ${profile.headline || 'Not set'}\nBio: ${profile.bio || 'Not set'}\nSkills: ${profile.skills?.map((s) => s.skillName).join(', ') || 'None listed'}`}
                    agentId="pitch-coach"
                    cacheKey={`own-profile-coach-${profile.userId}`}
                    variant="icon"
                    label={bilingualAria(profileEn('ai_coaching_label'), profileEl('ai_coaching_label'))}
                  />
                </div>
              </CardHeader>
              <CardContent className="pt-5">
                {profile.bio ? (
                  <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                    {profile.bio}
                  </p>
                ) : (
                  <div>
                    <p className="text-sm text-muted-foreground mb-3">
                      <BilingualText en={profileEn('bio_empty_hint')} el={profileEl('bio_empty_hint')} />
                    </p>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/profile/edit">
                        <BilingualText en={profileEn('add_bio')} el={profileEl('add_bio')} />
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

          {/* What this person has published, and the roles they have held. */}
          <ProfileActivity userId={profile.userId} own />
          <ProfileExperience payload={rolePayload} own />

          {/* Intent cards — What I'm looking for */}
          {(() => {
            const p = rolePayload as Record<string, unknown>;
            // A field can arrive as a list (lookingFor: ['cofounder', 'mentor']):
            // React prints an array's items back to back, which read as
            // "cofoundermentor". Each value is one word, read through the
            // shared enum map. Stage and commitment are left to the founder
            // details card below, which already shows both.
            const words = (v: unknown): string[] =>
              (Array.isArray(v) ? v : [v]).filter((x): x is string => typeof x === 'string' && x.trim() !== '');
            const shownBelow = profile.role === 'founder';
            const cards: { icon: React.ElementType; labelEn: string; labelEl: string; values: string[] }[] = [
              { icon: Target, labelEn: profileEn('looking_for'), labelEl: profileEl('looking_for'), values: words(p.lookingFor) },
              { icon: Rocket, labelEn: profileEn('startup_stage'), labelEl: profileEl('startup_stage'), values: shownBelow ? [] : words(p.stage) },
              { icon: Users, labelEn: profileEn('commitment'), labelEl: profileEl('commitment'), values: shownBelow ? [] : words(p.commitment) },
              { icon: DollarSign, labelEn: profileEn('compensation'), labelEl: profileEl('compensation'), values: words(p.compensation) },
            ].filter((c) => c.values.length > 0);
            if (!cards.length) return null;
            return (
              <Card className="animate-fade-in stagger-2 shadow-sm border-border">
                <CardHeader className="pb-3 border-b border-border">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Target className="icon-md text-muted-foreground" />
                    <BilingualText en={profileEn('what_looking_for')} el={profileEl('what_looking_for')} />
                  </CardTitle>
                </CardHeader>
                <CardContent className={cn('grid grid-cols-1 gap-4 pt-5', cards.length > 1 && 'sm:grid-cols-2')}>
                  {cards.map(({ icon: Icon, labelEn, labelEl, values }) => (
                    <div key={labelEn} className="min-w-0">
                      <div className="mb-2 flex items-start gap-2.5">
                        <div className="shrink-0 p-1.5 rounded-md bg-primary/10 text-primary-accessible">
                          <Icon className="icon-sm" />
                        </div>
                        {/* min-w-0 lets this flex item shrink — without it the card
                            pushed the page sideways at 640px. `wrap` is what it
                            does once it has shrunk: "Startup stage · Στάδιο
                            νεοφυούς επιχείρησης" is 185px in the 41px two of these
                            cards leave at 1024px, and uppercase with wide tracking
                            makes the label wider than it reads. */}
                        <span className="min-w-0 text-xs font-semibold uppercase leading-snug tracking-wide text-muted-foreground">
                          <BilingualText en={labelEn} el={labelEl} compact wrap />
                        </span>
                      </div>
                      <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm font-medium text-foreground">
                        {values.map((v) => <StatusText key={v} value={v} />)}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })()}

          {/* Role-specific details */}
          {Object.keys(rolePayload).some((k) => k !== 'experience' && k !== 'education') && (
            <div className="animate-fade-in stagger-2">
              <RoleDetails role={profile.role} payload={rolePayload} />
            </div>
          )}

          {/* Skill proficiency bars */}
          {profile.skills && profile.skills.length > 0 && (
            <Card className="animate-fade-in stagger-3 shadow-sm border-border">
              <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <BarChart3 className="icon-md text-muted-foreground" />
                    <BilingualText en={profileEn('top_skills')} el={profileEl('top_skills')} />
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-primary-accessible" asChild>
                    <Link href="/profile/edit">
                      <Plus className="icon-sm" /> <BilingualText en={profileEn('add')} el={profileEl('add')} />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-5">
                {/* A level shows only when the person declared one. The bars
                    used to invent both a level and a percentage from the
                    skill's place in the list. */}
                <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                  {(showAllSkills ? profile.skills : profile.skills.slice(0, 6)).map((s, i) => (
                    <li key={s.skillId ?? s.skillName ?? i} className="flex min-w-0 items-center justify-between gap-3 border-b border-border py-2.5">
                      <span className="min-w-0 truncate text-sm font-medium text-foreground">{s.skillName}</span>
                      {s.level ? (
                        <Badge variant="secondary" size="sm" className="shrink-0 bg-background"><StatusText value={s.level} /></Badge>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {profile.skills.length > 6 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    {/* It offered to show all of them and did nothing; the six
                        after the sixth were simply unreachable. */}
                    <Button
                      variant="link"
                      size="sm"
                      className="text-muted-foreground h-auto p-0"
                      aria-expanded={showAllSkills}
                      onClick={() => setShowAllSkills((shown: boolean) => !shown)}
                    >
                      {showAllSkills ? (
                        <BilingualText en="Show fewer" el="Εμφάνιση λιγότερων" />
                      ) : (
                        <BilingualText en={`${profileEn('show_all_skills')} ${profile.skills.length} ${profileEn('skills_suffix')}`} el={`${profileEl('show_all_skills')} ${profile.skills.length} ${profileEl('skills_suffix')}`} />
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Skills tied to the work that shows them */}
          {meId ? <SkillEvidencePanel userId={meId} editable /> : null}

          {/* Portfolio placeholder. It used to stretch to the right column's
              height, which drew a 550px dashed box around one line of text;
              the empty state keeps its own height now. */}
          <Card className="animate-fade-in shadow-sm border-border">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <FolderOpen className="icon-md text-muted-foreground" />
                  <BilingualText en={profileEn('portfolio_showcase')} el={profileEl('portfolio_showcase')} />
                </CardTitle>
                <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-xs text-primary-accessible">
                  <Link href="/profile/edit">
                    <Plus className="icon-sm" /> <BilingualText en={profileEn('add')} el={profileEl('add')} />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="flex flex-col items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <FolderOpen className="icon-lg" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    <BilingualText en={profileEn('showcase_title')} el={profileEl('showcase_title')} />
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-prose">
                    <BilingualText en={profileEn('showcase_desc')} el={profileEl('showcase_desc')} />
                  </p>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5" asChild>
                  <Link href="/profile/edit" className="mt-2">
                    <Plus className="icon-sm" /> <BilingualText en={profileEn('add_first_item')} el={profileEl('add_first_item')} />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* No content placeholder */}
          {!profile.bio && Object.keys(rolePayload).length === 0 && (
            <Card className="animate-fade-in bg-primary/5 border-primary/15">
              <CardContent className="flex flex-col items-center gap-4 text-center">
                <div className="p-3 bg-background rounded-full shadow-sm mb-2">
                  <Activity className="icon-xl text-primary-accessible" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-lg">
                    <BilingualText en={profileEn('profile_bare_title')} el={profileEl('profile_bare_title')} />
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    <BilingualText en={profileEn('profile_bare_desc')} el={profileEl('profile_bare_desc')} />
                  </p>
                </div>
                <Button className="gap-2 mt-2" asChild>
                  <Link href="/profile/edit">
                    <Edit className="icon-sm" />
                    <BilingualText en={profileEn('complete_profile_now')} el={profileEl('complete_profile_now')} />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
        </div>
      </div>
    </AppShell>
  );
}
