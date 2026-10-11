import type { ReactNode } from 'react';
import { getPageMetaEl } from '@/lib/i18n/strings-pages';

export type PageMeta = {
  /** Route pattern, e.g. `/matches` or `/profiles/[userId]` */
  path: string;
  title: string;
  /** Greek title — additive; English `title` remains canonical in UI primary line */
  titleEl?: string;
  /** One-line subtitle shown under the page title */
  description: string;
  descriptionEl?: string;
  /** Optional contextual help (HTML-free markdown-ish strings in JSX at call site) */
  helpId?: string;
  helpTitle?: string;
  /** Greek help heading — additive, same contract as `titleEl`. */
  helpTitleEl?: string;
  /** Primary user action label for empty states */
  primaryAction?: string;
  /** Breadcrumb parent */
  section?: string;
  /** WCAG: who this page is for */
  audience?: string[];
  /** UX priority for audit tracking */
  priority?: 'critical' | 'high' | 'medium' | 'low';
  /** Implementation status */
  status?: 'complete' | 'partial' | 'scaffold';
};

/** Static registry — dynamic segments matched by prefix/pattern in getPageMeta */
export const PAGE_REGISTRY: PageMeta[] = [
  // ── Public ──
  { path: '/', title: 'Home', description: 'CoFounderBay landing — find co-founders, mentors, and investors.', section: 'Public', priority: 'critical', status: 'complete' },
  { path: '/pricing', title: 'Pricing', description: 'Plans for founders, mentors, organizations, and enterprises.', section: 'Public', status: 'complete' },
  { path: '/login', title: 'Sign in', description: 'Access your workspace with email, Google, LinkedIn, or SSO.', section: 'Auth', priority: 'critical', status: 'complete' },
  { path: '/register', title: 'Create account', description: 'Join as founder, mentor, investor, or organization.', section: 'Auth', priority: 'critical', status: 'complete' },
  { path: '/onboarding', title: 'Welcome to CoFounderBay', description: 'A 3-minute setup so matching, search, and recommendations actually work for you.', helpId: 'onboarding', helpTitle: 'Why we ask these questions', helpTitleEl: 'Γιατί ρωτάμε αυτά', section: 'Auth', priority: 'critical', status: 'complete' },

  // ── Founder work ──
  { path: '/dashboard/founder', title: 'Founder dashboard', description: 'Your startup command center — readiness, matches, and next actions.', helpId: 'dashboard-founder', helpTitle: 'Founder dashboard', helpTitleEl: 'Ο πίνακας του ιδρυτή', section: 'Work', audience: ['founder'], priority: 'critical', status: 'complete' },
  { path: '/readiness', title: 'Readiness Score', description: 'Assess your startup\u2019s readiness across 6 key dimensions and see what to fix next.', helpId: 'readiness', helpTitle: 'How the readiness score works', helpTitleEl: 'Πώς υπολογίζεται η ετοιμότητα', section: 'Work', audience: ['founder'], status: 'complete' },
  { path: '/analytics', title: 'Analytics', description: 'Track your profile performance and network growth.', helpId: 'analytics', helpTitle: 'How to read these metrics', helpTitleEl: 'Πώς διαβάζονται οι μετρήσεις', section: 'Work', audience: ['founder'], status: 'complete' },
  { path: '/builder', title: 'Startup Builder', description: 'Structure idea, team, market, traction, and pitch \u2014 all in one workspace.', helpId: 'builder', helpTitle: 'Using the Startup Builder', helpTitleEl: 'Πώς δουλεύει ο Startup Builder', section: 'Work', priority: 'critical', status: 'complete' },
  { path: '/builder/pitch-deck', title: 'Pitch deck', description: 'Draft slides tied to Builder data. Completion counts filled content, not empty outlines.', helpId: 'pitch-deck', helpTitle: 'How this pitch deck works', helpTitleEl: 'Πώς δουλεύει αυτό το pitch deck', section: 'Work', status: 'complete' },
  { path: '/builder/applications', title: 'Program applications', description: 'Prepare accelerator and grant applications from your Builder workspace. Review AI drafts, then save your answers.', helpId: 'applications', helpTitle: 'How program applications work', helpTitleEl: 'Πώς δουλεύουν οι αιτήσεις προγράμματος', section: 'Work', status: 'complete' },
  { path: '/research', title: 'Research boards', description: 'Visual canvases for market, product, and competitive research. Templates seed a board; the canvas holds notes, files, and links.', helpId: 'research', helpTitle: 'How research boards work', helpTitleEl: 'Πώς δουλεύουν οι πίνακες έρευνας', section: 'Work', status: 'complete' },
  { path: '/milestones', title: 'Milestones', description: 'Atomic goals with owners and dates. Completing them feeds Readiness and investor updates.', helpId: 'milestones', helpTitle: 'How milestones work', helpTitleEl: 'Πώς δουλεύουν τα ορόσημα', section: 'Work', status: 'complete' },
  // Creation routes need their own line: inheriting the list page told the user
  // they were "tracking" milestones on the form that creates one.
  { path: '/milestones/new', title: 'New milestone', description: 'Define one milestone — what done looks like, who owns it, and when it is due.', helpId: 'milestones', helpTitle: 'How milestones work', helpTitleEl: 'Πώς δουλεύουν τα ορόσημα', section: 'Work', status: 'complete' },
  { path: '/projects', title: 'Projects', description: 'Discover startup projects, join a team, or publish one with open roles. Completing work here sits next to Milestones and Builder.', helpId: 'projects', helpTitle: 'How projects work', helpTitleEl: 'Πώς δουλεύουν τα έργα', section: 'Work', status: 'complete' },
  { path: '/projects/create', title: 'Create project', description: 'Name the idea, pick a stage, and list the roles you still need — then publish.', helpId: 'projects', helpTitle: 'How projects work', helpTitleEl: 'Πώς δουλεύουν τα έργα', section: 'Work', status: 'complete' },
  { path: '/commitments', title: 'Commitments', description: 'Need cards and the ladder from interest to agreed terms: a protected first conversation, separate confirmations, versioned terms.', helpId: 'commitments', helpTitle: 'How commitments work', helpTitleEl: 'Πώς λειτουργούν οι δεσμεύσεις', section: 'Work', status: 'complete' },
  { path: '/scout', title: 'Co-founder scout', description: 'Write who you are looking for; the scout proposes people with its reasons and a first note. It never sends anything or tells anyone.', helpId: 'scout', helpTitle: 'What the scout does', helpTitleEl: 'Τι κάνει ο ανιχνευτής', section: 'Work', audience: ['founder'], status: 'complete' },
  { path: '/commitments/new', title: 'Write a need card', description: 'Three sentences and an offer, in about two minutes. Category, place, stage and commitment are what people filter by.', helpId: 'commitments', helpTitle: 'How commitments work', helpTitleEl: 'Πώς λειτουργούν οι δεσμεύσεις', section: 'Work', status: 'complete' },
  { path: '/updates', title: 'Updates', description: 'Updates from founders you follow, and the ones you send to your followers or publicly, with a link made for LinkedIn.', helpId: 'updates', helpTitle: 'How updates work', helpTitleEl: 'Πώς λειτουργούν οι ενημερώσεις', section: 'Network', status: 'complete' },
  { path: '/fundraising', title: 'Fundraising', description: 'Track your funding round, manage investor conversations, and organise the documents for due diligence.', helpId: 'fundraising', helpTitle: 'Running your fundraise here', helpTitleEl: 'Ο γύρος χρηματοδότησης εδώ', section: 'Work', audience: ['founder'], status: 'complete' },

  // ── Discovery ──
  { path: '/matches', title: 'Matches', description: 'AI-ranked co-founder and team matches based on your profile compatibility.', helpId: 'matches', helpTitle: 'How matching works', helpTitleEl: 'Πώς γίνεται η αντιστοίχιση', section: 'Explore', priority: 'critical', status: 'complete' },
  { path: '/matches/compare', title: 'Compare profiles', description: 'Side-by-side comparison of skills, stage, and fit.', section: 'Explore', status: 'partial' },
  { path: '/discover', title: 'Explore', description: 'Discover founders, mentors, investors, and team members with filters for role, skills, and location.', helpId: 'discover', helpTitle: 'How discovery works', helpTitleEl: 'Πώς λειτουργεί η εξερεύνηση', section: 'Explore', status: 'complete' },
  { path: '/recommendations', title: 'For you', description: 'Personalized suggestions based on your profile and activity.', helpId: 'recommendations', helpTitle: 'How these picks are ranked', helpTitleEl: 'Πώς κατατάσσονται αυτές οι προτάσεις', section: 'Explore', status: 'complete' },
  { path: '/search', title: 'Search', description: 'Find people, jobs, events, programs, and posts.', helpId: 'search', helpTitle: 'What you can find here', helpTitleEl: 'Τι μπορείτε να βρείτε εδώ', section: 'Explore', status: 'complete' },
  { path: '/connections', title: 'Connections', description: 'Manage pending requests and active professional relationships.', helpId: 'connections', helpTitle: 'Connections', helpTitleEl: 'Συνδέσεις', section: 'Network', status: 'complete' },
  { path: '/intros', title: 'Introductions', description: 'Ask for an introduction through someone you both know. The intermediary decides whether to forward it; accepting answers your need card.', helpId: 'intros', helpTitle: 'How introductions work', helpTitleEl: 'Πώς λειτουργούν οι συστάσεις', section: 'Network', status: 'complete' },
  { path: '/shortlist', title: 'Saved profiles', description: 'Profiles you bookmarked for later outreach.', helpId: 'shortlist', helpTitle: 'How saved profiles work', helpTitleEl: 'Πώς δουλεύουν τα αποθηκευμένα προφίλ', section: 'Network', status: 'complete' },
  { path: '/messages', title: 'Messages', description: 'Full-height inbox for chats and intro requests. New message opens a connection picker; Ask AI drafts from the thread.', helpId: 'messages', helpTitle: 'Chats vs intro requests', helpTitleEl: 'Συνομιλίες και αιτήματα γνωριμίας', section: 'Communicate', priority: 'critical', status: 'complete' },
  { path: '/calendar', title: 'Calendar', description: 'Sessions, calls, and events in one timeline.', helpId: 'calendar', helpTitle: 'What this calendar shows', helpTitleEl: 'Τι δείχνει αυτό το ημερολόγιο', section: 'Communicate', status: 'complete' },

  // ── Mentor ──
  { path: '/dashboard/mentor', title: 'Mentor dashboard', description: 'Sessions, requests, earnings, and mentee overview.', helpId: 'dashboard-mentor', helpTitle: 'How this mentor home works', helpTitleEl: 'Πώς δουλεύει ο πίνακας μέντορα', section: 'Work', audience: ['mentor'], status: 'complete' },
  { path: '/mentor/sessions', title: 'My sessions', description: 'Upcoming and past mentoring sessions.', helpId: 'mentor-sessions', helpTitle: 'Upcoming vs past sessions', helpTitleEl: 'Επερχόμενες και παρελθούσες συνεδρίες', section: 'Work', audience: ['mentor'], status: 'complete' },
  { path: '/mentor/requests', title: 'Mentee requests', description: 'Accept or decline new mentoring requests.', helpId: 'mentor-requests', helpTitle: 'How mentee requests work', helpTitleEl: 'Πώς λειτουργούν τα αιτήματα καθοδήγησης', section: 'Work', audience: ['mentor'], status: 'complete' },
  { path: '/mentoring', title: 'Find mentors', description: 'Directory of mentors — filter by expertise and availability.', helpId: 'mentoring', helpTitle: 'How to find and book a mentor', helpTitleEl: 'Πώς βρίσκετε μέντορα και κλείνετε συνεδρία', section: 'Explore', status: 'complete' },

  // ── Investor ──
  { path: '/dashboard/investor', title: 'Investor dashboard', description: 'Deal flow KPIs, pipeline snapshot, and watchlist.', helpId: 'dashboard-investor', helpTitle: 'How this investor home works', helpTitleEl: 'Πώς δουλεύει ο πίνακας επενδυτή', section: 'Work', audience: ['investor'], status: 'complete' },
  { path: '/investor/scouting', title: 'Scout startups', description: 'Search and filter startups by stage, sector, and traction.', helpId: 'investor-scouting', helpTitle: 'How scouting works', helpTitleEl: 'Πώς δουλεύει το scouting', section: 'Work', audience: ['investor'], status: 'partial' },
  { path: '/investor/pipeline', title: 'Pipeline', description: 'Kanban of deals from intro to term sheet.', helpId: 'investor-pipeline', helpTitle: 'How the deal pipeline works', helpTitleEl: 'Πώς δουλεύει το pipeline συμφωνιών', section: 'Work', audience: ['investor'], status: 'complete' },
  { path: '/investors', title: 'Investor directory', description: 'Discover angels, VCs, and syndicates on the platform.', helpId: 'investors', helpTitle: 'How the investor directory works', helpTitleEl: 'Πώς δουλεύει ο κατάλογος επενδυτών', section: 'Explore', status: 'complete' },

  // ── Provider ──
  { path: '/dashboard/provider', title: 'Provider dashboard', description: 'Services, inquiries, and active client projects.', section: 'Work', audience: ['service_provider'], status: 'complete' },
  { path: '/marketplace', title: 'Services marketplace', description: 'Browse legal, design, growth, and ops providers.', helpId: 'marketplace', helpTitle: 'How the marketplace works', helpTitleEl: 'Πώς δουλεύει η αγορά υπηρεσιών', section: 'Resources', status: 'complete' },

  // ── Organization ──
  { path: '/org/dashboard', title: 'Organization dashboard', description: 'Programs, cohorts, and portfolio health.', helpId: 'org-dashboard', helpTitle: 'How this organization home works', helpTitleEl: 'Πώς δουλεύει ο πίνακας οργανισμού', section: 'Work', audience: ['org'], status: 'complete' },
  { path: '/org/programs', title: 'Programs', description: 'Create, run, and review accelerator, bootcamp, and incubator programs.', helpId: 'org-programs', helpTitle: 'How programs are listed', helpTitleEl: 'Πώς εμφανίζονται τα προγράμματα', section: 'Work', audience: ['org'], status: 'complete' },
  { path: '/org/applications', title: 'Applications', description: 'Review and score startup applications across all your open programs.', helpId: 'org-applications', helpTitle: 'How application review works', helpTitleEl: 'Πώς δουλεύει η αξιολόγηση αιτήσεων', section: 'Work', audience: ['org'], status: 'complete' },
  { path: '/org/cohorts', title: 'Cohorts', description: 'Manage program cohorts, mentor coverage, and participant progress.', helpId: 'org-cohorts', helpTitle: 'How the cohort list works', helpTitleEl: 'Πώς δουλεύει η λίστα κύκλων', section: 'Work', audience: ['org'], status: 'complete' },
  { path: '/org/startups', title: 'Portfolio Startups', description: 'Startups currently in your programs and graduates.', helpId: 'org-startups', helpTitle: 'How the portfolio list works', helpTitleEl: 'Πώς δουλεύει η λίστα χαρτοφυλακίου', section: 'Work', audience: ['org'], status: 'complete' },
  { path: '/org/members', title: 'Team Members', description: 'Invite and manage who can run programs, review applications, and access settings.', helpId: 'org-members', helpTitle: 'How team members work', helpTitleEl: 'Πώς δουλεύουν τα μέλη ομάδας', section: 'Work', audience: ['org'], status: 'complete' },
  { path: '/org/mentors', title: 'Mentor Pool', description: 'Mentors available to your cohorts. Invite by email or onboard from directory.', helpId: 'org-mentors', helpTitle: 'How the mentor pool works', helpTitleEl: 'Πώς δουλεύει το pool μεντόρων', section: 'Work', audience: ['org'], status: 'complete' },
  { path: '/org/events', title: 'Organization Events', description: 'Demo days, office hours, workshops, and pitch nights for your cohorts.', helpId: 'org-events', helpTitle: 'How organization events work', helpTitleEl: 'Πώς δουλεύουν οι εκδηλώσεις οργανισμού', section: 'Work', audience: ['org'], status: 'complete' },
  { path: '/org/analytics', title: 'Org Analytics', description: 'Cohort health, program impact, application funnel, and member growth.', helpId: 'org-analytics', helpTitle: 'How to read org analytics', helpTitleEl: 'Πώς διαβάζονται τα αναλυτικά οργανισμού', section: 'Work', audience: ['org'], status: 'complete' },
  { path: '/org/settings', title: 'Organization Settings', description: 'Profile, branding, team, permissions, and billing for your organization.', helpId: 'org-settings', helpTitle: 'What these settings change', helpTitleEl: 'Τι αλλάζουν αυτές οι ρυθμίσεις', section: 'Work', audience: ['org'], status: 'complete' },

  // ── Tenant admin ──
  { path: '/tenant/dashboard', title: 'Tenant dashboard', description: 'White-label community overview and key metrics.', section: 'Tenant', audience: ['tenant_admin'], status: 'complete' },
  { path: '/tenant/branding', title: 'Branding', description: 'Customize colors, logos, fonts, and landing page copy. Work in draft, then publish to apply across your tenant.', helpId: 'tenant-branding', helpTitle: 'Tenant branding', helpTitleEl: 'Εταιρική ταυτότητα οργανισμού', section: 'Tenant', audience: ['tenant_admin'], status: 'complete' },
  { path: '/tenant/sso', title: 'SSO / Authentication', description: 'Configure SAML, OIDC, or Google Workspace SSO. Optional rules map IdP claims to roles.', section: 'Tenant', audience: ['tenant_admin'], status: 'complete' },
  { path: '/tenant/domains', title: 'Domain Management', description: 'Add a subdomain or connect a custom domain. SSL is provisioned automatically once DNS verifies.', section: 'Tenant', audience: ['tenant_admin'], status: 'complete' },
  { path: '/tenant/members', title: 'Tenant Members', description: 'Invite, role, and remove members for your workspace.', section: 'Tenant', audience: ['tenant_admin'], status: 'complete' },
  { path: '/tenant/programs', title: 'Tenant Programs', description: 'Workspaces with programs unlock applications, cohorts, and structured mentoring.', section: 'Tenant', audience: ['tenant_admin'], status: 'complete' },
  { path: '/tenant/automation', title: 'Automation', description: 'Event-driven workflows: triggers, conditions, actions for your workspace.', section: 'Tenant', audience: ['tenant_admin'], status: 'complete' },
  { path: '/tenant/webhooks', title: 'Webhooks', description: 'Push real-time events to Zapier, Slack, or any HTTPS endpoint.', section: 'Tenant', audience: ['tenant_admin'], status: 'complete' },
  { path: '/tenant/api-keys', title: 'API Keys', description: 'Grant programmatic access scoped to specific permissions. Rotate regularly.', section: 'Tenant', audience: ['tenant_admin'], status: 'complete' },
  { path: '/tenant/billing', title: 'Organization Billing', description: 'Plan, seats, invoices, and payment methods for your workspace.', section: 'Tenant', audience: ['tenant_admin'], status: 'complete' },
  { path: '/tenant/analytics', title: 'Tenant Analytics', description: 'Member growth, engagement, and program activity for your workspace.', section: 'Tenant', audience: ['tenant_admin'], status: 'complete' },
  { path: '/tenant/settings', title: 'Tenant Settings', description: 'General workspace settings: membership policy, notifications, and email preferences.', section: 'Tenant', audience: ['tenant_admin'], status: 'complete' },

  // ── Platform admin ──
  { path: '/admin', title: 'Admin console', description: 'Moderation queue, users, content, cohorts and the platform\'s operational tools.', helpId: 'admin-overview', helpTitle: 'What this console covers', helpTitleEl: 'Τι καλύπτει αυτή η κονσόλα', section: 'Admin', audience: ['platform_admin'], priority: 'critical', status: 'complete' },
  { path: '/admin/users', title: 'Users', description: 'Search and moderate platform accounts.', section: 'Admin', status: 'complete' },
  { path: '/admin/user-management', title: 'User management', description: 'Advanced filters, bulk actions, and verification controls.', helpId: 'admin-user-management', helpTitle: 'User management', helpTitleEl: 'Διαχείριση χρηστών', section: 'Admin', status: 'complete' },
  { path: '/admin/analytics', title: 'Global analytics', description: 'Growth, engagement, and financial platform metrics.', helpId: 'admin-analytics', helpTitle: 'Reading the analytics', helpTitleEl: 'Πώς διαβάζονται τα αναλυτικά', section: 'Admin', status: 'complete' },
  { path: '/admin/content-moderation', title: 'Content moderation', description: 'Review flagged posts, profiles, and media.', helpId: 'admin-content-moderation', helpTitle: 'Moderation queue', helpTitleEl: 'Ουρά εποπτείας', section: 'Admin', status: 'complete' },
  { path: '/admin/security-monitoring', title: 'Security monitoring', description: 'Auth events, anomalies, and audit trails.', helpId: 'admin-security', helpTitle: 'Security monitoring', helpTitleEl: 'Παρακολούθηση ασφάλειας', section: 'Admin', status: 'complete' },
  { path: '/admin/community-management', title: 'Community management', description: 'Inspect community health, growth, and flagged content.', helpId: 'admin-community-management', helpTitle: 'Community management', helpTitleEl: 'Διαχείριση κοινοτήτων', section: 'Admin', status: 'complete' },
  { path: '/admin/mentorship-management', title: 'Mentorship management', description: 'Approve mentors, review credentials, and monitor session quality.', helpId: 'admin-mentorship', helpTitle: 'Mentorship management', helpTitleEl: 'Διαχείριση καθοδήγησης', section: 'Admin', status: 'complete' },
  { path: '/admin/system-settings', title: 'System settings', description: 'Platform-wide toggles for maintenance, registration, and email.', helpId: 'admin-system-settings', helpTitle: 'System settings', helpTitleEl: 'Ρυθμίσεις συστήματος', section: 'Admin', status: 'complete' },
  // Without their own entry these fell through to `/admin` and each announced
  // itself as "Admin dashboard — platform-wide health", which is a different
  // page. Titles here match the heading each route already renders.
  { path: '/admin/dashboard', title: 'Platform overview', description: 'Users, activity, what waits on an admin, and API health.', section: 'Admin', audience: ['platform_admin'], status: 'complete' },
  { path: '/admin/audit-log', title: 'Audit log', description: 'Immutable record of administrative actions — who changed what, and when.', section: 'Admin', status: 'complete' },
  { path: '/admin/automations', title: 'Automation rules', description: 'Trigger-and-action rules that run without manual review.', section: 'Admin', status: 'complete' },
  { path: '/admin/billing', title: 'Billing administration', description: 'Platform revenue, invoices, and subscription states across all accounts.', section: 'Admin', status: 'complete' },
  { path: '/admin/communities', title: 'Communities', description: 'Every community on the platform, with membership and activity levels.', section: 'Admin', status: 'complete' },
  { path: '/admin/domains', title: 'Domain management', description: 'Verify and route custom domains for tenant workspaces.', section: 'Admin', status: 'complete' },
  { path: '/admin/feature-flags', title: 'Feature flags', description: 'Roll features out or back per environment without a deploy.', section: 'Admin', status: 'complete' },
  { path: '/admin/programs', title: 'Programs', description: 'Accelerators and cohorts platform-wide — approve, pause, or audit.', section: 'Admin', status: 'complete' },
  { path: '/admin/reports', title: 'Reports & moderation', description: 'User-submitted reports awaiting a moderation decision.', section: 'Admin', status: 'complete' },
  { path: '/admin/sso', title: 'SSO configuration', description: 'Identity providers, ACS endpoints, and test sign-in for enterprise tenants.', section: 'Admin', status: 'complete' },
  { path: '/admin/taxonomy', title: 'Taxonomy management', description: 'Skills, industries, and stage vocabularies that matching and search read from.', section: 'Admin', status: 'complete' },
  { path: '/admin/tenants', title: 'Tenant management', description: 'Provision, suspend, and inspect tenant workspaces.', section: 'Admin', status: 'complete' },

  // ── Account ──
  { path: '/profile', title: 'My Profile', description: 'This is exactly how others see you. Keep skills, headline, and bio current \u2014 it powers matches and search.', section: 'Account', status: 'complete' },
  { path: '/profile/edit', title: 'Edit profile', description: 'Update photo, bio, skills, and visibility settings. Changes save automatically as you type.', section: 'Account', status: 'partial' },
  { path: '/settings', title: 'Settings', description: 'Manage billing, notifications, integrations, and privacy.', helpId: 'settings', helpTitle: 'Settings overview', helpTitleEl: 'Επισκόπηση ρυθμίσεων', section: 'Account', priority: 'high', status: 'complete' },
  // Each settings sub-page previously inherited the hub's "Manage billing,
  // notifications, integrations, and privacy" line, so all four described the
  // same four things instead of the one the user actually opened.
  { path: '/settings/ai', title: 'AI assistant', description: 'Choose the model and default agent that answer your questions across the platform.', section: 'Account', status: 'complete' },
  { path: '/settings/billing', title: 'Plan & billing', description: 'Your current plan, what it includes, and where invoices are sent.', section: 'Account', status: 'complete' },
  { path: '/settings/notifications', title: 'Notification preferences', description: 'Pick which events reach you by email and how often digests arrive.', section: 'Account', status: 'complete' },
  { path: '/settings/data-export', title: 'Data export', description: 'Download a copy of your profile, messages, and activity.', section: 'Account', status: 'complete' },
  { path: '/notifications', title: 'Notifications', description: 'Activity alerts — matches, messages, and program updates.', section: 'Account', status: 'complete' },
  { path: '/achievements', title: 'Achievements', description: 'Badges and XP earned from platform activity.', helpId: 'achievements', helpTitle: 'How XP and badges work', helpTitleEl: 'Πώς δουλεύουν τα XP και τα σήματα', section: 'Account', status: 'complete' },
  { path: '/help', title: 'Help & support', description: 'Guides, FAQs, and contact options.', section: 'Resources', status: 'complete' },

  // ── Programs, jobs, marketplace, community ──
  { path: '/jobs', title: 'Jobs & roles', description: 'Equity, full-time, and contract roles posted by startups on the platform.', helpId: 'jobs', helpTitle: 'How jobs work here', helpTitleEl: 'Πώς δουλεύουν οι θέσεις εδώ', section: 'Resources', status: 'complete' },
  { path: '/opportunities', title: 'Opportunities', description: 'Co-founder calls, paid gigs, equity roles, and short-term collaborations in one feed.', helpId: 'opportunities', helpTitle: 'How opportunities work', helpTitleEl: 'Πώς δουλεύουν οι ευκαιρίες', section: 'Resources', status: 'complete' },
  { path: '/events', title: 'Events', description: 'Workshops, demo days, meetups, and online sessions \u2014 RSVP and add to calendar.', section: 'Resources', status: 'complete' },
  { path: '/events/[id]', title: 'Event', titleEl: 'Εκδήλωση', description: 'One event: when, where, who hosts it, and your RSVP.', descriptionEl: 'Μία εκδήλωση: πότε, πού, ποιος τη διοργανώνει και η απάντησή σας.', section: 'Resources', status: 'complete' },
  { path: '/events/create', title: 'Create event', description: 'Publish a workshop, demo day, or meetup for the community to RSVP to.', section: 'Resources', status: 'complete' },
  { path: '/learning', title: 'Learning hub', description: 'Curated courses, founder guides, and templates aligned with your readiness gaps.', helpId: 'learning', helpTitle: 'How the learning hub works', helpTitleEl: 'Πώς δουλεύει το κέντρο μάθησης', section: 'Resources', status: 'complete' },
  { path: '/groups', title: 'Communities', description: 'Industry, stage, and interest-based groups. Join to participate; create your own anytime.', helpId: 'groups', helpTitle: 'How communities work', helpTitleEl: 'Πώς δουλεύουν οι κοινότητες', section: 'Community', status: 'complete' },
  { path: '/feed', title: 'Feed', description: 'Updates from your network, communities, and people you follow. Sample posts appear only when the live feed is empty.', helpId: 'feed', helpTitle: 'What the feed is', helpTitleEl: 'Τι είναι το feed', section: 'Community', status: 'complete' },
  { path: '/mentoring', title: 'Find mentors', description: 'Directory of vetted mentors \u2014 filter by expertise, timezone, and rate.', helpId: 'mentoring', helpTitle: 'How to find and book a mentor', helpTitleEl: 'Πώς βρίσκετε μέντορα και κλείνετε συνεδρία', section: 'Explore', status: 'complete' },

  // ── Mentor sub-pages ──

  // ── Investor sub-pages ──

  // ── Provider sub-pages ──

  // ── Ten routes that shipped without an entry here ──
  //    Each passes its own `title`/`description` to AppShell, so the header
  //    rendered — but `getPageMeta` returned undefined for the path, and with
  //    it went the Greek half: `getPageMetaEl` is only consulted for a route
  //    the registry knows. Ten founder-reachable pages therefore had an
  //    English-only heading on a bilingual product, and the help and
  //    assistant surfaces that read this registry could not see them at all.
  { path: '/activity', title: 'Activity Feed', titleEl: 'Ροή δραστηριότητας', description: 'Track your network activity, notifications, and events.', descriptionEl: 'Δραστηριότητα δικτύου, ειδοποιήσεις και εκδηλώσεις σε ένα σημείο.', helpId: 'activity', helpTitle: 'What each tab shows', helpTitleEl: 'Τι δείχνει κάθε καρτέλα', section: 'Account', status: 'complete' },
  { path: '/ai', title: 'AI Assistant', titleEl: 'Βοηθός AI', description: 'Ask about your active workspace, review evidence, and approve proposed changes before they run.', descriptionEl: 'Ρωτήστε για τον ενεργό χώρο εργασίας, ελέγξτε τα στοιχεία και εγκρίνετε τις προτεινόμενες αλλαγές πριν εκτελεστούν.', helpId: 'ai', helpTitle: 'What the assistant can do here', helpTitleEl: 'Τι μπορεί να κάνει ο βοηθός εδώ', section: 'Work', priority: 'critical', status: 'complete' },
  { path: '/ai/capabilities', title: 'What the assistant can do', titleEl: 'Τι μπορεί να κάνει ο βοηθός', description: 'Every read and write the assistant can perform, generated from the shared capability contract. The sample asks are example phrasings with an example name.', descriptionEl: 'Κάθε ανάγνωση και εγγραφή που μπορεί να κάνει ο βοηθός, παραγόμενη από το κοινό συμβόλαιο δυνατοτήτων. Τα δείγματα είναι παραδείγματα διατύπωσης με ενδεικτικό όνομα.', section: 'Work', status: 'complete' },
  { path: '/compare', title: 'Compare Profiles', description: 'Side-by-side comparison to find your best match. Tip: bookmark a /matches/compare URL with profile ids to share.', section: 'Explore', status: 'complete' },
  { path: '/expert-reviews', title: 'Expert Reviews', description: 'Structured feedback on your pitch, financials, and strategy from domain experts.', helpId: 'expert-reviews', helpTitle: 'How expert reviews work', helpTitleEl: 'Πώς λειτουργούν οι αξιολογήσεις ειδικών', section: 'Resources', status: 'complete' },
  { path: '/invite', title: 'Invite People', description: 'Grow your network by inviting co-founders, mentors, and investors.', section: 'Community', status: 'complete' },
  { path: '/members', title: 'Member Directory', description: 'Discover and connect with members across the platform.', section: 'Explore', status: 'complete' },
  { path: '/programs', title: 'Programs', description: 'Accelerators, incubators, bootcamps, and competitions to grow your startup.', helpId: 'programs', helpTitle: 'How programs work', helpTitleEl: 'Πώς δουλεύουν τα προγράμματα', section: 'Resources', status: 'complete' },
  { path: '/programs/[id]', title: 'Program', titleEl: 'Πρόγραμμα', description: 'One accelerator or incubator programme: dates, capacity, and how to apply.', descriptionEl: 'Ένα πρόγραμμα επιτάχυνσης ή θερμοκοιτίδας: ημερομηνίες, θέσεις και πώς να κάνετε αίτηση.', section: 'Resources', status: 'complete' },
  { path: '/startups/[id]', title: 'Startup', titleEl: 'Startup', description: 'A startup on your deal board: its stage, notes and history.', descriptionEl: 'Μια startup στον πίνακα συμφωνιών σας: στάδιο, σημειώσεις και ιστορικό.', section: 'Work', status: 'complete' },
  { path: '/referrals', title: 'Referral Program', description: 'Invite friends and earn rewards when they join CoFounderBay.', section: 'Community', status: 'complete' },
  { path: '/reputation', title: 'Reputation Score', description: 'Your trust and credibility on CoFounderBay.', section: 'Account', status: 'complete' },
  { path: '/saved-searches', title: 'Saved Searches', description: 'Manage your saved search filters and get notified of new matches.', section: 'Explore', status: 'complete' },

  // ── The 49 routes the registry did not know ──────────────────────────────
  // `navigate` is a declared assistant capability and `getPageMeta` is what
  // gives the header, the breadcrumb and the assistant a page's identity. A
  // route missing from here is a route the assistant cannot offer to open,
  // cannot describe when asked "what is this page", and cannot weigh when
  // deciding what to suggest next — a third of the product was in that state.
  // `pageRegistryCoverage.test.ts` fails if a new `page.tsx` lands without an
  // entry, so the gap cannot reopen quietly.

  // Mentor
  { path: '/mentor/dashboard', title: 'Mentor dashboard', titleEl: 'Πίνακας μέντορα', description: 'Your mentees, sessions and earnings at a glance.', descriptionEl: 'Οι μαθητευόμενοι, οι συνεδρίες και τα έσοδά σας με μια ματιά.', helpId: 'dashboard-mentor', helpTitle: 'How this mentor home works', helpTitleEl: 'Πώς δουλεύει ο πίνακας μέντορα', section: 'Work', audience: ['mentor'], priority: 'critical', status: 'complete' },
  { path: '/mentor/mentees', title: 'Mentees', titleEl: 'Μαθητευόμενοι', description: 'The founders you are mentoring, and where each one stands.', descriptionEl: 'Οι ιδρυτές που καθοδηγείτε και σε ποιο σημείο βρίσκεται ο καθένας.', helpId: 'mentor-mentees', helpTitle: 'How the mentee list works', helpTitleEl: 'Πώς λειτουργεί η λίστα καθοδηγούμενων', section: 'Work', audience: ['mentor'], status: 'complete' },
  { path: '/mentor/availability', title: 'Availability', titleEl: 'Διαθεσιμότητα', description: 'The hours you can be booked for sessions.', descriptionEl: 'Οι ώρες που μπορείτε να κλείσετε συνεδρίες.', helpId: 'mentor-availability', helpTitle: 'How booking hours work', helpTitleEl: 'Πώς δουλεύουν οι ώρες κράτησης', section: 'Work', audience: ['mentor'], status: 'complete' },
  { path: '/mentor/earnings', title: 'Earnings', titleEl: 'Έσοδα', description: 'Payouts, pending balance and session history.', descriptionEl: 'Πληρωμές, εκκρεμές υπόλοιπο και ιστορικό συνεδριών.', helpId: 'mentor-earnings', helpTitle: 'How earnings are counted', helpTitleEl: 'Πώς μετρώνται τα έσοδα', section: 'Work', audience: ['mentor'], status: 'complete' },
  { path: '/mentor/reviews', title: 'Reviews', titleEl: 'Κριτικές', description: 'What the founders you have mentored said afterwards.', descriptionEl: 'Τι είπαν οι ιδρυτές που καθοδηγήσατε.', helpId: 'mentor-reviews', helpTitle: 'How mentor reviews work', helpTitleEl: 'Πώς δουλεύουν οι κριτικές μέντορα', section: 'Work', audience: ['mentor'], status: 'complete' },
  { path: '/mentor/profile', title: 'Mentor profile', titleEl: 'Προφίλ μέντορα', description: 'Your expertise, rates and the founders you want to reach.', descriptionEl: 'Η εξειδίκευσή σας, οι χρεώσεις και οι ιδρυτές που θέλετε να προσεγγίσετε.', helpId: 'mentor-profile', helpTitle: 'What founders see on your listing', helpTitleEl: 'Τι βλέπουν οι ιδρυτές στην καταχώρισή σας', section: 'Account', audience: ['mentor'], status: 'complete' },

  // Investor
  { path: '/investor/dashboard', title: 'Investor dashboard', titleEl: 'Πίνακας επενδυτή', description: 'Deal flow, portfolio and the founders on your watchlist.', descriptionEl: 'Ροή συμφωνιών, χαρτοφυλάκιο και οι ιδρυτές στη λίστα παρακολούθησης.', helpId: 'dashboard-investor', helpTitle: 'How this investor home works', helpTitleEl: 'Πώς δουλεύει ο πίνακας επενδυτή', section: 'Work', audience: ['investor'], priority: 'critical', status: 'complete' },
  { path: '/investor/portfolio', title: 'Portfolio', titleEl: 'Χαρτοφυλάκιο', description: 'The companies you have invested in and how they are tracking.', descriptionEl: 'Οι εταιρείες στις οποίες επενδύσατε και η πορεία τους.', helpId: 'investor-portfolio', helpTitle: 'How the portfolio list works', helpTitleEl: 'Πώς δουλεύει η λίστα χαρτοφυλακίου', section: 'Work', audience: ['investor'], status: 'complete' },
  { path: '/investor/watchlist', title: 'Watchlist', titleEl: 'Λίστα παρακολούθησης', description: 'Founders and startups you are following before committing.', descriptionEl: 'Ιδρυτές και startups που παρακολουθείτε πριν δεσμευτείτε.', helpId: 'investor-watchlist', helpTitle: 'How the watchlist works', helpTitleEl: 'Πώς δουλεύει η λίστα παρακολούθησης', section: 'Work', audience: ['investor'], status: 'complete' },
  { path: '/investor/analytics', title: 'Investor analytics', titleEl: 'Αναλυτικά επενδυτή', description: 'Deal flow trends, sector exposure and response rates.', descriptionEl: 'Τάσεις ροής συμφωνιών, έκθεση ανά κλάδο και ποσοστά απόκρισης.', helpId: 'investor-analytics', helpTitle: 'How to read investor analytics', helpTitleEl: 'Πώς διαβάζονται τα αναλυτικά επενδυτή', section: 'Work', audience: ['investor'], status: 'complete' },

  // Service provider
  { path: '/provider/dashboard', title: 'Provider dashboard', titleEl: 'Πίνακας παρόχου', description: 'Inquiries, active projects and revenue.', descriptionEl: 'Αιτήματα, ενεργά έργα και έσοδα.', section: 'Work', audience: ['service_provider'], priority: 'critical', status: 'complete' },
  { path: '/provider/services', title: 'Services', titleEl: 'Υπηρεσίες', description: 'What you offer, how it is priced and what is currently bookable.', descriptionEl: 'Τι προσφέρετε, πώς τιμολογείται και τι είναι διαθέσιμο.', section: 'Work', audience: ['service_provider'], status: 'complete' },
  { path: '/provider/inquiries', title: 'Inquiries', titleEl: 'Αιτήματα', description: 'Founders who asked about your services and are waiting on you.', descriptionEl: 'Ιδρυτές που ρώτησαν για τις υπηρεσίες σας και περιμένουν απάντηση.', section: 'Work', audience: ['service_provider'], status: 'complete' },
  { path: '/provider/projects', title: 'Projects', titleEl: 'Έργα', description: 'Engagements in progress and what each one is waiting on.', descriptionEl: 'Συνεργασίες σε εξέλιξη και τι εκκρεμεί σε καθεμία.', section: 'Work', audience: ['service_provider'], status: 'complete' },
  { path: '/provider/reviews', title: 'Provider reviews', titleEl: 'Κριτικές παρόχου', description: 'What clients said after working with you.', descriptionEl: 'Τι είπαν οι πελάτες μετά τη συνεργασία.', section: 'Work', audience: ['service_provider'], status: 'complete' },
  { path: '/provider/analytics', title: 'Provider analytics', titleEl: 'Αναλυτικά παρόχου', description: 'Views, inquiry conversion and revenue over time.', descriptionEl: 'Προβολές, μετατροπή αιτημάτων και έσοδα διαχρονικά.', section: 'Work', audience: ['service_provider'], status: 'complete' },
  { path: '/provider/profile', title: 'Provider profile', titleEl: 'Προφίλ παρόχου', description: 'Your company, specialisms and portfolio.', descriptionEl: 'Η εταιρεία, οι εξειδικεύσεις και το χαρτοφυλάκιό σας.', section: 'Account', audience: ['service_provider'], status: 'complete' },

  // Incubator / organization
  { path: '/dashboard', title: 'Dashboard', titleEl: 'Πίνακας ελέγχου', description: 'Your workspace home — it opens the dashboard for your role.', descriptionEl: 'Η αρχική του χώρου σας — ανοίγει τον πίνακα του ρόλου σας.', section: 'Work', priority: 'critical', status: 'complete' },
  { path: '/dashboard/incubator', title: 'Incubator dashboard', titleEl: 'Πίνακας θερμοκοιτίδας', description: 'Cohorts, applications and the milestones your startups are hitting.', descriptionEl: 'Κύκλοι, αιτήσεις και τα ορόσημα των startups σας.', helpId: 'org-dashboard', helpTitle: 'How this organization home works', helpTitleEl: 'Πώς δουλεύει ο πίνακας οργανισμού', section: 'Work', audience: ['org'], priority: 'critical', status: 'complete' },
  { path: '/org/[slug]', title: 'Organization', titleEl: 'Οργανισμός', description: 'An organization\u2019s public page — programs, cohorts and members.', descriptionEl: 'Η δημόσια σελίδα ενός οργανισμού — προγράμματα, κύκλοι και μέλη.', section: 'Explore', status: 'complete' },
  { path: '/org/[slug]/admin', title: 'Organization admin', titleEl: 'Διαχείριση οργανισμού', description: 'Manage this organization\u2019s programs, cohorts, members and branding.', descriptionEl: 'Διαχειριστείτε προγράμματα, κύκλους, μέλη και branding.', helpId: 'org-admin', helpTitle: 'What you can manage here', helpTitleEl: 'Τι μπορείτε να διαχειριστείτε εδώ', section: 'Work', audience: ['org'], status: 'complete' },
  { path: '/org/cohorts/[id]', title: 'Cohort', titleEl: 'Κύκλος', description: 'A single cohort — its startups, schedule and progress.', descriptionEl: 'Ένας κύκλος — startups, πρόγραμμα και πρόοδος.', helpId: 'cohort-detail', helpTitle: 'How to read this cohort', helpTitleEl: 'Πώς να διαβάσετε αυτόν τον κύκλο', section: 'Work', audience: ['org'], status: 'complete' },
  { path: '/t/[slug]', title: 'Tenant workspace', titleEl: 'Χώρος οργανισμού', description: 'A white-labelled workspace on its own subdomain or path.', descriptionEl: 'Χώρος εργασίας με δική του επωνυμία, σε υποτομέα ή διαδρομή.', section: 'Work', status: 'complete' },
  { path: '/admin/user-detail/[id]', title: 'User detail', titleEl: 'Στοιχεία χρήστη', description: 'Everything the platform knows about one account, and the actions you can take on it.', descriptionEl: 'Ό,τι γνωρίζει η πλατφόρμα για έναν λογαριασμό και οι ενέργειες που μπορείτε να κάνετε.', section: 'Admin', audience: ['admin'], status: 'complete' },

  // Community and profiles
  { path: '/endorsements', title: 'Endorsements', titleEl: 'Συστάσεις', description: 'Vouches you have given and received, and who is waiting on one.', descriptionEl: 'Συστάσεις που δώσατε και λάβατε, και ποιος περιμένει μία.', section: 'Community', status: 'complete' },
  { path: '/coaching', title: 'Coaching', titleEl: 'Καθοδήγηση', description: 'Book time with mentors and see your upcoming sessions.', descriptionEl: 'Κλείστε χρόνο με μέντορες και δείτε τις επόμενες συνεδρίες σας.', section: 'Resources', status: 'complete' },
  { path: '/groups/[groupId]', title: 'Group', titleEl: 'Ομάδα', description: 'A community group — its posts, members and events.', descriptionEl: 'Μια ομάδα — αναρτήσεις, μέλη και εκδηλώσεις.', section: 'Community', status: 'complete' },
  { path: '/groups/manage', title: 'Manage group', titleEl: 'Διαχείριση ομάδας', description: 'Settings, membership and permissions for a group you run.', descriptionEl: 'Ρυθμίσεις, μέλη και δικαιώματα για ομάδα που διαχειρίζεστε.', section: 'Community', status: 'complete' },
  { path: '/groups/moderation', title: 'Group moderation', titleEl: 'Συντονισμός ομάδας', description: 'Reported posts and pending members awaiting a decision.', descriptionEl: 'Αναφερθείσες αναρτήσεις και μέλη σε αναμονή απόφασης.', section: 'Community', status: 'complete' },
  { path: '/profiles/[userId]', title: 'Profile', titleEl: 'Προφίλ', description: 'Someone\u2019s full profile — background, skills and what they are looking for.', descriptionEl: 'Το πλήρες προφίλ κάποιου — υπόβαθρο, δεξιότητες και τι αναζητά.', section: 'Explore', status: 'complete' },
  { path: '/p/[username]', title: 'Public profile', titleEl: 'Δημόσιο προφίλ', description: 'A shareable profile page that works without signing in.', descriptionEl: 'Σελίδα προφίλ που μοιράζεται και λειτουργεί χωρίς σύνδεση.', section: 'Public', status: 'complete' },
  { path: '/matches/[userId]', title: 'Match detail', titleEl: 'Λεπτομέρειες αντιστοίχισης', description: 'Why you and this person were matched, factor by factor.', descriptionEl: 'Γιατί αντιστοιχιστήκατε με αυτό το άτομο, παράγοντα προς παράγοντα.', section: 'Explore', status: 'complete' },

  // Workspace artifacts
  { path: '/research/canvas', title: 'Research canvas', titleEl: 'Καμβάς έρευνας', description: 'Map a problem, hypotheses and evidence on an open canvas.', descriptionEl: 'Χαρτογραφήστε πρόβλημα, υποθέσεις και ευρήματα σε ανοιχτό καμβά.', section: 'Work', status: 'complete' },
  { path: '/research/[boardId]', title: 'Research board', titleEl: 'Πίνακας έρευνας', description: 'One research board and everything pinned to it.', descriptionEl: 'Ένας πίνακας έρευνας και ό,τι είναι καρφιτσωμένο πάνω του.', section: 'Work', status: 'complete' },
  { path: '/projects/[projectId]', title: 'Project', titleEl: 'Έργο', description: 'A project\u2019s tasks, collaborators and files.', descriptionEl: 'Οι εργασίες, οι συνεργάτες και τα αρχεία ενός έργου.', section: 'Work', status: 'complete' },
  { path: '/commitments/[id]', title: 'Need card', titleEl: 'Κάρτα ανάγκης', description: 'One need card: what exists, the outcome, who is missing and what is offered, with each response on its ladder.', descriptionEl: 'Μία κάρτα ανάγκης: τι υπάρχει, το αποτέλεσμα, ποιος λείπει και τι προσφέρεται, με κάθε απάντηση στην κλίμακά της.', helpId: 'commitments', helpTitle: 'How commitments work', helpTitleEl: 'Πώς λειτουργούν οι δεσμεύσεις', section: 'Work', status: 'complete' },
  { path: '/c/[token]', title: 'Need card', titleEl: 'Κάρτα ανάγκης', description: 'A need card shared by its author: no email or phone, and a way to join and respond.', descriptionEl: 'Κάρτα ανάγκης που μοιράστηκε ο συντάκτης της: χωρίς email ή τηλέφωνο, με τρόπο εγγραφής και απάντησης.', section: 'Public', status: 'complete' },
  { path: '/u/[token]', title: 'Founder update', titleEl: 'Ενημέρωση ιδρυτή', description: 'An update its author made public: the founder\u2019s name and headline, and nothing that reaches them outside the platform.', descriptionEl: 'Ενημέρωση που ο συντάκτης της έκανε δημόσια: όνομα και τίτλος του ιδρυτή, και τίποτα που τον φτάνει εκτός πλατφόρμας.', section: 'Public', status: 'complete' },
  { path: '/pitch/[id]', title: 'Pitch deck', titleEl: 'Παρουσίαση', description: 'A deck in the builder — slides, notes and sharing.', descriptionEl: 'Μια παρουσίαση στον builder — διαφάνειες, σημειώσεις και κοινοποίηση.', helpId: 'public-pitch', helpTitle: 'Reading this pitch', helpTitleEl: 'Πώς διαβάζεται αυτό το pitch', section: 'Work', status: 'complete' },
  { path: '/data-room/[id]', title: 'Data room', titleEl: 'Data room', description: 'Documents shared with investors, and who has opened what.', descriptionEl: 'Έγγραφα που μοιράζεστε με επενδυτές και ποιος άνοιξε τι.', helpId: 'data-room', helpTitle: 'How the data room works', helpTitleEl: 'Πώς δουλεύει το data room', section: 'Work', status: 'complete' },
  { path: '/share/[token]', title: 'Shared link', titleEl: 'Κοινόχρηστος σύνδεσμος', description: 'Something shared with you through a link.', descriptionEl: 'Κάτι που μοιράστηκε μαζί σας μέσω συνδέσμου.', section: 'Public', status: 'complete' },

  // Auth and system
  { path: '/forgot-password', title: 'Reset your password', titleEl: 'Επαναφορά κωδικού', description: 'We will email you a link to set a new password.', descriptionEl: 'Θα σας στείλουμε σύνδεσμο για νέο κωδικό.', section: 'Auth', status: 'complete' },
  { path: '/reset-password', title: 'Set a new password', titleEl: 'Ορισμός νέου κωδικού', description: 'Choose a new password for your account.', descriptionEl: 'Επιλέξτε νέο κωδικό για τον λογαριασμό σας.', section: 'Auth', status: 'complete' },
  { path: '/auth/verify-email', title: 'Verify your email', titleEl: 'Επιβεβαίωση email', description: 'Confirm your address so we can reach you.', descriptionEl: 'Επιβεβαιώστε τη διεύθυνσή σας για να μπορούμε να επικοινωνούμε.', section: 'Auth', status: 'complete' },
  { path: '/auth/oauth-callback', title: 'Signing you in', titleEl: 'Γίνεται σύνδεση', description: 'Completing sign-in with your provider.', descriptionEl: 'Ολοκλήρωση σύνδεσης με τον πάροχό σας.', section: 'Auth', status: 'complete' },
  { path: '/auth/sso-complete', title: 'Single sign-on', titleEl: 'Ενιαία σύνδεση', description: 'Finishing your organization sign-in.', descriptionEl: 'Ολοκλήρωση σύνδεσης μέσω του οργανισμού σας.', section: 'Auth', status: 'complete' },
  { path: '/terms', title: 'Terms of Service', titleEl: 'Όροι χρήσης', description: 'The agreement between you and CoFounderBay.', descriptionEl: 'Η συμφωνία ανάμεσα σε εσάς και το CoFounderBay.', section: 'Public', status: 'complete' },
  { path: '/privacy', title: 'Privacy Policy', titleEl: 'Πολιτική απορρήτου', description: 'What we collect, why, and what you can ask us to delete.', descriptionEl: 'Τι συλλέγουμε, γιατί, και τι μπορείτε να ζητήσετε να διαγραφεί.', section: 'Public', status: 'complete' },
  { path: '/transparency', title: 'Transparency report', titleEl: 'Αναφορά διαφάνειας', description: 'What the safety rules refused and what members reported, per half year.', descriptionEl: 'Τι απέρριψαν οι κανόνες ασφαλείας και τι ανέφεραν τα μέλη, ανά εξάμηνο.', section: 'Public', status: 'complete' },
  { path: '/api-status', title: 'API status', titleEl: 'Κατάσταση API', description: 'Whether the backend is reachable, and what is degraded.', descriptionEl: 'Αν το backend είναι προσβάσιμο και τι λειτουργεί μειωμένα.', section: 'Account', status: 'complete' },
  { path: '/unauthorized', title: 'No access', titleEl: 'Χωρίς πρόσβαση', description: 'Shown when your roles do not include what a page needs, with the ways to get it.', descriptionEl: 'Εμφανίζεται όταν οι ρόλοι σας δεν καλύπτουν τη σελίδα, με τους τρόπους να αποκτήσετε πρόσβαση.', section: 'Account', status: 'complete' },
  { path: '/demo', title: 'Demo', titleEl: 'Επίδειξη', description: 'A guided tour of the product with sample data.', descriptionEl: 'Ξενάγηση στο προϊόν με δείγμα δεδομένων.', section: 'Public', status: 'complete' },
  { path: '/themes/alliance', title: 'Alliance theme', titleEl: 'Θέμα Alliance', description: 'Preview of the Alliance palette across the design system.', descriptionEl: 'Προεπισκόπηση της παλέτας Alliance στο design system.', section: 'Account', status: 'partial' },
  { path: '/test-onboarding', title: 'Onboarding preview', titleEl: 'Προεπισκόπηση onboarding', description: 'Internal preview of the onboarding flow.', descriptionEl: 'Εσωτερική προεπισκόπηση της ροής onboarding.', section: 'Account', status: 'scaffold' },
];

