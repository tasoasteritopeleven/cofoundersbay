import { Skeleton } from '@/components/ui/skeleton';

export default function EventsLoading() {
  return (
    <div className="min-h-screen bg-hero-radial pb-20 lg:pb-16">
      <div className="mx-auto w-full min-w-0 px-4 pt-6">
        <div className="flex items-center justify-between py-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-9 w-32 rounded-lg" />
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
                <Skeleton className="h-7 w-24" />
                <Skeleton className="h-4 w-56" />
              </div>
              <Skeleton className="h-9 w-32 rounded-lg" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
                  <Skeleton className="h-36 w-full" />
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-8 w-full rounded-lg mt-2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
