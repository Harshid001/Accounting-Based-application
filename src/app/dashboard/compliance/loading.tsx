import { Loader2 } from "lucide-react";

/**
 * Compliance page loading skeleton.
 */
export default function ComplianceLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-36 bg-muted rounded-md" />
      </div>

      {/* Filter bar skeleton */}
      <div className="flex gap-3 flex-wrap">
        <div className="h-9 w-28 bg-muted rounded-md" />
        <div className="h-9 w-28 bg-muted rounded-md" />
        <div className="h-9 w-28 bg-muted rounded-md" />
        <div className="h-9 w-36 bg-muted rounded-md" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-lg border bg-card overflow-hidden">
        {/* Table header */}
        <div className="flex items-center gap-4 px-4 py-3 border-b bg-muted/30">
          <div className="h-4 w-32 bg-muted rounded" />
          <div className="h-4 w-20 bg-muted rounded" />
          <div className="h-4 w-20 bg-muted rounded" />
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-4 w-20 bg-muted rounded" />
        </div>
        {/* Table rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0">
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="h-6 w-16 bg-muted rounded-full" />
            <div className="h-6 w-20 bg-muted rounded-full" />
            <div className="h-4 w-24 bg-muted rounded" />
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
