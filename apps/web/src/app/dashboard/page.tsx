'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRole } from '@/contexts/RoleContext';
import { Loader2 } from 'lucide-react';

export default function DashboardRouter() {
  const router = useRouter();
  const { primaryRole, isLoading } = useRole();

  useEffect(() => {
    if (isLoading) return;

    // Route to role-specific dashboard
    const roleRoutes: Record<string, string> = {
      aspiring_founder: '/dashboard/founder',
      existing_founder: '/dashboard/founder',
      cofounder_candidate: '/dashboard/founder',
      technical_talent: '/dashboard/founder',
      business_operator: '/dashboard/founder',
      mentor: '/dashboard/mentor',
      advisor: '/dashboard/mentor',
      coach: '/dashboard/mentor',
      course_creator: '/dashboard/mentor',
      angel_investor: '/dashboard/investor',
      vc_scout: '/dashboard/investor',
      vc_analyst: '/dashboard/investor',
      syndicate_manager: '/dashboard/investor',
      incubator_admin: '/dashboard/incubator',
      accelerator_admin: '/dashboard/incubator',
      university_admin: '/dashboard/incubator',
      venture_studio_admin: '/dashboard/incubator',
      service_provider: '/dashboard/provider',
      legal_partner: '/dashboard/provider',
      finance_advisor: '/dashboard/provider',
      recruiter: '/dashboard/provider',
      platform_admin: '/admin/dashboard',
    };

    const targetRoute = (primaryRole && roleRoutes[primaryRole]) || '/dashboard/founder';
    router.replace(targetRoute);
  }, [primaryRole, isLoading, router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="icon-xl animate-spin text-primary-accessible" />
        <p className="text-sm text-muted-foreground">Loading your dashboard...</p>
      </div>
    </div>
  );
}
