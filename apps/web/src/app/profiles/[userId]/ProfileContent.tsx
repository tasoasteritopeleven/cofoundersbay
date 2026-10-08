'use client';

import React, { useState } from 'react';
import { useIsAuthenticated } from '@/hooks/useIsAuthenticated';
import { useStoredUser } from '@/hooks/useStoredUser';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AIInsightButton } from '@/components/ai/AIInsightButton';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FollowButton } from '@/components/updates/FollowButton';
import { AskIntroButton } from '@/components/intros/AskIntroDialog';
import { OpenToLine } from '@/components/intros/OpenToLine';
import { SkillEvidencePanel } from '@/components/profile/SkillEvidencePanel';
import { ProfileHero } from '@/components/profile/ProfileHero';
import { ProfileActivity, ProfileExperience, ProfileRecommendations, SimilarProfiles } from '@/components/profile/ProfileSections';
import type { PageRailSection } from '@/components/layout/PageRail';
import {
  MapPin,
  Clock,
  Globe,
  Linkedin,
  Github,
  Twitter,
  MessageCircle,
  UserPlus,
  UserCheck,
  ArrowLeft,
  Languages,
  Briefcase,
  GraduationCap,
  TrendingUp,
  Building2,
  Share2,
  Loader2,
} from 'lucide-react';
import {
  getPublicProfile,
  sendConnectionRequest,
  getConnectionStatus,
  getOrCreateDirectConversation,
  type ConnectionStatus,
} from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RoleBadge } from '@/components/common/RoleBadge';
import { SkillChip } from '@/components/common/SkillChip';
import { statusEl } from '@/components/common/StatusText';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualAria } from '@/lib/i18n/format';
import { qk } from '@/lib/query-keys';
import { PersonVerifiedBadge } from '@/components/commitments/PersonVerifiedBadge';
import { usePageControls, type PageControlRunResult } from '@/lib/page-controls';

type PublicProfile = Awaited<ReturnType<typeof getPublicProfile>>;

