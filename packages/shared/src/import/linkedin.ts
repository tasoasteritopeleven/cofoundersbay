/**
 * A LinkedIn profile, read from the member's own data.
 *
 * Two sources share one shape: the "Get a copy of your data" export (CSV files,
 * usually in a ZIP) and the DMA Member Data Portability API, whose snapshot
 * rows are the same flat records with the same column names ("First Name",
 * "Company Name", "Started On"). Only what a CoFounderBay profile uses is
 * read; birth date, address, postcode and messenger handles are never taken.
 */

export type LinkedInRecord = Record<string, string>;

export interface LinkedInPosition {
  company: string;
  title: string;
  startedOn: string;
  finishedOn: string;
  location: string;
  description: string;
}

export interface LinkedInEducation {
  school: string;
  degree: string;
  startDate: string;
  endDate: string;
}

export interface LinkedInImport {
  displayName: string;
  headline: string;
  bio: string;
  location: string;
  websiteUrl: string;
  industry: string;
  skills: string[];
  positions: LinkedInPosition[];
  education: LinkedInEducation[];
}

/** RFC 4180 CSV: quoted fields, doubled quotes, commas and newlines inside quotes. */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

/**
 * Records keyed by header. Some export files open with a "Notes:" preamble;
 * the header is the first row that names one of `expect`.
 */
export function parseCsv(text: string, expect: readonly string[] = []): LinkedInRecord[] {
  const rows = parseCsvRows(text);
  const headerAt = expect.length ? rows.findIndex((r) => r.some((cell) => expect.includes(cell.trim()))) : 0;
  if (headerAt < 0 || !rows[headerAt]) return [];
  const header = rows[headerAt].map((h) => h.trim());
  return rows.slice(headerAt + 1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n).trimEnd() : s);

/** "[COMPANY:https://acme.example],[PERSONAL:https://me.example]" → the first https address. */
export function firstWebsite(raw: string): string {
  const match = raw.match(/https?:\/\/[^\s,\]]+/i);
  return match ? match[0] : '';
}

/** One shape from the four record lists. Unknown or private columns are ignored. */
export function fromLinkedInRecords(input: {
  profile?: LinkedInRecord[];
  positions?: LinkedInRecord[];
  education?: LinkedInRecord[];
  skills?: LinkedInRecord[];
}): LinkedInImport {
  const p = input.profile?.[0] ?? {};
  const name = [p['First Name'], p['Last Name']].filter(Boolean).join(' ').trim();
  const positions = (input.positions ?? [])
    .map((r) => ({
      company: r['Company Name'] ?? '',
      title: r['Title'] ?? '',
      startedOn: r['Started On'] ?? '',
      finishedOn: r['Finished On'] ?? '',
      location: r['Location'] ?? '',
      description: clip(r['Description'] ?? '', 600),
    }))
    .filter((x) => x.company || x.title)
    .slice(0, 30);
  const education = (input.education ?? [])
    .map((r) => ({ school: r['School Name'] ?? '', degree: r['Degree Name'] ?? '', startDate: r['Start Date'] ?? '', endDate: r['End Date'] ?? '' }))
    .filter((x) => x.school)
    .slice(0, 15);
  const skills = [...new Set((input.skills ?? []).map((r) => (r['Name'] ?? '').trim()).filter(Boolean))].slice(0, 50);
  return {
    displayName: clip(name, 80),
    headline: clip(p['Headline'] ?? '', 160),
    bio: clip(p['Summary'] ?? '', 2000),
    location: clip(p['Geo Location'] ?? p['Location'] ?? '', 120),
    websiteUrl: firstWebsite(p['Websites'] ?? ''),
    industry: clip(p['Industry'] ?? '', 80),
    skills,
    positions,
    education,
  };
}

/** Which export file a path is, by its base name, whatever folder it sits in. */
export function linkedInFileKind(path: string): 'profile' | 'positions' | 'education' | 'skills' | null {
  const base = path.split(/[\\/]/).pop()?.toLowerCase() ?? '';
  if (base === 'profile.csv') return 'profile';
  if (base === 'positions.csv') return 'positions';
  if (base === 'education.csv') return 'education';
  if (base === 'skills.csv') return 'skills';
  return null;
}

const EXPECTED_HEADERS = {
  profile: ['First Name', 'Headline'],
  positions: ['Company Name', 'Title'],
  education: ['School Name'],
  skills: ['Name'],
} as const;

/** Reads the export's CSV files (name → text) into one import. */
export function fromLinkedInExport(files: Record<string, string>): LinkedInImport {
  const records: { profile?: LinkedInRecord[]; positions?: LinkedInRecord[]; education?: LinkedInRecord[]; skills?: LinkedInRecord[] } = {};
  for (const [path, text] of Object.entries(files)) {
    const kind = linkedInFileKind(path);
    if (kind) records[kind] = parseCsv(text, EXPECTED_HEADERS[kind]);
  }
  return fromLinkedInRecords(records);
}

/** The DMA snapshot domains this import reads, and how they map to the export's files. */
export const DMA_SNAPSHOT_DOMAINS = { PROFILE: 'profile', POSITIONS: 'positions', EDUCATION: 'education', SKILLS: 'skills' } as const;

/** True when the import found anything worth showing. */
export function hasLinkedInData(imp: LinkedInImport): boolean {
  return Boolean(imp.displayName || imp.headline || imp.bio || imp.location || imp.skills.length || imp.positions.length);
}

/** A short experience paragraph a person may choose to add to their bio. */
export function experienceSummary(imp: LinkedInImport, limit = 4): string {
  return imp.positions
    .slice(0, limit)
    .map((p) => `${p.title}${p.title && p.company ? ' · ' : ''}${p.company}${p.startedOn ? ` (${p.startedOn}${p.finishedOn ? `–${p.finishedOn}` : '–'})` : ''}`)
    .join('\n');
}

/** The only columns an import keeps, per file or snapshot domain. Everything else is dropped before storage. */
export const LINKEDIN_IMPORT_FIELDS = {
  profile: ['First Name', 'Last Name', 'Headline', 'Summary', 'Industry', 'Geo Location', 'Location', 'Websites'],
  positions: ['Company Name', 'Title', 'Description', 'Location', 'Started On', 'Finished On'],
  education: ['School Name', 'Degree Name', 'Start Date', 'End Date'],
  skills: ['Name'],
} as const;

export function pickImportFields(kind: keyof typeof LINKEDIN_IMPORT_FIELDS, record: Record<string, unknown>): LinkedInRecord {
  const out: LinkedInRecord = {};
  for (const key of LINKEDIN_IMPORT_FIELDS[kind]) {
    const v = record[key];
    if (typeof v === 'string' && v.trim()) out[key] = v.trim().slice(0, 2000);
  }
  return out;
}
