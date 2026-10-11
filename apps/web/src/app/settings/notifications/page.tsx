'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Bell, Mail, MessageSquare, Users, Calendar,
  Briefcase, TrendingUp, Shield, Volume2, VolumeX, Smartphone,
  Monitor, Save, Loader2, Zap, GitMerge, CreditCard, RefreshCw, Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AppShell } from '@/components/layout/AppShell';
import { useToast } from '@/components/ui/toast';
import { BilingualText } from '@/components/common/BilingualText';
import { settingsEn, settingsEl } from '@/lib/i18n/strings-settings';
import { cn } from '@/lib/utils';
import { getNotificationPreferences, updateNotificationPreferences } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import { choiceControl, rowOptions, usePageControls } from '@/lib/page-controls';
import {
  AUTOMATION_KEYS,
  NOTIFICATION_CATEGORIES,
  categoryChannelOn,
  channelsOf,
  setChannel,
  updateNotificationPrefs,
  useNotificationPrefs,
  type AutomationKey,
  type NotificationCategoryDef,
  type NotificationChannel,
} from '@/lib/notification-prefs';

type Digest = 'daily' | 'weekly' | 'monthly' | 'never';

const DIGEST_OPTIONS: { value: Digest; en: string; el: string }[] = [
  { value: 'daily', en: 'Daily', el: 'Καθημερινά' },
  { value: 'weekly', en: 'Weekly', el: 'Εβδομαδιαία' },
  { value: 'monthly', en: 'Monthly', el: 'Μηνιαία' },
  { value: 'never', en: 'Never', el: 'Ποτέ' },
];

const CATEGORY_ICONS: Record<NotificationCategoryDef['id'], React.ElementType> = {
  messages: MessageSquare,
  connections: Users,
  matches: TrendingUp,
  projects: Briefcase,
  events: Calendar,
  security: Shield,
};

const CHANNELS: { id: NotificationChannel; icon: React.ElementType; en: string; el: string }[] = [
  { id: 'push', icon: Smartphone, en: 'Push', el: 'Push' },
  { id: 'email', icon: Mail, en: 'Email', el: 'Email' },
  { id: 'inApp', icon: Monitor, en: 'In-app', el: 'Στην εφαρμογή' },
];

