import {
  type LucideIcon,
  Compass,
  User,
  Settings,
  MessageCircle,
  Calendar,
  GraduationCap,
  Users,
  UserCheck,
  Bell,
  Flag,
  Bookmark,
  Grid3X3,
  LayoutDashboard,
  Rocket,
  Briefcase,
  TrendingUp,
  BookOpen,
  Building2,
  Megaphone,
  Waypoints,
  Radar,
  Target,
  Handshake,
  Award,
  PieChart,
  Shield,
  Sparkles,
  DollarSign,
  Store,
  UserPlus,
  ClipboardList,
  BarChart3,
  FolderKanban,
  Trophy,
  Activity,
  Telescope,
  GitMerge,
  Globe,
  HelpCircle,
  Star,
  Lock,
  LineChart,
  Webhook,
  KeyRound,
  BadgeCheck,
  Wallet,
  ClipboardCheck,
  GanttChart,
  BrainCircuit,
  Presentation,
  CalendarClock,
  SlidersHorizontal,
  Workflow,
  ClipboardSignature,
  FlaskConical,
  Boxes,
  Eye,
  Gauge,
  Layers,
  Lightbulb,
  Home,
  Wrench,
  Search,
  Gift,
  Rss,
  ArrowLeftRight,
  Save,
  Clock,
  Inbox,
  UserPen,
  BellRing,
  Download,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: 'messages' | 'connections' | 'notifications';
};

export type NavSection = {
  section: string;
  links: NavLink[];
  collapsed?: boolean;
};

export type SidebarMode = 'work' | 'explore' | 'account';

