import { redirect } from 'next/navigation';

/**
 * The provider's home is `/dashboard/provider` - the route the navigation,
 * the role switcher and the post-login redirect open. This page was a second
 * home with its own figures; it redirects, as /investor/dashboard and
 * /mentor/dashboard do, and everything it showed (inquiries, projects,
 * reviews, the summary tiles) is on the one home, from the same endpoints.
 */
export default function ProviderDashboardRedirect() {
  redirect('/dashboard/provider');
}
