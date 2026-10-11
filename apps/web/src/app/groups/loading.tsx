import { AppShell } from '@/components/layout/AppShell';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function GroupsLoading() {
  return (
    <AppShell
      title="Groups"
      titleEl="Κοινότητες"
      description="Join communities, share knowledge, and connect with like-minded founders"
      descriptionEl="Γίνετε μέλος κοινοτήτων, μοιραστείτε γνώση και γνωρίστε ιδρυτές με κοινά ενδιαφέροντα"
      actions={
        // The loading shell's copy of the header action; the real one renders
        // with the page. Disabled so it is not a control that does nothing.
        <Button className="gap-2" disabled>
          <Plus className="icon-sm" aria-hidden="true" />
          Create Group
        </Button>
      }
    >
      {/* Tabs skeleton */}
      <div className="flex gap-1 rounded-xl bg-secondary/50 p-1 mb-4 max-w-md">
        <Skeleton className="h-9 flex-1 rounded-lg" />
        <Skeleton className="h-9 flex-1 rounded-lg" />
      </div>

      {/* Search skeleton */}
      <Skeleton className="h-10 w-full rounded-xl mb-3" />

      {/* Category filters skeleton */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full shrink-0" />
        ))}
      </div>

      {/* Trending groups skeleton */}
      <div className="space-y-3 mb-6">
        <Skeleton className="h-5 w-36" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-12 w-12 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <div className="flex gap-2">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </div>
                </div>
                <Skeleton className="h-10 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-14 rounded-md" />
                  <Skeleton className="h-5 w-16 rounded-md" />
                  <Skeleton className="h-5 w-12 rounded-md" />
                </div>
                <div className="flex justify-between items-center pt-2">
                  <div className="flex gap-4">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                  <Skeleton className="h-8 w-20 rounded-md" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* All groups skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-24" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-12 w-12 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-10 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16 rounded-md" />
                  <Skeleton className="h-5 w-14 rounded-md" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
