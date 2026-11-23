/**
 * Calendar files (RFC 5545) for the pages that hand a reader their dates:
 * one event, one call, or the whole calendar.
 *
 * Each page used to write its own. The event page's escaped a semicolon as
 * `'\;'`, which JavaScript reads as a bare ";", so a title such as
 * "Demo day; Athens" broke the SUMMARY line in strict clients.
 */

export type IcsEntry = {
  uid: string;
  title: string;
  /** An ISO date-time; for an all-day entry only its UTC date is used. */
  start: string;
  /** An ISO date-time; defaults to an hour after the start if no later end is supplied. */
  end?: string | null;
  allDay?: boolean;
  description?: string | null;
  location?: string | null;
  url?: string | null;
};

/** TEXT escaping: backslash, semicolon, comma and line breaks. */
export function icsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/**
 * A content line folded as RFC 5545 §3.1 asks: no line longer than 75 octets,
 * each continuation starting with one space. Counted in UTF-8 octets, never
 * splitting a character, so a Greek title (two octets a letter) folds at
 * about 37 letters instead of running on: strict clients and validators
 * reject the long line, lenient ones only happen to accept it.
 */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  let octets = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    // The first line holds 75 octets; a continuation 74, after its space.
    const limit = parts.length === 0 ? 75 : 74;
    if (octets + size > limit) {
      parts.push(current);
      current = '';
      octets = 0;
    }
    current += char;
    octets += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

/** UTC date-time in the basic format: 20261021T180000Z. */
export function icsStamp(iso: string | Date): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** The UTC calendar date in the basic format: 20261021. */
function icsDate(iso: string | Date): string {
  return new Date(iso).toISOString().slice(0, 10).replace(/-/g, '');
}

function eventLines(entry: IcsEntry, now: Date): string[] {
  const lines = ['BEGIN:VEVENT', `UID:${entry.uid}@cofounderbay`, `DTSTAMP:${icsStamp(now)}`];
  if (entry.allDay) {
    const start = new Date(entry.start);
    const next = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 1));
    lines.push(`DTSTART;VALUE=DATE:${icsDate(start)}`, `DTEND;VALUE=DATE:${icsDate(next)}`);
  } else {
    const startMs = Date.parse(entry.start);
    const endMs = entry.end ? Date.parse(entry.end) : NaN;
    const end = new Date(Math.floor(endMs / 1_000) > Math.floor(startMs / 1_000) ? endMs : startMs + 60 * 60_000);
    lines.push(`DTSTART:${icsStamp(entry.start)}`, `DTEND:${icsStamp(end)}`);
  }
  lines.push(`SUMMARY:${icsText(entry.title)}`);
  const description = [entry.description, entry.url].filter(Boolean).join('\n\n');
  if (description) lines.push(`DESCRIPTION:${icsText(description)}`);
  if (entry.location) lines.push(`LOCATION:${icsText(entry.location)}`);
  if (entry.url) lines.push(`URL:${entry.url}`);
  lines.push('END:VEVENT');
  return lines;
}

/** A whole calendar file, CRLF line endings as the format requires. */
export function buildIcs(entries: IcsEntry[], options: { name?: string; now?: Date } = {}): string {
  const now = options.now ?? new Date();
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CoFounderBay//Calendar//EN', 'CALSCALE:GREGORIAN'];
  if (options.name) lines.push(`X-WR-CALNAME:${icsText(options.name)}`);
  for (const entry of entries) lines.push(...eventLines(entry, now));
  lines.push('END:VCALENDAR');
  return lines.map(foldIcsLine).join('\r\n');
}

/** A file name from a title: "Demo Day Q2" → "demo-day-q2.ics". */
export function icsFileName(title: string, fallback = 'calendar'): string {
  return `${title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || fallback}.ics`;
}

/** Hand the file to the browser as a download. */
export function downloadIcs(fileName: string, ics: string): void {
  const href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = href;
  a.download = fileName;
  a.click();
  // Released after the click has been handled: revoked in the same task, some
  // browsers cancel the download before it starts.
  setTimeout(() => URL.revokeObjectURL(href), 0);
}
