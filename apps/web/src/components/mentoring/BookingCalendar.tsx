'use client';

import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Video,
  MapPin,
  Calendar,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { RoleBadge } from '@/components/common/RoleBadge';
import { cn, initialsOf } from '@/lib/utils';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualInline } from '@/lib/i18n/format';
import { useLocalDateFormat } from '@/lib/i18n/useDateFormat';
import { FactLine } from '@/components/common/FactLine';

export type TimeSlot = {
  id: string;
  startTime: Date;
  endTime: Date;
  isAvailable: boolean;
  isBooked?: boolean;
};

export type MentorData = {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  headline?: string;
  expertise: string[];
  hourlyRate?: string;
  meetingTypes: ('video' | 'in-person')[];
  bio?: string;
};

type BookingCalendarProps = {
  mentor: MentorData;
  slots: TimeSlot[];
  onBookSlot: (slotId: string, meetingType: 'video' | 'in-person', notes: string) => Promise<void>;
  minDate?: Date;
  maxDate?: Date;
};

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function CalendarDay({
  date,
  isSelected,
  hasSlots,
  isDisabled,
  onClick,
}: {
  date: Date;
  isSelected: boolean;
  hasSlots: boolean;
  isDisabled: boolean;
  onClick: () => void;
}) {
  const isToday = date.toDateString() === new Date().toDateString();

  return (
    <button
      onClick={onClick}
      disabled={isDisabled || !hasSlots}
      className={cn(
        'relative h-10 w-10 rounded-lg text-sm transition-colors',
        isSelected && 'bg-primary text-primary-foreground',
        !isSelected && hasSlots && 'hover:bg-secondary',
        !isSelected && !hasSlots && 'text-muted-foreground/40',
        isToday && !isSelected && 'ring-1 ring-primary/50',
        isDisabled && 'cursor-not-allowed opacity-50'
      )}
    >
      {date.getDate()}
      {hasSlots && !isSelected && (
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />
      )}
    </button>
  );
}

