import { Skeleton } from '@/components/ui/skeleton';

export default function ReputationLoading() {
  return (
    <div className="min-h-screen pb-20 lg:pb-10">
      <div className="mx-auto w-full min-w-0 px-4 sm:px-6 lg:px-8 pt-4 space-y-5">
        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-3.5 shadow-sm">
          <div className="space-y-1.5"><Skeleton className="h-5 w-36" /><Skeleton className="h-3.5 w-56" /></div>
          <div className="flex gap-2"><Skeleton className="h-9 w-28 rounded-lg" /><Skeleton className="h-9 w-28 rounded-lg" /></div>
        </div>
        {/* Hero score card */}
        <div className="rounded-xl border border-border bg-card p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <Skeleton className="h-40 w-40 rounded-full shrink-0" />
            <div className="flex-1 space-y-3 text-center md:text-left">
              <Skeleton className="h-8 w-36 mx-auto md:mx-0" />
              <Skeleton className="h-4 w-64 mx-auto md:mx-0" />
              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-28 rounded-full" />)}
              </div>
            </div>
          </div>
        </div>
        {/* Category breakdown */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-md shrink-0" />
                <div className="flex-1 space-y-1"><Skeleton className="h-4 w-28" /><Skeleton className="h-3 w-20" /></div>
                <Skeleton className="h-8 w-12 rounded-full shrink-0" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
