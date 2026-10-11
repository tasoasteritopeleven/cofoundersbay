import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * CoFounderBay glyph family — the same scene as the brand mark
 * (surfer on the board, cofounder in the bay), quiet rounded squares.
 * Distinct from Lucide so the product is recognisable at a glance.
 */
export const CFB_GLYPH_NAMES = [
  'home',
  'builder',
  'research',
  'flag',
  'calendar',
  'messages',
  'matches',
  'discover',
  'search',
  'people',
  'mentor',
  'chart',
  'target',
  'community',
  'award',
  'bookmark',
  'briefcase',
  'book',
  'shield',
  'bell',
  'sliders',
  'spark',
  'star',
  'wallet',
  'building',
  'profile',
  'compare',
  'applications',
  'gauge',
  'deck',
  'growth',
  'feed',
  'pact',
  'update',
  'intro',
  'scout',
  'more',
  'default',
] as const;

export type CfbGlyphName = (typeof CFB_GLYPH_NAMES)[number];

const PATH_GLYPH: Record<string, CfbGlyphName> = {
  // Every role's home, whatever its last segment (/dashboard/mentor is the
  // mentor's overview, not the mentor glyph).
  '/dashboard': 'home',
  '/ai': 'spark',
  '/ai/capabilities': 'spark',
  '/settings/ai': 'spark',
  '/matches/compare': 'compare',
  '/builder/applications': 'applications',
  '/builder/pitch-deck': 'deck',
};

const SEGMENT_GLYPH: Record<string, CfbGlyphName> = {
  dashboard: 'home',
  readiness: 'gauge',
  analytics: 'chart',
  builder: 'builder',
  research: 'research',
  milestones: 'flag',
  projects: 'briefcase',
  fundraising: 'wallet',
  calendar: 'calendar',
  messages: 'messages',
  matches: 'matches',
  recommendations: 'star',
  discover: 'discover',
  search: 'search',
  members: 'people',
  mentoring: 'mentor',
  investors: 'growth',
  opportunities: 'target',
  commitments: 'pact',
  updates: 'update',
  groups: 'community',
  events: 'calendar',
  programs: 'award',
  invite: 'people',
  connections: 'people',
  intros: 'intro',
  scout: 'scout',
  shortlist: 'bookmark',
  endorsements: 'award',
  compare: 'compare',
  learning: 'book',
  marketplace: 'briefcase',
  jobs: 'briefcase',
  ai: 'spark',
  pitch: 'deck',
  'data-room': 'wallet',
  coaching: 'mentor',
  'expert-reviews': 'award',
  help: 'book',
  activity: 'feed',
  achievements: 'award',
  feed: 'feed',
  profile: 'profile',
  notifications: 'bell',
  settings: 'sliders',
  referrals: 'people',
  reputation: 'shield',
  mentor: 'mentor',
  investor: 'growth',
  provider: 'briefcase',
  org: 'building',
  admin: 'shield',
  tenant: 'building',
  billing: 'wallet',
  onboarding: 'spark',
  login: 'profile',
  register: 'people',
  // Leaves: the last segment of a section's page names it more exactly than
  // the section does (/admin/analytics is a chart, not another shield).
  applications: 'applications',
  cohorts: 'community',
  communities: 'community',
  earnings: 'wallet',
  mentees: 'people',
  mentors: 'mentor',
  portfolio: 'briefcase',
  reports: 'flag',
  reviews: 'star',
  scouting: 'discover',
  startups: 'builder',
  tenants: 'building',
  users: 'people',
  watchlist: 'bookmark',
};

/*
 * Sections whose first segment is a family, not a destination: every page
 * under /admin used to wear the shield, so an admin's sidebar was fifteen
 * identical marks (org and tenant: one each; mentor, investor, provider:
 * five for ten). A page in a family gets a glyph only if its own last
 * segment has one; otherwise its list shows the icon its nav entry names.
 */
const FAMILY_SEGMENTS = new Set(['admin', 'org', 'tenant', 'mentor', 'investor', 'provider', 'settings']);

function normalisePath(href: string): string {
  return (href.split('?')[0] || '/').replace(/\/+$/, '') || '/';
}

/**
 * The glyph that names this destination itself, or undefined when the route
 * only has its family's mark. Nav lists use this so that a page without a
 * glyph of its own shows the icon its entry names instead of a duplicate.
 */
