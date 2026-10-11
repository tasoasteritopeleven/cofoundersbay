import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export default function JobsLoading() {
  return (
    <div className="min-h-screen bg-hero-radial pb-20 lg:pb-16">
      <div className="mx-auto w-full min-w-0 px-4 sm:px-6 lg:px-8 pt-6">
        <Skeleton className="h-10 w-64 mb-6" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
          <Skeleton className="hidden lg:block h-[420px] rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-10 w-full" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="flex items-start gap-4">
                  <Skeleton className="h-11 w-11 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
