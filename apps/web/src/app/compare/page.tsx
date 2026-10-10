'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  X, Plus, UserPlus, MessageCircle, Sparkles, MapPin, Briefcase, GraduationCap, Clock, Target, Users, CheckCircle, XCircle, Minus, ChevronDown, ChevronUp, BarChart3, Zap, Heart, Share2, Download,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { getPublicProfile, getMatchBreakdown, sendConnectionRequest } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import { rowOptions, usePageControls, usePageList, type PageControlRunResult } from '@/lib/page-controls';
import { BilingualText } from '@/components/common/BilingualText';
import { FactLine } from '@/components/common/FactLine';
import { CardFoot, CardHead } from '@/components/common/CardAnatomy';
import { StatusText } from '@/components/common/StatusText';

const ComparisonChart = dynamic(
  () => import('./ComparisonChart').then((m) => ({ default: m.ComparisonChart })),
  { ssr: false, loading: () => <Skeleton className="h-[330px] w-full rounded-xl" /> }
);

type CompareProfile = {
  id: string;
  displayName: string;
  headline?: string;
  avatarUrl?: string;
  location?: string;
  role?: string;
  skills?: { name: string; level?: number }[];
  industries?: string[];
  stage?: string;
  availability?: string;
  languages?: string[];
  matchScore?: number;
  connectionStatus?: 'none' | 'pending' | 'connected';
};

const MAX_PROFILES = 4;

