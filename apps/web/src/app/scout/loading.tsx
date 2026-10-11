import { Skeleton } from '@/components/ui/skeleton';

export default function ScoutLoading() {
  return (
    <div className="mx-auto w-full min-w-0 space-y-4 px-4 pt-6" aria-busy="true">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-full max-w-md rounded-xl" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <Skeleton className="h-9 w-40 rounded-full" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}
