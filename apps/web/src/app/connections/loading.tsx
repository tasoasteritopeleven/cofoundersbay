import { Skeleton } from '@/components/ui/skeleton';

export default function ConnectionsLoading() {
  return (
    <div className="min-h-screen bg-hero-radial pb-20 lg:pb-16">
      <div className="mx-auto w-full min-w-0 px-4 pt-6">
        <div className="flex items-center justify-between py-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
          <div className="hidden lg:block space-y-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-lg" />
            ))}
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card/70 p-6 flex justify-between items-center">
              <div className="space-y-2">
                <Skeleton className="h-7 w-36" />
                <Skeleton className="h-4 w-56" />
              </div>
              <Skeleton className="h-9 w-28 rounded-lg" />
            </div>

            <div className="flex gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-28 rounded-lg" />
              ))}
            </div>

            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-8 w-20 rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
