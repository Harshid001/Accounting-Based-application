import { Loader2 } from "lucide-react";

/**
 * Dashboard loading skeleton.
 *
 * Shown by Next.js Suspense while the dashboard page is loading.
 * Uses a combination of spinner and shimmer placeholders to match
 * the dashboard layout structure.
 */
export default function DashboardLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Page header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-48 bg-muted rounded-md" />
          <div className="h-4 w-64 bg-muted rounded-md mt-2" />
        </div>
      </div>

      {/* Stats cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border bg-card p-6 space-y-3"
          >
            <div className="h-4 w-24 bg-muted rounded" />
            <div className="h-8 w-16 bg-muted rounded" />
            <div className="h-3 w-32 bg-muted rounded" />
          </div>
        ))}
      </div>

      {/* Content area skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-6 space-y-4">
            <div className="h-5 w-36 bg-muted rounded" />
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="flex items-center gap-3">
                <div className="h-4 w-4 bg-muted rounded-full" />
                <div className="h-4 flex-1 bg-muted rounded" />
                <div className="h-4 w-16 bg-muted rounded" />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Centered spinner for accessibility */}
      <div className="flex justify-center pt-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}
