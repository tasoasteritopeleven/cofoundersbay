/**
 * The mentor side of the showcase, in one place.
 *
 * Four screens told four stories about the same mentor: the dashboard had
 * 8 mentees, 47 sessions, $1,280 this month and a 4.8 from 32 reviews, with
 * mentees called Alex Chen, Sarah Johnson and Mike Rodriguez; /mentor/earnings
 * had four sessions from Alex K., Maria P., Nikos L. and Sofia A.; the reviews
 * page had a 4.6 from John Doe, Jane Smith and the rest of the admin sample;
 * and /mentor/mentees listed the reader as their own mentee.
 *
 * The mentees are the founders of three startups the rest of the demo already
 * has - Sofia Alexiou (Meltemi), Yannis Petrou (Kolo Labs) and Maria Georgiou
 * (Thalia) - and one whose mentorship finished, Dimitris Kostas. The preview
 * API answers the mentor-side relationship, session and request reads from
 * the same names, and the pages below read their sample rows from here, so
 * the dashboard's figures are counted from the rows the other pages list.
 */

export type MentorDemoPerson = {
  id: string;
  name: string;
  startup: string;
  headline: string;
};

export const MENTOR_DEMO_MENTEES: MentorDemoPerson[] = [
  { id: 'user-sofia', name: 'Sofia Alexiou', startup: 'Meltemi', headline: 'Founder at Meltemi' },
  { id: 'user-yannis', name: 'Yannis Petrou', startup: 'Kolo Labs', headline: 'Founder at Kolo Labs' },
  { id: 'user-maria', name: 'Maria Georgiou', startup: 'Thalia', headline: 'Founder at Thalia' },
];

/** A mentorship that has run its course: in the history, not in the active list. */
export const MENTOR_DEMO_ALUMNUS: MentorDemoPerson = {
  id: 'user-dimitris',
  name: 'Dimitris Kostas',
  startup: 'Orion Grid',
  headline: 'Founder at Orion Grid',
};

/** Paid and pending sessions, dated relative to today. */
export const MENTOR_DEMO_EARNINGS = [
  { id: 'e1', menteeId: 'user-sofia', name: 'Sofia Alexiou', ago: 2, duration: 60, amount: 120, status: 'paid', topic: 'Pricing for logistics operators' },
  { id: 'e2', menteeId: 'user-yannis', name: 'Yannis Petrou', ago: 4, duration: 45, amount: 90, status: 'paid', topic: 'Seed narrative and deck' },
  { id: 'e3', menteeId: 'user-maria', name: 'Maria Georgiou', ago: 6, duration: 30, amount: 60, status: 'paid', topic: 'Studio onboarding funnel' },
  { id: 'e4', menteeId: 'user-sofia', name: 'Sofia Alexiou', ago: 9, duration: 60, amount: 120, status: 'pending', topic: 'Hiring the first salesperson' },
  { id: 'e5', menteeId: 'user-yannis', name: 'Yannis Petrou', ago: 40, duration: 45, amount: 90, status: 'paid', topic: 'Developer go-to-market' },
  { id: 'e6', menteeId: 'user-dimitris', name: 'Dimitris Kostas', ago: 75, duration: 60, amount: 120, status: 'paid', topic: 'Utility pilot contracts' },
] as const;

/** Reviews left by the same people, dated relative to today. */
export const MENTOR_DEMO_REVIEWS = [
  { id: 'r1', mentee: 'Sofia Alexiou', rating: 5, comment: 'Turned our pricing page from three tiers nobody understood into one that operators sign on the first call.', ago: 3, sessionType: 'Pricing', helpful: 9 },
  { id: 'r2', mentee: 'Yannis Petrou', rating: 5, comment: 'The deck review cut twelve slides to eight and made the traction slide the one investors ask about.', ago: 5, sessionType: 'Pitch Review', helpful: 7 },
  { id: 'r3', mentee: 'Maria Georgiou', rating: 4, comment: 'Useful on the onboarding funnel. I would have liked more time on payments compliance.', ago: 8, sessionType: 'Product', helpful: 4 },
  { id: 'r4', mentee: 'Dimitris Kostas', rating: 5, comment: 'Six months that took us from one pilot to three signed utilities. Clear, direct, always prepared.', ago: 60, sessionType: 'Go-to-market', helpful: 12 },
] as const;

const DAY = 86_400_000;

/** Earnings this calendar month, from the same rows /mentor/earnings lists. */
export function mentorDemoMonthEarnings(now = Date.now()): { amount: number; minutes: number; sessions: number } {
  const start = new Date(now);
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const rows = MENTOR_DEMO_EARNINGS.filter((r) => now - r.ago * DAY >= start.getTime());
  return {
    amount: rows.filter((r) => r.status === 'paid').reduce((s, r) => s + r.amount, 0),
    minutes: rows.reduce((s, r) => s + r.duration, 0),
    sessions: rows.length,
  };
}

/** The average of the reviews /mentor/reviews lists, to one decimal. */
export function mentorDemoRating(): { average: number; count: number } {
  const count = MENTOR_DEMO_REVIEWS.length;
  const total = MENTOR_DEMO_REVIEWS.reduce((s, r) => s + r.rating, 0);
  return { average: Math.round((total / count) * 10) / 10, count };
}
