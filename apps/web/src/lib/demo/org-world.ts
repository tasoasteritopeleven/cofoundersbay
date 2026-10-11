/**
 * The organisation side of the showcase, in one place.
 *
 * About twenty-five screens administer an organisation - /org/*, /tenant/*,
 * /dashboard/incubator, /programs - and each told its own story: 42 startups
 * and 28 mentors on the incubator home, 38 and 25 on /org/cohorts, "Total
 * Startups 0" on /org/analytics, "AI Accelerator 2025" and "FinTech Bootcamp"
 * in a year that is over, "TechStars SF" (a real company) on one admin page,
 * "Acme" in five spellings on others, and "No organization context" on the
 * tenant screens because the demo reader belonged to nothing.
 *
 * There is now one organisation, Aegean Venture Lab, and its programs hold
 * the founders the rest of the demo already knows:
 * - the Autumn 2026 seed cohort is Meltemi, Kolo Labs, Thalia, Ledgerly and
 *   Agora B2B, three of whom the reader mentors on /mentor/*;
 * - Harbor, Orion Grid and Aegis Health graduated from Spring 2026, which is
 *   why they now appear in an investor's pipeline and portfolio;
 * - a climate track runs beside it, and a pre-seed bootcamp takes
 *   applications for spring.
 *
 * The preview API serves the org, program, mentor-pool and tenant endpoints
 * from these rows, so every count on those screens is counted from the same
 * people. Dates are offsets in days from today, resolved by the caller.
 */

export const ORG_ID = 'org-aegean';
export const ORG_SLUG = 'aegean-lab';
export const TENANT_ID = 'tenant-aegean';

export const ORG = {
  id: ORG_ID,
  slug: ORG_SLUG,
  name: 'Aegean Venture Lab',
  tagline: 'A pre-seed and seed accelerator for founders in Greece and Cyprus',
  description:
    'Twelve-week programs with a mentor pool, an investor network and a demo day in Athens. Two seed cohorts a year, a climate and energy track, and a pre-seed bootcamp.',
  mission: 'Help founders from the region build companies that sell beyond it.',
  website: 'https://aegeanlab.example',
  email: 'programs@aegeanlab.example',
  location: 'Athens, Greece',
  industry: 'Accelerator',
  focus: 'B2B software, fintech, climate',
  size: '11-50',
  type: 'accelerator',
  country: 'GR',
  timezone: 'Europe/Athens',
  primaryColor: '#6756dc',
  /** Days ago. */
  founded: 900,
} as const;

export type OrgPerson = {
  id: string;
  name: string;
  email: string;
  headline: string;
  location: string;
  /** Days ago the person joined the organisation. */
  joined: number;
};

/** The people who run the organisation. The reader is one of them. */
export const ORG_STAFF: (OrgPerson & { role: 'owner' | 'admin' | 'member'; title: string })[] = [
  { id: 'user-anna', name: 'Anna Lambrou', email: 'anna@aegeanlab.example', headline: 'Managing director at Aegean Venture Lab', location: 'Athens, Greece', joined: 880, role: 'owner', title: 'Managing director' },
  { id: 'preview-demo-user', name: 'Alex Demo', email: 'demo@cofounderbay.com', headline: 'Program partner at Aegean Venture Lab', location: 'Athens, Greece', joined: 400, role: 'admin', title: 'Program partner' },
  { id: 'user-ioanna', name: 'Ioanna Pappa', email: 'ioanna@aegeanlab.example', headline: 'Community and events at Aegean Venture Lab', location: 'Athens, Greece', joined: 310, role: 'member', title: 'Community lead' },
];

/** The mentor pool. The reader's three mentees are the ones /mentor/* lists. */
export const ORG_MENTORS: (OrgPerson & { expertise: string[]; maxMentees: number; mentees: string[]; pastMentees: string[] })[] = [
  { id: 'preview-demo-user', name: 'Alex Demo', email: 'demo@cofounderbay.com', headline: 'Program partner at Aegean Venture Lab', location: 'Athens, Greece', joined: 400, expertise: ['Pricing', 'Go-to-market', 'Fundraising'], maxMentees: 4, mentees: ['user-sofia', 'user-yannis', 'user-maria'], pastMentees: ['user-dimitris'] },
  { id: 'user-sarah', name: 'Dr. Sarah Kim', email: 'sarah@sarahkim.co', headline: 'Startup mentor · Former product lead · 3x founder', location: 'London, UK', joined: 520, expertise: ['Product', 'Hiring', 'Healthcare'], maxMentees: 3, mentees: ['user-katerina', 'user-giorgos'], pastMentees: ['user-elena', 'user-christina'] },
  { id: 'user-thanos', name: 'Thanos Rigas', email: 'thanos@rigas.energy', headline: 'Energy markets advisor', location: 'Thessaloniki, Greece', joined: 150, expertise: ['Energy markets', 'Hardware', 'Utilities'], maxMentees: 2, mentees: ['user-eleni', 'user-petros'], pastMentees: [] },
  { id: 'user-ioanna', name: 'Ioanna Pappa', email: 'ioanna@aegeanlab.example', headline: 'Community and events at Aegean Venture Lab', location: 'Athens, Greece', joined: 310, expertise: ['Growth marketing', 'Brand', 'Community'], maxMentees: 3, mentees: [], pastMentees: [] },
];

