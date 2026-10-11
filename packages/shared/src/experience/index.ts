import type { LinkedInImport } from '../import/linkedin';

/**
 * A profile's experience and education, the way a professional profile reads
 * them ("Title · Company, 2021 – now"). Both live in `rolePayload`
 * (`experience`, `education`), which the profile schema passes through, so
 * no column or migration is needed. They are written by the profile editor
 * or, when the person chooses, from a LinkedIn import; nothing is saved until
 * the form's Save. Dates are kept as the year only: LinkedIn exports "Mar
 * 2021", people type "2021", and a year reads the same in both languages.
 */

export const EXPERIENCE_MAX = 10;
export const EDUCATION_MAX = 6;
const TEXT_MAX = 120;

export interface ExperienceEntry {
  title: string;
  company: string;
  /** Four-digit year, or '' when not given. */
  start: string;
  /** Four-digit year; '' while the role is current. */
  end: string;
}

export interface EducationEntry {
  school: string;
  degree: string;
  start: string;
  end: string;
}

const text = (v: unknown, max = TEXT_MAX) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** "Mar 2021", "2021-03", "2021" → "2021"; anything without a year → ''. */
export function yearOf(value: unknown): string {
  const m = /\b(19|20)\d{2}\b/.exec(typeof value === 'string' ? value : String(value ?? ''));
  return m ? m[0] : '';
}

/** `rolePayload.experience` as entries, whatever shape it arrived in; newest first. */
export function readExperience(raw: unknown): ExperienceEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      const o = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
      return { title: text(o.title), company: text(o.company), start: yearOf(o.start), end: yearOf(o.end) };
    })
    .filter((e) => e.title || e.company)
    .slice(0, EXPERIENCE_MAX)
    .sort((a, b) => Number(b.end === '' ? 9999 : b.end) - Number(a.end === '' ? 9999 : a.end) || Number(b.start || 0) - Number(a.start || 0));
}

export function readEducation(raw: unknown): EducationEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      const o = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
      return { school: text(o.school), degree: text(o.degree), start: yearOf(o.start), end: yearOf(o.end) };
    })
    .filter((e) => e.school)
    .slice(0, EDUCATION_MAX);
}

/** The positions of a LinkedIn import as entries a person may keep. */
export function experienceFromLinkedIn(imp: Pick<LinkedInImport, 'positions'>, limit = EXPERIENCE_MAX): ExperienceEntry[] {
  return readExperience(
    (imp.positions ?? []).map((p) => ({ title: p.title, company: p.company, start: p.startedOn, end: p.finishedOn })),
  ).slice(0, limit);
}

export function educationFromLinkedIn(imp: Pick<LinkedInImport, 'education'>, limit = EDUCATION_MAX): EducationEntry[] {
  return readEducation((imp.education ?? []).map((e) => ({ school: e.school, degree: e.degree, start: e.startDate, end: e.endDate }))).slice(0, limit);
}

/** "2021 – now" / "2021 – σήμερα", "2018 – 2021", "2019", or '' with no years. */
export function spanOf(entry: { start: string; end: string }, current = true): { en: string; el: string } {
  const { start, end } = entry;
  if (!start && !end) return { en: '', el: '' };
  if (start && !end) return current ? { en: `${start} – now`, el: `${start} – σήμερα` } : { en: start, el: start };
  if (!start) return { en: end, el: end };
  if (start === end) return { en: start, el: start };
  return { en: `${start} – ${end}`, el: `${start} – ${end}` };
}

/** Entries the editor can save: trimmed, capped, empty rows dropped. */
export function cleanExperience(rows: readonly Partial<ExperienceEntry>[]): ExperienceEntry[] {
  return readExperience(rows);
}

export function cleanEducation(rows: readonly Partial<EducationEntry>[]): EducationEntry[] {
  return readEducation(rows);
}
