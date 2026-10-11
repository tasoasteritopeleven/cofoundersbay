import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="min-h-screen pb-20 lg:pb-10">
      <div className="mx-auto w-full min-w-0 px-4 sm:px-6 lg:px-8 pt-4 space-y-5">
        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-3.5 shadow-sm">
          <div className="space-y-1.5"><Skeleton className="h-5 w-32" /><Skeleton className="h-3.5 w-48" /></div>
          <div className="flex gap-2"><Skeleton className="h-9 w-28 rounded-lg" /><Skeleton className="h-9 w-24 rounded-lg" /></div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-3.5 flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-md shrink-0" />
              <div className="space-y-1.5"><Skeleton className="h-5 w-10" /><Skeleton className="h-3 w-20" /></div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between"><Skeleton className="h-5 w-36" /><Skeleton className="h-8 w-20 rounded-lg" /></div>
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="flex gap-3 items-center">
                    <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-32" /></div>
                    <Skeleton className="h-8 w-20 rounded-lg shrink-0" />
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-24 w-24 rounded-full mx-auto" />
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, j) => <div key={j} className="flex justify-between items-center"><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-12" /></div>)}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <Skeleton className="h-5 w-28" />
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex gap-2 items-center">
                  <Skeleton className="h-3.5 w-3.5 rounded-full shrink-0" />
                  <Skeleton className="h-3 flex-1" />
                  <Skeleton className="h-3 w-12 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
