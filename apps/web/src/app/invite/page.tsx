'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Mail, Users, Gift, Copy, Check, Send, X, Clock,
  UserCheck, Loader2, Link2, Sparkles, Trophy,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import {
  listInvites,
  getInviteStats,
  createInvite,
  cancelInvite,
  type InviteItem,
} from '@/lib/api';
import { cn } from '@/lib/utils';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualAria } from '@/lib/i18n/format';
import { useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';
import { INVITE_STRINGS, inviteEn, inviteEl } from '@/lib/i18n/strings-invite';
import { qk } from '@/lib/query-keys';
import { REFERRAL_REWARD_COPY } from '@cofounderbay/shared';

type InviteKey = keyof typeof INVITE_STRINGS;

const STATUS_CONFIG: Record<InviteItem['status'], { key: InviteKey; color: string }> = {
  pending:   { key: 'status_pending',   color: 'bg-status-warning-bg text-status-warning ' },
  accepted:  { key: 'status_accepted',  color: 'bg-status-success-bg text-status-success ' },
  expired:   { key: 'status_expired',   color: 'bg-muted text-muted-foreground' },
  cancelled: { key: 'status_cancelled', color: 'bg-muted text-muted-foreground' },
};

function StatCard({
  icon: Icon,
  labelKey,
  value,
  descriptionKey,
  accent = false,
}: {
  icon: React.ElementType;
  labelKey: InviteKey;
  value: number | string;
  descriptionKey?: InviteKey;
  accent?: boolean;
}) {
  return (
    <Card className={cn('', accent && 'border-primary/15 bg-primary/5')}>
      <CardContent>
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase leading-snug tracking-wide text-muted-foreground">
              <BilingualText en={inviteEn(labelKey)} el={inviteEl(labelKey)} compact />
            </p>
            <p className={cn('mt-1 text-3xl font-bold tabular-nums', accent ? 'text-primary-accessible' : 'text-foreground')}>{value}</p>
            {descriptionKey && (
              <p className="mt-1 text-xs leading-snug text-muted-foreground">
                <BilingualText en={inviteEn(descriptionKey)} el={inviteEl(descriptionKey)} compact wrap />
              </p>
            )}
          </div>
          <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', accent ? 'bg-primary/15' : 'bg-secondary')}>
            <Icon className={cn('icon-sm', accent ? 'text-primary-accessible' : 'text-muted-foreground')} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InviteRow({ invite, onCancel, cancelling }: {
  invite: InviteItem;
  onCancel: (id: string) => void;
  cancelling: boolean;
}) {
  const cfg = STATUS_CONFIG[invite.status];
  // A row of the history card, on the card's axis with no frame of its own:
  // the address and its dates, the state at the right. On a phone the state
  // drops under the dates, so it never sits stranded beside the cancel button.
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1.5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground" translate="no">{invite.email}</p>
        {/* Dates stay pinned to UTC, as everywhere else on the platform, so a
            rendered day cannot shift under the reader's clock. */}
        <p className="text-xs leading-snug text-muted-foreground">
          <BilingualText
            en={[inviteEn('sent_on').replace('{date}', new Date(invite.createdAt).toLocaleDateString('en-GB', { timeZone: 'UTC' })),
                invite.acceptedAt ? inviteEn('joined_on').replace('{date}', new Date(invite.acceptedAt).toLocaleDateString('en-GB', { timeZone: 'UTC' })) : null]
              .filter(Boolean).join(' · ')}
            el={[inviteEl('sent_on').replace('{date}', new Date(invite.createdAt).toLocaleDateString('el-GR', { timeZone: 'UTC' })),
                invite.acceptedAt ? inviteEl('joined_on').replace('{date}', new Date(invite.acceptedAt).toLocaleDateString('el-GR', { timeZone: 'UTC' })) : null]
              .filter(Boolean).join(' · ')}
            compact
            wrap
          />
        </p>
      </div>
      <div className="col-start-1 row-start-2 sm:col-start-2 sm:row-start-1">
        <Badge className={cn('text-xs', cfg.color)}>
          <BilingualText en={inviteEn(cfg.key)} el={inviteEl(cfg.key)} compact />
        </Badge>
      </div>
      {invite.status === 'pending' && (
        <Button
          variant="ghost"
          size="icon"
          className="col-start-2 row-start-1 h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive-accessible sm:col-start-3"
          onClick={() => onCancel(invite.id)}
          disabled={cancelling}
          aria-label={bilingualAria(inviteEn('cancel_invite'), inviteEl('cancel_invite'))}
        >
          <X className="icon-sm" aria-hidden="true" />
        </Button>
      )}
    </li>
  );
}

export default function InvitePage() {
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();
  const { primary } = useLanguagePreference();
  /* Toasts are one line of transient feedback, so they speak the reader's own
     language rather than stacking both into a notification that disappears. */
  const t = (key: InviteKey) => (primary === 'el' ? inviteEl(key) : inviteEn(key));

  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: qk('invites', 'stats'),
    queryFn: getInviteStats,
    staleTime: 30_000,
  });

  const { data: invitesData, isLoading: invitesLoading } = useQuery({
    queryKey: qk('invites'),
    queryFn: () => listInvites({ limit: 50 }),
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: () => createInvite({ email: email.trim(), message: message.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk('invites') });
      queryClient.invalidateQueries({ queryKey: qk('invites', 'stats') });
      success(t('sent_title'), t('sent_body').replace('{email}', email.trim()));
      setEmail('');
      setMessage('');
    },
    onError: (err) => {
      showError(t('send_failed'), err instanceof Error ? err.message : t('try_again'));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelInvite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk('invites') });
      queryClient.invalidateQueries({ queryKey: qk('invites', 'stats') });
      setCancellingId(null);
      success(t('cancelled_title'), t('cancelled_body'));
    },
    onError: () => {
      setCancellingId(null);
      showError(t('cancel_failed'), t('try_again'));
    },
  });

  const stats = statsData?.stats;
  const invites = invitesData?.invites ?? [];
  const canInvite = (stats?.remaining ?? 1) > 0;

  const handleCopyLink = () => {
    const link = `${window.location.origin}/register?ref=invite`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <AppShell>
      <div className="w-full space-y-6 pb-10">
        {/* Stats row */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent><Skeleton className="h-12 w-full" /></CardContent></Card>
            ))
          ) : (
            <>
              <StatCard icon={Send} labelKey="stat_sent" value={stats?.total ?? 0} />
              <StatCard icon={UserCheck} labelKey="stat_joined" value={stats?.accepted ?? 0} descriptionKey="stat_joined_hint" accent />
              <StatCard icon={UserCheck} labelKey="stat_active" value={stats?.active ?? 0} descriptionKey="stat_active_hint" />
              <StatCard icon={Gift} labelKey="stat_remaining" value={stats?.remaining ?? 0} descriptionKey="stat_remaining_hint" />
            </>
          )}
        </div>
        {/* Why "Active" and not "Joined" is what rewards count. */}
        <p className="text-xs text-muted-foreground">
          <BilingualText en={REFERRAL_REWARD_COPY.en} el={REFERRAL_REWARD_COPY.el} wrap />
        </p>

        {/* Invite form */}
        <Card className="shadow-sm border-border">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="icon-md shrink-0 text-muted-foreground" />
              <BilingualText en={inviteEn('form_title')} el={inviteEl('form_title')} compact wrap />
            </CardTitle>
            <CardDescription>
              <BilingualText en={inviteEn('form_description')} el={inviteEl('form_description')} />
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!canInvite && (
              <div className="flex items-center gap-3 rounded-xl border border-status-warning-border bg-status-warning-bg px-4 py-3">
                <Trophy className="icon-sm shrink-0 text-status-warning" />
                <p className="min-w-0 text-sm leading-snug text-foreground">
                  <BilingualText en={inviteEn('quota_spent')} el={inviteEl('quota_spent')} />
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="invite-email">
                <BilingualText en={inviteEn('email_label')} el={inviteEl('email_label')} compact /> <span className="text-destructive-accessible">*</span>
              </Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!canInvite}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-message"><BilingualText en={inviteEn('message_label')} el={inviteEl('message_label')} compact /></Label>
              <Textarea
                id="invite-message"
                /* A placeholder is read inside the box it sits in, so it takes
                   the reader's language rather than both at once — the
                   bilingual join would truncate and read as neither. */
                placeholder={t('message_placeholder')}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                disabled={!canInvite}
                maxLength={500}
              />
            </div>

            <div className="flex gap-3">
              <Button
                className="flex-1 gap-2"
                disabled={!email.trim() || !canInvite || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? (
                  <Loader2 className="icon-sm animate-spin" />
                ) : (
                  <Mail className="icon-sm" />
                )}
                {createMutation.isPending ? <BilingualText en={inviteEn('sending')} el={inviteEl('sending')} compact /> : <BilingualText en={inviteEn('send')} el={inviteEl('send')} compact wrap />}
              </Button>

              <Button variant="outline" className="gap-2" onClick={handleCopyLink}>
                {copied ? <Check className="icon-sm text-status-success" /> : <Link2 className="icon-sm" />}
                {copied ? <BilingualText en={inviteEn('copied')} el={inviteEl('copied')} compact /> : <BilingualText en={inviteEn('copy_link')} el={inviteEl('copy_link')} compact wrap />}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Invite history */}
        <Card className="shadow-sm border-border">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2">
              <Clock className="icon-md shrink-0 text-muted-foreground" />
              <BilingualText en={inviteEn('history_title')} el={inviteEl('history_title')} compact wrap />
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 pt-0">
            {invitesLoading ? (
              <div className="space-y-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 py-3 border-b border-border">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-40" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                  </div>
                ))}
              </div>
            ) : invites.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                  <Users className="icon-lg text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground"><BilingualText en={inviteEn('empty_title')} el={inviteEl('empty_title')} compact /></p>
                <p className="max-w-sm text-xs leading-snug text-muted-foreground">
                  <BilingualText en={inviteEn('empty_hint')} el={inviteEl('empty_hint')} />
                </p>
              </div>
            ) : (
              <ul className="card-rows">
                {invites.map((inv) => (
                  <InviteRow
                    key={inv.id}
                    invite={inv}
                    onCancel={(id) => {
                      setCancellingId(id);
                      cancelMutation.mutate(id);
                    }}
                    cancelling={cancellingId === inv.id && cancelMutation.isPending}
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