function ProfileColumn({
  profile,
  onRemove,
  onConnect,
  isConnecting,
}: {
  profile: CompareProfile;
  onRemove: () => void;
  onConnect: () => void;
  isConnecting: boolean;
}) {
  const initials = profile.displayName
    ?.split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '??';

  // The Connections card for each person compared: circle, name, headline
  // and place, remove at the right; the score, the facts and the foot on
  // the avatar's edge, so the columns read across at the same steps.
  return (
    <CardContent className="space-y-3">
      <CardHead
        mark={(
          <Avatar className="h-10 w-10 border border-primary/20">
            <AvatarImage src={profile.avatarUrl} alt="" />
            <AvatarFallback className="bg-primary/10 font-semibold text-primary-accessible">
              {initials}
            </AvatarFallback>
          </Avatar>
        )}
        title={profile.displayName}
        subtitle={<span className="line-clamp-1">{profile.headline || (profile.role ? <StatusText value={profile.role} /> : <BilingualText en="No headline" el="Χωρίς τίτλο" compact />)}</span>}
        meta={profile.location ?? undefined}
        asideStays
        aside={(
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="h-8 w-8 text-muted-foreground hover:text-destructive-accessible"
            aria-label="Remove from comparison"
          >
            <X className="icon-sm" aria-hidden="true" />
          </Button>
        )}
      />

      {/* Match Score: a figure under the title's step, its label beside it. */}
      {profile.matchScore !== undefined && (
        <p className="text-xs text-muted-foreground">
          <span className="card-body font-semibold tabular-nums text-primary-accessible">{profile.matchScore}%</span>{' '}
          <BilingualText en="Match Score" el="Βαθμός ταιριάσματος" compact />
        </p>
      )}

      {/* Skills */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground"><BilingualText en="Skills" el="Δεξιότητες" compact /></p>
        {(profile.skills?.length ?? 0) > 0 ? <FactLine className="text-foreground" items={(profile.skills ?? []).slice(0, 5).map((skill) => skill.name)} /> : <p className="text-xs text-muted-foreground"><BilingualText en="No skills listed" el="Δεν έχουν καταχωριστεί δεξιότητες" compact /></p>}
      </div>

      {/* Industries */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground"><BilingualText en="Industries" el="Κλάδοι" compact /></p>
        {(profile.industries?.length ?? 0) > 0 ? <FactLine className="text-foreground" items={(profile.industries ?? []).slice(0, 3)} /> : <p className="text-xs text-muted-foreground"><BilingualText en="Not specified" el="Δεν έχει οριστεί" compact /></p>}
      </div>

      {/* Stage & Availability */}
      <dl className="space-y-1.5 text-xs">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground"><BilingualText en="Stage" el="Στάδιο" compact /></dt>
          <dd className="font-medium text-foreground">{profile.stage ? <StatusText value={profile.stage} /> : '—'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground"><BilingualText en="Availability" el="Διαθεσιμότητα" compact /></dt>
          <dd className="font-medium text-foreground">{profile.availability ? <StatusText value={profile.availability} /> : '—'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground"><BilingualText en="Languages" el="Γλώσσες" compact /></dt>
          <dd className="font-medium text-foreground">{profile.languages?.join(', ') || '—'}</dd>
        </div>
      </dl>

      {/* Quick Actions */}
      <CardFoot>
        {profile.connectionStatus === 'connected' ? (
          <Button variant="outline" size="sm" asChild>
            <a href={`/messages?user=${profile.id}`}>
              <MessageCircle className="icon-sm mr-1" aria-hidden="true" />
              <BilingualText en="Message" el="Μήνυμα" compact />
            </a>
          </Button>
        ) : profile.connectionStatus === 'pending' ? (
          <Button variant="outline" size="sm" disabled title="Request sent · Το αίτημα στάλθηκε">
            <Clock className="icon-sm mr-1" aria-hidden="true" />
            <BilingualText en="Pending" el="Σε αναμονή" compact />
          </Button>
        ) : (
          <Button
            variant="default"
            size="sm"
            onClick={onConnect}
            disabled={isConnecting}
          >
            <UserPlus className="icon-sm mr-1" aria-hidden="true" />
            <BilingualText en="Connect" el="Σύνδεση" compact />
          </Button>
        )}
      </CardFoot>
    </CardContent>
  );
}

function AddProfileSlot({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-secondary/20 p-8 transition-colors hover:border-primary/40 hover:bg-secondary/40 min-h-48 sm:min-h-[400px]"
    >
      <div className="rounded-full bg-primary/10 p-4 mb-3">
        <Plus className="icon-xl text-primary-accessible" />
      </div>
      <p className="font-medium text-foreground"><BilingualText en="Add Profile" el="Προσθήκη προφίλ" compact /></p>
      <p className="text-sm text-muted-foreground mt-1"><BilingualText en="Select from matches or search" el="Επιλέξτε από τις αντιστοιχίσεις ή αναζητήστε" compact /></p>
    </button>
  );
}

function SkillsComparison({ profiles }: { profiles: CompareProfile[] }) {
  // Collect all unique skills
  const allSkills = useMemo(() => {
    const skillSet = new Set<string>();
    profiles.forEach((p) => p.skills?.forEach((s) => skillSet.add(s.name)));
    return Array.from(skillSet).slice(0, 10);
  }, [profiles]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="icon-md text-muted-foreground" />
          <BilingualText en="Skills Comparison" el="Σύγκριση δεξιοτήτων" compact />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {allSkills.map((skill) => (
            <div key={skill} className="flex items-center gap-4">
              <span className="w-32 text-sm font-medium truncate">{skill}</span>
              <div className="flex-1 flex gap-2">
                {profiles.map((p) => {
                  const hasSkill = p.skills?.some((s) => s.name === skill);
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        'flex-1 h-6 rounded flex items-center justify-center text-xs font-medium',
                        hasSkill
                          ? 'bg-primary/20 text-primary-accessible'
                          : 'bg-secondary/50 text-muted-foreground'
                      )}
                    >
                      {hasSkill ? <CheckCircle className="icon-sm" aria-hidden="true" /> : <Minus className="icon-sm" aria-hidden="true" />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ComparePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { success, error: showError } = useToast();

  const [profileIds, setProfileIds] = useState<string[]>([]);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Parse profile IDs from URL
  useEffect(() => {
    const ids = searchParams?.get('ids')?.split(',').filter(Boolean) || [];
    setProfileIds(ids.slice(0, MAX_PROFILES));
  }, [searchParams]);

  // Fetch profiles
  const { data: profiles, isLoading } = useQuery({
    queryKey: qk('matching', 'compare', profileIds),
    queryFn: async () => {
      if (profileIds.length === 0) return [];
      const results = await Promise.all(
        profileIds.map(async (id) => {
          try {
            /*
             * The engine's own score for this pairing. It used to be
             * `Math.random() * 40 + 60`, which meant the comparison table —
             * the one screen whose entire job is putting people side by side
             * on the same measure — ranked them by dice. A profile the engine
             * cannot score keeps `matchScore` undefined and the column shows
             * a dash.
             */
            const [profile, breakdown] = await Promise.all([
              getPublicProfile(id),
              getMatchBreakdown(id).catch(() => null),
            ]);
            const rolePayload = (profile.rolePayload ?? {}) as Record<string, unknown>;
            return {
              id,
              displayName: profile.displayName || 'Unknown',
              headline: profile.headline ?? undefined,
              avatarUrl: profile.avatarUrl ?? undefined,
              location: profile.location ?? undefined,
              role: profile.role,
              skills: profile.skills?.map((s) => ({ name: s.skillName, level: s.level ? parseInt(s.level, 10) : undefined })),
              industries: Array.isArray(rolePayload.industries) ? rolePayload.industries as string[] : undefined,
              stage: typeof rolePayload.stage === 'string' ? rolePayload.stage : undefined,
              availability: typeof rolePayload.availability === 'string' ? rolePayload.availability : undefined,
              languages: profile.languages ?? undefined,
              matchScore: breakdown?.overall.score,
              connectionStatus: 'none' as const,
            } as CompareProfile;
          } catch {
            return null;
          }
        })
      );
      return results.filter(Boolean) as CompareProfile[];
    },
    enabled: profileIds.length > 0,
  });

  const updateUrl = (ids: string[]) => {
    const params = new URLSearchParams();
    if (ids.length > 0) params.set('ids', ids.join(','));
    router.replace(`/compare?${params.toString()}`);
  };

  const handleRemove = (id: string) => {
    const newIds = profileIds.filter((pid) => pid !== id);
    setProfileIds(newIds);
    updateUrl(newIds);
  };

  const handleAdd = () => {
    // Navigate to discover with compare mode
    router.push('/discover?mode=compare&returnTo=/compare');
  };

  const handleConnect = async (id: string): Promise<PageControlRunResult> => {
    setConnectingId(id);
    try {
      await sendConnectionRequest({ receiverId: id, message: 'I found you through profile comparison and would love to connect!' });
      success('Connection request sent!');
    } catch (err) {
      showError('Failed to send connection request');
      return { error: err instanceof Error && err.message ? err.message : 'The connection request was not sent.' };
    } finally {
      setConnectingId(null);
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    success('Comparison link copied to clipboard!');
  };

  // The column's own actions, offered to the assistant, and the people being
  // compared with the measure the table puts them side by side on.
  const compared = profiles ?? [];
  const personRows = rowOptions(compared, (p) => p.id, (p) => p.displayName);
  const nobody = compared.length === 0 ? 'Nobody is being compared yet.' : undefined;
  const nobodyEl = compared.length === 0 ? 'Δεν συγκρίνεται κανείς ακόμη.' : undefined;
  usePageControls([
    {
      id: 'remove_from_comparison',
      labelEn: 'Remove a person from the comparison',
      labelEl: 'Αφαίρεση ατόμου από τη σύγκριση',
      writes: false,
      options: personRows,
      unavailableEn: nobody,
      unavailableEl: nobodyEl,
      run: (value) => { if (value) handleRemove(value); },
    },
    {
      id: 'add_to_comparison',
      labelEn: 'Pick another person to compare',
      labelEl: 'Επιλογή άλλου ατόμου για σύγκριση',
      writes: false,
      unavailableEn: profileIds.length >= MAX_PROFILES ? `The comparison holds ${MAX_PROFILES} people at most.` : undefined,
      unavailableEl: profileIds.length >= MAX_PROFILES ? `Η σύγκριση χωράει έως ${MAX_PROFILES} άτομα.` : undefined,
      run: handleAdd,
    },
    {
      id: 'connect_with_person',
      labelEn: 'Send a connection request to someone compared',
      labelEl: 'Αίτημα σύνδεσης σε άτομο της σύγκρισης',
      writes: true,
      options: personRows,
      unavailableEn: nobody,
      unavailableEl: nobodyEl,
      run: (value) => (value ? handleConnect(value) : undefined),
    },
    { id: 'copy_comparison_link', labelEn: 'Copy the comparison link', labelEl: 'Αντιγραφή συνδέσμου σύγκρισης', writes: false, run: handleShare },
  ]);
  usePageList([
    {
      id: 'compared_people',
      labelEn: 'People being compared',
      labelEl: 'Άτομα σε σύγκριση',
      rows: profileIds.length === 0 || profiles
        ? compared.map((p) => `${p.displayName} · ${p.role}${p.matchScore != null ? ` · match ${p.matchScore}%` : ''}${p.location ? ` · ${p.location}` : ''}`)
        : undefined,
      total: compared.length,
      sample: false,
    },
  ]);

  return (
    <AppShell
      actions={
        <>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="icon-sm mr-1" aria-hidden="true" />
              <BilingualText en="Share" el="Κοινοποίηση" compact />
            </Button>
            {profileIds.length < MAX_PROFILES && (
              <Button size="sm" onClick={handleAdd}>
                <Plus className="icon-sm mr-1" aria-hidden="true" />
                <BilingualText en="Add Profile" el="Προσθήκη προφίλ" compact />
              </Button>
            )}
          </div>
        </>
      }
    >
      <div className="space-y-6 pb-10">
        {/* Empty State */}
        {profileIds.length === 0 && (
          <EmptyState
            illustration="search"
            title={<BilingualText en="No profiles to compare" el="Κανένα προφίλ για σύγκριση" compact wrap />}
            description={<BilingualText en="Add profiles from your matches or search to compare them side by side" el="Προσθέστε προφίλ από τις αντιστοιχίσεις ή την αναζήτηση για να τα συγκρίνετε δίπλα-δίπλα" wrap />}
            askAiPrompt="Help me pick two or three people from my matches to compare as potential cofounders."
            action={
              <Button onClick={handleAdd}>
                <Plus className="icon-sm mr-2" aria-hidden="true" />
                <BilingualText en="Add Profiles" el="Προσθήκη προφίλ" compact />
              </Button>
            }
          />
        )}

        {/* Profile Columns */}
        {profileIds.length > 0 && (
          // One column on a phone; side by side from the tablet up, so a
          // compared card is never squeezed to a sliver at 390px.
          <div className={cn(
            'grid grid-cols-1 gap-6',
            profileIds.length === 1 && 'max-w-md',
            profileIds.length === 2 && 'sm:grid-cols-2',
            profileIds.length === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
            profileIds.length === 4 && 'sm:grid-cols-2 xl:grid-cols-4',
          )}>
            {isLoading ? (
              Array.from({ length: profileIds.length }).map((_, i) => (
                <Card key={i} className="p-4">
                  <div className="flex flex-col items-center">
                    <Skeleton className="h-20 w-20 rounded-full" />
                    <Skeleton className="h-5 w-32 mt-3" />
                    <Skeleton className="h-4 w-24 mt-2" />
                  </div>
                </Card>
              ))
            ) : (
              <>
                {profiles?.map((profile) => (
                  <Card key={profile.id}>
                    <ProfileColumn
                      profile={profile}
                      onRemove={() => handleRemove(profile.id)}
                      onConnect={() => handleConnect(profile.id)}
                      isConnecting={connectingId === profile.id}
                    />
                  </Card>
                ))}
                {profileIds.length < MAX_PROFILES && (
                  <AddProfileSlot onClick={handleAdd} />
                )}
              </>
            )}
          </div>
        )}

        {/* Comparison Charts */}
        {profiles && profiles.length >= 2 && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ComparisonChart profiles={profiles} />
            <SkillsComparison profiles={profiles} />
          </div>
        )}
      </div>
    </AppShell>
  );
}
