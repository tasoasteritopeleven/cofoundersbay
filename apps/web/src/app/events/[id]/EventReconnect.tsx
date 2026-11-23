'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BilingualText } from '@/components/common/BilingualText';
import { StatusText } from '@/components/common/StatusText';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useStoredUser } from '@/hooks/useStoredUser';
import type { EventItem } from '@/lib/api';
import {
  getEventAttendance, getEventReconnect, setEventAttendance, setEventReconnect,
  type AttendanceChange, type AttendanceRow, type ReconnectRow,
} from '@/lib/event-reconnect-api';
import { formatShortDate } from '@/lib/i18n/format';
import { useBilingualString, useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';
import { CANCELLED, ROW_GONE, rowOptions, type PageControl, type PageList } from '@/lib/page-controls';
import { isPreviewDemo } from '@/lib/preview-demo';
import { qk } from '@/lib/query-keys';
import { initialsOf } from '@/lib/utils';

const attended = { en: 'Attended', el: 'Παρευρέθηκε' };
const notMarked = { en: 'Not confirmed', el: 'Χωρίς επιβεβαίωση' };
const selection = { en: 'I’d like to meet again', el: 'Θέλω να ξαναβρεθούμε' };
const withdraw = { en: 'Withdraw selection', el: 'Απόσυρση επιλογής' };
const match = { en: 'Mutual interest', el: 'Αμοιβαίο ενδιαφέρον' };
const bulk = { en: 'Mark all going as attended', el: 'Επιβεβαίωση όλων όσοι δήλωσαν ότι θα έρθουν' };
const contact = { en: 'Connect or message', el: 'Σύνδεση ή μήνυμα' };
const name = (row: AttendanceRow | ReconnectRow, lang: 'en' | 'el') => row.displayName ?? (lang === 'el' ? 'Συμμετέχων' : 'Attendee');

export function useEventParticipation(event: EventItem | null) {
  const user = useStoredUser();
  const viewer = user?.id;
  const id = event?.id ?? '';
  const enabled = Boolean(viewer && id) && !isPreviewDemo();
  const organizer = enabled && event?.host?.id === viewer;
  const client = useQueryClient();
  const router = useRouter();
  const confirm = useConfirm();
  const say = useBilingualString();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const roster = useQuery({
    queryKey: qk('events', 'attendance', id, viewer),
    queryFn: () => getEventAttendance(id),
    enabled: organizer,
    retry: false,
    refetchInterval: 60_000,
  });
  const reconnect = useQuery({
    queryKey: qk('events', 'reconnect', id, viewer),
    queryFn: () => getEventReconnect(id),
    enabled,
    retry: false,
    refetchInterval: 60_000,
  });
  const attendees = organizer && !roster.isError ? roster.data?.rows : undefined;
  const candidates = enabled && !reconnect.isError ? reconnect.data?.rows : undefined;
  const canEdit = organizer && Boolean(roster.data?.editable) && !roster.isError;
  const canSelect = enabled && reconnect.data?.state === 'open' && !reconnect.isError;
  const going = attendees?.filter((row) => row.status === 'going' && !row.attended) ?? [];
  const matches = candidates?.filter((row) => row.mutual) ?? [];

  const save = async (operation: () => Promise<void>) => {
    if (busy) return { error: say('Please wait for the current update.', 'Περιμένετε να ολοκληρωθεί η ενημέρωση.') };
    setBusy(true);
    setFailed(false);
    try {
      await operation();
    } catch {
      setFailed(true);
      return { error: say('The update failed. Please retry.', 'Η ενημέρωση απέτυχε. Δοκιμάστε ξανά.') };
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: qk('events') }),
      client.invalidateQueries({ queryKey: qk('notifications') }),
    ]);
  };

  const mark = async (change: AttendanceChange) => {
    if (!canEdit) return ROW_GONE;
    if ('allGoing' in change) {
      if (!going.length) return ROW_GONE;
      if (!await confirm({
        title: <BilingualText en="Confirm attendance for everyone who RSVP’d Going?" el="Επιβεβαίωση παρουσίας για όλους όσοι δήλωσαν ότι θα έρθουν;" />,
        description: <BilingualText en="Use this only if they all attended. You can correct individual entries afterward." el="Χρησιμοποιήστε το μόνο αν παρευρέθηκαν όλοι. Μπορείτε μετά να διορθώσετε μεμονωμένες εγγραφές." />,
        confirmLabel: say(bulk.en, bulk.el),
      })) return CANCELLED;
    } else if (!change.attended && !await confirm({
      title: <BilingualText en="Clear confirmed attendance?" el="Αναίρεση επιβεβαιωμένης παρουσίας;" />,
      description: <BilingualText en="This also removes all reconnect selections and matches involving this attendee." el="Διαγράφονται επίσης όλες οι επιλογές επανασύνδεσης και τα αμοιβαία ενδιαφέροντα που αφορούν αυτόν τον συμμετέχοντα." />,
      confirmLabel: say('Clear attendance', 'Αναίρεση παρουσίας'),
    })) return CANCELLED;
    return save(async () => { await setEventAttendance(id, change); await refresh(); });
  };

  const select = async (row: ReconnectRow) => {
    if (!row.interested && !canSelect) return ROW_GONE;
    if (row.mutual && !await confirm({
      title: <BilingualText en="Withdraw this mutual interest?" el="Απόσυρση αυτού του αμοιβαίου ενδιαφέροντος;" />,
      description: <BilingualText en="The match disappears for both of you. No new notification is sent." el="Το αμοιβαίο ενδιαφέρον διαγράφεται και για τους δύο. Δεν αποστέλλεται νέα ειδοποίηση." />,
      confirmLabel: say(withdraw.en, withdraw.el),
    })) return CANCELLED;
    return save(async () => { await setEventReconnect(id, row.userId, !row.interested); await refresh(); });
  };

  const controls: PageControl[] = [];
  if (canEdit && attendees?.length) {
    controls.push({
      id: 'toggle_attended', labelEn: 'Toggle attendance', labelEl: 'Αλλαγή επιβεβαίωσης παρουσίας',
      writes: true, options: rowOptions(attendees, (row) => row.userId, (row) => name(row, 'en'), (row) => name(row, 'el')),
      run: (userId) => {
        const row = attendees.find((person) => person.userId === userId);
        return row ? mark({ userId: row.userId, attended: !row.attended }) : ROW_GONE;
      },
    });
    if (going.length) controls.push({
      id: 'mark_all_going', labelEn: bulk.en, labelEl: bulk.el, writes: true, run: () => mark({ allGoing: true }),
    });
  }
  const selectable = candidates?.filter((row) => row.interested || canSelect) ?? [];
  if (selectable.length) controls.push({
    id: 'toggle_reconnect', labelEn: 'Select or withdraw reconnect interest', labelEl: 'Επιλογή ή απόσυρση ενδιαφέροντος επανασύνδεσης',
    writes: true, options: rowOptions(selectable, (row) => row.userId, (row) => name(row, 'en'), (row) => name(row, 'el')),
    run: (userId) => {
      const row = selectable.find((person) => person.userId === userId);
      return row ? select(row) : ROW_GONE;
    },
  });
  if (matches.length) controls.push({
    id: 'contact_reconnect_match', labelEn: contact.en, labelEl: contact.el, writes: false,
    options: rowOptions(matches, (row) => row.userId, (row) => name(row, 'en'), (row) => name(row, 'el')),
    run: (userId) => {
      const row = matches.find((person) => person.userId === userId);
      if (!row) return ROW_GONE;
      router.push(matchProfile(row.userId));
    },
  });

  const attendanceLine = (row: AttendanceRow, lang: 'en' | 'el') => `${name(row, lang)} · ${(row.attended ? attended : notMarked)[lang]}`;
  const reconnectLine = (row: ReconnectRow, lang: 'en' | 'el') =>
    `${name(row, lang)}${row.mutual ? ` · ${match[lang]}` : row.interested ? ` · ${lang === 'el' ? 'Ιδιωτική επιλογή' : 'Private selection'}` : ''}`;
  const lists: PageList[] = [
    {
      id: 'attendance', labelEn: 'Attendance', labelEl: 'Παρουσίες',
      rows: attendees?.map((row) => attendanceLine(row, 'en')), rowsEl: attendees?.map((row) => attendanceLine(row, 'el')),
    },
    {
      id: 'event_reconnect', labelEn: 'Reconnect candidates and mutual matches', labelEl: 'Συμμετέχοντες και αμοιβαία ενδιαφέροντα',
      rows: reconnect.data?.state === 'open' || reconnect.data?.state === 'closed' ? candidates?.map((row) => reconnectLine(row, 'en')) : undefined,
      rowsEl: reconnect.data?.state === 'open' || reconnect.data?.state === 'closed' ? candidates?.map((row) => reconnectLine(row, 'el')) : undefined,
    },
  ];
  return { organizer, roster, reconnect, attendees, candidates, canEdit, canSelect, going, enabled, failed, busy, controls, lists, mark, select };
}

