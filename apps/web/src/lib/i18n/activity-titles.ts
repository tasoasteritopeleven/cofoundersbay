import { PREVIEW_MILESTONE_EL } from './strings-milestones';

const milestoneTitleEl = (title: string) => PREVIEW_MILESTONE_EL[title]?.title ?? title;

/**
 * The activity endpoints compose these titles from fixed English templates
 * (`dashboard.service`, `connections.service`, the preview payload). Only the
 * template is translated; the names and titles inside it are data and pass
 * through, except preview milestones, which have a Greek title of their own.
 */
const TITLE_TEMPLATES: Array<[RegExp, (...parts: string[]) => string]> = [
  [/^(.+) wants to connect$/, (name) => `${name} θέλει να συνδεθεί`],
  [/^New match: (.+)$/, (name) => `Νέα αντιστοίχιση: ${name}`],
  [/^(.+) and (.+) connected$/, (a, b) => `${a} και ${b} συνδέθηκαν`],
  [/^Milestone completed: (.+)$/, (title) => `Ολοκληρώθηκε ορόσημο: ${milestoneTitleEl(title)}`],
  [/^Milestone in progress: (.+)$/, (title) => `Ορόσημο σε εξέλιξη: ${milestoneTitleEl(title)}`],
  [/^Achievement unlocked: (.+)$/, (title) => `Νέο επίτευγμα: ${title}`],
];

export function activityTitleEl(title: string): string {
  for (const [pattern, render] of TITLE_TEMPLATES) {
    const match = pattern.exec(title);
    if (match) return render(...match.slice(1));
  }
  return title;
}

/** "2h", "2h ago" and "just now" from the API, in both languages. Dates pass through. */
export function activityTimeAgoPair(value: string): { en: string; el: string } {
  const trimmed = value.trim();
  if (trimmed === 'just now') return { en: 'just now', el: 'μόλις τώρα' };
  const match = /^(\d+)\s*([mhd])(?:\s+ago)?$/.exec(trimmed);
  if (!match) return { en: trimmed, el: trimmed };
  const n = Number(match[1]);
  const unit = match[2];
  // The compact form the rest of the product uses (`relativeTimeLabel`).
  const el = `πριν ${n} ${unit === 'm' ? 'λ.' : unit === 'h' ? 'ώ.' : 'ημ.'}`;
  return { en: `${n}${unit} ago`, el };
}
