import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import { getRedirectTarget } from "@/lib/middleware-logic"

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl
    const role = req.nextauth.token?.role as string | undefined

    const target = getRedirectTarget(pathname, role)

    if (target === "401") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (target) {
      return NextResponse.redirect(new URL(target, req.url))
    }
  },
  {
    callbacks: {
      authorized: () => true, // We handle the authorization logic entirely within the middleware body
    },
    pages: {
      signIn: "/login",
    }
  }
)

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/client-view/:path*",
    "/api/((?!cron|auth|webhooks).*)"
  ],
}
