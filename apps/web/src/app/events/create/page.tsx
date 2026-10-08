'use client';

import { useFormDraft } from '@/lib/form-draft';
import { FormDraftNotice } from '@/components/common/FormDraftNotice';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  MapPin,
  Video,
  Users,
  ArrowLeft,
  Loader2,
  Globe,
  Building2,
} from 'lucide-react';
import { createEvent } from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import { BilingualText } from '@/components/common/BilingualText';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { bilingualInline } from '@/lib/i18n/format';
import { useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';

const EVENT_TYPES = [
  { value: 'networking', label: 'Networking', labelEl: 'Δικτύωση' },
  { value: 'meetup', label: 'Meetup', labelEl: 'Συνάντηση' },
  { value: 'webinar', label: 'Webinar', labelEl: 'Διαδικτυακό σεμινάριο' },
  { value: 'workshop', label: 'Workshop', labelEl: 'Εργαστήριο' },
  { value: 'demo_day', label: 'Demo Day', labelEl: 'Demo Day' },
  { value: 'other', label: 'Other', labelEl: 'Άλλο' },
] as const;

type EventType = (typeof EVENT_TYPES)[number]['value'];
const EVENT_TYPE_VALUES: readonly string[] = EVENT_TYPES.map((t) => t.value);

/** "Thu 24 Oct, 18:30 – 21:00", from the two datetime-local values as typed. */
function whenText(startAt: string, endAt: string, locale: 'en-GB' | 'el-GR' = 'en-GB'): string | null {
  const start = startAt ? new Date(startAt) : null;
  if (!start || Number.isNaN(start.getTime())) return null;
  const day = start.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const time = (d: Date) => d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const end = endAt ? new Date(endAt) : null;
  if (!end || Number.isNaN(end.getTime())) return `${day}, ${time(start)}`;
  const sameDay = end.toDateString() === start.toDateString();
  return sameDay
    ? `${day}, ${time(start)} – ${time(end)}`
    : `${day}, ${time(start)} – ${end.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}, ${time(end)}`;
}

/** A card section of the form: a bilingual title with its icon, then fields. */
function FormSection({ icon: Icon, title, titleEl, children }: { icon: typeof Calendar; title: string; titleEl: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="icon-sm text-muted-foreground" aria-hidden="true" />
          <BilingualText en={title} el={titleEl} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

/*
 * The form filled the left 40% of a wide screen and left the rest empty, with
 * nothing to say what the event would look like once published. The right
 * column now previews the listing as it is typed and lists what is still
 * missing; the fields themselves are unchanged, and every label is now tied
 * to its input.
 */
export default function CreateEventPage() {
  const { primary } = useLanguagePreference();
  const router = useRouter();
  const { success, error: showError } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'networking' as EventType,
    startAt: '',
    endAt: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    location: '',
    isOnline: false,
    meetingUrl: '',
    capacity: '',
  });

  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // A draft the assistant proposed (draft_event). Only known fields, each in
  // the type the input holds; the person still presses Create.
  const draft = useFormDraft('event', (f) => {
    setForm((prev) => {
      const next = { ...prev };
      for (const key of ['title', 'description', 'location', 'meetingUrl', 'capacity'] as const) {
        if (typeof f[key] === 'string') next[key] = f[key] as string;
      }
      for (const key of ['startAt', 'endAt'] as const) {
        // datetime-local wants "YYYY-MM-DDTHH:mm"; anything else is left empty.
        const value = f[key];
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) next[key] = value.slice(0, 16);
      }
      if (typeof f.type === 'string' && EVENT_TYPE_VALUES.includes(f.type)) next.type = f.type as EventType;
      if (typeof f.isOnline === 'boolean') next.isOnline = f.isOnline;
      return next;
    });
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    if (!form.startAt) return;

    setSubmitting(true);
    try {
      const startDate = new Date(form.startAt).toISOString();
      const endDate = form.endAt ? new Date(form.endAt).toISOString() : undefined;

      await createEvent({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        type: form.type,
        startAt: startDate,
        endAt: endDate,
        timezone: form.timezone || undefined,
        location: form.location.trim() || undefined,
        isOnline: form.isOnline,
        meetingUrl: form.meetingUrl.trim() || undefined,
        capacity: form.capacity ? parseInt(form.capacity, 10) : undefined,
      });
      success('Event created', form.title.trim());
      router.push(`/events`);
    } catch (err) {
      showError('Could not create event', err instanceof Error ? err.message : 'Please try again');
    } finally {
      setSubmitting(false);
    }
  };

  const type = EVENT_TYPES.find((t) => t.value === form.type) ?? EVENT_TYPES[0];
  // Typed as local time, so shown in local time, in the reader's language.
  const when = whenText(form.startAt, form.endAt, primary === 'el' ? 'el-GR' : 'en-GB');
  const place = form.isOnline ? (form.meetingUrl.trim() ? 'Online' : null) : form.location.trim() || null;
  const capacity = form.capacity ? parseInt(form.capacity, 10) : null;
  const checklist = [
    { done: Boolean(form.title.trim()), en: 'A title', el: 'Τίτλος', required: true },
    { done: Boolean(form.startAt), en: 'A start time', el: 'Ώρα έναρξης', required: true },
    { done: Boolean(place), en: form.isOnline ? 'A meeting link' : 'A venue', el: form.isOnline ? 'Σύνδεσμος συνάντησης' : 'Χώρος', required: false },
    { done: form.description.trim().length >= 40, en: 'A description of who should come', el: 'Περιγραφή για το ποιος να έρθει', required: false },
  ];

  return (
    <AppShell
      title="Create event"
      titleEl="Δημιουργία εκδήλωσης"
      description="Host a meetup, webinar or demo day for the community."
      descriptionEl="Οργανώστε συνάντηση, webinar ή demo day για την κοινότητα."
      actions={
        <Button variant="secondary" size="sm" className="gap-2" asChild>
          <Link href="/events">
            <ArrowLeft className="icon-sm" aria-hidden="true" />
            <BilingualText en="Back to events" el="Πίσω στις εκδηλώσεις" compact />
          </Link>
        </Button>
      }
    >
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,44rem)_22rem]">
        <form onSubmit={handleSubmit} className="min-w-0 space-y-6">
          <FormDraftNotice filled={draft.filled} onDismiss={draft.dismiss} />
          <FormSection icon={Calendar} title="Basic information" titleEl="Βασικά στοιχεία">
            <FormField htmlFor="event-title" required label={<BilingualText en="Event title" el="Τίτλος εκδήλωσης" compact />}>
              <Input
                placeholder="e.g. Founder Meetup Athens Q2"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                required
                maxLength={120}
              />
            </FormField>

            <FormField htmlFor="event-description" label={<BilingualText en="Description" el="Περιγραφή" compact />}>
              <Textarea
                className="min-h-[7rem] resize-none"
                placeholder={bilingualInline("What will happen at this event? Who should attend?", "Τι θα γίνει στην εκδήλωση; Ποιοι πρέπει να έρθουν;")}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                maxLength={5000}
              />
            </FormField>

            <div className="space-y-1.5">
              <p id="event-type-label" className="text-sm font-medium text-foreground">
                <BilingualText en="Event type" el="Τύπος εκδήλωσης" compact />
              </p>
              <div role="group" aria-labelledby="event-type-label" className="flex flex-wrap gap-2">
                {EVENT_TYPES.map(({ value, label, labelEl }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={form.type === value}
                    onClick={() => set('type', value)}
                    className={cn(
                      'min-h-9 rounded-full border px-3 py-1 text-sm font-medium transition-colors focus-ring',
                      form.type === value
                        ? 'border-primary bg-primary/15 text-primary-accessible'
                        : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
                    )}
                  >
                    <BilingualText en={label} el={labelEl} compact />
                  </button>
                ))}
              </div>
            </div>
          </FormSection>

          <FormSection icon={Clock} title="Date & time" titleEl="Ημερομηνία & ώρα">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField htmlFor="event-start" required label={<BilingualText en="Start" el="Έναρξη" compact />}>
                <Input type="datetime-local" value={form.startAt} onChange={(e) => set('startAt', e.target.value)} required />
              </FormField>
              <FormField htmlFor="event-end" label={<BilingualText en="End" el="Λήξη" compact />}>
                <Input type="datetime-local" value={form.endAt} onChange={(e) => set('endAt', e.target.value)} min={form.startAt} />
              </FormField>
            </div>
            <FormField
              htmlFor="event-timezone"
              label={
                <span className="inline-flex items-center gap-1.5">
                  <Globe className="icon-sm" aria-hidden="true" />
                  <BilingualText en="Timezone" el="Ζώνη ώρας" compact />
                </span>
              }
            >
              <Input value={form.timezone} onChange={(e) => set('timezone', e.target.value)} placeholder="e.g. Europe/Athens" />
            </FormField>
          </FormSection>

          <FormSection icon={MapPin} title="Location" titleEl="Τοποθεσία">
            <div role="group" aria-label="Where the event happens" className="inline-flex rounded-xl border border-border bg-muted/40 p-0.5">
              {[
                { online: false, en: 'In person', el: 'Δια ζώσης', icon: Building2 },
                { online: true, en: 'Online', el: 'Διαδικτυακά', icon: Video },
              ].map(({ online, en, el, icon: Icon }) => (
                <button
                  key={en}
                  type="button"
                  aria-pressed={form.isOnline === online}
                  onClick={() => set('isOnline', online)}
                  className={cn(
                    'inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors focus-ring',
                    form.isOnline === online ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="icon-sm" aria-hidden="true" />
                  <BilingualText en={en} el={el} compact />
                </button>
              ))}
            </div>

            {form.isOnline ? (
              <FormField htmlFor="event-meeting-url" label={<BilingualText en="Meeting URL" el="Σύνδεσμος συνάντησης" compact />}>
                <Input type="url" placeholder="https://meet.google.com/…" value={form.meetingUrl} onChange={(e) => set('meetingUrl', e.target.value)} />
              </FormField>
            ) : (
              <FormField htmlFor="event-location" label={<BilingualText en="Venue / address" el="Χώρος / διεύθυνση" compact />}>
                <Input
                  placeholder="e.g. Station F, 5 Parvis Alan Turing, Paris"
                  value={form.location}
                  onChange={(e) => set('location', e.target.value)}
                  maxLength={180}
                />
              </FormField>
            )}
          </FormSection>

          <FormSection icon={Users} title="Capacity" titleEl="Χωρητικότητα">
            <FormField
              htmlFor="event-capacity"
              label={<BilingualText en="Max attendees" el="Μέγιστος αριθμός συμμετεχόντων" compact />}
              hint="Leave empty for unlimited attendees."
            >
              <Input
                type="number"
                placeholder={bilingualInline("Unlimited", "Απεριόριστο")}
                value={form.capacity}
                onChange={(e) => set('capacity', e.target.value)}
                min={1}
                max={5000}
                className="max-w-[12rem]"
              />
            </FormField>
          </FormSection>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" className="min-w-[140px] gap-2" disabled={submitting || !form.title.trim() || !form.startAt}>
              {submitting ? (
                <>
                  <Loader2 className="icon-sm animate-spin" aria-hidden="true" />
                  <BilingualText en="Creating…" el="Δημιουργία…" compact />
                </>
              ) : (
                <>
                  <Calendar className="icon-sm" aria-hidden="true" />
                  <BilingualText en="Create event" el="Δημιουργία εκδήλωσης" compact />
                </>
              )}
            </Button>
            <Button type="button" variant="ghost" asChild>
              <Link href="/events">
                <BilingualText en="Cancel" el="Ακύρωση" compact />
              </Link>
            </Button>
          </div>
        </form>

        {/* How the listing will read, and what it still lacks. */}
        <aside aria-label="Preview" className="min-w-0 space-y-4 lg:sticky lg:top-24">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                <BilingualText en="Preview" el="Προεπισκόπηση" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Badge variant="secondary" size="sm" className="bg-primary/10 text-primary-accessible">
                <BilingualText en={type.label} el={type.labelEl} compact />
              </Badge>
              <p className={cn('text-lg font-semibold leading-snug', !form.title.trim() && 'text-muted-foreground')}>
                {form.title.trim() || <BilingualText en="Untitled event" el="Εκδήλωση χωρίς τίτλο" />}
              </p>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Clock className="mt-0.5 icon-sm shrink-0" aria-hidden="true" />
                  <span className="min-w-0">
                    {when ?? <BilingualText en="Pick a start time" el="Επιλέξτε ώρα έναρξης" wrap />}
                    {when && form.timezone ? <span className="block text-xs">{form.timezone}</span> : null}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  {form.isOnline ? <Video className="mt-0.5 icon-sm shrink-0" aria-hidden="true" /> : <MapPin className="mt-0.5 icon-sm shrink-0" aria-hidden="true" />}
                  <span className="min-w-0 break-words">
                    {place ?? <BilingualText en={form.isOnline ? 'Online · add the link' : 'Add a venue'} el={form.isOnline ? 'Διαδικτυακά · προσθέστε σύνδεσμο' : 'Προσθέστε χώρο'} wrap />}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Users className="mt-0.5 icon-sm shrink-0" aria-hidden="true" />
                  <span className="min-w-0">
                    {capacity && capacity > 0 ? (
                      <BilingualText en={`Up to ${capacity} attendees`} el={`Έως ${capacity} συμμετέχοντες`} wrap />
                    ) : (
                      <BilingualText en="No attendance limit" el="Χωρίς όριο συμμετοχής" wrap />
                    )}
                  </span>
                </li>
              </ul>
              {form.description.trim() ? (
                <p className="line-clamp-4 border-t border-border pt-3 text-sm leading-relaxed text-muted-foreground">{form.description.trim()}</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                <BilingualText en="Before you publish" el="Πριν τη δημοσίευση" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {checklist.map((item) => (
                  <li key={item.en} className="flex items-start gap-2">
                    {item.done ? (
                      <CheckCircle2 className="mt-0.5 icon-sm shrink-0 text-status-success" aria-hidden="true" />
                    ) : (
                      <Circle className="mt-0.5 icon-sm shrink-0 text-muted-foreground/60" aria-hidden="true" />
                    )}
                    <span className={cn('min-w-0', item.done ? 'text-foreground' : 'text-muted-foreground')}>
                      <BilingualText en={item.en} el={item.el} wrap />
                      <span className="sr-only">{item.done ? ' (done)' : item.required ? ' (required)' : ' (recommended)'}</span>
                      {!item.done && item.required ? (
                        <span className="ml-1 text-xs text-destructive-accessible" aria-hidden="true">
                          <BilingualText en="required" el="υποχρεωτικό" compact />
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </aside>
      </div>
    </AppShell>
  );
}
