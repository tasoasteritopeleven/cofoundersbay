import { Skeleton } from '@/components/ui/skeleton';

export default function NotificationsLoading() {
  return (
    <div className="min-h-screen pb-20 lg:pb-16">
      <div className="mx-auto w-full max-w-2xl px-4 pt-6 space-y-4">
        <div className="flex items-center justify-between py-3">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
            <Skeleton className="h-9 w-9 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-3 w-12 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
