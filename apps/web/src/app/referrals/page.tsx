'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Gift, Users, Copy, Share2, Mail, MessageCircle,
  CheckCircle, Clock, XCircle, TrendingUp, Award,
  Sparkles, ChevronRight, ExternalLink, Trophy,
  Zap, Target, Star, Crown,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import Link from 'next/link';
import { SampleDataNotice } from '@/components/common/SampleDataNotice';
import { useDemoData } from '@/contexts/DemoDataContext';
import { listInvites, type InviteItem } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import { choiceControl, usePageControls, usePageList } from '@/lib/page-controls';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RowHead } from '@/components/dashboard/SectionCard';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { BilingualText } from '@/components/common/BilingualText';
import { useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';
import { REFERRALS_STRINGS, referralsEn, referralsEl } from '@/lib/i18n/strings-referrals';

type ReferralStatus = 'pending' | 'signed_up' | 'active' | 'rewarded' | 'expired';

type Referral = {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  status: ReferralStatus;
  invitedAt: string;
  signedUpAt?: string;
  rewardedAt?: string;
  rewardAmount?: number;
};

type ReferralKey = keyof typeof REFERRALS_STRINGS;

/** A perk is a key plus, where the copy has one, the number it carries. */
type Perk = { key: ReferralKey; n?: number };

type ReferralTier = {
  key: ReferralKey;
  icon: typeof Crown;
  minReferrals: number;
  rewardMultiplier: number;
  perks: Perk[];
  color: string;
};

function fill(key: ReferralKey, vars: Record<string, string | number>): { en: string; el: string } {
  let en = referralsEn(key);
  let el = referralsEl(key);
  for (const [k, v] of Object.entries(vars)) {
    en = en.replace(`{${k}}`, String(v));
    el = el.replace(`{${k}}`, String(v));
  }
  return { en, el };
}

const REFERRAL_TIERS: ReferralTier[] = [
  {
    key: 'tier_starter',
    icon: Star,
    minReferrals: 0,
    rewardMultiplier: 1,
    perks: [{ key: 'perk_credit', n: 10 }],
    color: 'text-muted-foreground',
  },
  {
    key: 'tier_connector',
    icon: Zap,
    minReferrals: 5,
    rewardMultiplier: 1.5,
    perks: [{ key: 'perk_credit', n: 15 }, { key: 'perk_priority_support' }],
    color: 'text-status-info',
  },
  {
    key: 'tier_ambassador',
    icon: Trophy,
    minReferrals: 15,
    rewardMultiplier: 2,
    perks: [{ key: 'perk_credit', n: 20 }, { key: 'perk_priority_support' }, { key: 'perk_exclusive_events' }],
    color: 'text-status-warning',
  },
  {
    key: 'tier_champion',
    icon: Crown,
    minReferrals: 30,
    rewardMultiplier: 2.5,
    perks: [{ key: 'perk_credit', n: 25 }, { key: 'perk_priority_support' }, { key: 'perk_exclusive_events' }, { key: 'perk_featured_profile' }],
    color: 'text-status-accent',
  },
];

const STATUS_CONFIG: Record<ReferralStatus, { key: ReferralKey; color: string; icon: typeof Clock }> = {
  pending: { key: 'status_pending', color: 'bg-status-warning-bg text-status-warning', icon: Clock },
  signed_up: { key: 'status_signed_up', color: 'bg-status-info-bg text-status-info', icon: CheckCircle },
  active: { key: 'status_active', color: 'bg-status-success-bg text-status-success', icon: Users },
  rewarded: { key: 'status_rewarded', color: 'bg-status-accent-bg text-status-accent', icon: Gift },
  expired: { key: 'status_expired', color: 'bg-muted text-muted-foreground', icon: XCircle },
};

// Samples from the demo world, shown only with sample data on and when the
// preview has no invitations to answer with. None carries a reward: rewards
// are not live, and a "+€10" sample said otherwise.
const DEMO_REFERRALS: Referral[] = [
  { id: 's1', email: 'ioanna@aegeanlab.example', name: 'Ioanna Pappa', status: 'active', invitedAt: '2026-02-15T10:00:00Z', signedUpAt: '2026-02-16T14:30:00Z' },
  { id: 's2', email: 'thanos@rigas.energy', name: 'Thanos Rigas', status: 'signed_up', invitedAt: '2026-03-01T09:00:00Z', signedUpAt: '2026-03-02T11:00:00Z' },
  { id: 's3', email: 'eleni@anemosstorage.example', status: 'pending', invitedAt: '2026-03-20T15:00:00Z' },
  { id: 's4', email: 'petros@kymaenergy.example', status: 'pending', invitedAt: '2026-03-25T08:00:00Z' },
  { id: 's5', email: 'hello@old-venture.example', status: 'expired', invitedAt: '2026-01-01T00:00:00Z' },
];

/**
 * The link shared is the real sign-up page. It used to be
 * `cofounderbay.com/join?ref=FOUNDER2026` - a route and a code that existed
 * for nobody. Invitations that should be tracked go through /invite, which
 * records them (POST /invites) and is what the list below reads.
 */
function ReferralLink({ onCopy }: { onCopy?: (copy: () => void) => void }) {
  const { success } = useToast();
  const { primary } = useLanguagePreference();
  const [origin, setOrigin] = useState('https://cofounderbay.com');
  useEffect(() => setOrigin(window.location.origin), []);
  const referralUrl = `${origin}/register`;
  /* The toast and the share body are written *by* the reader to someone else,
     so they go out in one language — theirs — rather than as a bilingual pair
     the recipient would have to read twice. */
  const t = (key: ReferralKey) => (primary === 'el' ? referralsEl(key) : referralsEn(key));

  const copyLink = () => {
    void navigator.clipboard?.writeText(referralUrl);
    success(t('copied'));
  };
  useEffect(() => { onCopy?.(copyLink); });

  const shareVia = (platform: 'email' | 'twitter' | 'linkedin') => {
    const text = t('share_text');
    const urls: Record<string, string> = {
      email: `mailto:?subject=${encodeURIComponent(t('share_subject'))}&body=${encodeURIComponent(text + '\n\n' + referralUrl)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(referralUrl)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralUrl)}`,
    };
    window.open(urls[platform], '_blank');
  };

  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="border-b border-border">
        <CardTitle className="flex items-center gap-2">
          <Share2 className="icon-md shrink-0 text-muted-foreground" />
          <BilingualText en={referralsEn('link_title')} el={referralsEl('link_title')} compact wrap />
        </CardTitle>
        <CardDescription>
          <BilingualText en={referralsEn('link_description')} el={referralsEl('link_description')} />
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={referralUrl}
            readOnly
            aria-label="Sign-up link. Σύνδεσμος εγγραφής"
            className="font-mono text-sm"
          />
          <Button onClick={copyLink}>
            <Copy className="icon-sm mr-1 shrink-0" aria-hidden="true" />
            <BilingualText en={referralsEn('copy')} el={referralsEl('copy')} compact wrap />
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" asChild>
            <Link href="/invite">
              <Mail className="icon-sm mr-1 shrink-0" aria-hidden="true" />
              <BilingualText en={referralsEn('invite_by_email')} el={referralsEl('invite_by_email')} compact />
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => shareVia('email')}>
            <Mail className="icon-sm mr-1 shrink-0" aria-hidden="true" />
            <BilingualText en={referralsEn('share_email')} el={referralsEl('share_email')} compact />
          </Button>
          <Button variant="outline" size="sm" onClick={() => shareVia('twitter')}>
            <ExternalLink className="icon-sm mr-1" />
            Twitter
          </Button>
          <Button variant="outline" size="sm" onClick={() => shareVia('linkedin')}>
            <ExternalLink className="icon-sm mr-1" />
            LinkedIn
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TierProgress({ referrals, currentTier }: { referrals: number; currentTier: ReferralTier }) {
  const nextTierIndex = REFERRAL_TIERS.findIndex((t) => t.minReferrals > referrals);
  const nextTier = nextTierIndex >= 0 ? REFERRAL_TIERS[nextTierIndex] : null;
  const progress = nextTier
    ? ((referrals - currentTier.minReferrals) / (nextTier.minReferrals - currentTier.minReferrals)) * 100
    : 100;

  const CurrentIcon = currentTier.icon;

  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="border-b border-border">
        <CardTitle className="flex items-center gap-2">
          <Award className="icon-md shrink-0 text-muted-foreground" />
          <BilingualText en={referralsEn('tier_title')} el={referralsEl('tier_title')} compact wrap />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* The tier as a row head: its emblem as the mark, the name a step
            under the card's title (it was text-xl, louder than that title)
            and the multiplier under it. */}
        <RowHead
          mark={(
            <div data-card-mark="" className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <CurrentIcon className={cn('icon-md', currentTier.color)} aria-hidden="true" />
            </div>
          )}
          title={<span className={currentTier.color}><BilingualText en={referralsEn(currentTier.key)} el={referralsEl(currentTier.key)} compact /></span>}
          subtitle={<BilingualText {...fill('multiplier', { n: currentTier.rewardMultiplier })} compact wrap />}
        />

        {nextTier && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="min-w-0 text-muted-foreground">
                <BilingualText
                  en={fill('progress_to', { tier: referralsEn(nextTier.key) }).en}
                  el={fill('progress_to', { tier: referralsEl(nextTier.key) }).el}
                  compact
                  wrap
                />
              </span>
              <span className="font-medium">{referrals}/{nextTier.minReferrals}</span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs leading-snug text-muted-foreground">
              <BilingualText
                en={fill('more_to_unlock', { n: nextTier.minReferrals - referrals, tier: referralsEn(nextTier.key) }).en}
                el={fill('more_to_unlock', { n: nextTier.minReferrals - referrals, tier: referralsEl(nextTier.key) }).el}
                compact
                wrap
              />
            </p>
          </div>
        )}

        <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs leading-snug text-muted-foreground">
          <BilingualText en={referralsEn('rewards_note')} el={referralsEl('rewards_note')} wrap />
        </p>

        <div className="pt-2 border-t">
          <p className="mb-2 text-sm font-medium"><BilingualText en={referralsEn('perks_title')} el={referralsEl('perks_title')} compact wrap /></p>
          <ul className="space-y-1">
            {currentTier.perks.map((perk) => (
              <li key={perk.key} className="flex items-start gap-2 text-sm leading-snug text-muted-foreground">
                <CheckCircle className="mt-0.5 icon-sm shrink-0 text-status-success" />
                <BilingualText {...fill(perk.key, perk.n === undefined ? {} : { n: perk.n })} compact wrap />
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function ReferralCard({ referral }: { referral: Referral }) {
  const config = STATUS_CONFIG[referral.status];
  const StatusIcon = config.icon;
  const initials = referral.name
    ?.split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || referral.email[0].toUpperCase();

  // A row of the invitations card: the person as the mark, the name with the
  // email under it, the reward and the state at the right.
  return (
    <RowHead
      mark={(
        <Avatar className="h-10 w-10">
          <AvatarImage src={referral.avatarUrl} />
          <AvatarFallback className="bg-primary/10 text-primary-accessible text-sm">
            {initials}
          </AvatarFallback>
        </Avatar>
      )}
      title={<span className="block truncate" translate={referral.name ? undefined : 'no'}>{referral.name || referral.email}</span>}
      subtitle={referral.name ? <span className="block truncate">{referral.email}</span> : undefined}
      aside={(
        <>
          {referral.rewardAmount && (
            <Badge variant="secondary" className="bg-status-success-bg text-status-success">
              +€{referral.rewardAmount}
            </Badge>
          )}
          <Badge className={cn('gap-1', config.color)}>
            <StatusIcon className="icon-sm shrink-0" aria-hidden="true" />
            <BilingualText en={referralsEn(config.key)} el={referralsEl(config.key)} compact />
          </Badge>
        </>
      )}
    />
  );
}

function StatsCards({ referrals }: { referrals: Referral[] }) {
  const totalInvited = referrals.length;
  const signedUp = referrals.filter((r) => r.status !== 'pending' && r.status !== 'expired').length;
  const rewarded = referrals.filter((r) => r.status === 'rewarded').length;
  const totalEarned = referrals.reduce((sum, r) => sum + (r.rewardAmount || 0), 0);

  return (
    <div className="grid grid-cols-2 gap-3">
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-status-info-bg p-2">
            <Users className="icon-md text-status-info" />
          </div>
          <div>
            <p className="page-stat text-xl font-bold">{totalInvited}</p>
            <p className="text-xs leading-snug text-muted-foreground"><BilingualText en={referralsEn('stat_invited')} el={referralsEl('stat_invited')} compact wrap /></p>
          </div>
        </div>
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-status-success-bg p-2">
            <CheckCircle className="icon-md text-status-success" />
          </div>
          <div>
            <p className="page-stat text-xl font-bold">{signedUp}</p>
            <p className="text-xs leading-snug text-muted-foreground"><BilingualText en={referralsEn('stat_signed_up')} el={referralsEl('stat_signed_up')} compact wrap /></p>
          </div>
        </div>
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-status-accent-bg p-2">
            <Gift className="icon-md text-status-accent" />
          </div>
          <div>
            <p className="page-stat text-xl font-bold">{rewarded}</p>
            <p className="text-xs leading-snug text-muted-foreground"><BilingualText en={referralsEn('stat_rewarded')} el={referralsEl('stat_rewarded')} compact wrap /></p>
          </div>
        </div>
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-status-warning-bg p-2">
            <TrendingUp className="icon-md text-status-warning" />
          </div>
          <div>
            <p className="page-stat text-xl font-bold">€{totalEarned}</p>
            <p className="text-xs leading-snug text-muted-foreground"><BilingualText en={referralsEn('stat_earned')} el={referralsEl('stat_earned')} compact wrap /></p>
          </div>
        </div>
      </Card>
    </div>
  );
}

/** An invitation as the list shows it; a cancelled one reads as expired. */
function inviteToReferral(invite: InviteItem): Referral {
  const status: ReferralStatus =
    invite.status === 'accepted' ? 'signed_up' : invite.status === 'pending' ? 'pending' : 'expired';
  return {
    id: invite.id,
    email: invite.email,
    status,
    invitedAt: invite.createdAt,
    signedUpAt: invite.acceptedAt ?? undefined,
  };
}

export default function ReferralsPage() {
  const { showDemoData } = useDemoData();
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'rewarded'>('all');

  // The invitations this account has sent (GET /invites). The samples used to
  // be every account's list; they are the demo's now.
  const { data, isLoading } = useQuery({
    queryKey: qk('invites', 'mine'),
    queryFn: () => listInvites({ limit: 100 }),
    retry: 0,
    staleTime: 60_000,
  });
  const live = Array.isArray(data?.invites) ? data.invites.map(inviteToReferral) : [];
  const referrals: Referral[] = live.length > 0 ? live : isLoading || !showDemoData ? [] : DEMO_REFERRALS;
  const isSample = live.length === 0 && referrals.length > 0;

  const successfulReferrals = referrals.filter(
    (r) => r.status === 'signed_up' || r.status === 'active' || r.status === 'rewarded'
  ).length;

  const currentTier = [...REFERRAL_TIERS]
    .reverse()
    .find((t) => successfulReferrals >= t.minReferrals) || REFERRAL_TIERS[0];

  const filteredReferrals = referrals.filter((r) => {
    if (activeTab === 'pending') return r.status === 'pending';
    if (activeTab === 'rewarded') return r.status === 'rewarded';
    return true;
  });

  const copyRef = useRef<(() => void) | null>(null);
  usePageControls([
    choiceControl('referrals_tab', 'Referrals shown', 'Συστάσεις που εμφανίζονται', [
      { value: 'all', en: referralsEn('tab_all'), el: referralsEl('tab_all') },
      { value: 'pending', en: referralsEn('tab_pending'), el: referralsEl('tab_pending') },
      { value: 'rewarded', en: referralsEn('tab_rewarded'), el: referralsEl('tab_rewarded') },
    ], activeTab, (v) => setActiveTab(v as typeof activeTab)),
    { id: 'copy_link', labelEn: 'Copy the sign-up link', labelEl: 'Αντιγραφή συνδέσμου εγγραφής', writes: false, run: () => copyRef.current?.() },
  ]);
  usePageList([
    {
      id: 'referrals',
      labelEn: 'Invitations',
      labelEl: 'Προσκλήσεις',
      rows: isLoading ? undefined : filteredReferrals.map((r) => `${r.name ? `${r.name} · ` : ''}${r.email} · ${r.status.replace('_', ' ')}`),
      total: referrals.length,
      sample: isSample,
    },
  ]);

  // The figures, the tier and how it works are the page's auxiliaries; the
  // column keeps the link and the list.
  const rail: PageRailSection[] = [
    {
      id: 'summary',
      glyph: 'chart',
      labelEn: 'Summary',
      labelEl: 'Σύνοψη',
      content: <StatsCards referrals={referrals} />,
    },
    {
      id: 'tier',
      glyph: 'spark',
      labelEn: 'Your tier',
      labelEl: 'Η βαθμίδα σας',
      content: <TierProgress referrals={successfulReferrals} currentTier={currentTier} />,
    },
    {
      id: 'how',
      glyph: 'book',
      labelEn: 'How it works',
      labelEl: 'Πώς λειτουργεί',
      content: (
        <ol className="space-y-4">
          {(['1', '2', '3'] as const).map((n) => (
            <li key={n} className="flex min-w-0 gap-3">
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
                {n}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium"><BilingualText en={referralsEn(`step${n}_title`)} el={referralsEl(`step${n}_title`)} compact wrap /></p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  <BilingualText en={referralsEn(`step${n}_body`)} el={referralsEl(`step${n}_body`)} compact wrap />
                </p>
              </div>
            </li>
          ))}
        </ol>
      ),
    },
  ];

  return (
    <AppShell rail={rail} askAi="Who have I invited to CoFounderBay, and which invitations are still pending?">
      <div className="space-y-6 pb-10">
        {isSample && (
          <SampleDataNotice
            surface="Referrals"
            detail="You have not invited anyone yet. These invitations are samples so you can see the layout."
            askAiPrompt="How do I invite a co-founder to CoFounderBay?"
          />
        )}

        <ReferralLink onCopy={(copy) => { copyRef.current = copy; }} />

        <Card className="shadow-sm border-border">
          <CardHeader className="border-b border-border">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle><BilingualText en={referralsEn('list_title')} el={referralsEl('list_title')} compact wrap /></CardTitle>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                <TabsList className="h-8">
                  <TabsTrigger value="all" className="text-xs"><BilingualText en={referralsEn('tab_all')} el={referralsEl('tab_all')} compact /></TabsTrigger>
                  <TabsTrigger value="pending" className="text-xs"><BilingualText en={referralsEn('tab_pending')} el={referralsEl('tab_pending')} compact /></TabsTrigger>
                  <TabsTrigger value="rewarded" className="text-xs"><BilingualText en={referralsEn('tab_rewarded')} el={referralsEl('tab_rewarded')} compact /></TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            {filteredReferrals.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Users className="mx-auto mb-3 h-12 w-12 opacity-50" aria-hidden="true" />
                <p className="text-sm"><BilingualText en={referralsEn('empty_list')} el={referralsEl('empty_list')} compact wrap /></p>
              </div>
            ) : (
              <div className="card-rows">
                {filteredReferrals.map((referral) => (
                  <ReferralCard key={referral.id} referral={referral} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
