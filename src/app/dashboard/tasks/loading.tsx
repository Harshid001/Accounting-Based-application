import { Loader2 } from "lucide-react";

/**
 * Tasks page loading skeleton.
 */
export default function TasksLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-24 bg-muted rounded-md" />
        <div className="h-10 w-28 bg-muted rounded-md" />
      </div>

      {/* Filter bar skeleton */}
      <div className="flex gap-3">
        <div className="h-9 w-24 bg-muted rounded-md" />
        <div className="h-9 w-24 bg-muted rounded-md" />
        <div className="h-9 w-32 bg-muted rounded-md" />
      </div>

      {/* Task list skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4 flex items-center gap-4">
            <div className="h-5 w-5 bg-muted rounded" />
            <div className="flex-1 space-y-1">
              <div className="h-4 w-48 bg-muted rounded" />
              <div className="h-3 w-32 bg-muted rounded" />
            </div>
            <div className="h-6 w-20 bg-muted rounded-full" />
            <div className="h-4 w-16 bg-muted rounded" />
          </div>
        ))}
      </div>

      <div className="flex justify-center pt-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}
