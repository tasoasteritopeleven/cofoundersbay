import { Skeleton } from '@/components/ui/skeleton';

export default function DiscoverLoading() {
  return (
    <div className="min-h-screen bg-hero-radial pb-20 lg:pb-16">
      <div className="mx-auto w-full min-w-0 px-4 pt-6">
        {/* TopNav skeleton */}
        <div className="flex items-center justify-between py-3">
          <Skeleton className="h-8 w-40" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
          {/* SideNav skeleton */}
          <div className="hidden lg:block space-y-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-lg" />
            ))}
          </div>

          {/* Main content */}
          <div className="space-y-6">
            {/* Page header */}
            <div className="rounded-2xl border border-border bg-card/70 p-6">
              <Skeleton className="h-7 w-40" />
              <Skeleton className="mt-2 h-4 w-64" />
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-28 rounded-lg" />
              ))}
            </div>

            {/* Filter bar */}
            <Skeleton className="h-12 w-full rounded-xl" />

            {/* Cards grid */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-12 w-12 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20 rounded-full" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {Array.from({ length: 3 }).map((_, j) => (
                      <Skeleton key={j} className="h-6 w-16 rounded-full" />
                    ))}
                  </div>
                  <Skeleton className="h-8 w-full rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
