import { Skeleton } from "~/components/ui/skeleton";
import { Card, CardHeader, CardContent, CardFooter } from "~/components/ui/card";

export function LoadingState() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8 md:py-12">
        {/* Header skeleton */}
        <div className="mb-8 md:mb-12">
          <div className="flex justify-center mb-6">
            <Skeleton className="h-16 w-48 md:h-20 md:w-64" />
          </div>
          <Skeleton className="h-12 w-full max-w-2xl mx-auto mb-4" />
          <Skeleton className="h-6 w-96 mx-auto" />

          {/* Search skeleton */}
          <div className="max-w-2xl mx-auto mt-6">
            <Skeleton className="h-12 w-full" />
          </div>
        </div>

        {/* Categories Grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((j) => (
                    <Skeleton key={j} className="h-4 w-full" />
                  ))}
                </div>
              </CardContent>
              <CardFooter>
                <Skeleton className="h-3 w-20" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