const DYNAMIC_PATTERNS: Array<{ pattern: RegExp; meta: Omit<PageMeta, 'path'> & { path?: string } }> = [
  {
    // /commitments/new is an exact registry entry and matches before this.
    pattern: /^\/commitments\/[^/]+$/,
    meta: {
      title: 'Need card',
      titleEl: 'Κάρτα ανάγκης',
      description: 'What exists, the outcome, who is missing and what is offered, with each response on its ladder.',
      descriptionEl: 'Τι υπάρχει, το αποτέλεσμα, ποιος λείπει και τι προσφέρεται, με κάθε απάντηση στην κλίμακά της.',
      helpId: 'commitments',
      helpTitle: 'How commitments work',
      helpTitleEl: 'Πώς λειτουργούν οι δεσμεύσεις',
      section: 'Work',
      status: 'complete',
    },
  },
  {
    pattern: /^\/c\/[^/]+$/,
    meta: {
      title: 'Need card',
      titleEl: 'Κάρτα ανάγκης',
      description: 'A need card shared by its author: no email or phone, and a way to join and respond.',
      descriptionEl: 'Κάρτα ανάγκης που μοιράστηκε ο συντάκτης της: χωρίς email ή τηλέφωνο, με τρόπο εγγραφής και απάντησης.',
      section: 'Public',
      status: 'complete',
    },
  },
  {
    pattern: /^\/u\/[^/]+$/,
    meta: {
      title: 'Founder update',
      titleEl: 'Ενημέρωση ιδρυτή',
      description: 'An update its author made public: the founder\u2019s name and headline, and nothing that reaches them outside the platform.',
      descriptionEl: 'Ενημέρωση που ο συντάκτης της έκανε δημόσια: όνομα και τίτλος του ιδρυτή, και τίποτα που τον φτάνει εκτός πλατφόρμας.',
      section: 'Public',
      status: 'complete',
    },
  },
  {
    pattern: /^\/matches\/[^/]+$/,
    meta: {
      title: 'Match detail',
      description: 'Compatibility breakdown and suggested next steps with this person.',
      section: 'Explore',
      status: 'complete',
    },
  },
  {
    pattern: /^\/profiles\/[^/]+$/,
    meta: {
      title: 'Member profile',
      description: 'Public profile — connect, message, or save to shortlist.',
      section: 'Explore',
      status: 'complete',
    },
  },
  {
    pattern: /^\/admin\/user-detail\/[^/]+$/,
    meta: {
      title: 'User detail',
      description: 'Full admin view — activity, moderation history, and account controls.',
      section: 'Admin',
      status: 'complete',
    },
  },
  {
    pattern: /^\/research\/[^/]+$/,
    meta: {
      title: 'Research canvas',
      description: 'Collaborative whiteboard for startup research.',
      section: 'Work',
      status: 'complete',
    },
  },
  {
    pattern: /^\/groups\/[^/]+$/,
    meta: {
      title: 'Community',
      description: 'Posts, members, and events for this group.',
      section: 'Community',
      status: 'complete',
    },
  },
  // `/projects/create` is matched exactly above, so this pattern only ever sees
  // a real project id.
  {
    pattern: /^\/projects\/(?!create$)[^/]+$/,
    meta: {
      title: 'Project',
      description: 'Overview, open roles, team, milestones, and updates for this project.',
      helpId: 'projects',
      helpTitle: 'How projects work',
      helpTitleEl: 'Πώς δουλεύουν τα έργα',
      section: 'Work',
      status: 'complete',
    },
  },
  {
    pattern: /^\/org\/cohorts\/[^/]+$/,
    meta: {
      title: 'Cohort',
      description: 'Participants, mentor coverage, and recent matches for this cohort.',
      helpId: 'cohort-detail',
      helpTitle: 'How to read this cohort',
      helpTitleEl: 'Πώς να διαβάσετε αυτόν τον κύκλο',
      section: 'Work',
      status: 'complete',
    },
  },
  {
    pattern: /^\/pitch\/[^/]+$/,
    meta: {
      title: 'Public pitch',
      description: 'Investor-facing deck. Views are counted; contact goes to the founder, not a public inbox.',
      helpId: 'public-pitch',
      helpTitle: 'Reading this pitch',
      helpTitleEl: 'Πώς διαβάζεται αυτό το pitch',
      section: 'Work',
      status: 'complete',
    },
  },
  {
    pattern: /^\/data-room\/[^/]+$/,
    meta: {
      title: 'Investor data room',
      description: 'Private documents for diligence. Share access per investor; nothing here is public.',
      helpId: 'data-room',
      helpTitle: 'How the data room works',
      helpTitleEl: 'Πώς δουλεύει το data room',
      section: 'Work',
      status: 'complete',
    },
  },
];

