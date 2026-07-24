import { Loader2 } from "lucide-react";

/**
 * Client portal loading skeleton.
 *
 * Shown by Next.js Suspense while client-view pages are loading.
 */
export default function ClientPortalLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-40 bg-muted rounded-md" />
          <div className="h-4 w-56 bg-muted rounded-md mt-2" />
        </div>
        <div className="h-10 w-10 bg-muted rounded-full" />
      </div>

      {/* Summary cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-5 space-y-2">
            <div className="h-4 w-20 bg-muted rounded" />
            <div className="h-7 w-12 bg-muted rounded" />
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="h-5 w-32 bg-muted rounded" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <div className="h-4 flex-1 bg-muted rounded" />
            <div className="h-4 w-20 bg-muted rounded" />
          </div>
        ))}
      </div>

      <div className="flex justify-center pt-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}
