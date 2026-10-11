'use client';

import { redirect } from 'next/navigation';

/**
 * The canonical investor dashboard is `/dashboard/investor`; this route is
 * kept so old links and the role switcher still land somewhere.
 *
 * Until now this file also carried ~270 lines of the pre-redirect dashboard
 * "preserved below" the redirect. Nothing could reach it — the default export
 * returned before any of it — but it imported `useState` into what was, with
 * no `'use client'` directive, a Server Component, and Turbopack refuses to
 * compile that. So the route did not redirect: it answered 500 on every
 * request, which the platform sweep found as the single non-200 route out of
 * 142. Everything the dead code rendered (watchlist, pipeline, portfolio) is
 * what `/dashboard/investor` renders from the API, so nothing is lost by
 * making this the same seven lines `/mentor/dashboard` already is.
 */
export default function InvestorDashboardRedirect() {
  redirect('/dashboard/investor');
}