/** Resolve metadata for the current pathname (exact match first, then dynamic). */
export function getPageMeta(pathname: string): PageMeta | undefined {
  const normalized = pathname.replace(/\/$/, '') || '/';
  const exact = PAGE_REGISTRY.find((p) => p.path === normalized);
  let meta: PageMeta | undefined;

  if (exact) {
    meta = exact;
  } else {
    for (const { pattern, meta: dynamicMeta } of DYNAMIC_PATTERNS) {
      if (pattern.test(normalized)) {
        meta = { path: normalized, ...dynamicMeta };
        break;
      }
    }

    if (!meta) {
      const sorted = [...PAGE_REGISTRY].sort((a, b) => b.path.length - a.path.length);
      for (const entry of sorted) {
        if (entry.path !== '/' && normalized.startsWith(entry.path)) {
          meta = { ...entry, path: normalized };
          break;
        }
      }
    }
  }

  if (!meta) return undefined;

  const el = getPageMetaEl(normalized);
  if (!el) return meta;

  return {
    ...meta,
    titleEl: meta.titleEl ?? el.title,
    descriptionEl: meta.descriptionEl ?? el.description,
  };
}

export type PageMetaOverrides = Partial<Pick<PageMeta, 'title' | 'description' | 'titleEl' | 'descriptionEl'>>;

/** Merge explicit AppShell props with registry defaults. */
export function resolvePageHeader(
  pathname: string,
  overrides?: PageMetaOverrides,
): { title?: string; titleEl?: string; description?: string; descriptionEl?: string; meta?: PageMeta } {
  const meta = getPageMeta(pathname);
  const titleIsCustom = Boolean(overrides?.title) && overrides?.title !== meta?.title;
  const descriptionIsCustom =
    Boolean(overrides?.description) && overrides?.description !== meta?.description;
  return {
    title: overrides?.title ?? meta?.title,
    // Drop registry Greek only when the English title is a different string
    // (a person's name). Pages that pass the registry English title still
    // need titleEl — otherwise Analytics/Projects/Fundraising rendered EN-only.
    titleEl: overrides?.titleEl ?? (titleIsCustom ? undefined : meta?.titleEl),
    description: overrides?.description ?? meta?.description,
    descriptionEl: overrides?.descriptionEl ?? (descriptionIsCustom ? undefined : meta?.descriptionEl),
    meta,
  };
}
