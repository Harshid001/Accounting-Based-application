/**
 * Pure decision logic for the authentication/role middleware.
 * Shared between src/proxy.ts (runtime) and tests (verification).
 *
 * Returns the redirect target path, "401" for API unauthorized responses,
 * or null if the request should pass through.
 */
export function getRedirectTarget(pathname: string, role: string | undefined): string | null {
  if (!role) {
    if (pathname.startsWith("/api/")) return "401"
    if (pathname.startsWith("/dashboard") || pathname.startsWith("/client-view")) return "/login"
    return null
  }
  if (role === "CLIENT" && pathname.startsWith("/dashboard")) return "/client-view"
  return null
}
