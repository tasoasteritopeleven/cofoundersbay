/*
 * Calm surfaces: decorative brand frames and gradient washes -> one emphasis.
 *
 * Emphasis surface = border-primary/15 (the whisper edge globals.css already
 * gives bg-primary/5|10) + a flat bg-primary/[0.03] wash. No gradients: a
 * gradient is two colours competing inside one box.
 *
 * Every entry is an exact substring in a named file. State styling (selected,
 * active, hover, drag, earned) is never in this list.
 */
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'src');

const E = 'border-primary/15 bg-primary/[0.03]';
const R = [
  // gradients -> flat wash
  ['app/activity/page.tsx', 'bg-gradient-to-br from-primary/5 to-accent/5', 'bg-primary/[0.03]'],
  ['app/DashboardHome.tsx', 'border-primary/20 bg-gradient-to-br from-primary/5 to-transparent', E],
  ['app/achievements/page.tsx', 'bg-gradient-to-br from-primary/10 via-primary/5 to-background', 'bg-primary/[0.03]'],
  ['app/jobs/page.tsx', "'border-primary/30 bg-gradient-to-br from-primary/[0.03] to-accent/[0.02]'", `'${E}'`],
  ['app/marketplace/page.tsx', 'border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10', E],
  ['components/messaging/ChatWindow.tsx', 'rounded-[1.75rem] bg-gradient-to-br from-primary/20 via-background to-accent/20 shadow-[0_18px_40px_-24px_hsl(var(--primary)/0.8)] ring-1 ring-primary/20', 'rounded-3xl bg-primary/[0.06]'],
  ['app/LandingHome.tsx', 'bg-gradient-to-br from-primary/5 via-background to-accent/5', 'bg-primary/[0.03]'],
  ['components/discover/ProfileCard.tsx', 'bg-gradient-to-r from-primary/20 to-accent/10', 'bg-primary/[0.04]'],
  ['app/matches/page.tsx', 'bg-gradient-to-r from-status-success-bg/50 via-card to-transparent', 'bg-status-success-bg/40'],
  ['components/social/InviteSystem.tsx', 'bg-gradient-to-br from-primary/10 via-primary/5 to-background', 'bg-primary/[0.03]'],
  ['components/ui/enhanced-card.tsx', 'bg-gradient-to-br from-primary/5 to-secondary/5 hover:from-primary/10 hover:to-secondary/10', 'bg-primary/[0.03] hover:bg-primary/[0.05]'],
  ['components/ui/enhanced-card.tsx', 'bg-gradient-to-br from-primary to-secondary', 'bg-primary', true],
  ['app/discover/page.tsx', 'border-primary/20 bg-gradient-to-r from-primary/5 to-status-accent-bg/30', E],
  ['app/analytics/page.tsx', "'border-primary/25 bg-gradient-to-b from-primary/12 via-card to-card'", "'border-primary/30 bg-primary/[0.04]'"],
  ['components/gamification/BadgesWidget.tsx', 'border-primary/30 bg-gradient-to-b from-primary/20 via-card to-card p-3 text-center shadow-sm transition-colors hover:border-primary/55', 'border-primary/15 bg-primary/[0.04] p-3 text-center transition-colors hover:border-primary/30'],
  ['app/help/page.tsx', 'bg-gradient-to-br from-primary/5 via-card to-muted/20 p-6 text-center shadow-sm', 'bg-primary/[0.03] p-6 text-center'],
  ['app/help/page.tsx', 'border-primary/20 bg-gradient-to-br from-primary/5 to-card', E],
  ['components/gamification/ReputationSystem.tsx', 'border-primary/50 bg-gradient-to-br from-primary/5 to-primary/10', E],
  ['app/groups/[groupId]/page.tsx', 'bg-gradient-to-br from-primary/20 via-primary/10 to-transparent', 'bg-primary/[0.06]'],
  ['app/groups/[groupId]/page.tsx', 'bg-gradient-to-br from-primary/30 to-primary/10 shadow-lg', 'bg-primary/10'],
  ['app/pricing/page.tsx', 'bg-gradient-to-b from-primary/5 to-transparent', 'bg-primary/[0.03]'],
  ['app/pricing/page.tsx', 'bg-gradient-to-t from-primary/5 to-transparent', 'bg-primary/[0.03]'],
  ['app/pitch/[id]/page.tsx', 'bg-gradient-to-br from-primary/10 via-background to-primary/5', 'bg-primary/[0.04]'],
  ['app/profile/page.tsx', 'bg-gradient-to-br from-primary/10 via-primary/5 to-secondary', 'bg-primary/[0.06]'],
  ['app/profile/edit/page.tsx', 'border-primary/30 bg-gradient-to-r from-primary/5 to-transparent p-5 space-y-4 shadow-sm', `${E} p-5 space-y-4`],
  ['app/recommendations/page.tsx', 'border-primary/20 bg-gradient-to-r from-primary/5 to-transparent', E],
  ['app/readiness/page.tsx', 'border-primary/25 bg-gradient-to-b from-primary/20 via-card to-card', 'border-primary/15 bg-primary/[0.04]'],
  ['app/readiness/page.tsx', 'border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent', E],
  ['app/reputation/page.tsx', 'bg-gradient-to-br from-primary/5 via-primary/10 to-secondary shadow-sm', 'bg-primary/[0.03]'],

  // decorative frames -> whisper edge (unconditional surfaces only)
  ['app/analytics/page.tsx', 'border-primary/20 bg-primary/[0.03]', E],
  ['app/(auth)/login/page.tsx', 'border-primary/30 bg-primary/5', 'border-primary/15 bg-primary/5'],
  ['app/p/[username]/page.tsx', 'bg-primary/5 border-primary/20', 'bg-primary/5 border-primary/15'],
  ['app/invite/page.tsx', "'border-primary/30 bg-primary/5'", "'border-primary/15 bg-primary/5'"],
  ['app/LandingHome.tsx', 'border border-primary/30 bg-primary/10 px-4', 'border border-primary/15 bg-primary/[0.06] px-4'],
  ['app/investor/scouting/page.tsx', 'border-primary/20 bg-primary/2', E],
  ['app/marketplace/page.tsx', "'border-primary/30 bg-primary/[0.02]'", `'${E}'`],
  ['app/mentoring/page.tsx', 'border border-primary/20 bg-primary/5 p-3', 'border border-primary/15 bg-primary/5 p-3'],
  ['app/recommendations/page.tsx', 'rounded-full border border-primary/20', 'rounded-full border border-primary/15'],
  ['app/tenant/billing/page.tsx', 'border-primary/20 bg-primary/5', 'border-primary/15 bg-primary/5'],
  ['app/readiness/page.tsx', 'border-primary/20 bg-primary/[0.03]', E],
  ['app/t/[slug]/page.tsx', 'bg-primary/5 border-primary/20', 'bg-primary/5 border-primary/15'],
  ['app/tenant/sso/page.tsx', 'border-primary/30 bg-muted/10', E],
  ['app/share/[token]/page.tsx', 'border-primary/20 bg-primary/5', 'border-primary/15 bg-primary/5'],
  ['app/mentor/profile/page.tsx', 'border-primary/20 bg-primary/2', E],
  ['app/provider/profile/page.tsx', '<Card className="border-primary/20">', `<Card className="${E}">`],
  ['components/members/MembersPageClient.tsx', 'border border-primary/20 bg-primary/[0.02]', `border ${E}`],
  ['app/profile/page.tsx', 'bg-primary/5 border-primary/20 shadow-sm', 'bg-primary/5 border-primary/15'],
  ['app/settings/data-export/page.tsx', 'border-primary/20 bg-primary/5 shadow-sm', 'border-primary/15 bg-primary/5'],
  ['app/profile/edit/page.tsx', 'shadow-sm border-primary/20 bg-primary/5', 'border-primary/15 bg-primary/5'],
  ['app/settings/billing/page.tsx', 'border-primary/20 bg-primary/[0.04] shadow-none', E],
  ['components/gamification/VentureReadinessCard.tsx', 'border-primary/20 bg-primary/[0.03]', E],
  ['components/common/ConnectionRequest.tsx', 'bg-primary/5 border border-primary/20', 'bg-primary/5 border border-primary/15'],
  ['components/common/HelpCallout.tsx', 'border border-primary/25 bg-primary/5', 'border border-primary/15 bg-primary/5'],
  ['components/common/HelpCallout.tsx', 'rounded-2xl border border-primary/20 bg-background', 'rounded-2xl border border-border bg-background'],
  ['app/shortlist/page.tsx', 'border border-primary/30 bg-primary/5', 'border border-primary/15 bg-primary/5'],
];

let changed = 0;
const missing = [];
for (const [rel, from, to, all] of R) {
  const file = path.join(SRC, rel);
  const src = fs.readFileSync(file, 'utf8');
  if (!src.includes(from)) { missing.push(`${rel} :: ${from}`); continue; }
  const next = all ? src.split(from).join(to) : src.replace(from, to);
  fs.writeFileSync(file, next);
  changed++;
}
console.log(`applied ${changed}/${R.length}`);
if (missing.length) console.log('MISSING:\n  ' + missing.join('\n  '));
