import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatRelativeTime, formatRelativeTimeEl, initialsOf, relativeTimeLabel } from './utils';

describe('formatRelativeTime', () => {
  afterEach(() => vi.useRealTimers());

  it('counts back from now', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-24T12:00:00Z'));
    expect(formatRelativeTime('2026-09-24T11:59:30Z')).toBe('just now');
    expect(formatRelativeTime('2026-09-24T09:00:00Z')).toBe('3h ago');
    expect(formatRelativeTime(new Date('2026-09-20T12:00:00Z'))).toBe('4d ago');
  });

  it('shows a value that is not a date as given, not as "NaNy ago"', () => {
    // /admin/users sample rows carry "2 hours ago" and "Never"; every one of
    // them rendered "NaNy ago" in the Last Active column.
    expect(formatRelativeTime('2 hours ago')).toBe('2 hours ago');
    expect(formatRelativeTime('Never')).toBe('Never');
    expect(formatRelativeTime('')).toBe('—');
    expect(formatRelativeTime(new Date('nope'))).toBe('—');
  });
});

describe('formatRelativeTimeEl', () => {
  afterEach(() => vi.useRealTimers());

  it('uses the same thresholds in Greek', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-24T12:00:00Z'));
    expect(formatRelativeTimeEl('2026-09-24T11:59:30Z')).toBe('μόλις τώρα');
    expect(formatRelativeTimeEl('2026-09-24T09:00:00Z')).toBe('πριν 3 ώ.');
    expect(formatRelativeTimeEl(new Date('2026-09-20T12:00:00Z'))).toBe('πριν 4 ημ.');
    expect(formatRelativeTimeEl('2025-09-01T12:00:00Z')).toBe('πριν 1 έτ.');
    expect(formatRelativeTimeEl('Never')).toBe('Never');
  });
});

describe('relativeTimeLabel', () => {
  afterEach(() => vi.useRealTimers());

  it('says the same age the same way in both languages, weeks included', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-24T12:00:00Z'));
    // A Greek feed used to read «πριν 2w»: weeks were the gap.
    expect(relativeTimeLabel('2026-09-10T12:00:00Z', 'en')).toBe('2w ago');
    expect(relativeTimeLabel('2026-09-10T12:00:00Z', 'el')).toBe('πριν 2 εβδ.');
    expect(relativeTimeLabel('2026-07-10T12:00:00Z', 'el')).toBe('πριν 2 μήν.');
  });

  it('drops "ago" for tight rows', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-24T12:00:00Z'));
    expect(relativeTimeLabel('2026-09-24T11:55:00Z', 'en', { short: true })).toBe('5m');
    expect(relativeTimeLabel('2026-09-24T11:55:00Z', 'el', { short: true })).toBe('5 λ.');
  });

  it('switches to the date once an item is old enough to need one', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-24T12:00:00Z'));
    expect(relativeTimeLabel('2026-09-20T12:00:00Z', 'en', { absoluteAfterDays: 7 })).toBe('4d ago');
    // "Sept" or "Sep", depending on the ICU build.
    expect(relativeTimeLabel('2026-09-01T12:00:00Z', 'en', { absoluteAfterDays: 7 })).toMatch(/^1 Sep/);
    expect(relativeTimeLabel('2026-09-01T12:00:00Z', 'el', { absoluteAfterDays: 7 })).toMatch(/^1 Σεπ/);
  });
});

describe('initialsOf', () => {
  it('takes the first and last word and skips titles', () => {
    expect(initialsOf('Dr. Sarah Kim')).toBe('SK');
    expect(initialsOf('Elena Papadopoulos')).toBe('EP');
    expect(initialsOf('Maria del Carmen Ruiz')).toBe('MR');
    expect(initialsOf('prof Ada')).toBe('A');
  });

  it('never returns more than two letters, and a mark for no name', () => {
    expect(initialsOf('Anna Maria Lisa Kowalski').length).toBe(2);
    expect(initialsOf('')).toBe('?');
    expect(initialsOf(null)).toBe('?');
  });
});
