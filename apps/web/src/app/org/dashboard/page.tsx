'use client';

import { redirect } from 'next/navigation';

export default function OrgDashboardRedirect() {
  redirect('/dashboard/incubator');
}
