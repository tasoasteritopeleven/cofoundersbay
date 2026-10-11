import { Skeleton } from '@/components/ui/skeleton';

export default function HelpLoading() {
  return (
    <div className="min-h-screen pb-20 lg:pb-10">
      <div className="mx-auto w-full min-w-0 px-4 sm:px-6 lg:px-8 pt-4 space-y-5">
        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-3.5 shadow-sm">
          <div className="space-y-1.5"><Skeleton className="h-5 w-36" /><Skeleton className="h-3.5 w-64" /></div>
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>
        <div className="rounded-xl border border-border bg-card p-6 text-center space-y-4">
          <Skeleton className="h-12 w-12 rounded-lg mx-auto" />
          <Skeleton className="h-6 w-48 mx-auto" />
          <Skeleton className="h-4 w-72 mx-auto" />
          <Skeleton className="h-11 w-full max-w-lg mx-auto rounded-lg" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-24 rounded-full" />)}
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-md shrink-0" />
              <div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-48" /></div>
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="px-6 py-4 border-b border-border last:border-0 flex items-center justify-between">
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-4 w-4 rounded" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
