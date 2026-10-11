'use client';

import { useState } from 'react';
import {
  Calendar, Clock, Video, Phone, ExternalLink, Check,
  ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualInline } from '@/lib/i18n/format';
import { useLocalDateFormat } from '@/lib/i18n/useDateFormat';

type ScheduleCallModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientId: string;
  recipientName: string;
  recipientAvatar?: string;
  onScheduled?: (details: ScheduleDetails) => void;
};

type ScheduleDetails = {
  date: Date;
  time: string;
  duration: string;
  type: 'video' | 'phone';
  message?: string;
};

const DURATIONS = [
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '45', label: '45 minutes' },
  { value: '60', label: '1 hour' },
];

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
];

function generateCalendarDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: (Date | null)[] = [];

  // Add empty slots for days before the first day of the month
  for (let i = 0; i < firstDay.getDay(); i++) {
    days.push(null);
  }

  // Add all days of the month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }

  return days;
}

export function ScheduleCallModal({
  open,
  onOpenChange,
  recipientId,
  recipientName,
  recipientAvatar,
  onScheduled,
}: ScheduleCallModalProps) {
  const fmtLocal = useLocalDateFormat();
  const [step, setStep] = useState<'date' | 'time' | 'details' | 'confirm'>('date');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [duration, setDuration] = useState('30');
  const [callType, setCallType] = useState<'video' | 'phone'>('video');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  const calendarDays = generateCalendarDays(viewYear, viewMonth);
  const monthName = fmtLocal(new Date(viewYear, viewMonth, 1), { month: 'long', year: 'numeric' });

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const isDateDisabled = (date: Date) => {
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return date < todayStart;
  };

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime) return;

    setIsSubmitting(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      onScheduled?.({
        date: selectedDate,
        time: selectedTime,
        duration,
        type: callType,
        message: message || undefined,
      });
      
      setStep('confirm');
    } catch (err) {
      // Handle error
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setStep('date');
    setSelectedDate(null);
    setSelectedTime(null);
    setDuration('30');
    setCallType('video');
    setMessage('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={recipientAvatar} />
              <AvatarFallback className="bg-primary/10 text-primary-accessible">
                {recipientName[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <span>Schedule a call with {recipientName}</span>
              <DialogDescription className="font-normal">
                {step === 'date' && 'Select a date'}
                {step === 'time' && 'Choose a time slot'}
                {step === 'details' && 'Add details'}
                {step === 'confirm' && 'Call scheduled!'}
              </DialogDescription>
            </div>
          </DialogTitle>
        </DialogHeader>

        {step === 'date' && (
          <div className="space-y-4">
            {/* Calendar Header */}
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={prevMonth} aria-label="Previous month">
                <ChevronLeft className="icon-sm" />
              </Button>
              <span className="font-medium" aria-live="polite">{monthName}</span>
              <Button variant="ghost" size="icon" onClick={nextMonth} aria-label="Next month">
                <ChevronRight className="icon-sm" />
              </Button>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                <div key={day} className="text-xs font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
              {calendarDays.map((date, i) => (
                <div key={i} className="aspect-square">
                  {date && (
                    <button
                      type="button"
                      disabled={isDateDisabled(date)}
                      onClick={() => {
                        setSelectedDate(date);
                        setStep('time');
                      }}
                      className={cn(
                        'w-full h-full rounded-lg text-sm transition-colors',
                        isDateDisabled(date) && 'text-muted-foreground/50 cursor-not-allowed',
                        !isDateDisabled(date) && 'hover:bg-primary/10',
                        selectedDate?.toDateString() === date.toDateString() && 'bg-primary text-primary-foreground',
                        date.toDateString() === today.toDateString() && !selectedDate && 'border border-primary'
                      )}
                    >
                      {date.getDate()}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Calendar Integration Notice */}
            <Card className="bg-muted/50">
              <CardContent className="flex items-center gap-3">
                <Calendar className="icon-md text-muted-foreground shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-foreground"><BilingualText en="Connect your calendar" el="Συνδέστε το ημερολόγιό σας" compact /></p>
                  <p className="text-muted-foreground text-xs">
                    <BilingualText en="Sync with Google Calendar or Outlook for automatic availability" el="Συγχρονισμός με Google Calendar ή Outlook για αυτόματη διαθεσιμότητα" wrap />
                  </p>
                </div>
                <Button variant="outline" size="sm" className="shrink-0" disabled title="Calendar sync is not available yet">
                  <ExternalLink className="icon-sm mr-1" aria-hidden="true" />
                  <BilingualText en="Connect" el="Σύνδεση" compact />
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'time' && selectedDate && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setStep('date')} className="gap-1 -ml-2">
              <ChevronLeft className="icon-sm" />
              {fmtLocal(selectedDate, { weekday: 'long', month: 'long', day: 'numeric' })}
            </Button>

            <div className="grid grid-cols-3 gap-2">
              {TIME_SLOTS.map((time) => (
                <button
                  key={time}
                  type="button"
                  onClick={() => {
                    setSelectedTime(time);
                    setStep('details');
                  }}
                  className={cn(
                    'rounded-lg border border-border py-2 px-3 text-sm transition-colors hover:border-primary hover:bg-primary/5',
                    selectedTime === time && 'border-primary bg-primary/10'
                  )}
                >
                  {time}
                </button>
              ))}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Times shown in your local timezone (UTC{Intl.DateTimeFormat().resolvedOptions().timeZone})
            </p>
          </div>
        )}

        {step === 'details' && selectedDate && selectedTime && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setStep('time')} className="gap-1 -ml-2">
              <ChevronLeft className="icon-sm" />
              {fmtLocal(selectedDate, { weekday: 'short', month: 'short', day: 'numeric' })} · {selectedTime}
            </Button>

            {/* Call Type */}
            <div className="space-y-2">
              <p id="ScheduleCallModal-cap1-cap" className="text-sm font-medium leading-tight"><BilingualText en="Call Type" el="Τύπος κλήσης" compact /></p>
              <div role="group" aria-labelledby="ScheduleCallModal-cap1-cap" className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCallType('video')}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-3 transition-colors',
                    callType === 'video' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  )}
                >
                  <Video className={cn('icon-md', callType === 'video' ? 'text-primary-accessible' : 'text-muted-foreground')} />
                  <div className="text-left">
                    <p className="font-medium text-sm"><BilingualText en="Video Call" el="Βιντεοκλήση" compact /></p>
                    <p className="text-xs text-muted-foreground"><BilingualText en="Face-to-face meeting" el="Συνάντηση πρόσωπο με πρόσωπο" compact /></p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setCallType('phone')}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-3 transition-colors',
                    callType === 'phone' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  )}
                >
                  <Phone className={cn('icon-md', callType === 'phone' ? 'text-primary-accessible' : 'text-muted-foreground')} />
                  <div className="text-left">
                    <p className="font-medium text-sm"><BilingualText en="Phone Call" el="Τηλεφωνική κλήση" compact /></p>
                    <p className="text-xs text-muted-foreground"><BilingualText en="Audio only" el="Μόνο ήχος" compact /></p>
                  </div>
                </button>
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label htmlFor="duration"><BilingualText en="Duration" el="Διάρκεια" compact /></Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger id="duration" aria-label="Duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label htmlFor="message"><BilingualText en="Message (optional)" el="Μήνυμα (προαιρετικά)" compact /></Label>
              <Textarea id="message"
                placeholder={bilingualInline("Add a note about what you'd like to discuss…", "Προσθέστε σημείωση για το τι θέλετε να συζητήσετε…")}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
              />
            </div>

            <Button className="w-full" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="icon-sm mr-2 animate-spin" />
                  <BilingualText en="Scheduling..." el="Προγραμματισμός…" compact />
                </>
              ) : (
                <>
                  <Calendar className="icon-sm mr-2" />
                  <BilingualText en="Schedule Call" el="Προγραμματισμός κλήσης" compact />
                </>
              )}
            </Button>
          </div>
        )}

        {step === 'confirm' && selectedDate && selectedTime && (
          <div className="text-center py-6 space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-status-success-bg mx-auto">
              <Check className="icon-xl text-status-success" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground"><BilingualText en="Call Scheduled!" el="Η κλήση προγραμματίστηκε!" compact /></h3>
              <p className="text-muted-foreground mt-1">
                {fmtLocal(selectedDate, { weekday: 'long', month: 'long', day: 'numeric' })} · {selectedTime}
              </p>
            </div>
            <Card className="bg-muted/50">
              <CardContent className="text-left space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  {callType === 'video' ? <Video className="icon-sm" /> : <Phone className="icon-sm" />}
                  <span>{callType === 'video' ? 'Video Call' : 'Phone Call'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="icon-sm" />
                  <span>{DURATIONS.find((d) => d.value === duration)?.label}</span>
                </div>
              </CardContent>
            </Card>
            <p className="text-sm text-muted-foreground">
              {recipientName} will receive a notification and calendar invite.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={resetAndClose}>
                <BilingualText en="Done" el="Τέλος" compact />
              </Button>
              {/* Had no handler: a .ics of the call just scheduled. */}
              <Button
                className="flex-1"
                disabled={!selectedDate || !selectedTime}
                onClick={() => {
                  if (!selectedDate || !selectedTime) return;
                  const [h, m] = selectedTime.replace(/\s?(AM|PM)$/i, '').split(':').map(Number);
                  const pm = /PM$/i.test(selectedTime) && h < 12;
                  const am12 = /AM$/i.test(selectedTime) && h === 12;
                  const start = new Date(selectedDate);
                  start.setHours((pm ? h + 12 : am12 ? 0 : h) || 0, m || 0, 0, 0);
                  const end = new Date(start.getTime() + Number(duration) * 60_000);
                  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
                  const ics = [
                    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CoFounderBay//Calls//EN', 'BEGIN:VEVENT',
                    `UID:${stamp(start)}-${recipientId}@cofounderbay`, `DTSTAMP:${stamp(new Date())}`,
                    `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
                    `SUMMARY:Call with ${recipientName.replace(/[,;\\]/g, ' ')}`,
                    'END:VEVENT', 'END:VCALENDAR',
                  ].join('\r\n');
                  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'call.ics';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <BilingualText en="Add to Calendar" el="Προσθήκη στο ημερολόγιο" compact />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
