import { Skeleton } from '@/components/ui/skeleton';

export default function LearningLoading() {
  return (
    <div className="min-h-screen pb-20 lg:pb-10">
      <div className="mx-auto w-full min-w-0 px-4 sm:px-6 lg:px-8 pt-4 space-y-5">
        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-3.5 shadow-sm">
          <div className="space-y-1.5"><Skeleton className="h-5 w-32" /><Skeleton className="h-3.5 w-60" /></div>
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
        <div className="flex gap-2 flex-wrap">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-24 rounded-full" />)}
        </div>
        <div className="space-y-2"><Skeleton className="h-5 w-40" /></div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
              <Skeleton className="h-40 w-full" />
              <div className="p-4 space-y-3">
                <div className="flex gap-2"><Skeleton className="h-5 w-16 rounded-full" /><Skeleton className="h-5 w-20 rounded-full" /></div>
                <Skeleton className="h-5 w-full" /><Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-2 w-full rounded-full" />
                <div className="flex justify-between items-center">
                  <Skeleton className="h-3 w-24" /><Skeleton className="h-8 w-24 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