/** The investor partner who sits in on demo days. */
export const ORG_INVESTORS: OrgPerson[] = [
  { id: 'user-nikos', name: 'Nikos Andreou', email: 'nikos@andreou.vc', headline: 'Angel investor · Seed', location: 'Limassol, Cyprus', joined: 450 },
];

export type OrgFounder = OrgPerson & { startup: string; industry: string; stage: string };

const founder = (id: string, name: string, startup: string, industry: string, stage: string, location: string, joined: number): OrgFounder => ({
  id,
  name,
  email: `${name.split(' ')[0].toLowerCase()}@${startup.toLowerCase().replace(/[^a-z0-9]/g, '')}.example`,
  headline: `Founder at ${startup}`,
  location,
  joined,
  startup,
  industry,
  stage,
});

export const ORG_FOUNDERS: Record<string, OrgFounder> = Object.fromEntries(
  [
    founder('user-sofia', 'Sofia Alexiou', 'Meltemi', 'Logistics', 'Pre-seed', 'Thessaloniki, Greece', 18),
    founder('user-yannis', 'Yannis Petrou', 'Kolo Labs', 'DevTools', 'Pre-seed', 'Remote', 18),
    founder('user-maria', 'Maria Georgiou', 'Thalia', 'FinTech', 'Seed', 'Athens, Greece', 18),
    founder('user-katerina', 'Katerina Nikolaou', 'Ledgerly', 'FinTech', 'Pre-seed', 'Athens, Greece', 18),
    founder('user-giorgos', 'Giorgos Vlachos', 'Agora B2B', 'Marketplaces', 'Pre-seed', 'Athens, Greece', 14),
    founder('user-eleni', 'Eleni Markou', 'Anemos Storage', 'Climate', 'Pre-seed', 'Heraklion, Greece', 60),
    founder('user-petros', 'Petros Ioannou', 'Kyma Energy', 'Climate', 'Pre-seed', 'Patras, Greece', 60),
    founder('user-elena', 'Elena Papadopoulos', 'Harbor', 'SaaS', 'Seed', 'Athens, Greece', 230),
    founder('user-dimitris', 'Dimitris Kostas', 'Orion Grid', 'CleanTech', 'Series A', 'Remote', 230),
    founder('user-christina', 'Christina Mavrou', 'Aegis Health', 'HealthTech', 'Seed', 'Patras, Greece', 230),
    // Applicants: the pre-seed bootcamp's open round, and the ones a cohort turned down.
    founder('user-stavros', 'Stavros Mitsos', 'Taverna OS', 'Hospitality software', 'Pre-seed', 'Thessaloniki, Greece', 2),
    founder('user-lydia', 'Lydia Karra', 'Petra Health', 'HealthTech', 'Idea', 'Athens, Greece', 4),
    founder('user-kostas', 'Kostas Dimou', 'Fleetwise', 'Mobility', 'Pre-seed', 'Patras, Greece', 6),
    founder('user-chrysa', 'Chrysa Vlachou', 'Loom & Leaf', 'Marketplaces', 'Idea', 'Heraklion, Greece', 9),
    founder('user-andreas', 'Andreas Sotiriou', 'Portside', 'Logistics', 'Pre-seed', 'Limassol, Cyprus', 11),
    founder('user-fotis', 'Fotis Lazarou', 'Pixelcraft', 'Media', 'Idea', 'Athens, Greece', 60),
    founder('user-irini', 'Irini Stathopoulou', 'Sokaki', 'Consumer', 'Idea', 'Athens, Greece', 58),
    founder('user-vasso', 'Vasso Kyriakou', 'GreenCrate', 'Climate', 'Idea', 'Volos, Greece', 80),
  ].map((f) => [f.id, f]),
);

export type OrgParticipant = {
  id: string;
  userId: string;
  status: 'applied' | 'accepted' | 'active' | 'completed' | 'dropped' | 'rejected';
  /** Days ago. */
  applied: number;
  decided?: number;
  completed?: number;
  score?: number;
};

export type OrgProgram = {
  id: string;
  slug: string;
  title: string;
  description: string;
  programType: 'accelerator' | 'incubator' | 'bootcamp';
  status: 'upcoming' | 'active' | 'completed';
  /** Days from today; negative is the past. */
  start: number;
  end: number;
  deadline: number | null;
  capacity: number;
  isRemote: boolean;
  location: string;
  industries: string[];
  benefits: string[];
  cohortId: string;
  cohortName: string;
  participants: OrgParticipant[];
};

const p = (id: string, userId: string, status: OrgParticipant['status'], applied: number, extra: Partial<OrgParticipant> = {}): OrgParticipant => ({
  id,
  userId,
  status,
  applied,
  ...extra,
});