export function specificGlyphForHref(href: string): CfbGlyphName | undefined {
  const path = normalisePath(href);
  if (PATH_GLYPH[path]) return PATH_GLYPH[path];
  const prefixes = Object.keys(PATH_GLYPH).sort((a, b) => b.length - a.length);
  for (const prefix of prefixes) {
    if (path.startsWith(`${prefix}/`)) return PATH_GLYPH[prefix];
  }
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return undefined;
  const leaf = SEGMENT_GLYPH[segments[segments.length - 1]];
  if (leaf) return leaf;
  if (FAMILY_SEGMENTS.has(segments[0])) return undefined;
  return SEGMENT_GLYPH[segments[0]];
}

export function glyphForHref(href: string): CfbGlyphName {
  const specific = specificGlyphForHref(href);
  if (specific) return specific;
  const segment = normalisePath(href).split('/').filter(Boolean)[0];
  if (segment && SEGMENT_GLYPH[segment]) return SEGMENT_GLYPH[segment];
  return 'default';
}

/**
 * One glyph per list. Walks a nav list in order; the first entry to claim a
 * glyph keeps it, and any later entry that resolves to the same glyph (or to
 * none of its own) gets null, which tells NavIcon to draw the entry's own
 * icon. Learning Hub keeps the book; Help & Support draws its help circle.
 */
export function distinctNavGlyphs(hrefs: readonly string[]): (CfbGlyphName | null)[] {
  const used = new Set<CfbGlyphName>();
  return hrefs.map((href) => {
    const glyph = specificGlyphForHref(href);
    if (!glyph || used.has(glyph)) return null;
    used.add(glyph);
    return glyph;
  });
}

/** distinctNavGlyphs over a sectioned list, shaped like the list. */
export function sectionNavGlyphs(
  sections: readonly { links: readonly { href: string }[] }[],
): (CfbGlyphName | null)[][] {
  const flat = distinctNavGlyphs(sections.flatMap((s) => s.links.map((l) => l.href)));
  let i = 0;
  return sections.map((s) => s.links.map(() => flat[i++] ?? null));
}

export function glyphForMode(mode: string): CfbGlyphName {
  if (mode === 'work') return 'builder';
  if (mode === 'explore') return 'discover';
  if (mode === 'account') return 'sliders';
  return 'default';
}

function GlyphFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('cfb-glyph', className)}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const GLYPHS: Record<CfbGlyphName, ReactNode> = {
  home: (
    <>
      <rect x="3.5" y="3.5" width="7.25" height="7.25" rx="2" />
      <rect x="13.25" y="3.5" width="7.25" height="7.25" rx="2" />
      <rect x="3.5" y="13.25" width="7.25" height="7.25" rx="2" />
      <circle cx="17.5" cy="16.2" r="3.3" />
      <path d="M14.2 17.15h6.6" transform="rotate(-12 17.5 17.15)" strokeWidth="2" />
      <circle cx="15.7" cy="14.6" r="0.85" fill="currentColor" stroke="none" />
      <path d="M15.7 15.5v1.4M15.1 15.9 13.9 15" />
      <circle cx="18.8" cy="19.35" r="0.8" fill="currentColor" stroke="none" />
      <path d="M18.2 18.8 17.4 17.3M19.4 18.8 20.2 17.4" />
    </>
  ),
  // Blocks being assembled. It used to be three rising bars - the chart
  // glyph's twin, drawn beside Readiness and Analytics in the nav.
  builder: (
    <>
      <rect x="3.8" y="12.6" width="7.2" height="7" rx="1.9" />
      <rect x="13" y="12.6" width="7.2" height="7" rx="1.9" />
      <rect x="8.4" y="4.4" width="7.2" height="7" rx="1.9" />
      <circle cx="12" cy="7.9" r="1.05" fill="currentColor" stroke="none" />
    </>
  ),
  research: (
    <>
      <rect x="4" y="5.5" width="11" height="13" rx="2.2" />
      <rect x="9" y="4" width="11" height="13" rx="2.2" />
      <path d="M12 9.5h5M12 13h3.5" />
    </>
  ),
  flag: (
    <>
      <path d="M7 20V5.5" />
      <path d="M7 6.2h8.5c.9 0 1.4.9.9 1.6L15 10.4c-.3.4-.3 1 0 1.4l1.4 2.4c.5.8 0 1.7-.9 1.7H7" />
      <circle cx="7" cy="5.2" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="14" rx="2.5" />
      <path d="M4 10h16M8.5 4v3M15.5 4v3" />
      <circle cx="9" cy="14" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="15" cy="14" r="1.05" fill="currentColor" stroke="none" />
    </>
  ),
  messages: (
    <>
      <path d="M5.5 6.2h13A2.3 2.3 0 0 1 20.8 8.5v6.2A2.3 2.3 0 0 1 18.5 17H12l-4.2 3v-3H5.5A2.3 2.3 0 0 1 3.2 14.7V8.5A2.3 2.3 0 0 1 5.5 6.2Z" />
      <circle cx="9" cy="11.4" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="11.4" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  // Two links of a chain, joined: a commitment two people make. Drawn apart
  // from Matches (two overlapping circles) so the nav never shows one mark twice.
  pact: (
    <>
      <rect x="2.9" y="9" width="11" height="6.6" rx="3.3" transform="rotate(-32 8.4 12.3)" />
      <rect x="9.6" y="8.4" width="11" height="6.6" rx="3.3" transform="rotate(-32 15.1 11.7)" />
      <circle cx="11.8" cy="12" r="1.05" fill="currentColor" stroke="none" />
    </>
  ),
  // Two circles that overlap: what two people share. It used to be the
  // brand's surfer-and-planet scene, drawn again for Ask AI and the
  // fallback mark; at 16px the three were one blob, side by side in the nav.
  matches: (
    <>
      <circle cx="9.1" cy="12" r="5.4" />
      <circle cx="14.9" cy="12" r="5.4" />
      <circle cx="12" cy="12" r="1.05" fill="currentColor" stroke="none" />
    </>
  ),
  discover: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 6.5c-2.6 1.6-4 3.7-4 5.5s1.4 3.9 4 5.5c2.6-1.6 4-3.7 4-5.5S14.6 8.1 12 6.5Z" />
      <circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none" />
    </>
  ),
  // A lens on its handle. Search used to borrow Discover's compass, so the
  // sidebar's Search button and the Explore mode above it wore one mark.
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 4.6 4.6" />
      <path d="M8 9.2a2.9 2.9 0 0 1 1.9-1.75" />
    </>
  ),
  people: (
    <>
      <circle cx="8" cy="8.2" r="2.4" />
      <circle cx="16" cy="8.2" r="2.4" />
      <path d="M4.4 18c.4-3.2 2.4-5 3.6-5.4M19.6 18c-.4-3.2-2.4-5-3.6-5.4" />
      <path d="M8 12.6c1.8.4 6.2.4 8 0" />
    </>
  ),
  mentor: (
    <>
      <circle cx="12" cy="6.8" r="2.3" />
      <circle cx="6.6" cy="10.2" r="1.9" />
      <circle cx="17.4" cy="10.2" r="1.9" />
      <path d="M12 10.2c-2.8 1-5.2 4.2-5.4 8M12 10.2c2.8 1 5.2 4.2 5.4 8" />
    </>
  ),
  chart: (
    <>
      <path d="M4.5 18.5h15" />
      <path d="M7 18.5V12.5M12 18.5V8.5M17 18.5V5.5" />
      <circle cx="7" cy="11.4" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="17" cy="4.5" r="1.05" fill="currentColor" stroke="none" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4.4" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  community: (
    <>
      <circle cx="12" cy="6.6" r="2.15" />
      <circle cx="6.6" cy="15.4" r="2.15" />
      <circle cx="17.4" cy="15.4" r="2.15" />
      <path d="M10.4 8.3 7.8 13.3M13.6 8.3l2.6 5M8.8 15.4h6.4" />
    </>
  ),
  award: (
    <>
      <circle cx="12" cy="9" r="5" />
      <path d="M9.2 13.4 8 20l4-2.2L16 20l-1.2-6.6" />
      <circle cx="12" cy="9" r="1.15" fill="currentColor" stroke="none" />
    </>
  ),
  bookmark: (
    <>
      <path d="M7 4.8h10A1.6 1.6 0 0 1 18.6 6.4v13.2L12 16.2l-6.6 3.4V6.4A1.6 1.6 0 0 1 7 4.8Z" />
      <circle cx="12" cy="9.2" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3.5" y="8" width="17" height="11.5" rx="2.2" />
      <path d="M9 8V6.2A1.7 1.7 0 0 1 10.7 4.5h2.6A1.7 1.7 0 0 1 15 6.2V8M3.5 13h17" />
    </>
  ),
  book: (
    <>
      <path d="M12 6.2c-2.4-1.4-6.5-1-8 .6v11.4c1.6-1.4 5.6-1.8 8-.4 2.4-1.4 6.4-1 8 .4V6.8c-1.5-1.6-5.6-2-8-.6Z" />
      <path d="M12 6.4v11.6" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.6 19.2 6.4v5.8c0 4.4-3 6.9-7.2 8.2C7.8 19.1 4.8 16.6 4.8 12.2V6.4Z" />
      <path d="M9.2 12.1 11.2 14l3.8-4.2" />
    </>
  ),
  bell: (
    <>
      <path d="M7.2 10.2a4.8 4.8 0 0 1 9.6 0c0 4.2 1.4 5.4 1.4 5.4H5.8s1.4-1.2 1.4-5.4" />
      <path d="M10.4 17.8a1.6 1.6 0 0 0 3.2 0" />
      <circle cx="12" cy="5.4" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  sliders: (
    <>
      <path d="M5 8h14M5 16h14" />
      <circle cx="9.5" cy="8" r="2.05" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="16" r="2.05" fill="currentColor" stroke="none" />
    </>
  ),
  // The assistant: a four-point spark and a small one beside it.
  spark: (
    <>
      <path d="M10.6 4.2c.6 3.7 2.5 5.6 6.2 6.2-3.7.6-5.6 2.5-6.2 6.2-.6-3.7-2.5-5.6-6.2-6.2 3.7-.6 5.6-2.5 6.2-6.2Z" />
      <path d="M18.2 15.4v3.6M16.4 17.2H20" />
    </>
  ),
  // Picked for you, and what reviewers give: a soft five-point star.
  star: (
    <>
      <path d="M12 4.4 14.3 9l5 .75-3.6 3.5.85 5L12 15.9l-4.55 2.35.85-5-3.6-3.5 5-.75L12 4.4Z" />
    </>
  ),
  wallet: (
    <>
      <rect x="3.8" y="7" width="16.4" height="11.6" rx="2.2" />
      <path d="M3.8 10.6h16.4" />
      <circle cx="16.2" cy="14.6" r="1.15" fill="currentColor" stroke="none" />
    </>
  ),
  building: (
    <>
      <rect x="5" y="5.2" width="14" height="14.3" rx="2" />
      <path d="M9 19.5v-4h6v4" />
      <path d="M8.2 9.2h1.6M14.2 9.2h1.6M8.2 13h1.6M14.2 13h1.6" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8.2" r="3.1" />
      <path d="M5.4 19.2c.6-4.2 3.2-6.4 6.6-6.4s6 2.2 6.6 6.4" />
    </>
  ),
  compare: (
    <>
      <rect x="3.5" y="5" width="7.2" height="14" rx="2" />
      <rect x="13.3" y="5" width="7.2" height="14" rx="2" />
      <path d="M6.2 9.2h1.8M16 9.2h1.8M6.2 12.6h1.8M16 12.6h1.8" />
    </>
  ),
  applications: (
    <>
      <rect x="5" y="3.8" width="14" height="16.4" rx="2.2" />
      <path d="M8.2 8.2h7.6M8.2 12h7.6M8.2 15.8h4.6" />
    </>
  ),
  // Readiness: a dial, not a bar chart - it is one score against a bar.
  gauge: (
    <>
      <path d="M4.6 16.4a7.4 7.4 0 0 1 14.8 0" />
      <path d="M6.4 11.3l1.1.8M12 8.9v1.3M17.6 11.3l-1.1.8" />
      <path d="M12 16.4l3.4-4.2" />
      <circle cx="12" cy="16.4" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  // A slide on its stand: the pitch deck.
  deck: (
    <>
      <rect x="3.6" y="4.4" width="16.8" height="11.2" rx="2.2" />
      <path d="M12 15.6v3.4M8.8 19.6h6.4" />
      <path d="M7.4 8.6h5.2M7.4 11.6h3.2" />
      <circle cx="16.2" cy="10.1" r="1.15" fill="currentColor" stroke="none" />
    </>
  ),
  // Capital that compounds: investors and their surfaces.
  growth: (
    <>
      <path d="M4.4 17.6l5-5.2 3.4 3 6.6-7" />
      <path d="M15.4 8.4h4v4" />
      <circle cx="9.4" cy="12.4" r="1.1" fill="currentColor" stroke="none" />
      <path d="M4.4 20h15.2" />
    </>
  ),
  // Posts in a column: the feed and activity, not the assistant's spark.
  feed: (
    <>
      <rect x="4" y="4" width="16" height="6.6" rx="2" />
      <rect x="4" y="13.4" width="16" height="6.6" rx="2" />
      <circle cx="7.6" cy="7.3" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="7.6" cy="16.7" r="1.1" fill="currentColor" stroke="none" />
      <path d="M10.6 7.3h6M10.6 16.7h4" />
    </>
  ),
  // A page with a rising arrow at its corner: what a founder sends the
  // people who follow them. Apart from Feed (posts in a column) and from
  // Fundraising's wallet, its neighbour in the nav.
  update: (
    <>
      <path d="M13.6 4H7a2.4 2.4 0 0 0-2.4 2.4v11.2A2.4 2.4 0 0 0 7 20h10a2.4 2.4 0 0 0 2.4-2.4v-6.8" />
      <path d="M8.2 10.4h4.6M8.2 13.6h7.4M8.2 16.6h5" />
      <path d="M16.4 7.6l3.4-3.4M16.8 4h3v3" />
      <circle cx="16.4" cy="7.6" r="1.05" fill="currentColor" stroke="none" />
    </>
  ),
  // Three people on one line, the middle one carrying the accent: an
  // introduction runs through someone who knows both ends.
  intro: (
    <>
      <circle cx="4.8" cy="15.6" r="2.3" />
      <circle cx="19.2" cy="15.6" r="2.3" />
      <circle cx="12" cy="7.4" r="2.3" />
      <path d="M6.4 13.9l3.9-4.6M13.7 9.3l3.9 4.6" />
      <circle cx="12" cy="7.4" r="1" fill="currentColor" stroke="none" />
      <path d="M8.2 18.8h7.6" strokeDasharray="1.6 2" />
    </>
  ),
  // A sweep across rings with one find on it: the scout reads, and proposes.
  scout: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <circle cx="12" cy="12" r="4.4" />
      <path d="M12 12l5.6-5.6" />
      <circle cx="15.3" cy="15.6" r="1.15" fill="currentColor" stroke="none" />
    </>
  ),
  more: (
    <>
      <circle cx="6.2" cy="12" r="1.35" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.35" fill="currentColor" stroke="none" />
      <circle cx="17.8" cy="12" r="1.35" fill="currentColor" stroke="none" />
    </>
  ),
  // The fallback, and the family's bare motif: the disc and its wave, with none
  // of the satellites the named glyphs add. It was a byte-for-byte copy of
  // `matches`, which `CfbGlyph.test.tsx` catches as 28 names drawing 27
  // pictures — an unknown glyph name rendered as "matches" and read as a
  // deliberate icon rather than as a gap.
  default: (
    <>
      <circle cx="12" cy="11.6" r="6.4" />
      <path d="M4.6 15.2h14.8" transform="rotate(-14 12 15.2)" strokeWidth="2.15" />
    </>
  ),
};

