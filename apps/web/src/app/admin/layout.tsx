'use client';

import { Fragment } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { AdminGuard } from '@/components/auth/AdminGuard';
import { AppShellFrame } from '@/components/layout/AppShell';
import { cn } from '@/lib/utils';
import { BilingualText } from '@/components/common/BilingualText';
import { LayoutDashboard, LayoutGrid, Building2, KeyRound, Globe, Zap } from 'lucide-react';

// The overview is the platform admin's home (the role's landing page); the
// console holds the moderation queue and the twelve operational sections.
const ADMIN_NAV = [
  { href: '/admin/dashboard',    label: 'Overview',       labelEl: 'Επισκόπηση',   icon: LayoutDashboard },
  { href: '/admin',              label: 'Console',        labelEl: 'Κονσόλα',      icon: LayoutGrid },
  { href: '/admin/tenants',      label: 'Organisations',  labelEl: 'Οργανισμοί',   icon: Building2 },
  { href: '/admin/sso',          label: 'SSO',            labelEl: 'SSO',          icon: KeyRound },
  { href: '/admin/domains',      label: 'Domains',        labelEl: 'Τομείς',       icon: Globe },
  { href: '/admin/automations',  label: 'Automations',    labelEl: 'Αυτοματισμοί', icon: Zap },
];

function AdminSubNav() {
  const pathname = usePathname() ?? '/admin';
  return (
    <div className="border-b border-border bg-card/60 px-4">
      <nav aria-label="Admin sections" className="flex gap-1 overflow-x-auto w-full min-w-0 max-w-[84rem] mx-auto">
        {ADMIN_NAV.map(({ href, label, labelEl, icon: Icon }) => {
          const active = pathname === href || (href !== '/admin' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                active
                  ? 'border-primary text-primary-accessible'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
              )}
            >
              <Icon className="icon-sm" aria-hidden="true" />
              <BilingualText en={label} el={labelEl} compact />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      {/* The frame is mounted here rather than by each admin page, so the
          sub-nav sits inside the shell (it previously rendered above the
          page's own AppShell, leaving it visually detached) and the sidebar
          survives navigation between admin sections. The negative margins
          cancel appShellMainClasses' padding so the bar spans the column. */}
      <AppShellFrame>
        {/* Two siblings, both keyed. `children` is the page element as Next
            delivers it from the server payload, which carries no key; as the
            second item of a two-item list it is what React complains about
            ("Each child in a list should have a unique key") the moment the
            frame re-reconciles that list - which a page rail causes, because
            the rail tells the frame to reserve its strip. The only admin page
            without the warning was the only one without a rail. Keyed
            fragments make the list stable without adding a wrapper element. */}
        <Fragment key="admin-subnav">
          <div className="-mx-3 -mt-3 mb-4 sm:-mx-6 lg:-mx-[1.2rem]">
            <AdminSubNav />
          </div>
        </Fragment>
        <Fragment key="admin-page">{children}</Fragment>
      </AppShellFrame>
    </AdminGuard>
  );
}
