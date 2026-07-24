"use client";

import { useEffect } from "react";

/**
 * Global error boundary for the application.
 *
 * Catches uncaught React render errors and displays a branded
 * fallback UI with a retry button. This prevents the entire app
 * from crashing to a white screen.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console (and to Sentry when integrated)
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-auto p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-red-600 dark:text-red-400"
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

        <h2 className="text-xl font-semibold text-foreground mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          An unexpected error occurred. Please try again or contact support if
          the problem persists.
        </p>

        {process.env.NODE_ENV === "development" && (
          <details className="mb-6 text-left">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
              Error details
            </summary>
            <pre className="mt-2 p-3 bg-muted rounded-md text-xs text-red-600 dark:text-red-400 overflow-auto max-h-40">
              {error.message}
              {error.digest && `\nDigest: ${error.digest}`}
            </pre>
          </details>
        )}

        <button
          onClick={reset}
          className="inline-flex items-center px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