function SocialLinkButton({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <a
      href={href.startsWith('http') ? href : `https://${href}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
    >
      <Icon className="icon-sm" />
      {label}
    </a>
  );
}

type RolePayloadValue = string | string[] | Record<string, string> | null | undefined;

// camelCase payload keys that ship Greek labels; an unknown key keeps the
// derived English label rather than inventing a translation.
const PAYLOAD_LABELS: Record<string, [string, string]> = {
  lookingFor: ['Looking for', 'Αναζητά'],
  availability: ['Availability', 'Διαθεσιμότητα'],
  industries: ['Industries', 'Κλάδοι'],
  services: ['Services', 'Υπηρεσίες'],
  expertise: ['Expertise', 'Εξειδίκευση'],
  hourlyRate: ['Hourly rate', 'Ωριαία χρέωση'],
  stage: ['Stage', 'Στάδιο'],
};

function PayloadEntry({ entryKey, value }: { entryKey: string; value: RolePayloadValue }) {
  const derived = entryKey.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
  const [en, el] = PAYLOAD_LABELS[entryKey] ?? [derived, derived];
  const label = <BilingualText en={en} el={el} compact />;
  if (!value) return null;
  if (Array.isArray(value) && value.length > 0) {
    return (
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <div className="flex flex-wrap gap-1.5">
          {(value as string[]).map((item) => (
            <Badge key={item} variant="secondary" className="text-xs">{item}</Badge>
          ))}
        </div>
      </div>
    );
  }
  if (typeof value === 'string' && value.trim()) {
    return (
      <div className="space-y-0.5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm text-foreground">{value}</p>
      </div>
    );
  }
  return null;
}

const ROLE_ICONS: Record<string, React.ElementType> = {
  founder: Briefcase,
  mentor: GraduationCap,
  investor: TrendingUp,
  org: Building2,
};

export default function PublicProfilePage({ userId }: { userId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();

  const [connecting, setConnecting] = useState(false);
  const [messaging, setMessaging] = useState(false);

  // Read after mount, so the server and the first client render agree on
  // whether this is the reader's own profile.
  const viewerId = useStoredUser()?.id ?? null;
  const hasToken = useIsAuthenticated();

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: qk('public-profile', userId),
    queryFn: () => getPublicProfile(userId),
    staleTime: 2 * 60_000,
    enabled: !!userId,
    retry: 1,
  });

  const { data: connStatus } = useQuery({
    queryKey: qk('connection-status', userId),
    queryFn: () => getConnectionStatus(userId),
    staleTime: 30_000,
    enabled: !!userId && hasToken,
  });

  const handleConnect = async (): Promise<PageControlRunResult> => {
    setConnecting(true);
    try {
      await sendConnectionRequest({ receiverId: userId });
      queryClient.setQueryData(qk('connection-status', userId), {
        status: 'pending', connectionId: null, direction: 'sent',
      });
      success('Request sent!', `Your connection request has been sent.`);
    } catch (err) {
      showError('Could not connect', err instanceof Error ? err.message : 'Please try again');
      return { error: err instanceof Error && err.message ? err.message : 'The connection request was not sent.' };
    } finally {
      setConnecting(false);
    }
  };

  const handleMessage = async () => {
    setMessaging(true);
    try {
      const { conversationId } = await getOrCreateDirectConversation(userId);
      router.push(`/messages?c=${conversationId}`);
    } catch {
      router.push(`/messages?to=${userId}`);
    } finally {
      setMessaging(false);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).then(() =>
      success('Link copied!', 'Profile link copied to clipboard.')
    );
  };

  /*
   * Connect, message and share, offered to the assistant. Connecting names no
   * page-level undo: the request's id is not known here until the status is
   * read again, and the assistant's own send_connection action carries the
   * partial withdraw the API allows (pending requests only).
   */
  const own = viewerId === userId;
  const blocked = connStatus?.status === 'blocked';
  const connected = connStatus?.status === 'accepted';
  const pending = connStatus?.status === 'pending';
  const noActor = !viewerId ? 'Sign in first.' : own ? 'This is your own profile.' : blocked ? 'This connection is blocked.' : undefined;
  const noActorEl = !viewerId ? 'Συνδεθείτε πρώτα.' : own ? 'Αυτό είναι το δικό σας προφίλ.' : blocked ? 'Η σύνδεση είναι αποκλεισμένη.' : undefined;
  usePageControls([
    {
      id: 'connect_with_person',
      labelEn: 'Send a connection request',
      labelEl: 'Αποστολή αιτήματος σύνδεσης',
      writes: true,
      unavailableEn: noActor ?? (connected ? 'You are already connected.' : pending ? 'A request is already pending.' : undefined),
      unavailableEl: noActorEl ?? (connected ? 'Είστε ήδη συνδεδεμένοι.' : pending ? 'Υπάρχει ήδη εκκρεμές αίτημα.' : undefined),
      run: handleConnect,
    },
    {
      id: 'message_person',
      labelEn: 'Open a conversation with this person',
      labelEl: 'Άνοιγμα συνομιλίας με αυτό το άτομο',
      // Opens the thread, creating it when there is none - a write.
      writes: true,
      unavailableEn: noActor,
      unavailableEl: noActorEl,
      run: handleMessage,
    },
    { id: 'copy_profile_link', labelEn: 'Copy the profile link', labelEl: 'Αντιγραφή συνδέσμου προφίλ', writes: false, run: handleShare },
  ]);

  if (isLoading)
    return (
      <AppShell>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
          <div className="space-y-4">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-56 w-full rounded-2xl" />
          </div>
        </div>
      </AppShell>
    );

  if (isError || !profile)
    return (
      <AppShell>
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <p className="text-lg font-semibold text-foreground">
            <BilingualText en="Profile not found" el="Το προφίλ δεν βρέθηκε" />
          </p>
          <p className="text-sm text-muted-foreground">
            <BilingualText
              en="This profile may have been removed or is not publicly visible."
              el="Αυτό το προφίλ μπορεί να έχει αφαιρεθεί ή να μην είναι δημόσια ορατό."
            />
          </p>
          <button onClick={() => router.back()} className="text-sm text-primary-accessible hover:underline">
            <BilingualText en="Go back" el="Επιστροφή" compact />
          </button>
        </div>
      </AppShell>
    );

  const isOwnProfile = viewerId === userId;
  type RolePayloadValue = string | string[] | Record<string, string> | null | undefined;
  const rolePayload = (profile.rolePayload ?? {}) as Record<string, RolePayloadValue>;
  const RoleIcon = ROLE_ICONS[profile.role] ?? Briefcase;

  const rolePayloadNodes: React.ReactNode[] = Object.entries(rolePayload)
    .filter(([k]) => k !== 'links' && k !== 'experience' && k !== 'education')
    .reduce<React.ReactNode[]>((acc, [key, val]) => {
      acc.push(<PayloadEntry key={key} entryKey={key} value={val} />);
      return acc;
    }, []);

  const connLabel: [string, string] =
    connStatus?.status === 'blocked'
      ? ['Blocked', 'Αποκλεισμένο']
      : connStatus?.status === 'accepted'
      ? ['Connected', 'Συνδεδεμένοι']
      : connStatus?.status === 'pending' && connStatus.direction === 'sent'
        ? ['Request sent', 'Το αίτημα στάλθηκε']
        : ['Connect', 'Σύνδεση'];
  const connButtonLabel = <BilingualText en={connLabel[0]} el={connLabel[1]} compact />;

  const isBlocked = connStatus?.status === 'blocked';
  const isConnected = connStatus?.status === 'accepted';
  const isPendingSent = connStatus?.status === 'pending' && connStatus.direction === 'sent';

  /*
   * Rail: what supports reading this person, never a copy of a control. Similar
   * profiles come from shared role, skills and industry; recommendations are
   * what others wrote and the person approved.
   */
  const rail: PageRailSection[] = [
    {
      id: 'similar',
      glyph: 'people',
      labelEn: 'Similar profiles',
      labelEl: 'Παρόμοια προφίλ',
      content: (
        <SimilarProfiles
          person={{
            userId,
            role: profile.role,
            skills: (profile.skills ?? []).map((s) => s.skillName).filter((n): n is string => typeof n === 'string'),
            industries: Array.isArray(rolePayload.industries) ? (rolePayload.industries as string[]) : [],
            location: profile.location,
          }}
          viewerId={viewerId}
        />
      ),
    },
    {
      id: 'recommendations',
      glyph: 'star',
      labelEn: 'Recommendations',
      labelEl: 'Συστάσεις',
      content: <ProfileRecommendations userId={userId} />,
    },
  ];

  return (
    <AppShell
      // The header keeps the registry's "Profile" title and line: the person's
      // name and headline are the top card's own, read once, as on a
      // professional profile. Passing them here printed both twice.
      rail={rail}
      actions={
        <Button variant="secondary" size="sm" className="gap-2" asChild>
          <Link href="/discover">
            <ArrowLeft className="icon-sm" />
            <BilingualText en="Back" el="Πίσω" compact />
          </Link>
        </Button>
      }
    >
      <div className="space-y-6">
        <ProfileHero
          name={profile.displayName}
          avatarUrl={profile.avatarUrl}
          nameBadge={<PersonVerifiedBadge userId={userId} />}
          headline={profile.headline}
          meta={[
            profile.location ? <><MapPin className="icon-sm shrink-0" aria-hidden="true" />{profile.location}</> : null,
            profile.timezone ? <><Clock className="icon-sm shrink-0" aria-hidden="true" />{profile.timezone}</> : null,
            profile.languages?.length ? <><Languages className="icon-sm shrink-0" aria-hidden="true" />{profile.languages.join(' · ')}</> : null,
          ]}
          openTo={!isOwnProfile ? <OpenToLine userId={userId} /> : null}
          aside={<RoleBadge role={profile.role} />}
          actions={
            isOwnProfile ? (
              <>
                <Button variant="secondary" asChild>
                  <Link href="/profile/edit"><BilingualText en="Edit your profile" el="Επεξεργασία προφίλ" compact /></Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleShare}
                  title={bilingualAria('Copy link', 'Αντιγραφή συνδέσμου')}
                  aria-label={bilingualAria('Copy link', 'Αντιγραφή συνδέσμου')}
                >
                  <Share2 className="icon-sm" />
                </Button>
              </>
            ) : (
              <>
                {viewerId ? (
                  <>
                    <Button
                      className="gap-2"
                      onClick={() => void handleConnect()}
                      disabled={connecting || isConnected || isPendingSent || isBlocked}
                      variant={isConnected || isBlocked ? 'secondary' : 'default'}
                    >
                      {connecting ? (
                        <Loader2 className="icon-sm animate-spin" aria-hidden="true" />
                      ) : isConnected || isBlocked ? (
                        <UserCheck className="icon-sm" aria-hidden="true" />
                      ) : (
                        <UserPlus className="icon-sm" aria-hidden="true" />
                      )}
                      {connButtonLabel}
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={handleMessage}
                      disabled={messaging || isBlocked}
                      title={isBlocked ? bilingualAria('Messages are closed between you and this member', 'Τα μηνύματα είναι κλειστά ανάμεσα σε εσάς και αυτό το μέλος') : undefined}
                    >
                      {messaging ? (
                        <Loader2 className="icon-sm animate-spin" aria-hidden="true" />
                      ) : (
                        <MessageCircle className="icon-sm" aria-hidden="true" />
                      )}
                      <BilingualText en="Message" el="Μήνυμα" compact />
                    </Button>
                  </>
                ) : null}
                <FollowButton userId={userId} />
                <AskIntroButton targetId={userId} targetName={profile.displayName} />
                {viewerId ? (
                  <AIInsightButton
                    prompt={`Analyze this ${profile.role} profile for collaboration potential:\n${profile.displayName} — ${profile.headline ?? 'No headline'}\nSkills: ${profile.skills?.map((s) => s.skillName).join(', ') || 'None listed'}\nBio: ${profile.bio ?? 'No bio'}`}
                    agentId="matching"
                    cacheKey={`profile-match-${userId}`}
                    variant="outline"
                    size="sm"
                    label="AI Match Analysis"
                    labelEl="Ανάλυση αντιστοίχισης με AI"
                  />
                ) : null}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleShare}
                  title={bilingualAria('Copy link', 'Αντιγραφή συνδέσμου')}
                  aria-label={bilingualAria('Copy link', 'Αντιγραφή συνδέσμου')}
                >
                  <Share2 className="icon-sm" />
                </Button>
              </>
            )
          }
        />

        {profile.bio && (
          <Card className="shadow-sm border-border">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-lg font-semibold"><BilingualText en="About" el="Σχετικά" compact /></CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                {profile.bio}
              </p>
            </CardContent>
          </Card>
        )}

        {viewerId ? <ProfileActivity userId={userId} own={isOwnProfile} /> : null}

        <ProfileExperience payload={rolePayload as Record<string, unknown>} own={isOwnProfile} />

        {profile.skills?.length ? (
          <Card className="shadow-sm border-border">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-lg font-semibold">
                <BilingualText en="Skills" el="Δεξιότητες" compact />
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2 pt-5">
              {profile.skills.map((s, i) => (
                // skillId can be absent on a partially-populated payload, and
                // key={undefined} is the same as no key to React.
                <SkillChip key={s.skillId ?? s.skillName ?? i} label={s.skillName} />
              ))}
            </CardContent>
          </Card>
        ) : null}
        {viewerId ? <SkillEvidencePanel userId={userId} /> : null}

        {Object.keys(rolePayload).filter((k) => k !== 'experience' && k !== 'education').length > 0 && (
          <Card className="shadow-sm border-border">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <RoleIcon className="icon-sm text-muted-foreground" />
                <BilingualText
                  en={`${(profile.role ?? '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())} details`}
                  el={`${(statusEl(profile.role) ?? profile.role ?? '').replace(/^./, (c) => c.toUpperCase())} — λεπτομέρειες`}
                  compact
                />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              {/* Generic role payload display */}
              <>{rolePayloadNodes}</>

              {/* Social links */}
              {rolePayload.links && typeof rolePayload.links === 'object' && (
                <div className="space-y-1.5 pt-2 border-t border-border">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider"><BilingualText en="Links" el="Σύνδεσμοι" compact /></p>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { key: 'websiteUrl', icon: Globe, label: 'Website' },
                        { key: 'linkedinUrl', icon: Linkedin, label: 'LinkedIn' },
                        { key: 'githubUrl', icon: Github, label: 'GitHub' },
                        { key: 'twitterUrl', icon: Twitter, label: 'Twitter/X' },
                      ] as { key: string; icon: React.ElementType; label: string }[]
                    )
                      .filter(({ key }) => {
                        const url = (rolePayload.links as Record<string, unknown>)[key];
                        return typeof url === 'string' && url.trim();
                      })
                      .map(({ key, icon: LinkIcon, label }) => (
                        <SocialLinkButton
                          key={key}
                          href={String((rolePayload.links as Record<string, unknown>)[key])}
                          icon={LinkIcon}
                          label={label}
                        />
                      ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
