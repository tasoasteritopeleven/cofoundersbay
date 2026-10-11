import { Skeleton } from '@/components/ui/skeleton';

export default function CompareLoading() {
  return (
    <div className="min-h-screen pb-20 lg:pb-10">
      <div className="mx-auto w-full min-w-0 px-4 sm:px-6 lg:px-8 pt-4 space-y-5">
        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-3.5 shadow-sm">
          <div className="space-y-1.5"><Skeleton className="h-5 w-36" /><Skeleton className="h-3.5 w-52" /></div>
          <div className="flex gap-2"><Skeleton className="h-9 w-24 rounded-lg" /><Skeleton className="h-9 w-20 rounded-lg" /></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="flex flex-col items-center gap-3 text-center">
                <Skeleton className="h-20 w-20 rounded-full" />
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-4 w-20 rounded-full" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
              <div className="space-y-2 pt-2 border-t border-border">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="flex justify-between">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5 flex-wrap">{Array.from({ length: 4 }).map((_, j) => <Skeleton key={j} className="h-5 w-14 rounded-full" />)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
