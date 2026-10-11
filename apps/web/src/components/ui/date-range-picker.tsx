'use client';

import { useState, useRef, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, addDays, isSameMonth, isSameDay, isWithinInterval, addMonths, subMonths, isAfter, isBefore } from 'date-fns';
import { CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  placeholder?: string;
  className?: string;
  minDate?: Date;
  maxDate?: Date;
  presets?: { label: string; range: DateRange }[];
  disabled?: boolean;
}

const DEFAULT_PRESETS = [
  { label: 'Last 7 days', range: { from: addDays(new Date(), -7), to: new Date() } },
  { label: 'Last 30 days', range: { from: addDays(new Date(), -30), to: new Date() } },
  { label: 'Last 90 days', range: { from: addDays(new Date(), -90), to: new Date() } },
  { label: 'This month', range: { from: startOfMonth(new Date()), to: endOfMonth(new Date()) } },
  { label: 'Last month', range: { from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) } },
  { label: 'This year', range: { from: new Date(new Date().getFullYear(), 0, 1), to: new Date() } },
];

function CalendarMonth({
  month,
  selectedRange,
  hoverDate,
  onDayClick,
  onDayHover,
  minDate,
  maxDate,
}: {
  month: Date;
  selectedRange: DateRange;
  hoverDate: Date | null;
  onDayClick: (d: Date) => void;
  onDayHover: (d: Date | null) => void;
  minDate?: Date;
  maxDate?: Date;
}) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) days.push(addDays(start, i));

  const effectiveTo = selectedRange.from && !selectedRange.to && hoverDate ? hoverDate : selectedRange.to;

  return (
    <div className="p-3 min-w-[240px]">
      <div className="grid grid-cols-7 mb-1">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
          <div key={d} className="text-center text-2xs font-medium text-muted-foreground py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const isCurrentMonth = isSameMonth(day, month);
          const isFrom = selectedRange.from ? isSameDay(day, selectedRange.from) : false;
          const isTo = effectiveTo ? isSameDay(day, effectiveTo) : false;
          const inRange = selectedRange.from && effectiveTo
            ? isWithinInterval(day, { start: isAfter(selectedRange.from, effectiveTo) ? effectiveTo : selectedRange.from, end: isAfter(selectedRange.from, effectiveTo) ? selectedRange.from : effectiveTo })
            : false;
          const isToday = isSameDay(day, new Date());
          const isDisabled = (minDate && isBefore(day, minDate)) || (maxDate && isAfter(day, maxDate));

          return (
            <button
              key={i}
              type="button"
              disabled={isDisabled}
              onClick={() => !isDisabled && onDayClick(day)}
              onMouseEnter={() => onDayHover(day)}
              onMouseLeave={() => onDayHover(null)}
              className={cn(
                'h-7 w-7 text-xs rounded transition-colors relative',
                !isCurrentMonth && 'opacity-30',
                isDisabled && 'opacity-20 cursor-not-allowed',
                !isFrom && !isTo && !inRange && isCurrentMonth && !isDisabled && 'hover:bg-accent',
                isToday && !isFrom && !isTo && 'font-bold text-primary-accessible',
                inRange && 'bg-primary/15 rounded-none',
                (isFrom || isTo) && 'bg-primary text-primary-foreground font-medium rounded-sm',
                isFrom && effectiveTo && !isSameDay(selectedRange.from!, effectiveTo) && 'rounded-r-none',
                isTo && selectedRange.from && !isSameDay(selectedRange.from, effectiveTo!) && 'rounded-l-none',
              )}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = 'Select date range',
  className,
  minDate,
  maxDate,
  presets = DEFAULT_PRESETS,
  disabled = false,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [leftMonth, setLeftMonth] = useState(() => value.from ? startOfMonth(value.from) : startOfMonth(new Date()));
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [selecting, setSelecting] = useState<'from' | 'to'>('from');
  const containerRef = useRef<HTMLDivElement>(null);

  const rightMonth = addMonths(leftMonth, 1);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDayClick = (day: Date) => {
    if (selecting === 'from' || (value.from && value.to)) {
      onChange({ from: day, to: null });
      setSelecting('to');
    } else {
      const from = value.from!;
      if (isBefore(day, from)) {
        onChange({ from: day, to: from });
      } else {
        onChange({ from, to: day });
      }
      setSelecting('from');
      setOpen(false);
    }
  };

  const handlePreset = (preset: { label: string; range: DateRange }) => {
    onChange(preset.range);
    setSelecting('from');
    setOpen(false);
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({ from: null, to: null });
    setSelecting('from');
  };

  const displayValue = () => {
    if (value.from && value.to) {
      return `${format(value.from, 'MMM d, yyyy')} – ${format(value.to, 'MMM d, yyyy')}`;
    }
    if (value.from) return `${format(value.from, 'MMM d, yyyy')} – ...`;
    return null;
  };

  const display = displayValue();

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2 h-9 px-3 rounded-xl border border-input bg-background text-sm',
          'hover:bg-accent transition-colors w-full text-left',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <CalendarIcon className="icon-sm text-muted-foreground shrink-0" />
        <span className={cn('flex-1 truncate', !display && 'text-muted-foreground')}>
          {display ?? placeholder}
        </span>
        {display && (
          <button aria-label="Clear dates" type="button" onClick={clear} className="ml-1 p-0.5 rounded-lg hover:bg-muted">
            <X className="icon-sm text-muted-foreground" />
          </button>
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 bg-popover border border-border rounded-xl shadow-flyout flex flex-col sm:flex-row overflow-hidden">
          {/* Presets sidebar */}
          {presets.length > 0 && (
            <div className="border-b sm:border-b-0 sm:border-r border-border p-2 flex flex-row sm:flex-col gap-1 overflow-x-auto sm:overflow-x-visible sm:min-w-[130px]">
              {presets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => handlePreset(p)}
                  className="text-xs px-2 py-1.5 rounded-md text-left hover:bg-accent whitespace-nowrap transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {/* Calendars */}
          <div className="flex flex-col sm:flex-row">
            <div>
              <div className="flex items-center justify-between px-3 pt-3 pb-1">
                <button aria-label="Previous month" type="button" onClick={() => setLeftMonth(subMonths(leftMonth, 1))} className="p-1 rounded-md hover:bg-accent">
                  <ChevronLeft className="icon-sm" />
                </button>
                <span className="text-sm font-medium">{format(leftMonth, 'MMMM yyyy')}</span>
                <button aria-label="Next month" type="button" onClick={() => setLeftMonth(addMonths(leftMonth, 1))} className="p-1 rounded-md hover:bg-accent sm:invisible">
                  <ChevronRight className="icon-sm" />
                </button>
              </div>
              <CalendarMonth
                month={leftMonth}
                selectedRange={value}
                hoverDate={hoverDate}
                onDayClick={handleDayClick}
                onDayHover={setHoverDate}
                minDate={minDate}
                maxDate={maxDate}
              />
            </div>
            <div className="hidden sm:block border-l border-border">
              <div className="flex items-center justify-between px-3 pt-3 pb-1">
                <button aria-label="Previous month" type="button" onClick={() => setLeftMonth(subMonths(leftMonth, 1))} className="p-1 rounded-md hover:bg-accent invisible">
                  <ChevronLeft className="icon-sm" />
                </button>
                <span className="text-sm font-medium">{format(rightMonth, 'MMMM yyyy')}</span>
                <button aria-label="Next month" type="button" onClick={() => setLeftMonth(addMonths(leftMonth, 1))} className="p-1 rounded-md hover:bg-accent">
                  <ChevronRight className="icon-sm" />
                </button>
              </div>
              <CalendarMonth
                month={rightMonth}
                selectedRange={value}
                hoverDate={hoverDate}
                onDayClick={handleDayClick}
                onDayHover={setHoverDate}
                minDate={minDate}
                maxDate={maxDate}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-border px-3 py-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {selecting === 'from' ? 'Click to set start date' : 'Click to set end date'}
            </span>
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { onChange({ from: null, to: null }); setSelecting('from'); }}>
              Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
