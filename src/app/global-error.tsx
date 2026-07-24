"use client";

import { useEffect } from "react";

/**
 * Root-level error boundary that catches errors thrown from the root layout itself.
 *
 * Unlike `error.tsx`, `global-error.tsx` is the ONLY boundary that can catch errors
 * in `app/layout.tsx` (e.g., a crash in SessionProvider, font loading, etc.).
 *
 * Because this replaces the entire page (including <html> and <body>), it must
 * render its own document structure. It uses inline styles to avoid depending
 * on any CSS that might have failed to load.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError - root layout]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          backgroundColor: "#0a0a0a",
          color: "#ededed",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <div style={{ maxWidth: 440, textAlign: "center", padding: 32 }}>
          <div
            style={{
              width: 64,
              height: 64,
              margin: "0 auto 24px",
              borderRadius: "50%",
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
            }}
          >
            ⚠
          </div>

          <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>
            Application Error
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "#999",
              marginBottom: 24,
              lineHeight: 1.5,
            }}
          >
            A critical error prevented the application from loading. Please try
            refreshing the page. If the problem persists, contact your
            administrator.
          </p>

          <button
            onClick={reset}
            style={{
              padding: "10px 24px",
              backgroundColor: "#ededed",
              color: "#0a0a0a",
              border: "none",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