export type ModeConfig = {
  id: SidebarMode;
  label: string;
  icon: LucideIcon;
  shortLabel: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Mode Definitions
// ─────────────────────────────────────────────────────────────────────────────

export const sidebarModes: ModeConfig[] = [
  { id: 'work', label: 'Work', icon: Wrench, shortLabel: 'Work' },
  { id: 'explore', label: 'Explore', icon: Compass, shortLabel: 'Explore' },
  { id: 'account', label: 'Account', icon: Settings, shortLabel: 'Account' },
];

// ─────────────────────────────────────────────────────────────────────────────
// WORK MODE — Role-specific tools (no duplicates with Explore)
// ─────────────────────────────────────────────────────────────────────────────

// ─── Founder Work Mode ───────────────────────────────────────────────────────

export const founderWorkSections: NavSection[] = [
  {
    section: 'Dashboard',
    links: [
      { href: '/dashboard/founder', label: 'Overview', icon: LayoutDashboard },
      { href: '/readiness', label: 'Readiness Score', icon: Gauge },
      { href: '/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    section: 'Build',
    links: [
      { href: '/builder', label: 'Startup Builder', icon: Rocket },
      { href: '/builder/pitch-deck', label: 'Pitch Deck', icon: Presentation },
      { href: '/research', label: 'Research boards', icon: Grid3X3 },
      { href: '/milestones', label: 'Milestones', icon: Flag },
      { href: '/projects', label: 'Projects', icon: FolderKanban },
      { href: '/commitments', label: 'Commitments', icon: Handshake },
      { href: '/scout', label: 'Co-founder scout', icon: Radar },
    ],
  },
  {
    section: 'Fundraise',
    links: [
      { href: '/fundraising', label: 'Fundraising', icon: DollarSign },
      { href: '/updates', label: 'Updates', icon: Megaphone },
      { href: '/builder/applications', label: 'Applications', icon: ClipboardList },
    ],
  },
  {
    section: 'Communicate',
    links: [
      { href: '/ai', label: 'AI Assistant', icon: Sparkles },
      { href: '/messages', label: 'Messages', icon: MessageCircle, badge: 'messages' },
      { href: '/calendar', label: 'Calendar', icon: Calendar },
    ],
  },
];

// ─── Mentor Work Mode ────────────────────────────────────────────────────────

export const mentorWorkSections: NavSection[] = [
  {
    section: 'Dashboard',
    links: [
      { href: '/dashboard/mentor', label: 'Overview', icon: LayoutDashboard },
      { href: '/mentor/earnings', label: 'Earnings', icon: Wallet },
      { href: '/mentor/reviews', label: 'Reviews', icon: Star },
    ],
  },
  {
    section: 'Sessions',
    links: [
      { href: '/mentor/sessions', label: 'My Sessions', icon: CalendarClock },
      { href: '/mentor/requests', label: 'Requests', icon: UserPlus },
      { href: '/mentor/mentees', label: 'Mentees', icon: Users },
    ],
  },
  {
    section: 'Profile',
    links: [
      { href: '/mentor/availability', label: 'Availability', icon: Clock },
      { href: '/mentor/profile', label: 'Mentor Profile', icon: BadgeCheck },
    ],
  },
  {
    section: 'Communicate',
    links: [
      { href: '/ai', label: 'AI Assistant', icon: Sparkles },
      { href: '/messages', label: 'Messages', icon: MessageCircle, badge: 'messages' },
      { href: '/calendar', label: 'Calendar', icon: Calendar },
    ],
  },
];

// ─── Investor Work Mode ──────────────────────────────────────────────────────

export const investorWorkSections: NavSection[] = [
  {
    section: 'Dashboard',
    links: [
      { href: '/dashboard/investor', label: 'Overview', icon: LayoutDashboard },
      { href: '/investor/analytics', label: 'Deal Analytics', icon: LineChart },
    ],
  },
  {
    section: 'Deal Flow',
    links: [
      { href: '/investor/scouting', label: 'Scout Startups', icon: Telescope },
      { href: '/investor/pipeline', label: 'Pipeline', icon: GanttChart },
      { href: '/investor/watchlist', label: 'Watchlist', icon: Eye },
    ],
  },
  {
    section: 'Portfolio',
    links: [
      { href: '/investor/portfolio', label: 'Portfolio', icon: Briefcase },
      { href: '/updates', label: 'Updates', icon: Megaphone },
    ],
  },
  {
    section: 'Communicate',
    links: [
      { href: '/ai', label: 'AI Assistant', icon: Sparkles },
      { href: '/messages', label: 'Messages', icon: MessageCircle, badge: 'messages' },
      { href: '/calendar', label: 'Calendar', icon: Calendar },
    ],
  },
];

// ─── Service Provider Work Mode ──────────────────────────────────────────────

export const providerWorkSections: NavSection[] = [
  {
    section: 'Dashboard',
    links: [
      { href: '/dashboard/provider', label: 'Overview', icon: LayoutDashboard },
      { href: '/provider/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    section: 'Services',
    links: [
      { href: '/provider/services', label: 'My Services', icon: Store },
      { href: '/provider/inquiries', label: 'Inquiries', icon: Inbox },
      { href: '/provider/projects', label: 'Projects', icon: FolderKanban },
    ],
  },
  {
    section: 'Reputation',
    links: [
      { href: '/provider/reviews', label: 'Reviews', icon: Star },
      { href: '/provider/profile', label: 'Provider Profile', icon: BadgeCheck },
    ],
  },
  {
    section: 'Communicate',
    links: [
      { href: '/ai', label: 'AI Assistant', icon: Sparkles },
      { href: '/messages', label: 'Messages', icon: MessageCircle, badge: 'messages' },
      { href: '/calendar', label: 'Calendar', icon: Calendar },
    ],
  },
];

// ─── Organization (Incubator/Accelerator) Work Mode ──────────────────────────

export const orgWorkSections: NavSection[] = [
  {
    section: 'Dashboard',
    links: [
      { href: '/dashboard/incubator', label: 'Overview', icon: LayoutDashboard },
      { href: '/org/analytics', label: 'Analytics', icon: PieChart },
    ],
  },
  {
    section: 'Programs',
    links: [
      { href: '/org/programs', label: 'Programs', icon: Layers },
      { href: '/org/cohorts', label: 'Cohorts', icon: Users },
      { href: '/org/applications', label: 'Applications', icon: ClipboardList },
    ],
  },
  {
    section: 'Portfolio',
    links: [
      { href: '/org/startups', label: 'Startups', icon: Rocket },
      { href: '/org/mentors', label: 'Mentor Pool', icon: GraduationCap },
    ],
  },
  {
    section: 'Manage',
    links: [
      { href: '/org/events', label: 'Events', icon: Calendar },
      { href: '/org/members', label: 'Team', icon: Users },
      { href: '/org/settings', label: 'Settings', icon: SlidersHorizontal },
    ],
  },
];

// ─── Platform Admin Work Mode ────────────────────────────────────────────────

export const adminWorkSections: NavSection[] = [
  {
    section: 'Overview',
    links: [
      { href: '/admin/dashboard', label: 'Platform overview', icon: LayoutDashboard },
      { href: '/admin', label: 'Admin console', icon: Shield },
      { href: '/admin/analytics', label: 'Global Analytics', icon: BarChart3 },
    ],
  },
  {
    section: 'Users & Content',
    links: [
      { href: '/admin/users', label: 'Users', icon: Users },
      { href: '/admin/communities', label: 'Communities', icon: Users },
      { href: '/admin/reports', label: 'Reports', icon: Flag },
    ],
  },
  {
    section: 'Platform',
    links: [
      { href: '/admin/tenants', label: 'Tenants', icon: Building2 },
      { href: '/admin/programs', label: 'Programs', icon: Award },
      { href: '/admin/billing', label: 'Billing', icon: DollarSign },
    ],
  },
  {
    section: 'Config',
    links: [
      { href: '/admin/taxonomy', label: 'Taxonomy', icon: Boxes },
      { href: '/admin/feature-flags', label: 'Feature Flags', icon: FlaskConical },
      { href: '/admin/automations', label: 'Automations', icon: Workflow },
      { href: '/admin/sso', label: 'SSO', icon: Lock },
      { href: '/admin/domains', label: 'Domains', icon: Globe },
      { href: '/admin/audit-log', label: 'Audit Log', icon: ClipboardSignature },
    ],
    collapsed: true,
  },
];

// ─── Tenant Admin Work Mode ──────────────────────────────────────────────────

export const tenantWorkSections: NavSection[] = [
  {
    section: 'Dashboard',
    links: [
      { href: '/tenant/dashboard', label: 'Overview', icon: LayoutDashboard },
      { href: '/tenant/analytics', label: 'Analytics', icon: PieChart },
    ],
  },
  {
    section: 'Manage',
    links: [
      { href: '/tenant/members', label: 'Members', icon: Users },
      { href: '/tenant/programs', label: 'Programs', icon: Award },
    ],
  },
  {
    section: 'Config',
    links: [
      { href: '/tenant/branding', label: 'Branding', icon: Lightbulb },
      { href: '/tenant/domains', label: 'Domains', icon: Globe },
      { href: '/tenant/sso', label: 'SSO', icon: Lock },
      { href: '/tenant/webhooks', label: 'Webhooks', icon: Webhook },
      { href: '/tenant/api-keys', label: 'API Keys', icon: KeyRound },
      { href: '/tenant/automation', label: 'Automations', icon: Workflow },
      { href: '/tenant/billing', label: 'Billing', icon: DollarSign },
      { href: '/tenant/settings', label: 'Settings', icon: Settings },
    ],
    collapsed: true,
  },
];

// ─── Default Work Mode (no specific role) ────────────────────────────────────

export const defaultWorkSections: NavSection[] = [
  {
    section: 'Dashboard',
    links: [
      { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
      { href: '/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    section: 'Workspace',
    links: [
      { href: '/builder', label: 'Startup Builder', icon: Rocket },
      { href: '/research', label: 'Research boards', icon: Grid3X3 },
      { href: '/milestones', label: 'Milestones', icon: Flag },
      { href: '/projects', label: 'Projects', icon: FolderKanban },
    ],
  },
  {
    section: 'Communicate',
    links: [
      { href: '/ai', label: 'AI Assistant', icon: Sparkles },
      { href: '/messages', label: 'Messages', icon: MessageCircle, badge: 'messages' },
      { href: '/calendar', label: 'Calendar', icon: Calendar },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// EXPLORE MODE — Discovery, Community, Network (shared across all roles)
// ─────────────────────────────────────────────────────────────────────────────

export const exploreSections: NavSection[] = [
  {
    section: 'Discover',
    links: [
      { href: '/discover', label: 'Explore', icon: Compass },
      { href: '/search', label: 'Search', icon: Search },
      { href: '/ai', label: 'Ask AI', icon: BrainCircuit },
    ],
  },
  {
    section: 'People',
    links: [
      { href: '/members', label: 'Members', icon: Users },
      { href: '/mentoring', label: 'Mentors', icon: GraduationCap },
      { href: '/investors', label: 'Investors', icon: TrendingUp },
    ],
  },
  {
    section: 'Community',
    links: [
      { href: '/groups', label: 'Communities', icon: Users },
      { href: '/events', label: 'Events', icon: Calendar },
      { href: '/programs', label: 'Programs', icon: Award },
    ],
  },
  {
    section: 'Opportunities',
    links: [
      { href: '/opportunities', label: 'Opportunities', icon: Target },
      { href: '/jobs', label: 'Jobs & Roles', icon: Briefcase },
      { href: '/marketplace', label: 'Services', icon: Store },
    ],
  },
  {
    section: 'Network',
    links: [
      { href: '/connections', label: 'Connections', icon: UserCheck, badge: 'connections' },
      { href: '/intros', label: 'Introductions', icon: Waypoints },
      { href: '/shortlist', label: 'Saved Profiles', icon: Bookmark },
      { href: '/endorsements', label: 'Endorsements', icon: Handshake },
      { href: '/compare', label: 'Compare Profiles', icon: ArrowLeftRight },
      { href: '/saved-searches', label: 'Saved Searches', icon: Save },
    ],
  },
  {
    section: 'Learn',
    links: [
      { href: '/learning', label: 'Learning Hub', icon: BookOpen },
      { href: '/expert-reviews', label: 'Expert Reviews', icon: ClipboardCheck },
      { href: '/coaching', label: 'Coaching', icon: BrainCircuit },
      { href: '/help', label: 'Help & Support', icon: HelpCircle },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT MODE — Profile, Settings, Activity
// ─────────────────────────────────────────────────────────────────────────────

export const accountSections: NavSection[] = [
  {
    section: 'Profile',
    links: [
      { href: '/profile', label: 'My Profile', icon: User },
      { href: '/profile/edit', label: 'Edit Profile', icon: UserPen },
      { href: '/reputation', label: 'Reputation', icon: Shield },
      { href: '/achievements', label: 'Achievements', icon: Trophy },
    ],
  },
  {
    section: 'Activity',
    links: [
      { href: '/feed', label: 'Feed', icon: Rss },
      { href: '/activity', label: 'Activity', icon: Activity },
      { href: '/notifications', label: 'Notifications', icon: Bell, badge: 'notifications' },
    ],
  },
  {
    section: 'Settings',
    links: [
      { href: '/settings', label: 'General', icon: Settings },
      { href: '/settings/ai', label: 'AI Preferences', icon: Sparkles },
      { href: '/settings/notifications', label: 'Notification Prefs', icon: BellRing },
      { href: '/settings/billing', label: 'Billing', icon: DollarSign },
      { href: '/settings/data-export', label: 'Data Export', icon: Download },
    ],
  },
  {
    section: 'Grow',
    links: [
      { href: '/referrals', label: 'Referrals', icon: Gift },
      { href: '/invite', label: 'Invite Friends', icon: UserPlus },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Get Work sections based on user role
// ─────────────────────────────────────────────────────────────────────────────

export function getWorkSectionsForRole(role: string | undefined): NavSection[] {
  if (!role) return defaultWorkSections;

  switch (role) {
    // Founders
    case 'founder':
    case 'aspiring_founder':
    case 'existing_founder':
    case 'cofounder_candidate':
    case 'technical_talent':
    case 'business_operator':
      return founderWorkSections;

    // Mentors & Coaches
    case 'mentor':
    case 'advisor':
    case 'coach':
    case 'course_creator':
      return mentorWorkSections;

    // Investors
    case 'investor':
    case 'angel':
    case 'vc':
    case 'angel_investor':
    case 'vc_scout':
    case 'vc_analyst':
    case 'syndicate_manager':
      return investorWorkSections;

    // Service Providers
    case 'service_provider':
    case 'legal_partner':
    case 'finance_advisor':
    case 'recruiter':
      return providerWorkSections;

    // Organizations
    case 'org':
    case 'incubator_admin':
    case 'accelerator_admin':
    case 'university_admin':
    case 'venture_studio_admin':
    case 'program_manager':
      return orgWorkSections;

    // Platform Admin
    case 'admin':
    case 'platform_admin':
    case 'super_admin':
      return adminWorkSections;

    // Tenant Admin
    case 'tenant_admin':
      return tenantWorkSections;

    default:
      return defaultWorkSections;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Get sections for a specific mode
// ─────────────────────────────────────────────────────────────────────────────

export function getActiveNavHref(pathname: string | null, sections: NavSection[]): string | undefined {
  if (!pathname) return undefined;
  return sections.flatMap((section) => section.links).reduce<string | undefined>((active, { href }) => {
    const matches = pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
    return matches && href.length > (active?.length ?? 0) ? href : active;
  }, undefined);
}

/**
 * The mode whose list holds this page, preferring the one already showing.
 * A page in no list (a profile, a deal, a board) keeps the reader's mode.
 */
/**
 * Pages reached from a mode's content but not listed in its sidebar (the
 * full Matches and For You views open from Discover's tab headers) still
 * belong to that mode's story.
 */
const ORPHAN_MODE: Record<string, SidebarMode> = {
  '/matches': 'explore',
  '/recommendations': 'explore',
};

export function modeForPath(pathname: string | null, current: SidebarMode, role?: string): SidebarMode {
  if (!pathname || getActiveNavHref(pathname, getSectionsForMode(current, role))) return current;
  for (const candidate of ['work', 'explore', 'account'] as const) {
    if (candidate !== current && getActiveNavHref(pathname, getSectionsForMode(candidate, role))) return candidate;
  }
  for (const [prefix, mode] of Object.entries(ORPHAN_MODE)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return mode;
  }
  return current;
}

export function getSectionsForMode(mode: SidebarMode, role?: string): NavSection[] {
  switch (mode) {
    case 'work':
      return getWorkSectionsForRole(role);
    case 'explore':
      return exploreSections;
    case 'account':
      return accountSections;
    default:
      return defaultWorkSections;
  }
}
