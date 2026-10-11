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
  Target,
  Handshake,
  Award,
  FileText,
  PieChart,
  Shield,
  Sparkles,
  Lightbulb,
  DollarSign,
  Store,
  UserPlus,
  ClipboardList,
  BarChart3,
  Layers,
  FolderKanban,
  CircleDot,
  Trophy,
  Activity,
  Network,
  Telescope,
  GitMerge,
  CreditCard,
  Megaphone,
  Globe,
  HelpCircle,
  Star,
  Zap,
  Lock,
  ChartLine,
  Package,
  Search,
  CheckSquare,
  Eye,
  MapPin,
  LineChart,
  Webhook,
  KeyRound,
  BellRing,
  BadgeCheck,
  Coins,
  Gauge,
  UserCog,
  SlidersHorizontal,
  Link2,
  Workflow,
  Database,
  Code2,
  Filter,
  Boxes,
  Presentation,
  MessageSquare,
  CalendarClock,
  BookMarked,
  HeartHandshake,
  Wallet,
  ClipboardCheck,
  GanttChart,
  Building,
  BrainCircuit,
  MoveRight,
  Scale,
  Lightbulb as LightbulbIcon,
  FileSearch,
  Cpu,
  ClipboardSignature,
  Projector,
  HeartPulse,
  FlaskConical,
  PenTool,
  Banknote,
  ArrowUpRight,
} from 'lucide-react';

export type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: 'messages' | 'connections' | 'notifications';
  roles?: string[]; // If specified, only show for these roles
};