export function BookingCalendar({
  mentor,
  slots,
  onBookSlot,
  minDate = new Date(),
  maxDate,
}: BookingCalendarProps) {
  const fmtLocal = useLocalDateFormat();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [meetingType, setMeetingType] = useState<'video' | 'in-person'>('video');
  const [notes, setNotes] = useState('');
  const [step, setStep] = useState<'date' | 'slot' | 'confirm'>('date');
  const [booking, setBooking] = useState(false);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const days = getDaysInMonth(year, month);
  const firstDayOfMonth = days[0].getDay();

  // Get available slots for selected date
  const availableSlots = selectedDate
    ? slots.filter(
        (slot) =>
          slot.startTime.toDateString() === selectedDate.toDateString() && slot.isAvailable
      )
    : [];

  // Check if a date has available slots
  const dateHasSlots = (date: Date) =>
    slots.some(
      (slot) => slot.startTime.toDateString() === date.toDateString() && slot.isAvailable
    );

  // Navigation
  const prevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
    setSelectedDate(null);
    setSelectedSlot(null);
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
    setSelectedDate(null);
    setSelectedSlot(null);
  };

  // Handle booking
  const handleBook = async () => {
    if (!selectedSlot) return;
    setBooking(true);
    try {
      await onBookSlot(selectedSlot.id, meetingType, notes);
    } finally {
      setBooking(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      {/* Main content */}
      <div className="space-y-6">
        {/* Mentor info */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src={mentor.avatarUrl || undefined} />
                <AvatarFallback className="bg-primary/20 text-primary-accessible text-sm">
                  {initialsOf(mentor.displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold text-foreground">{mentor.displayName}</h2>
                  <RoleBadge role="mentor" size="sm" />
                </div>
                {mentor.headline && (
                  <p className="text-sm text-muted-foreground mt-1">{mentor.headline}</p>
                )}
                <FactLine className="mt-3" items={mentor.expertise.slice(0, 4)} />
                {mentor.hourlyRate && (
                  <p className="mt-3 text-sm font-medium text-primary-accessible">{mentor.hourlyRate}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 1: Select date */}
        {step === 'date' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="icon-md text-muted-foreground" />
                <BilingualText en="Select a date" el="Επιλέξτε ημερομηνία" compact />
              </CardTitle>
              <CardDescription><BilingualText en="Choose a date to see available time slots" el="Επιλέξτε ημερομηνία για να δείτε τις διαθέσιμες ώρες" wrap /></CardDescription>
            </CardHeader>
            <CardContent>
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="icon" onClick={prevMonth} aria-label="Previous month">
                  <ChevronLeft className="icon-md" />
                </Button>
                <span className="font-semibold text-foreground" aria-live="polite">
                  {fmtLocal(currentMonth, { month: 'long', year: 'numeric' })}
                </span>
                <Button variant="ghost" size="icon" onClick={nextMonth} aria-label="Next month">
                  <ChevronRight className="icon-md" />
                </Button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div
                    key={day}
                    className="h-10 flex items-center justify-center text-xs font-medium text-muted-foreground"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 gap-1">
                {/* Empty cells for days before first of month */}
                {[...Array(firstDayOfMonth)].map((_, i) => (
                  <div key={`empty-${i}`} className="h-10" />
                ))}
                {/* Day cells */}
                {days.map((date) => {
                  const isPast = date < minDate && date.toDateString() !== minDate.toDateString();
                  const isFuture = maxDate && date > maxDate;
                  const hasSlots = dateHasSlots(date);

                  return (
                    <CalendarDay
                      key={date.toISOString()}
                      date={date}
                      isSelected={selectedDate?.toDateString() === date.toDateString()}
                      hasSlots={hasSlots}
                      isDisabled={isPast || isFuture || false}
                      onClick={() => {
                        setSelectedDate(date);
                        setSelectedSlot(null);
                      }}
                    />
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Select time slot */}
        {step === 'slot' && selectedDate && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="icon-md text-muted-foreground" />
                    <BilingualText en="Select a time" el="Επιλέξτε ώρα" compact />
                  </CardTitle>
                  <CardDescription>
                    {fmtLocal(selectedDate, { weekday: 'long', month: 'long', day: 'numeric' })}
                  </CardDescription>
                </div>
                <Button variant="ghost" onClick={() => setStep('date')}>
                  <BilingualText en="Change date" el="Αλλαγή ημερομηνίας" compact />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {availableSlots.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot.id}
                      onClick={() => setSelectedSlot(slot)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-sm transition-colors',
                        selectedSlot?.id === slot.id
                          ? 'border-primary bg-primary/10 text-primary-accessible'
                          : 'border-border text-foreground hover:border-primary/50'
                      )}
                    >
                      {formatTime(slot.startTime)}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-center text-sm text-muted-foreground py-8">
                  <BilingualText en="No available slots for this date" el="Δεν υπάρχουν διαθέσιμες ώρες για αυτή την ημερομηνία" compact />
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Confirm booking */}
        {step === 'confirm' && selectedSlot && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Check className="icon-md text-primary-accessible" />
                  <BilingualText en="Confirm booking" el="Επιβεβαίωση κράτησης" compact />
                </CardTitle>
                <Button variant="ghost" onClick={() => setStep('slot')}>
                  <BilingualText en="Change time" el="Αλλαγή ώρας" compact />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Selected datetime */}
              <div className="rounded-lg bg-secondary/40 p-4">
                <div className="flex items-center gap-3 text-foreground">
                  <Calendar className="icon-md text-muted-foreground" />
                  <span className="font-medium">
                    {fmtLocal(selectedDate, { weekday: 'long', month: 'long', day: 'numeric' })}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-foreground mt-2">
                  <Clock className="icon-md text-muted-foreground" />
                  <span className="font-medium">
                    {formatTime(selectedSlot.startTime)} - {formatTime(selectedSlot.endTime)}
                  </span>
                </div>
              </div>

              {/* Meeting type */}
              <div className="space-y-2">
                <p id="bc-mtype" className="text-sm font-medium text-foreground"><BilingualText en="Meeting type" el="Τύπος συνάντησης" compact /></p>
                <div className="flex gap-2" role="group" aria-labelledby="bc-mtype">
                  {mentor.meetingTypes.includes('video') && (
                    <button
                      type="button"
                      aria-pressed={meetingType === 'video'}
                      onClick={() => setMeetingType('video')}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border px-4 py-2 transition-colors',
                        meetingType === 'video'
                          ? 'border-primary bg-primary/10 text-primary-accessible'
                          : 'border-border text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Video className="icon-sm" />
                      <BilingualText en="Video call" el="Βιντεοκλήση" compact />
                    </button>
                  )}
                  {mentor.meetingTypes.includes('in-person') && (
                    <button
                      type="button"
                      aria-pressed={meetingType === 'in-person'}
                      onClick={() => setMeetingType('in-person')}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border px-4 py-2 transition-colors',
                        meetingType === 'in-person'
                          ? 'border-primary bg-primary/10 text-primary-accessible'
                          : 'border-border text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <MapPin className="icon-sm" />
                      <BilingualText en="In person" el="Δια ζώσης" compact />
                    </button>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label htmlFor="bc-f1" className="text-sm font-medium text-foreground"><BilingualText en="What would you like to discuss?" el="Τι θα θέλατε να συζητήσετε;" compact wrap /></label>
                <Textarea id="bc-f1"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={bilingualInline("Share your goals, challenges, or questions…", "Μοιραστείτε στόχους, προκλήσεις ή ερωτήσεις…")}
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sidebar summary */}
      <div className="space-y-4">
        <Card className="sticky top-6">
          <CardHeader>
            <CardTitle className="text-base"><BilingualText en="Booking Summary" el="Σύνοψη κράτησης" compact /></CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground"><BilingualText en="Mentor" el="Μέντορας" compact /></span>
                <span className="font-medium text-foreground">{mentor.displayName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground"><BilingualText en="Date" el="Ημερομηνία" compact /></span>
                <span className="font-medium text-foreground">
                  {selectedDate
                    ? fmtLocal(selectedDate, { month: 'short', day: 'numeric' })
                    : 'Not selected'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground"><BilingualText en="Time" el="Ώρα" compact /></span>
                <span className="font-medium text-foreground">
                  {selectedSlot ? formatTime(selectedSlot.startTime) : 'Not selected'}
                </span>
              </div>
              {mentor.hourlyRate && (
                <>
                  <div className="border-t border-border my-2" />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground"><BilingualText en="Rate" el="Αμοιβή" compact /></span>
                    <span className="font-semibold text-primary-accessible">{mentor.hourlyRate}</span>
                  </div>
                </>
              )}
            </div>

            {/* Action button */}
            {step === 'date' && (
              <Button
                className="w-full"
                disabled={!selectedDate}
                onClick={() => setStep('slot')}
              >
                <BilingualText en="Continue" el="Συνέχεια" compact />
              </Button>
            )}
            {step === 'slot' && (
              <Button
                className="w-full"
                disabled={!selectedSlot}
                onClick={() => setStep('confirm')}
              >
                <BilingualText en="Continue" el="Συνέχεια" compact />
              </Button>
            )}
            {step === 'confirm' && (
              <Button
                className="w-full"
                onClick={handleBook}
                disabled={booking}
              >
                {booking ? 'Booking...' : 'Confirm Booking'}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
