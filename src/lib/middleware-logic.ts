/**
 * Pure decision logic for the authentication/role middleware.
 * Shared between src/proxy.ts (runtime) and tests (verification).
 *
 * Returns the redirect target path, "401" for API unauthorized responses,
 * or null if the request should pass through.
 *
 * Safety invariants:
 * - Never returns a target equal to `pathname` (prevents self-redirect loops).
 * - Never redirects auth pages (/login, /pending-approval) — they are public
 *   destinations and redirecting them would create an infinite loop.
 * - Never redirects the root "/" — that page resolves the destination
 *   server-side via getServerSession to guarantee a single hop.
 */
export function getRedirectTarget(pathname: string, role: string | undefined): string | null {
  const PUBLIC_DESTINATIONS = new Set(["/login", "/pending-approval"])

  if (PUBLIC_DESTINATIONS.has(pathname)) {
    return null
  }

  if (pathname === "/") {
    return null
  }

  if (!role) {
    // Exempt NextAuth routes and webhooks from authentication
    if (pathname.startsWith("/api/auth") || pathname.startsWith("/api/webhooks")) {
      return null
    }
    if (pathname.startsWith("/api/")) return "401"
    if (pathname.startsWith("/dashboard") || pathname.startsWith("/client-view")) return "/login"
    return null
  }

  if (role === "CLIENT" && pathname.startsWith("/dashboard")) {
    const target = "/client-view"
    if (target === pathname) return null
    return target
  }

  return null
}