const AUTOMATION: { key: AutomationKey; icon: React.ElementType; en: string; el: string; descEn: string; descEl: string }[] = [
  { key: 'automation_onboarding', icon: Users, en: 'Onboarding', el: 'Πρώτα βήματα', descEn: 'Welcome, profile nudges, setup reminders', descEl: 'Καλωσόρισμα, υπενθυμίσεις προφίλ και ρύθμισης' },
  { key: 'automation_matching', icon: GitMerge, en: 'Matching', el: 'Αντιστοιχίσεις', descEn: 'New matches, connection follow-ups, unread match nudges', descEl: 'Νέες αντιστοιχίσεις, συνέχειες συνδέσεων, υπενθυμίσεις' },
  { key: 'automation_mentorship', icon: TrendingUp, en: 'Mentorship', el: 'Mentoring', descEn: 'Mentor request updates, session reminders', descEl: 'Ενημερώσεις αιτημάτων μέντορα, υπενθυμίσεις συνεδριών' },
  { key: 'automation_community', icon: Users, en: 'Community', el: 'Κοινότητα', descEn: 'Welcome messages, activity nudges in groups', descEl: 'Μηνύματα καλωσορίσματος, υπενθυμίσεις σε κοινότητες' },
  { key: 'automation_billing', icon: CreditCard, en: 'Billing & subscriptions', el: 'Χρεώσεις & συνδρομές', descEn: 'Trial reminders, payment alerts, renewal notices', descEl: 'Υπενθυμίσεις δοκιμής, ειδοποιήσεις πληρωμών και ανανεώσεων' },
  { key: 'automation_reengagement', icon: RefreshCw, en: 'Re-engagement', el: 'Επανασύνδεση', descEn: 'Personalised prompts when inactive', descEl: 'Εξατομικευμένες υπενθυμίσεις όταν είστε ανενεργοί' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

export default function NotificationPreferencesPage() {
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();
  const prefs = useNotificationPrefs();
  const [digest, setDigest] = useState<Digest>('weekly');

  const { data: serverPrefs } = useQuery({
    queryKey: qk('notifications', 'preferences'),
    queryFn: getNotificationPreferences,
  });

  useEffect(() => {
    if (serverPrefs?.digestFrequency) setDigest(serverPrefs.digestFrequency as Digest);
  }, [serverPrefs]);

  const saveDigest = useMutation({
    mutationFn: () => updateNotificationPreferences({ digestFrequency: digest }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk('notifications', 'preferences') });
      success('Digest saved', 'Your email digest frequency is saved to your account.');
    },
    onError: () => toastError('Could not save the digest'),
  });
  const digestDirty = (serverPrefs?.digestFrequency ?? 'never') !== digest;

  const setQuietHours = (patch: Partial<typeof prefs.quietHours>) =>
    updateNotificationPrefs((prev) => ({ ...prev, quietHours: { ...prev.quietHours, ...patch } }));
  const setAutomation = (key: AutomationKey, value: boolean) =>
    updateNotificationPrefs((prev) => ({ ...prev, automation: { ...prev.automation, [key]: value } }));
  const setCategory = (category: NotificationCategoryDef, channel: NotificationChannel, value: boolean) =>
    setChannel(category.settings.map((s) => s.id), channel, value);

  // Offered to the assistant: the digest (chosen, then saved), quiet hours,
  // and a whole category or automated-message type on or off - the same
  // setters the switches call.
  const categoryRows = rowOptions(NOTIFICATION_CATEGORIES, (c) => c.id, (c) => c.titleEn, (c) => c.titleEl);
  const automationRows = AUTOMATION.map((a) => ({ value: a.key, labelEn: a.en, labelEl: a.el }));
  usePageControls([
    choiceControl('digest_frequency', 'Email digest frequency', 'Συχνότητα email σύνοψης', DIGEST_OPTIONS, digest, (v) => setDigest(v as Digest)),
    {
      id: 'save_digest',
      labelEn: 'Save the email digest frequency',
      labelEl: 'Αποθήκευση συχνότητας email σύνοψης',
      writes: true,
      unavailableEn: digestDirty ? undefined : 'The digest frequency is already saved.',
      unavailableEl: digestDirty ? undefined : 'Η συχνότητα σύνοψης είναι ήδη αποθηκευμένη.',
      run: async () => { await saveDigest.mutateAsync(); },
    },
    {
      id: 'quiet_hours',
      labelEn: 'Quiet hours',
      labelEl: 'Ώρες ησυχίας',
      writes: true,
      options: [
        { value: 'on', labelEn: 'On', labelEl: 'Ενεργές' },
        { value: 'off', labelEn: 'Off', labelEl: 'Ανενεργές' },
      ],
      current: prefs.quietHours.enabled ? 'on' : 'off',
      // One flag; its hours are left as they were.
      undo: () => ({ control: 'quiet_hours', value: prefs.quietHours.enabled ? 'on' : 'off' }),
      run: (v) => setQuietHours({ enabled: v === 'on' }),
    },
    // A category switch sets every type in it, so the opposite restores the
    // category only when all its types agreed before - otherwise it would
    // flatten choices made one by one, and there is no undo.
    ...CHANNELS.flatMap((ch) => {
      const uniform = (v: string | undefined, on: boolean) => {
        const c = NOTIFICATION_CATEGORIES.find((x) => x.id === v);
        return c ? c.settings.every((st) => channelsOf(prefs, st)[ch.id] === on) : false;
      };
      return [
        { id: `${ch.id}_on`, labelEn: `Turn ${ch.en.toLowerCase()} notifications on for`, labelEl: `Ενεργοποίηση ειδοποιήσεων ${ch.el} για`, writes: true, options: categoryRows, undo: (v?: string) => (uniform(v, false) ? { control: `${ch.id}_off`, value: v } : undefined), run: (v?: string) => { const c = NOTIFICATION_CATEGORIES.find((x) => x.id === v); if (c) setCategory(c, ch.id, true); } },
        { id: `${ch.id}_off`, labelEn: `Turn ${ch.en.toLowerCase()} notifications off for`, labelEl: `Απενεργοποίηση ειδοποιήσεων ${ch.el} για`, writes: true, options: categoryRows, undo: (v?: string) => (uniform(v, true) ? { control: `${ch.id}_on`, value: v } : undefined), run: (v?: string) => { const c = NOTIFICATION_CATEGORIES.find((x) => x.id === v); if (c) setCategory(c, ch.id, false); } },
      ];
    }),
    { id: 'automation_on', labelEn: 'Turn automated messages on', labelEl: 'Ενεργοποίηση αυτοματοποιημένων μηνυμάτων', writes: true, options: automationRows.filter((a) => !prefs.automation[a.value as AutomationKey]), undo: (v) => ({ control: 'automation_off', value: v }), run: (v) => { if (v) setAutomation(v as AutomationKey, true); } },
    { id: 'automation_off', labelEn: 'Turn automated messages off', labelEl: 'Απενεργοποίηση αυτοματοποιημένων μηνυμάτων', writes: true, options: automationRows.filter((a) => prefs.automation[a.value as AutomationKey]), undo: (v) => ({ control: 'automation_on', value: v }), run: (v) => { if (v) setAutomation(v as AutomationKey, false); } },
  ]);

  const saveButton = (className?: string) => (
    <Button size="sm" onClick={() => saveDigest.mutate()} disabled={saveDigest.isPending || !digestDirty} className={cn('gap-2', className)}>
      {saveDigest.isPending ? <Loader2 className="icon-sm animate-spin" /> : <Save className="icon-sm" />}
      <BilingualText en={saveDigest.isPending ? settingsEn('saving') : 'Save digest'} el={saveDigest.isPending ? settingsEl('saving') : 'Αποθήκευση σύνοψης'} compact />
    </Button>
  );

  return (
    <AppShell
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" className="sm:hidden" aria-label="Settings" asChild>
            <Link href="/settings">
              <ArrowLeft className="icon-sm" />
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="hidden gap-2 sm:flex" asChild>
            <Link href="/settings">
              <ArrowLeft className="icon-sm" />
              <BilingualText en={settingsEn('settings')} el={settingsEl('settings')} compact />
            </Link>
          </Button>
          {saveButton('hidden sm:inline-flex')}
        </div>
      }
    >
      <div className="space-y-6 pb-10">
        {/* Where each choice is kept - said once, before any switch. */}
        <p className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <Info className="icon-sm mt-0.5 shrink-0" aria-hidden="true" />
          <BilingualText
            en="The email digest is saved to your account. Channels, quiet hours and automated messages are kept on this device and take effect immediately here; delivery from the server does not read them yet."
            el="Η email σύνοψη αποθηκεύεται στον λογαριασμό σας. Τα κανάλια, οι ώρες ησυχίας και τα αυτοματοποιημένα μηνύματα κρατούνται σε αυτή τη συσκευή και ισχύουν αμέσως εδώ· η αποστολή από τον διακομιστή δεν τα διαβάζει ακόμη."
            wrap
          />
        </p>

        {/* Delivery */}
        <Card className="shadow-sm border-border">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="icon-md text-muted-foreground" aria-hidden="true" />
              <BilingualText en="Delivery" el="Παράδοση" compact />
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border/50 p-0">
            <div className="flex flex-col gap-3 px-4 py-4 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-0.5">
                <Label htmlFor="digest" className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  <BilingualText en="Email digest" el="Email σύνοψη" compact />
                  <Badge variant="secondary" className="text-2xs">
                    <BilingualText en="Saved to your account" el="Στον λογαριασμό" compact />
                  </Badge>
                </Label>
                <p className="text-sm text-muted-foreground">
                  <BilingualText en="A summary of activity, sent by email" el="Σύνοψη δραστηριότητας μέσω email" compact wrap />
                </p>
              </div>
              <Select value={digest} onValueChange={(v) => setDigest(v as Digest)}>
                <SelectTrigger id="digest" className="ml-auto w-full sm:w-44" aria-label="Email digest frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIGEST_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      <BilingualText en={o.en} el={o.el} compact />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 px-4 py-4 sm:px-6">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 space-y-0.5">
                  <p id="page-cap1-cap" className="flex items-center gap-2 text-sm font-medium">
                    {prefs.quietHours.enabled ? <VolumeX className="icon-sm" aria-hidden="true" /> : <Volume2 className="icon-sm" aria-hidden="true" />}
                    <BilingualText en="Quiet hours" el="Ώρες ησυχίας" compact />
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <BilingualText en="Pause push notifications during these hours" el="Παύση push ειδοποιήσεων αυτές τις ώρες" compact wrap />
                  </p>
                </div>
                <Switch
                  checked={prefs.quietHours.enabled}
                  onCheckedChange={(v) => setQuietHours({ enabled: v })}
                  aria-label="Enable quiet hours"
                />
              </div>
              {prefs.quietHours.enabled && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  {([['start', 'From', 'Από'], ['end', 'To', 'Έως']] as const).map(([key, en, el]) => (
                    <div key={key} className="flex items-center gap-2">
                      <Label htmlFor="page-f2" className="text-sm text-muted-foreground"><BilingualText en={en} el={el} compact /></Label>
                      <Select value={prefs.quietHours[key]} onValueChange={(v) => setQuietHours({ [key]: v })}>
                        <SelectTrigger id="page-f2" className="w-[100px]" aria-label={key === 'start' ? 'Quiet hours start time' : 'Quiet hours end time'}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {HOURS.map((time) => <SelectItem key={time} value={time}>{time}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Notification types: one matrix, the channels as columns. */}
        <Card className="shadow-sm border-border">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="icon-md text-muted-foreground" aria-hidden="true" />
              <BilingualText en="What you are notified about" el="Για τι ειδοποιείστε" compact />
            </CardTitle>
            <CardDescription>
              <BilingualText en="Choose a channel per notification type. A category's own row switches all of its types at once." el="Επιλέξτε κανάλι ανά τύπο ειδοποίησης. Η γραμμή κάθε κατηγορίας αλλάζει όλους τους τύπους της μαζί." compact wrap />
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {/* Column heads, from sm up; below sm each switch carries its own icon. */}
            <div className="hidden items-center justify-end gap-4 border-b border-border px-4 py-2 sm:px-6 text-xs font-medium text-muted-foreground sm:flex">
              {CHANNELS.map((ch) => (
                <span key={ch.id} className="flex w-16 flex-col items-center gap-0.5 text-center">
                  <ch.icon className="icon-sm" aria-hidden="true" />
                  <BilingualText en={ch.en} el={ch.el} compact />
                </span>
              ))}
            </div>
            {NOTIFICATION_CATEGORIES.map((category) => {
              const Icon = CATEGORY_ICONS[category.id];
              return (
                <section key={category.id} className="border-b border-border last:border-b-0" aria-labelledby={`cat-${category.id}`}>
                  <div className="flex flex-col gap-3 px-4 py-3 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Icon className="icon-sm text-muted-foreground" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <h3 id={`cat-${category.id}`} className="text-sm font-semibold text-foreground">
                          <BilingualText en={category.titleEn} el={category.titleEl} compact />
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          <BilingualText en={category.descriptionEn} el={category.descriptionEl} compact wrap />
                        </p>
                      </div>
                    </div>
                    <ChannelSwitches
                      label={category.titleEn}
                      value={(ch) => categoryChannelOn(prefs, category, ch)}
                      onChange={(ch, v) => setCategory(category, ch, v)}
                      scope="all"
                    />
                  </div>
                  {category.settings.map((setting) => {
                    const channels = channelsOf(prefs, setting);
                    return (
                      <div key={setting.id} className="flex flex-col gap-3 px-4 py-3 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-sm font-medium text-foreground">
                            <BilingualText en={setting.labelEn} el={setting.labelEl} compact />
                          </p>
                          <p className="text-xs text-muted-foreground">
                            <BilingualText en={setting.descriptionEn} el={setting.descriptionEl} compact wrap />
                          </p>
                        </div>
                        <ChannelSwitches
                          label={setting.labelEn}
                          value={(ch) => channels[ch]}
                          onChange={(ch, v) => setChannel([setting.id], ch, v)}
                        />
                      </div>
                    );
                  })}
                </section>
              );
            })}
          </CardContent>
        </Card>

        {/* Automated messages */}
        <Card className="shadow-sm border-border">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="icon-md text-muted-foreground" aria-hidden="true" />
              <BilingualText en="Automated messages" el="Αυτοματοποιημένα μηνύματα" compact />
            </CardTitle>
            <CardDescription>
              <BilingualText en="Workflow messages the platform sends on its own." el="Μηνύματα ροών που στέλνει η πλατφόρμα από μόνη της." compact wrap />
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border/40">
            {AUTOMATION.map(({ key, icon: Icon, en, el, descEn, descEl }) => (
              <div key={key} className="flex items-center justify-between gap-4 py-3">
                <div className="flex min-w-0 items-start gap-3">
                  <Icon className="icon-sm mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium"><BilingualText en={en} el={el} compact /></p>
                    <p className="text-xs text-muted-foreground"><BilingualText en={descEn} el={descEl} compact wrap /></p>
                  </div>
                </div>
                <Switch
                  checked={prefs.automation[key]}
                  onCheckedChange={(val) => setAutomation(key, val)}
                  aria-label={en}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="sm:hidden">{saveButton('w-full')}</div>
      </div>
    </AppShell>
  );
}

/** Three switches, one per channel, aligned under the column heads. */
function ChannelSwitches({
  label,
  value,
  onChange,
  scope,
}: {
  label: string;
  value: (channel: NotificationChannel) => boolean;
  onChange: (channel: NotificationChannel, value: boolean) => void;
  scope?: 'all';
}) {
  return (
    <div className="ml-auto flex shrink-0 items-center justify-between gap-4 sm:justify-end">
      {CHANNELS.map((ch) => (
        <div key={ch.id} className="flex items-center gap-1.5 sm:w-16 sm:justify-center">
          <ch.icon className="icon-sm text-muted-foreground sm:hidden" aria-hidden="true" />
          <Switch
            checked={value(ch.id)}
            onCheckedChange={(v) => onChange(ch.id, v)}
            aria-label={`${label}${scope === 'all' ? ' (all types)' : ''} — ${ch.en.toLowerCase()} notifications`}
          />
        </div>
      ))}
    </div>
  );
}
