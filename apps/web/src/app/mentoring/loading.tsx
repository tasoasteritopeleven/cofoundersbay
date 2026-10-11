import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export default function MentoringLoading() {
  return (
    <div className="min-h-screen bg-hero-radial pb-20 lg:pb-16">
      <div className="mx-auto w-full min-w-0 px-4 sm:px-6 lg:px-8 pt-6">
        <Skeleton className="h-10 w-48 mb-6" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
          <Skeleton className="hidden lg:block h-[420px] rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-10 w-full rounded-xl" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-12 w-12 rounded-full shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-8 w-full rounded-lg" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
