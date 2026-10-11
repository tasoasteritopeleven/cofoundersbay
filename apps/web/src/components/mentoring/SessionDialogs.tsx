'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { qk } from '@/lib/query-keys';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  getMyMentorships,
  scheduleMentorshipSession,
  updateMentorshipSession,
  type MentorshipSessionItem,
} from '@/lib/api';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualInline } from '@/lib/i18n/format';

/** `<input type="datetime-local">` wants local wall-clock time without a zone. */
function toLocalInput(iso: string | Date): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Tomorrow at 10:00 local - a sensible first value for a new session. */
function defaultStart(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return toLocalInput(d);
}

/**
 * Schedule a session with one of the mentor's mentees.
 *
 * "Schedule Session" (three places on /mentor/sessions and one per mentee on
 * /mentor/mentees) linked to /mentor/sessions/new, which never existed.
 * POST /mentorship/relationships/:id/sessions did, through
 * scheduleMentorshipSession, so the form lives here as a dialog.
 */
export function ScheduleSessionDialog({
  open,
  onOpenChange,
  initialMenteeId,
  onScheduled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMenteeId?: string | null;
  onScheduled: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: qk('mentorships', 'mentor'),
    queryFn: () => getMyMentorships('mentor'),
    enabled: open,
    staleTime: 60_000,
    retry: 0,
  });
  const relationships = (data?.relationships ?? []).filter((r) => r.status === 'active');

  const [relationshipId, setRelationshipId] = useState('');
  const [title, setTitle] = useState('');
  const [start, setStart] = useState(defaultStart);
  const [duration, setDuration] = useState('60');
  const [meetingType, setMeetingType] = useState<'video' | 'in_person' | 'chat'>('video');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [agenda, setAgenda] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preselect the mentee the caller named (the mentees page passes one).
  useEffect(() => {
    if (!open || relationshipId || relationships.length === 0) return;
    const match = initialMenteeId ? relationships.find((r) => r.menteeId === initialMenteeId) : undefined;
    setRelationshipId((match ?? relationships[0]).id);
  }, [open, initialMenteeId, relationships, relationshipId]);

  const submit = async () => {
    if (!relationshipId) return;
    setSaving(true);
    setError(null);
    try {
      await scheduleMentorshipSession(relationshipId, {
        title: title.trim() || undefined,
        scheduledAt: new Date(start).toISOString(),
        duration: Number(duration),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        meetingType,
        meetingUrl: meetingType === 'video' && meetingUrl.trim() ? meetingUrl.trim() : undefined,
        agenda: agenda.trim() || undefined,
      });
      onScheduled();
      onOpenChange(false);
      setTitle('');
      setAgenda('');
      setMeetingUrl('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The session could not be scheduled.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle><BilingualText en="Schedule a session" el="Προγραμματισμός συνεδρίας" compact /></DialogTitle>
          <DialogDescription><BilingualText en="With one of your active mentees. They see it in their sessions straight away." el="Με έναν από τους ενεργούς μαθητευόμενούς σας. Τη βλέπουν αμέσως στις συνεδρίες τους." wrap /></DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="icon-lg animate-spin text-muted-foreground" aria-hidden="true" /></div>
        ) : relationships.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            <BilingualText en="You have no active mentees yet. Accept a request on the Requests page and they appear here." el="Δεν έχετε ακόμα ενεργούς μαθητευόμενους. Αποδεχτείτε ένα αίτημα στη σελίδα Αιτήματα και θα εμφανιστούν εδώ." wrap />
          </p>
        ) : (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
            <div className="space-y-1.5">
              <Label htmlFor="session-mentee"><BilingualText en="Mentee" el="Μαθητευόμενος" compact /></Label>
              <Select value={relationshipId} onValueChange={setRelationshipId}>
                <SelectTrigger id="session-mentee"><SelectValue placeholder={bilingualInline("Choose a mentee", "Επιλέξτε καθοδηγούμενο")} /></SelectTrigger>
                <SelectContent>
                  {relationships.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.mentee.displayName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="session-title"><BilingualText en="Title" el="Τίτλος" compact /> <span className="text-muted-foreground"><BilingualText en="(optional)" el="(προαιρετικό)" compact /></span></Label>
              <Input id="session-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Pitch review" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="session-start"><BilingualText en="Starts" el="Έναρξη" compact /></Label>
                <Input id="session-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="session-duration"><BilingualText en="Duration" el="Διάρκεια" compact /></Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger id="session-duration"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['15', '30', '45', '60', '90', '120'].map((m) => <SelectItem key={m} value={m}>{m} min</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="session-type"><BilingualText en="Format" el="Μορφή" compact /></Label>
                <Select value={meetingType} onValueChange={(v) => setMeetingType(v as typeof meetingType)}>
                  <SelectTrigger id="session-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video"><BilingualText en="Video call" el="Βιντεοκλήση" compact /></SelectItem>
                    <SelectItem value="in_person"><BilingualText en="In person" el="Δια ζώσης" compact /></SelectItem>
                    <SelectItem value="chat"><BilingualText en="Chat" el="Συνομιλία" compact /></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {meetingType === 'video' && (
                <div className="space-y-1.5">
                  <Label htmlFor="session-url"><BilingualText en="Meeting link" el="Σύνδεσμος συνάντησης" compact /></Label>
                  <Input id="session-url" type="url" value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="https://" />
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="session-agenda"><BilingualText en="Agenda" el="Ατζέντα" compact /> <span className="text-muted-foreground"><BilingualText en="(optional)" el="(προαιρετικό)" compact /></span></Label>
              <Textarea id="session-agenda" rows={3} value={agenda} onChange={(e) => setAgenda(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive-accessible" role="alert">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}><BilingualText en="Cancel" el="Ακύρωση" compact /></Button>
              <Button type="submit" disabled={saving || !relationshipId}>
                {saving ? 'Scheduling…' : 'Schedule'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Move a scheduled session to a new time (PATCH /mentorship/sessions/:id). */
export function RescheduleSessionDialog({
  session,
  onOpenChange,
  onSaved,
}: {
  session: MentorshipSessionItem | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [start, setStart] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (session) setStart(toLocalInput(session.scheduledAt));
    setError(null);
  }, [session]);

  const submit = async () => {
    if (!session) return;
    setSaving(true);
    try {
      await updateMentorshipSession(session.id, { scheduledAt: new Date(start).toISOString() });
      onSaved();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The session could not be moved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={session !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle><BilingualText en="Reschedule" el="Αλλαγή ώρας" compact /></DialogTitle>
          <DialogDescription>{session?.title ?? 'Mentorship session'}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="reschedule-start"><BilingualText en="New time" el="Νέα ώρα" compact /></Label>
            <Input id="reschedule-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-destructive-accessible" role="alert">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}><BilingualText en="Keep current time" el="Διατήρηση τρέχουσας ώρας" compact /></Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Reschedule'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A completed session's notes.
 *
 * "View Notes" linked to /mentor/sessions/:id/notes, which did not exist. The
 * notes are fields on the session itself, so they open here: the mentor's own
 * notes are editable, the mentee's are shown as written.
 */
export function SessionNotesDialog({
  session,
  onOpenChange,
  onSaved,
}: {
  session: MentorshipSessionItem | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setNotes(session?.mentorNotes ?? '');
    setError(null);
  }, [session]);

  const submit = async () => {
    if (!session) return;
    setSaving(true);
    try {
      await updateMentorshipSession(session.id, { mentorNotes: notes });
      onSaved();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The notes could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={session !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle><BilingualText en="Session notes" el="Σημειώσεις συνεδρίας" compact /></DialogTitle>
          <DialogDescription>{session?.title ?? 'Mentorship session'}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="notes-mentor"><BilingualText en="Your notes" el="Οι σημειώσεις σας" compact /></Label>
            <Textarea id="notes-mentor" rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {session?.menteeNotes && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium"><BilingualText en="Mentee&apos;s notes" el="Σημειώσεις μαθητευόμενου" compact /></p>
              <p className="whitespace-pre-line rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">{session.menteeNotes}</p>
            </div>
          )}
          {error && <p className="text-sm text-destructive-accessible" role="alert">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}><BilingualText en="Close" el="Κλείσιμο" compact /></Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save notes'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
