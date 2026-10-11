import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { getServerQueryClient, serverFetch } from '@/lib/server-query';
import { queryKeys, qk } from '@/lib/query-keys';
import FounderDashboardContent from './FounderDashboardContent';

export default async function FounderDashboardPage() {
  const queryClient = getServerQueryClient();

  // Prefetch the 4 main dashboard queries in parallel on the server.
  // Keys must match FounderDashboardContent's useQuery calls exactly, or the
  // client hydration match fails silently and it refetches instead of using
  // this SSR data.
  //
  // Seed only when the server actually produced data. serverFetch returns null
  // whenever it cannot speak for the user — every preview-demo session, and any
  // request where the API is unreachable — and prefetchQuery caches that null
  // just as happily as a real payload.
  //
  // These keys are shared with client code that uses a *different* queryFn:
  // queryKeys.me.profile() is read by /profile, the four other dashboards and a
  // dozen more pages, all of them via getMeProfile(), which returns
  // { profile, hasCompletedOnboarding } and has its own demo branch. Seeding
  // null therefore did not just miss a cache hit — it poisoned the entry. On
  // /profile the poisoned value made `meData?.profile` null with the query
  // already settled, and that page renders "Preparing your profile…" forever in
  // that state. Loading the page directly worked; reaching it from the dashboard
  // hung, which is exactly the reported symptom.
  const seed = async (key: readonly unknown[], path: string) => {
    const data = await serverFetch(path);
    if (data !== null && data !== undefined) queryClient.setQueryData(key, data);
  };

  await Promise.allSettled([
    seed(queryKeys.me.profile(), '/api/me/profile'),
    seed(qk('dashboard', 'stats', 'founder'), '/api/dashboard/stats'),
    // Must stay `queryKeys.recommendations` (= ['recommendations']) to match the
    // client's useQuery. It previously prefetched ['recommendations', {limit:5}],
    // which hydrates into a different cache entry — so this fetch was paid for on
    // the server, shipped in the payload, then thrown away and refetched on the
    // client, exactly the silent miss the comment above warns about.
    // The API serves recommendations at /api/recommendations (the client's
    // getRecommendations); /api/matching/recommendations never existed, so this
    // seed always missed and the client fetched again.
    seed(queryKeys.recommendations, '/api/recommendations?limit=5'),
    seed(queryKeys.connections.pendingReceived(), '/api/connections/requests'),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <FounderDashboardContent />
    </HydrationBoundary>
  );
}
