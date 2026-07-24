import { Loader2 } from "lucide-react";

/**
 * Clients list loading skeleton.
 */
export default function ClientsLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Header + search bar skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-32 bg-muted rounded-md" />
        <div className="h-10 w-64 bg-muted rounded-md" />
      </div>

      {/* Client cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-muted rounded-full" />
              <div className="space-y-1 flex-1">
                <div className="h-4 w-28 bg-muted rounded" />
                <div className="h-3 w-36 bg-muted rounded" />
              </div>
            </div>
            <div className="h-3 w-20 bg-muted rounded" />
          </div>
        ))}
      </div>

      <div className="flex justify-center pt-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}