export function CfbGlyph({
  name,
  className,
}: {
  name: CfbGlyphName;
  className?: string;
}) {
  return <GlyphFrame className={className}>{GLYPHS[name] ?? GLYPHS.default}</GlyphFrame>;
}

export function NavIcon({
  href,
  name,
  fallback: Fallback,
  className,
}: {
  href?: string;
  /** null: the list already shows this route's glyph; draw `fallback`. */
  name?: CfbGlyphName | null;
  fallback?: LucideIcon;
  className?: string;
}) {
  const resolved = name === null ? undefined : (name ?? (href ? glyphForHref(href) : undefined));
  if (resolved) return <CfbGlyph name={resolved} className={className} />;
  if (Fallback) return <Fallback className={className} aria-hidden="true" />;
  return <CfbGlyph name="default" className={className} />;
}

export function CfbGlyphWell({
  href,
  name,
  size = 'md',
  className,
}: {
  href?: string;
  name?: CfbGlyphName;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const resolved = name ?? (href ? glyphForHref(href) : 'default');
  const box = {
    sm: 'h-8 w-8 rounded-lg',
    md: 'h-10 w-10 rounded-xl',
    lg: 'h-12 w-12 rounded-xl',
  }[size];
  const icon = { sm: 'icon-sm', md: 'icon-md', lg: 'icon-lg' }[size];
  return (
    <span
      data-glyph-well=""
      className={cn(
        'inline-flex shrink-0 items-center justify-center bg-primary/8 text-primary-accessible',
        box,
        className,
      )}
    >
      <CfbGlyph name={resolved} className={icon} />
    </span>
  );
}