export const ORG_PROGRAMS: OrgProgram[] = [
  {
    id: 'prog-seed-autumn-2026',
    slug: 'seed-autumn-2026',
    title: 'Seed Accelerator · Autumn 2026',
    description: 'Twelve weeks for pre-seed and seed B2B teams: weekly mentor sessions, a pricing and go-to-market sprint, and demo day with forty investors in Athens.',
    programType: 'accelerator',
    status: 'active',
    start: -18,
    end: 66,
    deadline: -40,
    capacity: 8,
    isRemote: false,
    location: 'Athens, Greece',
    industries: ['B2B SaaS', 'FinTech', 'Logistics', 'Marketplaces'],
    benefits: ['€50K for 7% equity', 'A mentor for each founder', 'Demo day with forty investors'],
    cohortId: 'cohort-autumn-2026',
    cohortName: 'Autumn 2026 cohort',
    participants: [
      p('pp-sofia', 'user-sofia', 'active', 62, { decided: 45, score: 88 }),
      p('pp-yannis', 'user-yannis', 'active', 60, { decided: 45, score: 84 }),
      p('pp-maria', 'user-maria', 'active', 58, { decided: 45, score: 86 }),
      p('pp-katerina', 'user-katerina', 'active', 55, { decided: 44, score: 81 }),
      p('pp-giorgos', 'user-giorgos', 'active', 50, { decided: 42, score: 79 }),
      p('pp-fotis', 'user-fotis', 'rejected', 60, { decided: 46, score: 52 }),
      p('pp-irini', 'user-irini', 'rejected', 58, { decided: 46, score: 58 }),
    ],
  },
  {
    id: 'prog-climate-2026',
    slug: 'climate-energy-2026',
    title: 'Climate & Energy Track 2026',
    description: 'A six-month incubator for hardware and energy teams, with pilot introductions to two regional utilities.',
    programType: 'incubator',
    status: 'active',
    start: -60,
    end: 120,
    deadline: -75,
    capacity: 4,
    isRemote: true,
    location: 'Remote, with two weeks in Athens',
    industries: ['Climate', 'Energy'],
    benefits: ['Utility pilot introductions', 'Lab time at partner universities', '€30K grant'],
    cohortId: 'cohort-climate-2026',
    cohortName: 'Climate track 2026',
    participants: [
      p('pp-eleni', 'user-eleni', 'active', 95, { decided: 76, score: 83 }),
      p('pp-petros', 'user-petros', 'active', 92, { decided: 76, score: 80 }),
      p('pp-vasso', 'user-vasso', 'rejected', 90, { decided: 77, score: 61 }),
    ],
  },
  {
    id: 'prog-preseed-spring-2027',
    slug: 'preseed-spring-2027',
    title: 'Pre-seed Bootcamp · Spring 2027',
    description: 'Six weeks from idea to first paying customer: interviews, a landing page that converts, and a pre-seed round plan.',
    programType: 'bootcamp',
    status: 'upcoming',
    start: 110,
    end: 152,
    deadline: 21,
    capacity: 10,
    isRemote: false,
    location: 'Athens, Greece',
    industries: ['Any'],
    benefits: ['Weekly founder office hours', 'Customer interview playbook', 'Priority review for the seed accelerator'],
    cohortId: 'cohort-spring-2027',
    cohortName: 'Spring 2027 bootcamp',
    participants: [
      p('pp-stavros', 'user-stavros', 'applied', 2),
      p('pp-lydia', 'user-lydia', 'applied', 4, { score: 72 }),
      p('pp-kostas', 'user-kostas', 'applied', 6, { score: 77 }),
      p('pp-chrysa', 'user-chrysa', 'applied', 9),
      p('pp-andreas', 'user-andreas', 'applied', 11, { score: 81 }),
    ],
  },
  {
    id: 'prog-seed-spring-2026',
    slug: 'seed-spring-2026',
    title: 'Seed Accelerator · Spring 2026',
    description: 'The spring seed cohort. All three teams presented at demo day; two have raised since.',
    programType: 'accelerator',
    status: 'completed',
    start: -230,
    end: -146,
    deadline: -250,
    capacity: 6,
    isRemote: false,
    location: 'Athens, Greece',
    industries: ['SaaS', 'CleanTech', 'HealthTech'],
    benefits: ['€50K for 7% equity', 'A mentor for each founder', 'Demo day with forty investors'],
    cohortId: 'cohort-spring-2026',
    cohortName: 'Spring 2026 cohort',
    participants: [
      p('pp-elena', 'user-elena', 'completed', 280, { decided: 250, completed: 146, score: 90 }),
      p('pp-dimitris', 'user-dimitris', 'completed', 278, { decided: 250, completed: 146, score: 87 }),
      p('pp-christina', 'user-christina', 'completed', 275, { decided: 250, completed: 146, score: 85 }),
    ],
  },
];

/** Who a participant row is, whichever list they came from. */
export function orgPerson(id: string): OrgPerson | undefined {
  return ORG_FOUNDERS[id] ?? ORG_STAFF.find((s) => s.id === id) ?? ORG_MENTORS.find((m) => m.id === id) ?? ORG_INVESTORS.find((i) => i.id === id);
}
