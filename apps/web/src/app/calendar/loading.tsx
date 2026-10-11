import { Skeleton } from '@/components/ui/skeleton';

export default function CalendarLoading() {
  return (
    <div className="min-h-screen pb-20 lg:pb-10">
      <div className="mx-auto w-full min-w-0 px-4 sm:px-6 lg:px-8 pt-4">
        {/* AppShell header */}
        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-3.5 shadow-sm mb-5">
          <div className="space-y-1.5"><Skeleton className="h-5 w-28" /><Skeleton className="h-3.5 w-48" /></div>
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-3.5 flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-md shrink-0" />
              <div className="space-y-1.5"><Skeleton className="h-5 w-10" /><Skeleton className="h-3 w-20" /></div>
            </div>
          ))}
        </div>
        {/* Calendar + sidebar */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <Skeleton className="h-6 w-32" />
              <div className="flex gap-2"><Skeleton className="h-8 w-8 rounded-md" /><Skeleton className="h-8 w-8 rounded-md" /></div>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-6 w-full rounded" />)}
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-lg border border-border p-1">
                  <Skeleton className="h-4 w-6 mb-1" />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-3.5 space-y-2">
                <div className="flex gap-2 items-center"><Skeleton className="h-4 w-4 rounded shrink-0" /><Skeleton className="h-4 w-40" /></div>
                <Skeleton className="h-3 w-28" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
