import { Skeleton } from '@/components/ui/skeleton';

export default function MessagesLoading() {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar skeleton */}
      <div className="w-full md:w-80 lg:w-96 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
        <div className="flex-1 p-2 space-y-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
              <div className="relative shrink-0">
                <Skeleton className="h-12 w-12 rounded-full" />
                {i < 2 && (
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-status-success-bg ring-2 ring-background" />
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-10 shrink-0" />
                </div>
                <Skeleton className="h-3 w-44" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat area skeleton — hidden on mobile */}
      <div className="hidden md:flex flex-1 flex-col">
        {/* Chat header */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 p-6 space-y-4">
          {[false, true, false, false, true, false].map((isMine, i) => (
            <div key={i} className={`flex gap-3 ${isMine ? 'flex-row-reverse' : ''}`}>
              {!isMine && <Skeleton className="h-8 w-8 rounded-full shrink-0" />}
              <Skeleton
                className={`h-10 rounded-2xl ${isMine ? 'w-48 rounded-tr-sm' : 'w-64 rounded-tl-sm'}`}
              />
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="border-t border-border p-4 flex items-center gap-3">
          <Skeleton className="h-10 flex-1 rounded-xl" />
          <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
        </div>
      </div>
    </div>
  );
}