export type NavSection = {
  section: string;
  links: NavLink[];
  roles?: string[]; // If specified, only show section for these roles
  collapsed?: boolean; // Default collapsed state
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared Core Navigation — Available to all authenticated users
// ─────────────────────────────────────────────────────────────────────────────

export const navSections: NavSection[] = [
  {
    section: 'Workspace',
    links: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/builder', label: 'Startup Builder', icon: Rocket },
      { href: '/research', label: 'Research boards', icon: Grid3X3 },
      { href: '/milestones', label: 'Milestones', icon: Flag },
      { href: '/calendar', label: 'Calendar', icon: Calendar },
      { href: '/messages', label: 'Messages', icon: MessageCircle, badge: 'messages' },
    ],
  },
  {
    section: 'Discovery',
    links: [
      { href: '/discover', label: 'Explore', icon: Compass },
      { href: '/members', label: 'Members', icon: Users },
      { href: '/mentoring', label: 'Mentors', icon: GraduationCap },
      { href: '/investors', label: 'Investors', icon: TrendingUp },
      { href: '/opportunities', label: 'Opportunities', icon: Target },
    ],
  },
  {
    section: 'Community',
    links: [
      { href: '/groups', label: 'Communities', icon: Users },
      { href: '/events', label: 'Events', icon: Calendar },
      { href: '/programs', label: 'Programs', icon: Award },
      { href: '/invite', label: 'Invite & Grow', icon: Megaphone },
    ],
  },
  {
    section: 'Network',
    links: [
      { href: '/connections', label: 'Connections', icon: UserCheck, badge: 'connections' },
      { href: '/shortlist', label: 'Saved Profiles', icon: Bookmark },
      { href: '/endorsements', label: 'Endorsements', icon: Handshake },
      { href: '/matches/compare', label: 'Compare Profiles', icon: GitMerge },
    ],
  },
  {
    section: 'Resources',
    links: [
      { href: '/learning', label: 'Learning Hub', icon: BookOpen },
      { href: '/marketplace', label: 'Services', icon: Store },
      { href: '/jobs', label: 'Jobs & Roles', icon: Briefcase },
      { href: '/expert-reviews', label: 'Expert Reviews', icon: Award },
      { href: '/coaching', label: 'Coaching', icon: BrainCircuit },
      { href: '/help', label: 'Help & Support', icon: HelpCircle },
    ],
  },
  {
    section: 'Insights',
    links: [
      { href: '/analytics', label: 'Analytics', icon: BarChart3 },
      { href: '/activity', label: 'Activity Feed', icon: Activity },
      { href: '/achievements', label: 'Achievements', icon: Trophy },
    ],
  },
  {
    section: 'Account',
    links: [
      { href: '/profile', label: 'Profile', icon: User },
      { href: '/notifications', label: 'Notifications', icon: Bell, badge: 'notifications' },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Role-Specific Navigation Sections
// ─────────────────────────────────────────────────────────────────────────────

// ─── Founder / Co-founder / Builder ─────────────────────────────────────────

export const founderNavSections: NavSection[] = [
  {
    section: 'Founder Tools',
    links: [
      { href: '/dashboard/founder', label: 'Founder Dashboard', icon: LayoutDashboard },
      { href: '/readiness', label: 'Readiness Score', icon: Gauge },
      { href: '/builder', label: 'Startup Builder', icon: Rocket },
      { href: '/builder/pitch-deck', label: 'Pitch Deck', icon: Presentation },
      { href: '/builder/applications', label: 'Program Applications', icon: ClipboardList },
      { href: '/milestones', label: 'Milestones', icon: Flag },
      { href: '/projects', label: 'Projects', icon: FolderKanban },
    ],
  },
  {
    section: 'Fundraising',
    links: [
      { href: '/fundraising', label: 'Fundraising Tracker', icon: DollarSign },
      { href: '/investors', label: 'Find Investors', icon: TrendingUp },
      { href: '/programs', label: 'Programs & Grants', icon: Award },
      { href: '/opportunities', label: 'Opportunities', icon: Target },
    ],
    collapsed: true,
  },
  {
    section: 'Expert Support',
    links: [
      { href: '/expert-reviews', label: 'Expert Reviews', icon: Award },
      { href: '/coaching', label: 'Coaching', icon: BrainCircuit },
      { href: '/mentoring', label: 'Find Mentors', icon: GraduationCap },
    ],
    collapsed: true,
  },
];

// ─── Co-founder Candidate ─────────────────────────────────────────────────────

export const cofounderNavSections: NavSection[] = [
  {
    section: 'Co-founder Tools',
    links: [
      { href: '/matches', label: 'Find Startups', icon: BrainCircuit },
      { href: '/recommendations', label: 'Recommended', icon: Sparkles },
      { href: '/opportunities', label: 'Opportunities', icon: Target },
      { href: '/shortlist', label: 'Saved Startups', icon: Bookmark },
    ],
  },
];

// ─── Mentor / Advisor ─────────────────────────────────────────────────────────

export const mentorNavSections: NavSection[] = [
  {
    section: 'Mentor Hub',
    links: [
      { href: '/dashboard/mentor', label: 'Mentor Dashboard', icon: LayoutDashboard },
      { href: '/mentor/sessions', label: 'My Sessions', icon: CalendarClock },
      { href: '/mentor/requests', label: 'Mentee Requests', icon: UserPlus },
      { href: '/mentor/mentees', label: 'Active Mentees', icon: Users },
      { href: '/mentor/reviews', label: 'Reviews', icon: ClipboardCheck },
    ],
  },
  {
    section: 'Mentor Resources',
    links: [
      { href: '/mentor/availability', label: 'Availability', icon: Calendar },
      { href: '/mentor/earnings', label: 'Earnings', icon: Wallet },
      { href: '/mentor/profile', label: 'Mentor Profile', icon: BadgeCheck },
    ],
    collapsed: true,
  },
];

// ─── Coach ─────────────────────────────────────────────────────────────────────

export const coachNavSections: NavSection[] = [
  {
    section: 'Coach Hub',
    links: [
      { href: '/coaching', label: 'My Coaching', icon: BrainCircuit },
      { href: '/mentor/sessions', label: 'Sessions', icon: CalendarClock },
      { href: '/mentor/requests', label: 'Client Requests', icon: UserPlus },
    ],
  },
];

// ─── Investor / Angel / VC ────────────────────────────────────────────────────

export const investorNavSections: NavSection[] = [
  {
    section: 'Deal Flow',
    links: [
      { href: '/dashboard/investor', label: 'Investor Dashboard', icon: LayoutDashboard },
      { href: '/investor/scouting', label: 'Scout Startups', icon: Telescope },
      { href: '/investor/pipeline', label: 'Pipeline', icon: GanttChart },
      { href: '/investor/portfolio', label: 'Portfolio', icon: Briefcase },
    ],
  },
  {
    section: 'Investor Analytics',
    links: [
      { href: '/investor/analytics', label: 'Deal Analytics', icon: LineChart },
      { href: '/investor/watchlist', label: 'Watchlist', icon: Eye },
    ],
    collapsed: true,
  },
];

// ─── Incubator / Accelerator / University / Org ───────────────────────────────

export const incubatorNavSections: NavSection[] = [
  {
    section: 'Program Management',
    links: [
      { href: '/org/dashboard', label: 'Org Dashboard', icon: LayoutDashboard },
      { href: '/org/programs', label: 'Programs', icon: Layers },
      { href: '/org/cohorts', label: 'Cohorts', icon: Users },
      { href: '/org/applications', label: 'Applications', icon: ClipboardList },
      { href: '/org/startups', label: 'Startups', icon: Rocket },
    ],
  },
  {
    section: 'Org Resources',
    links: [
      { href: '/org/mentors', label: 'Mentor Pool', icon: GraduationCap },
      { href: '/org/events', label: 'Org Events', icon: Calendar },
      { href: '/org/analytics', label: 'Analytics', icon: PieChart },
      { href: '/org/members', label: 'Team Members', icon: UserCog },
      { href: '/org/settings', label: 'Org Settings', icon: SlidersHorizontal },
    ],
    collapsed: true,
  },
];

// ─── Service Provider ─────────────────────────────────────────────────────────

export const serviceProviderNavSections: NavSection[] = [
  {
    section: 'Provider Hub',
    links: [
      { href: '/dashboard/provider', label: 'Provider Dashboard', icon: LayoutDashboard },
      { href: '/provider/services', label: 'My Services', icon: Store },
      { href: '/provider/inquiries', label: 'Inquiries', icon: MessageSquare },
      { href: '/provider/projects', label: 'Active Projects', icon: FolderKanban },
    ],
  },
  {
    section: 'Provider Growth',
    links: [
      { href: '/provider/reviews', label: 'Reviews', icon: Star },
      { href: '/provider/analytics', label: 'Analytics', icon: BarChart3 },
      { href: '/provider/profile', label: 'Provider Profile', icon: BadgeCheck },
      { href: '/expert-reviews', label: 'Expert Reviews', icon: Award },
    ],
    collapsed: true,
  },
];

// ─── Community Manager ────────────────────────────────────────────────────────

export const communityManagerNavSections: NavSection[] = [
  {
    section: 'Community Tools',
    links: [
      { href: '/groups', label: 'Communities', icon: Users },
      { href: '/groups/manage', label: 'Manage Groups', icon: SlidersHorizontal },
      { href: '/events', label: 'Events', icon: Calendar },
      { href: '/events/create', label: 'Create Event', icon: CalendarClock },
      { href: '/groups/moderation', label: 'Moderation', icon: Shield },
    ],
  },
];

// ─── Platform Admin ───────────────────────────────────────────────────────────

export const adminNavSections: NavSection[] = [
  {
    section: 'Platform Admin',
    links: [
      { href: '/admin/dashboard', label: 'Platform overview', icon: LayoutDashboard },
      { href: '/admin', label: 'Admin console', icon: Shield },
      { href: '/admin/users', label: 'Users', icon: Users },
      { href: '/admin/tenants', label: 'Tenants', icon: Building2 },
      { href: '/admin/programs', label: 'Programs', icon: Award },
      { href: '/admin/reports', label: 'Reports & Flags', icon: Flag },
      { href: '/admin/communities', label: 'Communities', icon: Users },
    ],
  },
  {
    section: 'Platform Config',
    links: [
      { href: '/admin/analytics', label: 'Global Analytics', icon: BarChart3 },
      { href: '/admin/billing', label: 'Billing & Plans', icon: DollarSign },
      { href: '/admin/automations', label: 'Automations', icon: Workflow },
      { href: '/admin/audit-log', label: 'Audit Log', icon: ClipboardSignature },
      { href: '/admin/feature-flags', label: 'Feature Flags', icon: FlaskConical },
      { href: '/admin/taxonomy', label: 'Taxonomy', icon: Boxes },
      { href: '/admin/sso', label: 'SSO Config', icon: Lock },
      { href: '/admin/domains', label: 'Domain Mapping', icon: Globe },
    ],
    collapsed: true,
  },
];

// ─── Tenant Admin ─────────────────────────────────────────────────────────────

export const tenantAdminNavSections: NavSection[] = [
  {
    section: 'Tenant Admin',
    links: [
      { href: '/dashboard/incubator', label: 'Tenant Dashboard', icon: Building2 },
      { href: '/tenant/members', label: 'Members', icon: Users },
      { href: '/tenant/programs', label: 'Programs', icon: Award },
      { href: '/tenant/analytics', label: 'Analytics', icon: PieChart },
    ],
  },
  {
    section: 'Tenant Config',
    links: [
      { href: '/tenant/branding', label: 'Branding', icon: Lightbulb },
      { href: '/tenant/domains', label: 'Domains', icon: Globe },
      { href: '/tenant/sso', label: 'SSO / Auth', icon: Lock },
      { href: '/tenant/webhooks', label: 'Webhooks', icon: Webhook },
      { href: '/tenant/api-keys', label: 'API Keys', icon: KeyRound },
      { href: '/tenant/automation', label: 'Automations', icon: Workflow },
      { href: '/tenant/settings', label: 'Settings', icon: Settings },
    ],
    collapsed: true,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helper function to get navigation sections based on user role
// ─────────────────────────────────────────────────────────────────────────────

export type UserRole = 
  | 'founder' 
  | 'cofounder' 
  | 'mentor' 
  | 'advisor' 
  | 'investor' 
  | 'angel' 
  | 'vc' 
  | 'incubator_admin' 
  | 'accelerator_admin' 
  | 'program_manager'
  | 'service_provider'
  | 'platform_admin'
  | 'tenant_admin'
  | 'community_manager';

export function getNavSectionsForRole(role: UserRole | string): NavSection[] {
  const sections = [...navSections];

  switch (role) {
    case 'founder':
    case 'aspiring_founder':
    case 'existing_founder':
    case 'business_operator':
      return [...founderNavSections, ...sections];

    case 'cofounder':
    case 'cofounder_candidate':
    case 'technical_talent':
      return [...cofounderNavSections, ...founderNavSections, ...sections];

    case 'mentor':
    case 'advisor':
    case 'course_creator':
      return [...mentorNavSections, ...sections];

    case 'coach':
      return [...coachNavSections, ...mentorNavSections, ...sections];

    case 'investor':
    case 'angel':
    case 'vc':
    case 'angel_investor':
    case 'vc_scout':
    case 'vc_analyst':
    case 'syndicate_manager':
      return [...investorNavSections, ...sections];

    case 'incubator_admin':
    case 'accelerator_admin':
    case 'university_admin':
    case 'venture_studio_admin':
    case 'program_manager':
      return [...incubatorNavSections, ...sections];

    case 'service_provider':
    case 'legal_partner':
    case 'finance_advisor':
    case 'recruiter':
      return [...serviceProviderNavSections, ...sections];

    case 'community_manager':
      return [...communityManagerNavSections, ...sections];

    case 'platform_admin':
      return [...adminNavSections, ...tenantAdminNavSections, ...sections];

    case 'tenant_admin':
      return [...tenantAdminNavSections, ...sections];

    default:
      return sections;
  }
}

/** Flat nav links — deduplicated by href */
export const navLinks = Array.from(
  new Map(navSections.flatMap((s) => s.links).map((l) => [l.href, l])).values()
);