const matchProfile = (id: string) => `/profiles/${encodeURIComponent(id)}`;

function Person({ row }: { row: AttendanceRow | ReconnectRow }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar className="size-8">
        <AvatarImage src={row.avatarUrl ?? undefined} alt="" />
        <AvatarFallback>{initialsOf(row.displayName ?? undefined)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 break-words text-sm font-medium">
        {row.displayName || <BilingualText en="Attendee" el="Συμμετέχων" compact />}
      </span>
    </div>
  );
}

export function EventReconnect({ participation, event }: { participation: ReturnType<typeof useEventParticipation>; event: EventItem }) {
  const { primary } = useLanguagePreference();
  const say = useBilingualString();
  const { organizer, roster, reconnect, attendees, candidates, canEdit, canSelect, going, enabled, busy, failed, mark, select } = participation;
  const showReconnect = enabled && (
    (reconnect.isError && Boolean(event.viewerRsvp)) ||
    reconnect.data?.state === 'open' ||
    reconnect.data?.state === 'closed' ||
    (reconnect.data?.state === 'not_confirmed' && Boolean(event.viewerRsvp))
  );
  const anchor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (showReconnect && window.location.hash === '#reconnect') anchor.current?.scrollIntoView();
  }, [showReconnect, event.id]);
  if (!organizer && !showReconnect) return null;
  return (
    <div className="space-y-4">
      {organizer ? (
        <Card>
          <CardHeader><CardTitle><BilingualText en="Confirm attendance" el="Επιβεβαίωση παρουσιών" compact /></CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <BilingualText en="Mark only people who attended. Attendance can be edited from the start through seven days after the event ends." el="Επιβεβαιώστε μόνο όσους παρευρέθηκαν. Μπορείτε να αλλάξετε τις παρουσίες από την έναρξη έως επτά ημέρες μετά τη λήξη." wrap />
            </p>
            {roster.isError ? <Button variant="outline" onClick={() => void roster.refetch()}><BilingualText en="Retry loading attendance" el="Επανάληψη φόρτωσης παρουσιών" compact /></Button> : null}
            {!attendees && !roster.isError ? <p role="status"><BilingualText en="Loading attendance…" el="Φόρτωση παρουσιών…" compact /></p> : null}
            {canEdit && going.length > 0 ? (
              <Button variant="outline" className="h-auto whitespace-normal" disabled={busy} onClick={() => void mark({ allGoing: true })}><BilingualText {...bulk} compact wrap /></Button>
            ) : null}
            {attendees?.length === 0 ? <p><BilingualText en="No RSVPs to verify yet." el="Δεν υπάρχουν ακόμη δηλώσεις προς επιβεβαίωση." compact /></p> : null}
            <ul className="divide-y divide-border">
              {attendees?.map((row) => (
                <li key={row.userId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Person row={row} />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground"><StatusText value={row.status} /></span>
                    {canEdit ? (
                      <Button size="sm" variant={row.attended ? 'secondary' : 'outline'} aria-pressed={row.attended}
                        aria-label={`${say(attended.en, attended.el)}: ${name(row, primary)}`}
                        disabled={busy} onClick={() => void mark({ userId: row.userId, attended: !row.attended })}>
                        <BilingualText {...attended} compact />
                      </Button>
                    ) : <span className="text-xs"><BilingualText {...(row.attended ? attended : notMarked)} compact /></span>}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
      {showReconnect ? (
        <Card ref={anchor} id="reconnect" className="scroll-mt-24">
          <CardHeader><CardTitle><BilingualText en="Reconnect after the event" el="Επανασύνδεση μετά την εκδήλωση" compact /></CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <BilingualText
                en="Only confirmed attendees can see this list. Your choices stay private unless the interest is mutual. Unmatched choices are deleted 14 days after the event. Mutual matches stay until either person withdraws or deletes their account."
                el="Μόνο όσοι έχουν επιβεβαιωμένη παρουσία βλέπουν τη λίστα. Οι επιλογές σας παραμένουν ιδιωτικές εκτός αν το ενδιαφέρον είναι αμοιβαίο. Οι μονόπλευρες επιλογές διαγράφονται 14 ημέρες μετά την εκδήλωση. Το αμοιβαίο ενδιαφέρον διατηρείται μέχρι να το αποσύρει κάποιος ή να διαγράψει τον λογαριασμό του."
                wrap
              />
            </p>
            {reconnect.isError ? <Button variant="outline" onClick={() => void reconnect.refetch()}><BilingualText en="Retry loading reconnect options" el="Επανάληψη φόρτωσης επιλογών επανασύνδεσης" compact /></Button> : null}
            {reconnect.data?.state === 'not_confirmed' ? <p><BilingualText en="The organizer hasn’t confirmed your attendance yet." el="Ο διοργανωτής δεν έχει ακόμη επιβεβαιώσει την παρουσία σας." compact wrap /></p> : null}
            {canSelect && reconnect.data?.closesAt ? <p className="text-sm"><BilingualText en={`Selections close on ${formatShortDate(reconnect.data.closesAt, 'en')}.`} el={`Οι επιλογές κλείνουν στις ${formatShortDate(reconnect.data.closesAt, 'el')}.`} compact /></p> : null}
            {!reconnect.isError && reconnect.data?.state === 'closed' ? <p><BilingualText en="New selections are closed. You can still withdraw a mutual match." el="Οι νέες επιλογές έχουν κλείσει. Μπορείτε ακόμη να αποσύρετε ένα αμοιβαίο ενδιαφέρον." compact wrap /></p> : null}
            {canSelect && candidates?.length === 0 ? <p><BilingualText en="No other confirmed attendees are available yet." el="Δεν υπάρχουν ακόμη άλλοι διαθέσιμοι συμμετέχοντες με επιβεβαιωμένη παρουσία." compact wrap /></p> : null}
            <ul className="divide-y divide-border">
              {candidates?.map((row) => (
                <li key={row.userId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="space-y-1">
                    <Person row={row} />
                    {row.mutual ? <span className="text-xs font-medium"><BilingualText {...match} compact /></span> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {row.mutual ? <Button asChild size="sm"><Link href={matchProfile(row.userId)}><BilingualText {...contact} compact /></Link></Button> : null}
                    {row.interested || canSelect ? (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => void select(row)}
                        aria-label={`${row.interested ? say(withdraw.en, withdraw.el) : say(selection.en, selection.el)}: ${name(row, primary)}`}>
                        <BilingualText {...(row.interested ? withdraw : selection)} compact />
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
      <div aria-live="polite">
        {failed ? <p className="text-sm text-muted-foreground"><BilingualText en="The update failed. Please retry." el="Η ενημέρωση απέτυχε. Δοκιμάστε ξανά." compact /></p> : null}
      </div>
    </div>
  );
}
