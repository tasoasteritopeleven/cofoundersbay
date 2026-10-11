import { Skeleton } from '@/components/ui/skeleton';

export default function ReferralsLoading() {
  return (
    <div className="min-h-screen pb-20 lg:pb-10">
      <div className="mx-auto w-full min-w-0 px-4 sm:px-6 lg:px-8 pt-4 space-y-5">
        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-3.5 shadow-sm">
          <div className="space-y-1.5"><Skeleton className="h-5 w-36" /><Skeleton className="h-3.5 w-56" /></div>
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-3.5 flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-md shrink-0" />
              <div className="space-y-1.5"><Skeleton className="h-5 w-10" /><Skeleton className="h-3 w-20" /></div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_350px]">
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <Skeleton className="h-5 w-32" />
              <div className="flex gap-2"><Skeleton className="h-11 flex-1 rounded-lg" /><Skeleton className="h-11 w-28 rounded-lg" /></div>
              <Skeleton className="h-3 w-64" />
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4 flex gap-4">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between"><Skeleton className="h-4 w-28" /><Skeleton className="h-5 w-20 rounded-full" /></div>
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <Skeleton className="h-5 w-28" />
              {Array.from({ length: 3 }).map((_, j) => <div key={j} className="flex justify-between"><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-16" /></div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
