"use client";

import { useEffect } from "react";

/**
 * Client portal error boundary.
 *
 * Catches errors within the client-view layout and shows a
 * contextual recovery UI for external clients.
 */
export default function ClientPortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ClientPortalError]", error);
  }, [error]);

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center">
        <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
          <svg
            className="w-7 h-7 text-amber-600 dark:text-amber-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>

        <h2 className="text-lg font-semibold text-foreground mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-muted-foreground mb-5">
          We encountered an issue loading this page. Please try again or
          contact your accounting firm for assistance.
        </p>

        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Try Again
          </button>
          <a
            href="/client-view"
            className="inline-flex items-center px-4 py-2 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent transition-colors"
          >
            Go to Overview
          </a>
        </div>
      </div>
    </div>
  );
}
